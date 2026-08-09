const { Router } = require('express');

module.exports = function studentRoutes(ctx) {
  const { supabase, logAction, requireStudent, validate, rateLimit, schemas } = ctx;
  const router = Router();

  const {
    signupSchema,
    accessRequestSchema,
    serviceApplicationSchema,
    pushSubscribeSchema,
    serviceIdParam
  } = schemas;

  // =====================================================================
  // Signup — rate-limited, validated. Creates the Supabase account with a
  // synthetic email (username@univault.local) + the profiles row.
  // The frontend then logs in client-side with supabase.auth.signInWithPassword.
  // =====================================================================
  router.post('/auth/signup', rateLimit.signupLimiter, validate(signupSchema), async (req, res) => {
    const { username, password } = req.body;
    const syntheticEmail = `${username}@univault.local`;

    const { data: existing } = await supabase.from('profiles').select('username').eq('username', username).maybeSingle();
    if (existing) return res.status(400).json({ error: 'That username is already taken' });

    const { data: created, error } = await supabase.auth.admin.createUser({
      email: syntheticEmail,
      password,
      email_confirm: true
    });
    if (error) {
      if (error.message && /already been registered|already registered/i.test(error.message)) {
        return res.status(400).json({ error: 'That username is already taken' });
      }
      return res.status(400).json({ error: error.message });
    }

    const { error: profileErr } = await supabase.from('profiles').insert({ id: created.user.id, username });
    if (profileErr) return res.status(400).json({ error: profileErr.message });

    await logAction(req, created.user.id, 'student', 'signup');
    res.status(201).json({ ok: true });
  });

  // =====================================================================
  // Creates a profiles row for a Google/OAuth user on demand, so no
  // student route can ever hit the access_requests_user_id_fkey / other
  // profiles FK constraint. Called automatically by every student route
  // that writes a row referencing profiles (§5)
  // =====================================================================
  async function ensureProfile(req, userId) {
    const { data: existing } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
    if (existing) return { ok: true };

    const { data: user } = await supabase.auth.admin.getUserById(userId);
    const email = (user?.user?.email || '').split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || null;
    const base = (email && email.length >= 3 && email.length <= 20) ? email : 'user';
    const rand = Math.random().toString(36).slice(2, 6);

    let username = base;
    let attempt = 0;
    while (true) {
      const { data: taken } = await supabase.from('profiles').select('username').eq('username', username).maybeSingle();
      if (!taken) break;
      attempt++;
      if (attempt > 5) return { ok: false, error: 'Could not create a unique username — contact the admin' };
      username = (base + attempt).slice(0, 20) || ('user' + attempt);
    }

    const { data: created, error } = await supabase.from('profiles').insert({
      id: userId,
      username
    }).select().single();
    if (error) return { ok: false, error: error.message };

    await logAction(req, userId, 'student', 'signup.oauth', 'profiles', created.id);
    return { ok: true };
  }

  // =====================================================================
  // Google OAuth — after a successful Google sign-in the client calls this
  // to make sure a profiles row exists (created once, username generated
  // from the Google account). (§5)
  // =====================================================================
  router.post('/auth/ensure-profile', requireStudent, rateLimit.signupLimiter, async (req, res) => {
    const userId = req.userId;

    const { data: existing } = await supabase.from('profiles').select('id, username').eq('id', userId).maybeSingle();
    if (existing) return res.json({ ok: true, username: existing.username });

    const result = await ensureProfile(req, userId);
    if (!result.ok) return res.status(400).json({ error: result.error });
    const { data: fresh } = await supabase.from('profiles').select('username').eq('id', userId).maybeSingle();
    res.status(201).json({ ok: true, username: fresh?.username });
  });

  // =====================================================================
  // Student requests access to a paid service (§13)
  // =====================================================================
  router.post('/access-requests', requireStudent, rateLimit.accessReqLimiter, validate(accessRequestSchema), async (req, res) => {
    const { service_id, payment_note, requester_name, whatsapp, email } = req.body;

    const ensured = await ensureProfile(req, req.userId);
    if (!ensured.ok) return res.status(400).json({ error: ensured.error });

    // Email is authoritative from the auth provider, never trusted from the client.
    let userEmail = email || null;
    const { data: authUser } = await supabase.auth.admin.getUserById(req.userId);
    if (authUser && authUser.user && authUser.user.email) userEmail = authUser.user.email;

    // Prevent duplicate request rows (unique constraint on user+service)
    const { data: existing } = await supabase
      .from('access_requests')
      .select('*')
      .eq('user_id', req.userId)
      .eq('service_id', service_id)
      .maybeSingle();
    if (existing) {
      return res.json({ ok: true, existing: existing.status });
    }

    const { data: created, error } = await supabase.from('access_requests').insert({
      user_id: req.userId,
      service_id,
      payment_note: payment_note || null,
      requester_name,
      whatsapp,
      email: userEmail,
      status: 'pending'
    }).select().single();
    if (error) return res.status(400).json({ error: error.message });

    await logAction(req, req.userId, 'student', 'access_request.created', 'access_requests', created.id);
    res.status(201).json({ ok: true });
  });

  // =====================================================================
  // Student fetches unlocked files (only if granted) (§14)
  // =====================================================================
  router.get('/resources/:serviceId', requireStudent, validate(serviceIdParam), async (req, res) => {
    const { serviceId } = req.params;
    const { data: grant } = await supabase
      .from('access_grants')
      .select('*')
      .eq('user_id', req.userId)
      .eq('service_id', serviceId)
      .maybeSingle();

    if (!grant) return res.status(403).json({ error: 'Not unlocked yet' });

    const { data: resources, error } = await supabase.from('resources').select('*').eq('service_id', serviceId);
    if (error) return res.status(400).json({ error: error.message });

    const signedResources = await Promise.all((resources || []).map(async (r) => {
      if (!r.storage_path) return { ...r, signed_url: null };
      const { data } = await supabase.storage.from('resource-files').createSignedUrl(r.storage_path, 60 * 10); // 10 min
      return { ...r, signed_url: data?.signedUrl || null };
    }));

    await logAction(req, req.userId, 'student', 'resource.accessed', 'services', serviceId);
    res.json(signedResources);
  });

  // =====================================================================
  // Student views a service's private page (requires login; returns meta
  // + the user's access status + breadcrumb for the owner field) (§16)
  // =====================================================================
  router.get('/services/:serviceId/view', requireStudent, validate(serviceIdParam), async (req, res) => {
    const { serviceId } = req.params;
    const { data: service, error } = await supabase
      .from('services')
      .select('id, field_id, owner_id, title, description, price, is_active, is_featured')
      .eq('id', serviceId)
      .maybeSingle();
    if (error) return res.status(400).json({ error: error.message });
    if (!service || !service.is_active) return res.status(404).json({ error: 'Service not found' });

    const { data: grant } = await supabase
      .from('access_grants')
      .select('id')
      .eq('user_id', req.userId)
      .eq('service_id', serviceId)
      .maybeSingle();

    const { data: accessRequest } = await supabase
      .from('access_requests')
      .select('status')
      .eq('user_id', req.userId)
      .eq('service_id', serviceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let field = null;
    let university = null;
    if (service.field_id) {
      const { data: f } = await supabase.from('fields').select('id, name, slug, uni_id').eq('id', service.field_id).maybeSingle();
      field = f;
      if (f && f.uni_id) {
        const { data: u } = await supabase.from('universities').select('name, slug').eq('id', f.uni_id).maybeSingle();
        university = u;
      }
    }

    let owner = null;
    if (service.owner_id) {
      const { data: o } = await supabase.from('profiles').select('username').eq('id', service.owner_id).maybeSingle();
      owner = o;
    }

    res.json({
      service: {
        id: service.id,
        title: service.title,
        description: service.description,
        price: service.price,
        is_featured: service.is_featured
      },
      granted: !!grant,
      status: grant ? 'granted' : (accessRequest ? accessRequest.status : 'none'),
      field,
      university,
      owner
    });
  });

  // =====================================================================
  // Anyone applies to offer their own service (§19)
  // =====================================================================
  router.post('/service-applications', requireStudent, rateLimit.applyLimiter, validate(serviceApplicationSchema), async (req, res) => {
    const { university_id, field_id, proposed_title, proposed_description, proposed_price } = req.body;
    const ensured = await ensureProfile(req, req.userId);
    if (!ensured.ok) return res.status(400).json({ error: ensured.error });
    const { data: created, error } = await supabase.from('service_applications').insert({
      applicant_id: req.userId,
      university_id,
      field_id,
      proposed_title,
      proposed_description,
      proposed_price,
      status: 'pending'
    }).select().single();
    if (error) return res.status(400).json({ error: error.message });

    await logAction(req, req.userId, 'student', 'service_application.created', 'service_applications', created.id);
    res.status(201).json({ ok: true });
  });

  // =====================================================================
  // Save a browser push subscription (§20)
  // =====================================================================
  router.post('/push/subscribe', requireStudent, validate(pushSubscribeSchema), async (req, res) => {
    const sub = req.body;
    const ensured = await ensureProfile(req, req.userId);
    if (!ensured.ok) return res.status(400).json({ error: ensured.error });
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: req.userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth_key: sub.keys.auth
    }, { onConflict: 'user_id,endpoint' });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true });
  });

  return router;
};
