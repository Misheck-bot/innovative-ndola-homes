// Vercel serverless API for Ndola Homes
// Uses Express wrapped by serverless-http. This mirrors the Netlify function logic.

const serverless = require('serverless-http');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const { body, validationResult, query } = require('express-validator');
const multer = require('multer');
const sqlite3 = require('sqlite3');
const nodemailer = require('nodemailer');

// Load env in local dev; on Vercel, env vars are provided by the platform
require('dotenv').config();

const app = express();

// Vercel lambda writable path
const DB_FILE = '/tmp/realestate.db';
let db;

function initDB() {
  if (db) return db;
  db = new sqlite3.verbose().Database(DB_FILE, (err) => {
    if (err) console.error('DB connect error:', err.message);
  });

  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      price INTEGER NOT NULL,
      type TEXT NOT NULL,
      bedrooms INTEGER,
      bathrooms INTEGER,
      city TEXT NOT NULL,
      area TEXT,
      address TEXT,
      owner_name TEXT,
      owner_email TEXT,
      owner_phone TEXT,
      latitude REAL,
      longitude REAL,
      thumbnail_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      kind TEXT NOT NULL,
      FOREIGN KEY(listing_id) REFERENCES listings(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id INTEGER,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Seed sample data if empty
    db.get('SELECT COUNT(*) as count FROM listings', (err, row) => {
      if (!err && (!row || row.count === 0)) {
        const sampleListings = [
          {
            title: 'Modern 3-Bedroom House in Northrise',
            description: 'Beautiful modern house with spacious rooms, fitted kitchen, and secure parking. Located in the prestigious Northrise area with easy access to schools and shopping centers.',
            price: 450000,
            type: 'sale',
            bedrooms: 3,
            bathrooms: 2,
            city: 'Ndola',
            area: 'Northrise',
            address: 'Plot 123, Northrise Road',
            owner_name: 'John Mwamba',
            owner_email: 'john@example.com',
            owner_phone: '+260977123456',
            latitude: -12.9584,
            longitude: 28.6369
          },
          {
            title: 'Cozy 2-Bedroom Apartment for Rent',
            description: 'Well-maintained apartment in a quiet neighborhood. Features include modern fixtures, ample natural light, and proximity to public transport.',
            price: 2500,
            type: 'rent',
            bedrooms: 2,
            bathrooms: 1,
            city: 'Ndola',
            area: 'Kansenshi',
            address: 'Flat 5B, Kansenshi Apartments',
            owner_name: 'Mary Banda',
            owner_email: 'mary@example.com',
            owner_phone: '+260966789012',
            latitude: -12.9700,
            longitude: 28.6200
          }
        ];
        const stmt = db.prepare(`INSERT INTO listings (title, description, price, type, bedrooms, bathrooms, city, area, address, owner_name, owner_email, owner_phone, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        sampleListings.forEach(l => {
          stmt.run([l.title, l.description, l.price, l.type, l.bedrooms, l.bathrooms, l.city, l.area, l.address, l.owner_name, l.owner_email, l.owner_phone, l.latitude, l.longitude]);
        });
        stmt.finalize();
      }
    });
  });

  return db;
}

// Email (optional)
let emailTransporter;
function getEmailTransporter() {
  if (!emailTransporter && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    emailTransporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
  }
  return emailTransporter;
}

async function sendContactEmail({ name, email, phone, message, listingId }) {
  const transporter = getEmailTransporter();
  if (!transporter) return { success: false, error: 'Email not configured' };
  const subject = listingId ? `Property Inquiry - Ndola Homes (Listing #${listingId})` : 'New Contact Form Submission - Ndola Homes';
  const html = `
    <h2>New Contact Form Submission</h2>
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Email:</strong> ${email}</p>
    ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
    <p><strong>Message:</strong></p>
    <p>${String(message || '').replace(/\n/g, '<br>')}</p>
    ${listingId ? `<p><strong>Property ID:</strong> ${listingId}</p>` : ''}
  `;
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: process.env.EMAIL_TO || 'misheckmwamba99@gmail.com',
      subject,
      html,
      replyTo: email
    });
    return { success: true, id: info.messageId };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure DB is ready per request in serverless
app.use((req, res, next) => { initDB(); next(); });

// Auth helpers
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch(err) {
    return res.status(401).json({ error: 'invalid_token' });
  }
}
function roleRequired(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
    next();
  }
}

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'ok', site: process.env.SITE_NAME || 'Ndola Homes' });
});

// Auth routes
app.post('/auth/register', [
  body('name').isString().isLength({min:2}),
  body('email').isEmail(),
  body('password').isString().isLength({min:6}),
  body('role').optional().isIn(['user','agent','admin'])
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { name, email, password, role = 'user' } = req.body;
  const passwordHash = bcrypt.hashSync(password, 10);
  db.run('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', [name, email, passwordHash, role], function(err){
    if (err) {
      if (String(err.message).includes('UNIQUE')) return res.status(409).json({ error: 'email_in_use' });
      return res.status(500).json({ error: 'db_error', details: err.message });
    }
    const token = createToken({ id: this.lastID, name, email, role });
    res.status(201).json({ token, user: { id: this.lastID, name, email, role } });
  });
});

