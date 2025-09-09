const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');

const app = express();
const PORT = 3000;

// Database setup
const DB_FILE = path.join(__dirname, 'data', 'realestate.db');
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const db = new (sqlite3.verbose().Database)(DB_FILE);

// Initialize database with sample data
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

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Add sample data if empty
  db.get("SELECT COUNT(*) as count FROM listings", (err, row) => {
    if (!err && row.count === 0) {
      console.log('Adding sample listings...');
      const sampleListings = [
        {
          title: "Modern 3-Bedroom House in Northrise",
          description: "Beautiful modern house with spacious rooms, fitted kitchen, and secure parking.",
          price: 450000,
          type: "sale",
          bedrooms: 3,
          bathrooms: 2,
          city: "Ndola",
          area: "Northrise",
          address: "Plot 123, Northrise Road",
          owner_name: "John Mwamba",
          owner_phone: "+260977123456",
          latitude: -12.9584,
          longitude: 28.6369
        },
        {
          title: "Cozy 2-Bedroom Apartment for Rent",
          description: "Well-maintained apartment in a quiet neighborhood with modern fixtures.",
          price: 2500,
          type: "rent",
          bedrooms: 2,
          bathrooms: 1,
          city: "Ndola",
          area: "Kansenshi",
          address: "Flat 5B, Kansenshi Apartments",
          owner_name: "Mary Banda",
          owner_phone: "+260966789012",
          latitude: -12.9700,
          longitude: 28.6200
        },
        {
          title: "Luxury Villa with Swimming Pool",
          description: "Stunning luxury villa featuring 5 bedrooms, swimming pool, and landscaped gardens.",
          price: 850000,
          type: "sale",
          bedrooms: 5,
          bathrooms: 4,
          city: "Ndola",
          area: "Riverside",
          address: "House 23, Riverside Estate",
          owner_name: "David Phiri",
          owner_phone: "+260955456789",
          latitude: -12.9500,
          longitude: 28.6100
        }
      ];

      const stmt = db.prepare(`INSERT INTO listings (title, description, price, type, bedrooms, bathrooms, city, area, address, owner_name, owner_phone, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      
      sampleListings.forEach(listing => {
        stmt.run([
          listing.title, listing.description, listing.price, listing.type,
          listing.bedrooms, listing.bathrooms, listing.city, listing.area,
          listing.address, listing.owner_name, listing.owner_phone,
          listing.latitude, listing.longitude
        ]);
      });
      
      stmt.finalize(() => {
        console.log('Sample listings added successfully');
      });
    }
  });
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Email setup
const emailTransporter = nodemailer.createTransporter({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Auth helpers
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', site: 'Ndola Homes' });
});

app.get('/api/listings', (req, res) => {
  const { q, type, minPrice, maxPrice, bedrooms, city, limit = 20, offset = 0 } = req.query;
  
  const conditions = [];
  const params = [];
  
  if (q) {
    conditions.push('(title LIKE ? OR description LIKE ? OR area LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (type) {
    conditions.push('type = ?');
    params.push(type);
  }
  if (minPrice) {
    conditions.push('price >= ?');
    params.push(Number(minPrice));
  }
  if (maxPrice) {
    conditions.push('price <= ?');
    params.push(Number(maxPrice));
  }
  if (bedrooms) {
    conditions.push('bedrooms >= ?');
    params.push(Number(bedrooms));
  }
  if (city) {
    conditions.push('LOWER(city) = LOWER(?)');
    params.push(city);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT * FROM listings ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  
  console.log('Executing query:', sql, 'with params:', [...params, Number(limit), Number(offset)]);
  
  db.all(sql, [...params, Number(limit), Number(offset)], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    
    console.log(`Found ${rows.length} listings`);
    
    // Get total count
    db.get(`SELECT COUNT(*) as count FROM listings ${whereClause}`, params, (countErr, countRow) => {
      if (countErr) {
        console.error('Count error:', countErr);
        return res.json({ items: rows, total: rows.length });
      }
      
      res.json({ 
        items: rows.map(row => ({ ...row, media: [] })), 
        total: countRow.count 
      });
    });
  });
});

app.get('/api/listings/:id', (req, res) => {
  const id = Number(req.params.id);
  db.get('SELECT * FROM listings WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({ ...row, media: [] });
  });
});

app.post('/api/auth/register', [
  body('name').isString().isLength({min:2}),
  body('email').isEmail(),
  body('password').isString().isLength({min:6}),
  body('role').optional().isIn(['user', 'admin'])
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  
  const { name, email, password, role = 'user' } = req.body;
  const passwordHash = bcrypt.hashSync(password, 10);
  
  db.run('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', 
    [name, email, passwordHash, role], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'email_in_use' });
      return res.status(500).json({ error: 'db_error', details: err.message });
    }
    const token = jwt.sign({ id: this.lastID, name, email, role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: this.lastID, name, email, role } });
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
    if (err) return res.status(500).json({ error: 'db_error' });
    if (!user) return res.status(401).json({ error: 'invalid_credentials' });
    
    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'invalid_credentials' });
    
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  });
});

app.post('/api/contact', [
  body('name').isString().isLength({min:2}),
  body('email').isEmail(),
  body('message').isString().isLength({min:5})
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  
  const { name, email, phone, message, listingId } = req.body;
  
  // Send email if configured
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: process.env.EMAIL_TO || 'misheckmwamba99@gmail.com',
        subject: 'New Contact Form Submission - Ndola Homes',
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
          <p><strong>Message:</strong></p>
          <p>${message.replace(/\n/g, '<br>')}</p>
          ${listingId ? `<p><strong>Property ID:</strong> ${listingId}</p>` : ''}
        `,
        replyTo: email
      };
      
      await emailTransporter.sendMail(mailOptions);
      console.log('Contact email sent successfully');
    } catch (error) {
      console.error('Email error:', error.message);
    }
  }
  
  res.json({ success: true, message: 'Message sent successfully!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Database initialized and sample data loaded');
});
