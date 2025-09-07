const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const { body, validationResult, query } = require('express-validator');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server, { cors: { origin: '*'} });

const PORT = process.env.PORT || 3000;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data', 'realestate.db');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'public', 'uploads');

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new sqlite3.Database(DB_FILE);

// Email configuration
const emailTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Function to send contact email
async function sendContactEmail(contactData) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('Email credentials not configured. Skipping email send.');
    return;
  }

  const { name, email, phone, message, listingId } = contactData;
  
  let subject = 'New Contact Form Submission - Ndola Homes';
  let htmlContent = `
    <h2>New Contact Form Submission</h2>
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Email:</strong> ${email}</p>
    ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
    <p><strong>Message:</strong></p>
    <p>${message.replace(/\n/g, '<br>')}</p>
  `;

  if (listingId) {
    subject = `Property Inquiry - Ndola Homes (Listing #${listingId})`;
    htmlContent += `<p><strong>Property ID:</strong> ${listingId}</p>`;
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: process.env.EMAIL_TO || 'misheckmwamba99@gmail.com',
    subject: subject,
    html: htmlContent,
    replyTo: email
  };

  try {
    await emailTransporter.sendMail(mailOptions);
    console.log('Contact email sent successfully');
  } catch (error) {
    console.error('Error sending contact email:', error.message);
  }
}

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    price INTEGER NOT NULL,
    type TEXT NOT NULL, -- rent | sale
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
    kind TEXT NOT NULL, -- image | video
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
    role TEXT NOT NULL DEFAULT 'user', -- user | agent | admin
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Attempt to add owner/contact columns for existing databases (no-op if already present)
db.run("ALTER TABLE listings ADD COLUMN owner_name TEXT", () => {});
db.run("ALTER TABLE listings ADD COLUMN owner_email TEXT", () => {});
db.run("ALTER TABLE listings ADD COLUMN owner_phone TEXT", () => {});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(__dirname, 'public')));
// Auth helpers
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
function createToken(payload){
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
function authRequired(req, res, next){
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch(err){
    return res.status(401).json({ error: 'invalid_token' });
  }
}
function roleRequired(...roles){
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
    next();
  }
}

// Auth routes
app.post('/api/auth/register', [
  body('name').isString().isLength({min:2}),
  body('email').isEmail(),
  body('password').isString().isLength({min:6}),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { name, email, password } = req.body;
  const passwordHash = bcrypt.hashSync(password, 10);
  db.run('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', [name, email, passwordHash, 'user'], function(err){
    if (err) {
      if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'email_in_use' });
      return res.status(500).json({ error: 'db_error', details: err.message });
    }
    const token = createToken({ id: this.lastID, name, email, role: 'user' });
    res.status(201).json({ token, user: { id: this.lastID, name, email, role: 'user' } });
  });
});

app.post('/api/auth/login', [
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

// Admin registration endpoint - creates users with admin role
app.post('/api/auth/register-admin', [
  body('name').isString().isLength({min:2}),
  body('email').isEmail(),
  body('password').isString().isLength({min:6}),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { name, email, password } = req.body;
  const passwordHash = bcrypt.hashSync(password, 10);
  db.run('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', [name, email, passwordHash, 'admin'], function(err){
    if (err) {
      if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'email_in_use' });
      return res.status(500).json({ error: 'db_error', details: err.message });
    }
    const token = createToken({ id: this.lastID, name, email, role: 'admin' });
    res.status(201).json({ token, user: { id: this.lastID, name, email, role: 'admin' } });
  });
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, UPLOAD_DIR); },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage });

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', site: process.env.SITE_NAME || 'Ndola Homes' });
});

