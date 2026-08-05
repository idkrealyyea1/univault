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
  // Student requests access to a paid service (§13)
  // =====================================================================
  router.post('/access-requests', requireStudent, rateLimit.accessReqLimiter, validate(accessRequestSchema), async (req, res) => {
    const { service_id, payment_note } = req.body;

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
  // Anyone applies to offer their own service (§19)
  // =====================================================================
  router.post('/service-applications', requireStudent, rateLimit.applyLimiter, validate(serviceApplicationSchema), async (req, res) => {
    const { university_id, field_id, proposed_title, proposed_description, proposed_price } = req.body;
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
