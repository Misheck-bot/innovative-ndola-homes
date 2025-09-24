import 'dotenv/config';
import path from "path";
import fs from 'fs';
import express from "express";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import { body, validationResult, query } from 'express-validator';
import multer from 'multer';
import sqlite3 from 'sqlite3';
import nodemailer from 'nodemailer';
import serverless from 'serverless-http';

const app = express();
const __dirname = path.resolve();

// Note: Static files are served by Netlify, not the serverless function

// Database setup for serverless
const DB_FILE = '/tmp/realestate.db';
let db;

// Initialize database with sample data
function initDB() {
  if (!db) {
    console.log('Initializing database at:', DB_FILE);
    db = new sqlite3.verbose().Database(DB_FILE, (err) => {
      if (err) {
        console.error('Database connection error:', err);
      } else {
        console.log('Database connected successfully');
      }
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

      // Add sample data if database is empty
      db.get("SELECT COUNT(*) as count FROM listings", (err, row) => {
        console.log('Checking database count:', err, row);
        if (!err && (!row || row.count === 0)) {
          console.log('Database is empty, adding sample listings...');
          const sampleListings = [
            {
              title: "Modern 3-Bedroom House in Northrise",
              description: "Beautiful modern house with spacious rooms, fitted kitchen, and secure parking. Located in the prestigious Northrise area with easy access to schools and shopping centers.",
              price: 450000,
              type: "sale",
              bedrooms: 3,
              bathrooms: 2,
              city: "Ndola",
              area: "Northrise",
              address: "Plot 123, Northrise Road",
              owner_name: "John Mwamba",
              owner_email: "john@example.com",
              owner_phone: "+260977123456",
              latitude: -12.9584,
              longitude: 28.6369
            },
            {
              title: "Cozy 2-Bedroom Apartment for Rent",
              description: "Well-maintained apartment in a quiet neighborhood. Features include modern fixtures, ample natural light, and proximity to public transport.",
              price: 2500,
              type: "rent",
              bedrooms: 2,
              bathrooms: 1,
              city: "Ndola",
              area: "Kansenshi",
              address: "Flat 5B, Kansenshi Apartments",
              owner_name: "Mary Banda",
              owner_email: "mary@example.com",
              owner_phone: "+260966789012",
              latitude: -12.9700,
              longitude: 28.6200
            },
            {
              title: "Luxury 4-Bedroom Villa with Pool",
              description: "Stunning villa featuring 4 bedrooms, 3 bathrooms, swimming pool, and landscaped garden. Perfect for families seeking luxury living in Ndola.",
              price: 850000,
              type: "sale",
              bedrooms: 4,
              bathrooms: 3,
              city: "Ndola",
              area: "Riverside",
              address: "House 45, Riverside Estate",
              owner_name: "David Phiri",
              owner_email: "david@example.com",
              owner_phone: "+260955345678",
              latitude: -12.9500,
              longitude: 28.6500
            },
            {
              title: "Affordable 1-Bedroom Flat",
              description: "Perfect starter home or investment property. Clean, well-maintained flat in a secure building with 24/7 security.",
              price: 1800,
              type: "rent",
              bedrooms: 1,
              bathrooms: 1,
              city: "Ndola",
              area: "Masala",
              address: "Block C, Masala Flats",
              owner_name: "Grace Tembo",
              owner_email: "grace@example.com",
              owner_phone: "+260944567890",
              latitude: -12.9650,
              longitude: 28.6100
            },
            {
              title: "Family Home with Large Garden",
              description: "Spacious family home featuring large garden, garage, and modern amenities. Ideal for families with children and pets.",
              price: 320000,
              type: "sale",
              bedrooms: 3,
              bathrooms: 2,
              city: "Ndola",
              area: "Chipulukusu",
              address: "Plot 78, Chipulukusu Road",
              owner_name: "Peter Mulenga",
              owner_email: "peter@example.com",
              owner_phone: "+260933456789",
              latitude: -12.9800,
              longitude: 28.6300
            }
          ];

          const stmt = db.prepare(`INSERT INTO listings (title, description, price, type, bedrooms, bathrooms, city, area, address, owner_name, owner_email, owner_phone, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
          
          sampleListings.forEach(listing => {
            stmt.run([
              listing.title,
              listing.description,
              listing.price,
              listing.type,
              listing.bedrooms,
              listing.bathrooms,
              listing.city,
              listing.area,
              listing.address,
              listing.owner_name,
              listing.owner_email,
              listing.owner_phone,
              listing.latitude,
              listing.longitude
            ]);
          });
          
          stmt.finalize((err) => {
            if (err) {
              console.error('Error inserting sample data:', err);
            } else {
              console.log(`Successfully inserted ${sampleListings.length} sample listings`);
              // Force database to persist by running a verification query
              db.get("SELECT COUNT(*) as count FROM listings", (verifyErr, verifyRow) => {
                console.log('Verification count after insert:', verifyErr, verifyRow);
              });
            }
          });
        }
      });
    });
  }
  return db;
}

// Email configuration
let emailTransporter = null;

function getEmailTransporter() {
  if (!emailTransporter && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    emailTransporter = nodemailer.createTransporter({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }
  return emailTransporter;
}

// Function to send contact email
async function sendContactEmail(contactData) {
  // Debug environment variables
  console.log('Email config check:', {
    hasEmailUser: !!process.env.EMAIL_USER,
    hasEmailPass: !!process.env.EMAIL_PASS,
    emailHost: process.env.EMAIL_HOST || 'smtp.gmail.com',
    emailPort: process.env.EMAIL_PORT || '587'
  });

  const transporter = getEmailTransporter();
  if (!transporter) {
    console.warn('Email credentials not configured. Skipping email send.');
    return { success: false, error: 'Email credentials not configured in environment variables' };
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

  console.log('Attempting to send email with config:', {
    from: mailOptions.from,
    to: mailOptions.to,
    subject: mailOptions.subject
  });

  try {
    // Test the connection first
    await transporter.verify();
    console.log('SMTP connection verified successfully');
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Contact email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending contact email:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response
    });
    return { success: false, error: error.message, details: error.code };
  }
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Middleware to ensure DB is initialized
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Initializing database`);
  initDB();
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', site: process.env.SITE_NAME || 'Ndola Homes' });
});

// Auth routes
app.post('/auth/register', [
  body('name').isString().isLength({min:2}),
  body('email').isEmail(),
  body('password').isString().isLength({min:6}),
  body('role').optional().isIn(['user', 'admin'])
], (req, res) => {
  console.log('Registration attempt:', { name: req.body.name, email: req.body.email, role: req.body.role });
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { name, email, password, role = 'user' } = req.body;
  const passwordHash = bcrypt.hashSync(password, 10);
  
  console.log('Attempting to insert user with role:', role);
  
  db.run('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', [name, email, passwordHash, role], function(err){
    if (err) {
      console.error('Database error during registration:', err);
      if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'email_in_use' });
      return res.status(500).json({ error: 'db_error', details: err.message });
    }
    
    console.log('User registered successfully with ID:', this.lastID, 'and role:', role);
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

// Listings routes
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
  
  if (latitude && longitude && radiusKm) {
    const lat = Number(latitude);
    const lon = Number(longitude);
    const radius = Number(radiusKm);
    const latDelta = radius / 111;
    const lonDelta = radius / (111 * Math.cos(lat * Math.PI / 180) || 1);
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
  console.log('Executing search query:', sql, 'with params:', [...params, Number(limit), Number(offset)]);
  
  db.all(sql, [...params, Number(limit), Number(offset)], (err, rows) => {
    if (err) {
      console.error('Database query error:', err);
      return res.status(500).json({ error: 'db_error', details: err.message });
    }
    
    console.log(`Found ${rows ? rows.length : 0} listings`);
    
    if (!rows || !rows.length) {
      // Check if database has any data at all
      db.get('SELECT COUNT(*) as total FROM listings', (countErr, countResult) => {
        if (countErr) {
          console.error('Error checking total count:', countErr);
        } else {
          console.log(`Total listings in database: ${countResult ? countResult.total : 0}`);
        }
      });
      return res.json({ items: [], total: 0 });
    }
    
    const ids = rows.map(r => r.id);
    
    // Handle case where there are no media entries yet
    if (ids.length === 0) {
      return res.json({ items: rows.map(r => ({ ...r, media: [] })), total: rows.length });
    }
    
    db.all(`SELECT * FROM media WHERE listing_id IN (${ids.map(() => '?').join(',')})`, ids, (mErr, media) => {
      if (mErr) {
        console.error('Media query error:', mErr);
        // Continue without media if media query fails
        const items = rows.map(r => ({ ...r, media: [] }));
        return res.json({ items, total: rows.length });
      }
      
      const idToMedia = {};
      if (media) {
        media.forEach(m => { 
          if (!idToMedia[m.listing_id]) idToMedia[m.listing_id] = []; 
          idToMedia[m.listing_id].push(m); 
        });
      }
      
      const items = rows.map(r => ({ ...r, media: idToMedia[r.id] || [] }));
      
      db.get(`SELECT COUNT(*) as count FROM listings ${whereClause}`, params, (cErr, countRow) => {
        if (cErr) {
          console.error('Count query error:', cErr);
          return res.json({ items, total: items.length });
        }
        res.json({ items, total: countRow ? countRow.count : items.length });
      });
    });
  });
});

app.get('/listings/:id', (req, res) => {
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

// Contact route
app.post('/contact', [
  body('name').isString().isLength({ min: 2 }),
  body('email').isEmail(),
  body('phone').optional().isString(),
  body('message').isString().isLength({ min: 5 }),
  body('listingId').optional().isInt({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, phone, message, listingId } = req.body;

    // Send email notification
    const emailResult = await sendContactEmail({ name, email, phone, message, listingId });
    
    if (emailResult.success) {
      res.json({ success: true, message: 'Message sent successfully!' });
    } else {
      console.error('Email sending failed:', emailResult.error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to send email notification', 
        details: emailResult.error 
      });
    }
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

export const handler = serverless(app);