app.post('/auth/login', [
  body('email').isEmail(),
  body('password').isString().isLength({min:6}),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) return res.status(500).json({ error: 'db_error', details: err.message });
    if (!user) return res.status(401).json({ error: 'invalid_credentials' });
    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'invalid_credentials' });
    const token = createToken({ id: user.id, name: user.name, email: user.email, role: user.role });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  });
});

// Listings search
app.get('/listings', [
  query('q').optional().isString(),
  query('type').optional().isIn(['rent', 'sale']),
  query('minPrice').optional().isInt({ min: 0 }),
  query('maxPrice').optional().isInt({ min: 0 }),
  query('bedrooms').optional().isInt({ min: 0 }),
  query('city').optional().isString(),
  query('latitude').optional().isFloat({ min: -90, max: 90 }),
  query('longitude').optional().isFloat({ min: -180, max: 180 }),
  query('radiusKm').optional().isFloat({ min: 0.5, max: 500 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { q, type, minPrice, maxPrice, bedrooms, city, latitude, longitude, radiusKm, limit = 20, offset = 0 } = req.query;
  const conditions = [];
  const params = [];
  if (q) { conditions.push('(title LIKE ? OR description LIKE ? OR area LIKE ? OR address LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
  if (type) { conditions.push('type = ?'); params.push(type); }
  if (minPrice) { conditions.push('price >= ?'); params.push(Number(minPrice)); }
  if (maxPrice) { conditions.push('price <= ?'); params.push(Number(maxPrice)); }
  if (bedrooms) { conditions.push('bedrooms >= ?'); params.push(Number(bedrooms)); }
  if (city) { conditions.push('LOWER(city) = LOWER(?)'); params.push(city); }
  if (latitude && longitude && radiusKm) {
    const lat = Number(latitude), lon = Number(longitude), radius = Number(radiusKm);
    const latDelta = radius / 111;
    const lonDelta = radius / (111 * Math.cos(lat * Math.PI / 180) || 1);
    const minLat = lat - latDelta, maxLat = lat + latDelta;
    const minLon = lon - lonDelta, maxLon = lon + lonDelta;
    conditions.push('latitude IS NOT NULL AND longitude IS NOT NULL');
    conditions.push('latitude BETWEEN ? AND ?'); params.push(minLat, maxLat);
    conditions.push('longitude BETWEEN ? AND ?'); params.push(minLon, maxLon);
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT * FROM listings ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  db.all(sql, [...params, Number(limit), Number(offset)], (err, rows = []) => {
    if (err) return res.status(500).json({ error: 'db_error', details: err.message });
    if (!rows.length) return res.json({ items: [], total: 0 });
    const ids = rows.map(r => r.id);
    db.all(`SELECT * FROM media WHERE listing_id IN (${ids.map(() => '?').join(',')})`, ids, (mErr, media = []) => {
      if (mErr) return res.status(500).json({ error: 'db_error', details: mErr.message });
      const idToMedia = {};
      media.forEach(m => { (idToMedia[m.listing_id] ||= []).push(m); });
      const items = rows.map(r => ({ ...r, media: idToMedia[r.id] || [] }));
      db.get(`SELECT COUNT(*) as count FROM listings ${whereClause}`, params, (cErr, countRow) => {
        if (cErr) return res.json({ items, total: items.length });
        res.json({ items, total: countRow.count });
      });
    });
  });
});

app.get('/listings/:id', (req, res) => {
  const id = Number(req.params.id);
  db.get('SELECT * FROM listings WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: 'db_error', details: err.message });
    if (!row) return res.status(404).json({ error: 'not_found' });
    db.all('SELECT * FROM media WHERE listing_id = ?', [id], (mErr, media = []) => {
      if (mErr) return res.status(500).json({ error: 'db_error', details: mErr.message });
      res.json({ ...row, media });
    });
  });
});

// Contact
app.post('/contact', [
  body('name').isString().isLength({ min: 2 }),
  body('email').isEmail(),
  body('phone').optional().isString(),
  body('message').isString().isLength({ min: 5 }),
  body('listingId').optional().isInt({ min: 1 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  const { name, email, phone, message, listingId } = req.body;
  const result = await sendContactEmail({ name, email, phone, message, listingId });
  if (result.success) return res.json({ success: true, message: 'Message sent successfully!' });
  return res.status(500).json({ success: false, error: 'Failed to send email', details: result.error });
});

module.exports = (req, res) => {
  const handler = serverless(app);
  return handler(req, res);
};