app.get(
  '/api/listings',
  [
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
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const {
      q, type, minPrice, maxPrice, bedrooms, city,
      latitude, longitude, radiusKm,
      limit = 20, offset = 0,
    } = req.query;

    const conditions = [];
    const params = [];
    if (q) { conditions.push('(title LIKE ? OR description LIKE ? OR area LIKE ? OR address LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
    if (type) { conditions.push('type = ?'); params.push(type); }
    if (minPrice) { conditions.push('price >= ?'); params.push(Number(minPrice)); }
    if (maxPrice) { conditions.push('price <= ?'); params.push(Number(maxPrice)); }
    if (bedrooms) { conditions.push('bedrooms >= ?'); params.push(Number(bedrooms)); }
    if (city) { conditions.push('LOWER(city) = LOWER(?)'); params.push(city); }
    // Simple bounding-box geofilter approximation if lat/lon provided
    if (latitude && longitude && radiusKm) {
      const lat = Number(latitude);
      const lon = Number(longitude);
      const radius = Number(radiusKm);
      const latDelta = radius / 111; // ~111 km per degree latitude
      const lonDelta = radius / (111 * Math.cos(lat * Math.PI / 180) || 1); // protect divide by zero
      const minLat = lat - latDelta;
      const maxLat = lat + latDelta;
      const minLon = lon - lonDelta;
      const maxLon = lon + lonDelta;
      conditions.push('latitude IS NOT NULL AND longitude IS NOT NULL');
      conditions.push('latitude BETWEEN ? AND ?'); params.push(minLat, maxLat);
      conditions.push('longitude BETWEEN ? AND ?'); params.push(minLon, maxLon);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM listings ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    db.all(sql, [...params, Number(limit), Number(offset)], (err, rows) => {
      if (err) return res.status(500).json({ error: 'db_error', details: err.message });
      if (!rows.length) return res.json({ items: [], total: 0 });
      const ids = rows.map(r => r.id);
      db.all(`SELECT * FROM media WHERE listing_id IN (${ids.map(() => '?').join(',')})`, ids, (mErr, media) => {
        if (mErr) return res.status(500).json({ error: 'db_error', details: mErr.message });
        const idToMedia = {};
        media.forEach(m => { if (!idToMedia[m.listing_id]) idToMedia[m.listing_id] = []; idToMedia[m.listing_id].push(m); });
        const items = rows.map(r => ({ ...r, media: idToMedia[r.id] || [] }));
        db.get(`SELECT COUNT(*) as count FROM listings ${whereClause}`, params, (cErr, countRow) => {
          if (cErr) return res.status(500).json({ error: 'db_error', details: cErr.message });
          res.json({ items, total: countRow.count });
        });
      });
    });
  }
);

app.get('/api/listings/:id', (req, res) => {
  const id = Number(req.params.id);
  db.get('SELECT * FROM listings WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: 'db_error', details: err.message });
    if (!row) return res.status(404).json({ error: 'not_found' });
    db.all('SELECT * FROM media WHERE listing_id = ?', [id], (mErr, media) => {
      if (mErr) return res.status(500).json({ error: 'db_error', details: mErr.message });
      res.json({ ...row, media });
    });
  });
});

app.post(
  '/api/contact',
  [
    body('name').isString().isLength({ min: 2 }),
    body('email').isEmail(),
    body('phone').optional().isString(),
    body('message').isString().isLength({ min: 5 }),
    body('listingId').optional().isInt({ min: 1 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { name, email, phone, message, listingId } = req.body;
    
    db.run(
      'INSERT INTO contacts (listing_id, name, email, phone, message) VALUES (?, ?, ?, ?, ?)',
      [listingId || null, name, email, phone || null, message],
      async function (err) {
        if (err) return res.status(500).json({ error: 'db_error', details: err.message });
        
        // Send email notification
        try {
          await sendContactEmail({ name, email, phone, message, listingId });
        } catch (emailError) {
          console.error('Failed to send contact email:', emailError.message);
          // Don't fail the request if email fails
        }
        
        res.status(201).json({ id: this.lastID });
      }
    );
  }
);

app.post(
  '/api/listings',
  authRequired,
  roleRequired('agent','admin'),
  upload.array('media', 10),
  [
    body('title').isString().isLength({ min: 3 }),
    body('description').isString().isLength({ min: 10 }),
    body('price').isInt({ min: 0 }),
    body('type').isIn(['rent', 'sale']),
    body('bedrooms').optional().isInt({ min: 0 }),
    body('bathrooms').optional().isInt({ min: 0 }),
    body('city').isString().isLength({ min: 2 }),
    body('area').optional().isString(),
    body('address').optional().isString(),
    body('owner_name').optional().isString(),
    body('owner_email').optional().isEmail(),
    body('owner_phone').optional().isString(),
    body('latitude').optional().isFloat({ min: -90, max: 90 }),
    body('longitude').optional().isFloat({ min: -180, max: 180 })
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { title, description, price, type, bedrooms, bathrooms, city, area, address, owner_name, owner_email, owner_phone, latitude, longitude } = req.body;
    const files = req.files || [];
    const thumbnailUrl = files.length ? ('/public/uploads/' + path.basename(files[0].path)) : null;

    db.run(
      `INSERT INTO listings (title, description, price, type, bedrooms, bathrooms, city, area, address, owner_name, owner_email, owner_phone, latitude, longitude, thumbnail_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description, Number(price), type, bedrooms || null, bathrooms || null, city, area || null, address || null, owner_name || null, owner_email || null, owner_phone || null, latitude || null, longitude || null, thumbnailUrl],
      function (err) {
        if (err) return res.status(500).json({ error: 'db_error', details: err.message });
        const listingId = this.lastID;
        const stmt = db.prepare('INSERT INTO media (listing_id, url, kind) VALUES (?, ?, ?)');
        files.forEach(f => {
          const url = '/public/uploads/' + path.basename(f.path);
          const kind = f.mimetype.startsWith('video') ? 'video' : 'image';
          stmt.run(listingId, url, kind);
        });
        stmt.finalize((finErr) => {
          if (finErr) return res.status(500).json({ error: 'db_error', details: finErr.message });
          io.emit('listing:new', { id: listingId });
          res.status(201).json({ id: listingId });
        });
      }
    );
  }
);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Simple static pages for footer links
app.get('/privacy', (req, res) => {
  res.type('html').send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Privacy Policy</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"><link href="/public/styles.css" rel="stylesheet"></head><body class="bg-white"><div class="container py-5"><h1>Privacy Policy</h1><p class="text-muted">We respect your privacy. This demo page can be customized.</p><a class="btn btn-primary" href="/">Back to Home</a></div></body></html>`);
});

app.get('/terms', (req, res) => {
  res.type('html').send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Terms of Service</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"><link href="/public/styles.css" rel="stylesheet"></head><body class="bg-white"><div class="container py-5"><h1>Terms of Service</h1><p class="text-muted">These are placeholder terms. Customize as needed.</p><a class="btn btn-primary" href="/">Back to Home</a></div></body></html>`);
});

// Return current user from Authorization header
app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});

io.on('connection', (socket) => {
  socket.emit('hello', { message: 'Connected to Ndola Homes realtime channel' });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


