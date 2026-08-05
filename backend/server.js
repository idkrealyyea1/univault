require('dotenv').config(); // loads ./backend/.env when testing locally (Render uses env vars)

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const webpush = require('web-push');
const { z } = require('zod');
const { createClient } = require('@supabase/supabase-js');

const adminRoutes = require('./routes/admin');
const studentRoutes = require('./routes/student');

const app = express();
app.use(helmet());                        // security headers (CSP, no-sniff, etc.)
app.use(morgan('combined'));               // logs every request
app.use(express.json({ limit: '100kb' })); // caps request body size
app.use(cors({ origin: process.env.ALLOWED_ORIGIN }));

// Node < 22 needs an explicit WebSocket implementation for the (unused)
// realtime client that @supabase/supabase-js initializes eagerly.
let realtimeOptions = {};
try {
  const ws = require('ws');
  realtimeOptions = { transport: ws };
} catch (e) { /* Node 22+ ships native WebSocket */ }

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // service role — server only, never exposed
  { realtime: realtimeOptions }
);

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// =====================================================================
// Shared zod schemas
// =====================================================================
const idParam = z.object({ params: z.object({ id: z.string().uuid() }) });

const signupSchema = z.object({
  body: z.object({
    username: z
      .string()
      .regex(/^[a-zA-Z0-9_]{3,20}$/, '3-20 chars: letters, numbers, underscore'),
    password: z.string().min(8, 'at least 8 characters')
  })
});

const accessRequestSchema = z.object({
  body: z.object({
    service_id: z.string().uuid(),
    payment_note: z.string().max(500).optional()
  })
});

const serviceApplicationSchema = z.object({
  body: z.object({
    university_id: z.string().uuid(),
    field_id: z.string().uuid(),
    proposed_title: z.string().min(3).max(100),
    proposed_description: z.string().max(2000).optional(),
    proposed_price: z.number().min(0).max(100000)
  })
});

const pushSubscribeSchema = z.object({
  body: z.object({
    endpoint: z.string().url(),
    keys: z.object({ p256dh: z.string(), auth: z.string() })
  })
});

const statusQuery = z.object({
  query: z.object({
    status: z.enum(['pending', 'approved', 'rejected']).optional()
  })
});

const serviceIdParam = z.object({ params: z.object({ serviceId: z.string().uuid() }) });

// =====================================================================
// Input validation middleware
// =====================================================================
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({ body: req.body, query: req.query, params: req.params });
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid request', details: result.error.flatten() });
    }
    next();
  };
}

// =====================================================================
// Audit log helper — call at every privileged or business-meaningful action
// =====================================================================
async function logAction(req, actorId, actorType, action, targetTable = null, targetId = null, metadata = {}) {
  await supabase.from('audit_log').insert({
    actor_id: actorId,
    actor_type: actorType,
    action,
    target_table: targetTable,
    target_id: targetId,
    ip_address: req.ip,
    metadata
  });
}

// =====================================================================
// Rate limiters
// =====================================================================
const adminLoginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });
const signupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5 });
const accessReqLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, keyGenerator: (req) => req.userId || req.ip });
const applyLimiter = rateLimit({ windowMs: 24 * 60 * 60 * 1000, max: 10, keyGenerator: (req) => req.userId || req.ip });

// =====================================================================
// Push notification helper
// =====================================================================
async function notifyUser(userId, title, body, url = '/') {
  const { data: subs } = await supabase.from('push_subscriptions').select('*').eq('user_id', userId);
  if (!subs) return;
  for (const s of subs) {
    const subscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } };
    try {
      await webpush.sendNotification(subscription, JSON.stringify({ title, body, url }));
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('id', s.id); // dead subscription, clean it up
      }
    }
  }
}

// =====================================================================
// Auth middleware
// =====================================================================
function requireAdmin(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'admin') throw new Error();
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// Verify a STUDENT's Supabase session token (sent from frontend)
async function requireStudent(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Unauthorized' });
  req.userId = data.user.id;
  next();
}

// =====================================================================
// Context shared with route modules
// =====================================================================
const ctx = {
  supabase,
  logAction,
  notifyUser,
  requireAdmin,
  requireStudent,
  validate,
  rateLimit: { adminLoginLimiter, signupLimiter, accessReqLimiter, applyLimiter },
  schemas: { idParam, signupSchema, accessRequestSchema, serviceApplicationSchema, pushSubscribeSchema, statusQuery, serviceIdParam }
};

app.post('/api/auth/admin-login', adminLoginLimiter, async (req, res) => {
  const { password } = req.body;
  const ok = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);
  if (!ok) {
    await logAction(req, null, 'system', 'login.failed', 'admin', null, { attempted: true });
    return res.status(401).json({ error: 'Wrong password' });
  }
  const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '12h' });
  await logAction(req, null, 'admin', 'login.success');
  res.json({ token });
});

app.use('/api/admin', adminRoutes(ctx));
app.use('/api', studentRoutes(ctx));

// =====================================================================
// Centralized error handler — last middleware. Never leak internals.
// =====================================================================
app.use((err, req, res, next) => {
  console.error(err); // full detail stays server-side (Render log stream)
  if (err.type === 'entity.parse.failed' || err.status === 400) {
    return res.status(400).json({ error: 'Invalid request' });
  }
  if (err.name === 'MulterError') {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File too large' : err.message;
    return res.status(400).json({ error: message });
  }
  if (err.status === 400 && err.clientMessage) {
    return res.status(400).json({ error: err.clientMessage });
  }
  res.status(500).json({ error: 'Something went wrong' });
});

app.listen(process.env.PORT || 3000, () => {
  console.log('UniVault API listening on port', process.env.PORT || 3000);
});

// Explicitly listed for clarity in the spec even though unused by the
// handler above (multer errors arrive through the error middleware).
module.exports = app;
