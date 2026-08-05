const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const { z } = require('zod');
const { Router } = express;

// Allowed file types for resource uploads (§21.5)
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp'
]);

const MAX_SIZE = 25 * 1024 * 1024; // 25MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: 1 },
  fileFilter(req, file, cb) {
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      const err = new Error('File type not allowed');
      err.status = 400;
      err.clientMessage = 'File type not allowed. Use PDF, DOCX, PPTX, XLSX, ZIP or images.';
      return cb(err);
    }
    cb(null, true);
  }
});

module.exports = function adminRoutes(ctx) {
  const { supabase, logAction, requireAdmin, validate, schemas } = ctx;
  const router = Router();
  router.use(requireAdmin);

  const { idParam, statusQuery } = schemas;

  // =====================================================================
  // Dashboard summary
  // =====================================================================
  router.get('/summary', async (req, res) => {
    const unis = await supabase.from('universities').select('id', { count: 'exact', head: true });
    const fields = await supabase.from('fields').select('id', { count: 'exact', head: true });
    const services = await supabase.from('services').select('id', { count: 'exact', head: true });
    const users = await supabase.from('profiles').select('id', { count: 'exact', head: true });
    const requests = await supabase.from('access_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending');
    const applications = await supabase.from('service_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending');

    res.json({
      universities: unis.count || 0,
      fields: fields.count || 0,
      services: services.count || 0,
      users: users.count || 0,
      pendingAccessRequests: requests.count || 0,
      pendingServiceApplications: applications.count || 0
    });
  });

  // =====================================================================
  // Universities CRUD
  // =====================================================================
  const universitySchema = {
    body: z.object({
      name: z.string().min(1).max(200),
      slug: z.string().regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers, hyphens'),
      type: z.string().min(1).max(100),
      description: z.string().max(2000).optional(),
      logo_url: z.string().url().max(500).optional().or(z.literal(''))
    })
  };

  router.get('/universities', async (req, res) => {
    const { data, error } = await supabase.from('universities').select('*').order('name');
    if (error) return res.status(400).json({ error: error.message });
    res.json(data || []);
  });

  router.post('/universities', validate(universitySchema), async (req, res) => {
    const { name, slug, type, description, logo_url } = req.body;
    const { data, error } = await supabase.from('universities').insert({ name, slug, type, description, logo_url }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    await logAction(req, null, 'admin', 'university.created', 'universities', data.id);
    res.status(201).json(data);
  });

  router.put('/universities/:id', validate({ ...universitySchema, params: z.object({ id: z.string().uuid() }) }), async (req, res) => {
    const { id } = req.params;
    const { name, slug, type, description, logo_url } = req.body;
    const { data, error } = await supabase.from('universities').update({ name, slug, type, description, logo_url }).eq('id', id).select().single();
    if (error) return res.status(400).json({ error: error.message });
    await logAction(req, null, 'admin', 'university.updated', 'universities', id);
    res.json(data);
  });

  router.delete('/universities/:id', validate(idParam), async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('universities').delete().eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    await logAction(req, null, 'admin', 'university.deleted', 'universities', id);
    res.json({ ok: true });
  });

  // =====================================================================
  // Fields CRUD
  // =====================================================================
  const fieldSchema = {
    body: z.object({
      university_id: z.string().uuid(),
      name: z.string().min(1).max(200),
      slug: z.string().regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers, hyphens'),
      theme: z.enum(['default', 'cyber']).default('default'),
      description: z.string().max(2000).optional()
    })
  };

  router.get('/fields', async (req, res) => {
    const { data, error } = await supabase.from('fields').select('*').order('name');
    if (error) return res.status(400).json({ error: error.message });
    res.json(data || []);
  });

  router.post('/fields', validate(fieldSchema), async (req, res) => {
    const { university_id, name, slug, theme, description } = req.body;
    const { data, error } = await supabase.from('fields').insert({ university_id, name, slug, theme, description }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    await logAction(req, null, 'admin', 'field.created', 'fields', data.id);
    res.status(201).json(data);
  });

  router.put('/fields/:id', validate({ ...fieldSchema, params: z.object({ id: z.string().uuid() }) }), async (req, res) => {
    const { id } = req.params;
    const { university_id, name, slug, theme, description } = req.body;
    const { data, error } = await supabase.from('fields').update({ university_id, name, slug, theme, description }).eq('id', id).select().single();
    if (error) return res.status(400).json({ error: error.message });
    await logAction(req, null, 'admin', 'field.updated', 'fields', id);
    res.json(data);
  });

  router.delete('/fields/:id', validate(idParam), async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('fields').delete().eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    await logAction(req, null, 'admin', 'field.deleted', 'fields', id);
    res.json({ ok: true });
  });

  // =====================================================================
  // Services CRUD
  // =====================================================================
  const serviceSchema = {
    body: z.object({
      field_id: z.string().uuid(),
      owner_id: z.string().uuid().nullable().optional(),
      title: z.string().min(1).max(200),
      description: z.string().max(2000).optional(),
      price: z.number().min(0).max(100000),
      is_active: z.boolean().optional()
    })
  };

  router.get('/services', async (req, res) => {
    const { data, error } = await supabase.from('services').select('*').order('created_at', { ascending: false });
    if (error) return res.status(400).json({ error: error.message });
    res.json(data || []);
  });

  router.post('/services', validate(serviceSchema), async (req, res) => {
    const { field_id, owner_id, title, description, price, is_active } = req.body;
    const { data, error } = await supabase.from('services').insert({ field_id, owner_id: owner_id || null, title, description, price, is_active: is_active ?? true }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    await logAction(req, null, 'admin', 'service.created', 'services', data.id);
    res.status(201).json(data);
  });

  router.put('/services/:id', validate({ ...serviceSchema, params: z.object({ id: z.string().uuid() }) }), async (req, res) => {
    const { id } = req.params;
    const { field_id, owner_id, title, description, price, is_active } = req.body;
    const { data, error } = await supabase.from('services').update({ field_id, owner_id: owner_id || null, title, description, price, is_active }).eq('id', id).select().single();
    if (error) return res.status(400).json({ error: error.message });
    await logAction(req, null, 'admin', 'service.updated', 'services', id);
    res.json(data);
  });

  router.delete('/services/:id', validate(idParam), async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    await logAction(req, null, 'admin', 'service.deleted', 'services', id);
    res.json({ ok: true });
  });

  // =====================================================================
  // Resources — attach files/links to a service (§14, §21.5)
  // =====================================================================
  router.get('/resources', validate({ query: z.object({ service_id: z.string().uuid() }) }), async (req, res) => {
    const { service_id } = req.query;
    const { data, error } = await supabase.from('resources').select('*').eq('service_id', service_id).order('created_at');
    if (error) return res.status(400).json({ error: error.message });
    res.json(data || []);
  });

  // Multipart: file OR external_link. file uses multer memoryStorage.
  router.post('/resources', upload.single('file'), async (req, res) => {
    const { service_id, title, external_link } = req.body;
    const parsed = z.object({
      service_id: z.string().uuid(),
      title: z.string().min(1).max(200),
      external_link: z.string().url().max(2000).optional().or(z.literal(''))
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });

    const { service_id: sid, title: t, external_link: link } = parsed.data;

    if (!req.file && !link) {
      return res.status(400).json({ error: 'Provide a file or an external link' });
    }

    let storage_path = null;
    let file_type = null;

    if (req.file) {
      const ext = (req.file.originalname.match(/\.([a-z0-9]+)$/i) || [])[1] || 'bin';
      const path = `uploads/${crypto.randomUUID()}.${ext}`; // generated name, never client-supplied
      const { error: upErr } = await supabase.storage.from('resource-files').upload(path, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });
      if (upErr) return res.status(400).json({ error: 'Upload failed: ' + upErr.message });
      storage_path = path;
      file_type = req.file.mimetype;
    }

    const { data, error } = await supabase.from('resources').insert({
      service_id: sid,
      title: t,
      storage_path,
      external_link: link || null,
      file_type
    }).select().single();
    if (error) return res.status(400).json({ error: error.message });

    await logAction(req, null, 'admin', 'resource.created', 'resources', data.id, { storage_path });
    res.status(201).json(data);
  });

  router.delete('/resources/:id', validate(idParam), async (req, res) => {
    const { id } = req.params;
    const { data: row } = await supabase.from('resources').select('*').eq('id', id).single();
    if (row?.storage_path) {
      await supabase.storage.from('resource-files').remove([row.storage_path]);
    }
    const { error } = await supabase.from('resources').delete().eq('id', id);
    if (error) return res.status(400).json({ error: error.message });
    await logAction(req, null, 'admin', 'resource.deleted', 'resources', id);
    res.json({ ok: true });
  });

  // =====================================================================
  // Access requests queue (§13)
  // =====================================================================
  router.get('/access-requests', validate(statusQuery), async (req, res) => {
    let query = supabase.from('access_requests').select('*, profiles!access_requests_user_id_fkey(username), services(title)');
    if (req.query.status) query = query.eq('status', req.query.status);
    const { data, error } = await query.order('requested_at', { ascending: false });
    if (error) return res.status(400).json({ error: error.message });
    res.json(data || []);
  });

  router.post('/access-requests/:id/approve', validate(idParam), async (req, res) => {
    const { id } = req.params;
    const { data: reqRow } = await supabase.from('access_requests').select('*').eq('id', id).single();
    if (!reqRow) return res.status(404).json({ error: 'Not found' });

    const { error: grantErr } = await supabase.from('access_grants').insert({
      user_id: reqRow.user_id,
      service_id: reqRow.service_id
    });
    if (grantErr && grantErr.code !== '23505') return res.status(400).json({ error: grantErr.message });

    await supabase.from('access_requests').update({ status: 'approved', resolved_at: new Date() }).eq('id', id);
    await notifyUser(reqRow.user_id, 'Access approved ✅', 'Your payment was confirmed — the resource is unlocked now.');
    await logAction(req, reqRow.user_id, 'admin', 'access_request.approved', 'access_requests', id);
    res.json({ ok: true });
  });

  router.post('/access-requests/:id/reject', validate(idParam), async (req, res) => {
    const { id } = req.params;
    const { data: reqRow } = await supabase.from('access_requests').select('*').eq('id', id).single();
    if (!reqRow) return res.status(404).json({ error: 'Not found' });

    await supabase.from('access_requests').update({ status: 'rejected', resolved_at: new Date() }).eq('id', id);
    await logAction(req, reqRow.user_id, 'admin', 'access_request.rejected', 'access_requests', id);
    res.json({ ok: true });
  });

  // =====================================================================
  // Service applications queue (§19)
  // =====================================================================
  router.get('/service-applications', validate(statusQuery), async (req, res) => {
    let query = supabase.from('service_applications').select('*, profiles!service_applications_applicant_id_fkey(username), universities(name), fields(name)');
    if (req.query.status) query = query.eq('status', req.query.status);
    const { data, error } = await query.order('submitted_at', { ascending: false });
    if (error) return res.status(400).json({ error: error.message });
    res.json(data || []);
  });

  router.post('/service-applications/:id/approve', validate(idParam), async (req, res) => {
    const { id } = req.params;
    const { data: appRow } = await supabase.from('service_applications').select('*').eq('id', id).single();
    if (!appRow) return res.status(404).json({ error: 'Not found' });

    await supabase.from('services').insert({
      field_id: appRow.field_id,
      owner_id: appRow.applicant_id,
      title: appRow.proposed_title,
      description: appRow.proposed_description,
      price: appRow.proposed_price,
      is_active: true
    });
    await supabase.from('service_applications').update({ status: 'approved', resolved_at: new Date() }).eq('id', id);
    await notifyUser(appRow.applicant_id, 'Application approved ✅', `"${appRow.proposed_title}" is now live.`);
    await logAction(req, appRow.applicant_id, 'admin', 'service_application.approved', 'service_applications', id);
    res.json({ ok: true });
  });

  router.post('/service-applications/:id/reject', validate(idParam), async (req, res) => {
    const { id } = req.params;
    const { admin_notes } = req.body || {};
    const { data: appRow } = await supabase.from('service_applications').select('*').eq('id', id).single();
    if (!appRow) return res.status(404).json({ error: 'Not found' });

    await supabase.from('service_applications')
      .update({ status: 'rejected', resolved_at: new Date(), admin_notes: admin_notes ? String(admin_notes).slice(0, 2000) : null })
      .eq('id', id);
    await logAction(req, appRow.applicant_id, 'admin', 'service_application.rejected', 'service_applications', id, { admin_notes });
    res.json({ ok: true });
  });

  // =====================================================================
  // Users list
  // =====================================================================
  router.get('/users', async (req, res) => {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) return res.status(400).json({ error: error.message });
    res.json(data || []);
  });

  // =====================================================================
  // Audit log (§22.3 — admin-only read)
  // =====================================================================
  router.get('/audit-log', validate({ query: z.object({ limit: z.coerce.number().min(1).max(500).optional() }) }), async (req, res) => {
    const limit = req.query.limit || 200;
    const { data, error } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) return res.status(400).json({ error: error.message });
    res.json(data || []);
  });

  return router;
};
