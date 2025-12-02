// Minimal JWT + bcrypt auth server for development
// - Stores users in server/data/users.json (or MongoDB if configured)
// - Issues HttpOnly JWT cookies on login
// - Intended for local use behind Vite proxy

const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me-now';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me-now';
const ACCESS_TOKEN_EXPIRES = '15m';
const REFRESH_TOKEN_EXPIRES = '7d';
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 12);

const { findUserByEmail, findUserById, createUser } = require('./mongo.cjs');

function validateEmail(email) {
  return /[^\s@]+@[^\s@]+\.[^\s@]+/.test(String(email));
}

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.VITE_APP_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10kb' })); // Limit body size
app.use(cookieParser());

// Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per windowMs
  message: { ok: false, error: 'Too many login attempts, please try again later.' }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

app.use('/api/auth/', authLimiter);
app.use('/api/', apiLimiter);

// Helpers
function issueTokens(res, payload) {
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES });

  // Access Token Cookie (Short-lived)
  res.cookie('auth_token', accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 15 * 60 * 1000, // 15 mins
  });

  // Refresh Token Cookie (Long-lived)
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/auth/refresh', // Restricted path
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

function clearCookies(res) {
  res.cookie('auth_token', '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
  res.cookie('refresh_token', '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/api/auth/refresh', maxAge: 0 });
}

function authMiddleware(req, res, next) {
  const token = req.cookies?.auth_token;
  if (!token) return res.status(401).json({ ok: false, error: 'Not authenticated' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: 'Invalid or expired token' });
  }
}

// Routes
app.get('/api/health', async (req, res) => {
  try {
    const col = await require('./mongo').connectMongo();
    const users = await col.countDocuments();
    res.json({ ok: true, service: 'auth', users });
  } catch (e) {
    res.json({ ok: false, error: 'DB connection failed' });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ ok: false, error: 'Email and password are required' });
    if (!validateEmail(email)) return res.status(400).json({ ok: false, error: 'Invalid email format' });
    if (String(password).length < 8) return res.status(400).json({ ok: false, error: 'Password must be at least 8 characters' });
    if (await findUserByEmail(email)) return res.status(409).json({ ok: false, error: 'An account with this email already exists.' });

    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hash = await bcrypt.hash(password, salt);
    const id = 'u_' + Math.random().toString(36).slice(2);
    await createUser({ id, email, passwordHash: hash });

    // Auto-login after signup
    issueTokens(res, { sub: id, email });
    return res.json({ ok: true, id });
  } catch (e) {
    console.error('signup error', e);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ ok: false, error: 'Email and password are required' });
    const user = await findUserByEmail(email);
    if (!user) return res.status(401).json({ ok: false, error: 'Invalid email or password.' });
    const ok = await bcrypt.compare(String(password), String(user.passwordHash));
    if (!ok) return res.status(401).json({ ok: false, error: 'Invalid email or password.' });

    issueTokens(res, { sub: user.id, email: user.email });
    return res.json({ ok: true, user: { id: user.id, email: user.email } });
  } catch (e) {
    console.error('login error', e);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  clearCookies(res);
  return res.json({ ok: true });
});

app.post('/api/auth/refresh', (req, res) => {
  const refreshToken = req.cookies?.refresh_token;
  if (!refreshToken) return res.status(401).json({ ok: false, error: 'No refresh token' });

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    // In a real app, verify user still exists and token version matches
    const payload = { sub: decoded.sub, email: decoded.email };
    issueTokens(res, payload);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(403).json({ ok: false, error: 'Invalid refresh token' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const id = req.user?.sub;
  const user = await findUserById(id);
  if (!user) return res.status(401).json({ ok: false, error: 'Not authenticated' });
  return res.json({ ok: true, id: user.id, email: user.email });
});

app.listen(PORT, () => {
  console.log(`[auth-server] listening on http://127.0.0.1:${PORT}`);
});
