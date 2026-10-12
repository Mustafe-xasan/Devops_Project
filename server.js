const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Respect proxy headers when deployed behind a reverse proxy / load balancer
app.set('trust proxy', 1);

// ---------- Database setup ----------
const db = new Database(path.join(__dirname, 'database.sqlite'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    guests INTEGER NOT NULL,
    requests TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ---------- Middleware ----------
app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Validation helpers ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const GUESTS_MIN = 1;
const GUESTS_MAX = 20;

function cleanText(value, maxLen) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLen) return null;
  return trimmed;
}

function validateEmail(raw) {
  const email = cleanText(raw, 254);
  if (!email || !EMAIL_RE.test(email)) return null;
  return email.toLowerCase();
}

function validateGuests(raw) {
  const guests = Number(raw);
  if (!Number.isInteger(guests) || guests < GUESTS_MIN || guests > GUESTS_MAX) return null;
  return guests;
}

function validateDate(raw) {
  const date = cleanText(raw, 10);
  if (!date || !DATE_RE.test(date)) return null;
  // Reject dates that don't exist (e.g. 2026-02-31) and past dates
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (parsed < today) return null;
  return date;
}

function validateTime(raw) {
  const time = cleanText(raw, 5);
  if (!time || !TIME_RE.test(time)) return null;
  return time;
}

// ---------- API: Newsletter ----------
app.post('/api/newsletter', (req, res) => {
  const email = validateEmail(req.body && req.body.email);

  if (!email) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  try {
    const stmt = db.prepare('INSERT OR IGNORE INTO subscribers (email) VALUES (?)');
    const info = stmt.run(email);

    if (info.changes === 0) {
      return res.status(200).json({ message: 'You are already subscribed!' });
    }

    res.status(201).json({ message: 'Thanks for subscribing!' });
  } catch (err) {
    console.error('newsletter error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ---------- API: Reservations ----------
app.post('/api/reservations', (req, res) => {
  const body = req.body || {};

  const name = cleanText(body.name, 100);
  const email = validateEmail(body.email);
  const date = validateDate(body.date);
  const time = validateTime(body.time);
  const guests = validateGuests(body.guests);
  const phone = cleanText(body.phone, 30); // optional
  const requests = cleanText(body.requests, 500); // optional

  if (!name || !email || !date || !time || guests === null) {
    return res.status(400).json({
      error: 'Please fill in all required fields with valid values (name, email, date, time, guests 1–20).',
    });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO reservations (name, email, phone, date, time, guests, requests)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      name,
      email,
      phone,
      date,
      time,
      guests,
      requests
    );

    res.status(201).json({
      message: 'Reservation confirmed! We will contact you shortly.',
      reservationId: Number(info.lastInsertRowid),
    });
  } catch (err) {
    console.error('reservation error:', err);
    res.status(500).json({ error: 'Could not save reservation. Please try again.' });
  }
});

// ---------- Simple admin dashboard ----------
// Protects the dashboard pages/APIs with a shared passcode.
// Override it with the ADMIN_TOKEN environment variable for anything non-local.
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin123';

function requireAdmin(req, res, next) {
  const provided = req.get('x-admin-token');
  if (provided && provided === ADMIN_TOKEN) return next();
  return res.status(401).json({ error: 'Invalid passcode.' });
}

const todayStr = () => new Date().toISOString().slice(0, 10);

// Serve the dashboard page at a friendly URL.
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Summary numbers for the dashboard cards.
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  try {
    const totalReservations = db.prepare('SELECT COUNT(*) AS c FROM reservations').get().c;
    const totalGuests = db.prepare('SELECT COALESCE(SUM(guests), 0) AS c FROM reservations').get().c;
    const upcoming = db
      .prepare('SELECT COUNT(*) AS c FROM reservations WHERE date >= ?')
      .get(todayStr()).c;
    const totalSubscribers = db.prepare('SELECT COUNT(*) AS c FROM subscribers').get().c;

    res.json({ totalReservations, totalGuests, upcoming, totalSubscribers });
  } catch (err) {
    console.error('admin stats error:', err);
    res.status(500).json({ error: 'Could not load dashboard stats.' });
  }
});

// Recent reservations.
app.get('/api/admin/reservations', requireAdmin, (req, res) => {
  try {
    const rows = db
      .prepare('SELECT * FROM reservations ORDER BY date ASC, time ASC, id ASC')
      .all();
    res.json({ reservations: rows });
  } catch (err) {
    console.error('admin reservations error:', err);
    res.status(500).json({ error: 'Could not load reservations.' });
  }
});

// Newsletter subscribers.
app.get('/api/admin/subscribers', requireAdmin, (req, res) => {
  try {
    const rows = db
      .prepare('SELECT * FROM subscribers ORDER BY created_at DESC, id DESC')
      .all();
    res.json({ subscribers: rows });
  } catch (err) {
    console.error('admin subscribers error:', err);
    res.status(500).json({ error: 'Could not load subscribers.' });
  }
});

// ---------- 404: unknown routes (JSON for API, plain for the rest) ----------
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found.' });
  }
  res.status(404).send('Not found');
});

// ---------- Central error handler (catches bad JSON bodies etc.) ----------
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body.' });
  }
  console.error('unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

// ---------- Start ----------
const server = app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other process or set a different PORT.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

// ---------- Graceful shutdown ----------
function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  // Force-exit if close hangs
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = app;
