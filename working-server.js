const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// In-memory database for testing
let listings = [
  {
    id: 1,
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
    owner_phone: "+260977123456",
    latitude: -12.9584,
    longitude: 28.6369,
    created_at: new Date().toISOString()
  },
  {
    id: 2,
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
    owner_phone: "+260966789012",
    latitude: -12.9700,
    longitude: 28.6200,
    created_at: new Date().toISOString()
  },
  {
    id: 3,
    title: "Luxury Villa with Swimming Pool",
    description: "Stunning luxury villa featuring 5 bedrooms, swimming pool, landscaped gardens, and staff quarters. Premium location with excellent security.",
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
    longitude: 28.6100,
    created_at: new Date().toISOString()
  },
  {
    id: 4,
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
    owner_phone: "+260933456789",
    latitude: -12.9800,
    longitude: 28.6300,
    created_at: new Date().toISOString()
  },
  {
    id: 5,
    title: "Studio Apartment - City Center",
    description: "Compact studio apartment in the heart of Ndola. Perfect for students or single professionals. Walking distance to shops and offices.",
    price: 1500,
    type: "rent",
    bedrooms: 1,
    bathrooms: 1,
    city: "Ndola",
    area: "City Center",
    address: "Flat 8C, Central Plaza",
    owner_name: "Grace Tembo",
    owner_phone: "+260944567890",
    latitude: -12.9650,
    longitude: 28.6350,
    created_at: new Date().toISOString()
  }
];

let users = [];
let nextUserId = 1;
let nextListingId = 6;

// Email setup
const emailTransporter = nodemailer.createTransport({
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
  res.json({ status: 'ok', site: 'Ndola Homes', listings: listings.length });
});

app.get('/api/listings', (req, res) => {
  const { q, type, minPrice, maxPrice, bedrooms, city, limit = 20, offset = 0 } = req.query;
  
  let filteredListings = [...listings];
  
  if (q) {
    const query = q.toLowerCase();
    filteredListings = filteredListings.filter(listing => 
      listing.title.toLowerCase().includes(query) ||
      listing.description.toLowerCase().includes(query) ||
      listing.area.toLowerCase().includes(query) ||
      listing.address.toLowerCase().includes(query)
    );
  }
  
  if (type) {
    filteredListings = filteredListings.filter(listing => listing.type === type);
  }
  
  if (minPrice) {
    filteredListings = filteredListings.filter(listing => listing.price >= Number(minPrice));
  }
  
  if (maxPrice) {
    filteredListings = filteredListings.filter(listing => listing.price <= Number(maxPrice));
  }
  
  if (bedrooms) {
    filteredListings = filteredListings.filter(listing => listing.bedrooms >= Number(bedrooms));
  }
  
  if (city) {
    filteredListings = filteredListings.filter(listing => 
      listing.city.toLowerCase() === city.toLowerCase()
    );
  }
  
  const total = filteredListings.length;
  const startIndex = Number(offset);
  const endIndex = startIndex + Number(limit);
  const paginatedListings = filteredListings.slice(startIndex, endIndex);
  
  console.log(`Search query: "${q || 'all'}", found ${total} results, returning ${paginatedListings.length}`);
  
  res.json({ 
    items: paginatedListings.map(listing => ({ ...listing, media: [] })), 
    total: total 
  });
});

app.get('/api/listings/:id', (req, res) => {
  const id = Number(req.params.id);
  const listing = listings.find(l => l.id === id);
  
  if (!listing) {
    return res.status(404).json({ error: 'Listing not found' });
  }
  
  res.json({ ...listing, media: [] });
});

app.post('/api/auth/register', [
  body('name').isString().isLength({min:2}),
  body('email').isEmail(),
  body('password').isString().isLength({min:6}),
  body('role').optional().isIn(['user', 'admin'])
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { name, email, password, role = 'user' } = req.body;
  
  // Check if email already exists
  if (users.find(u => u.email === email)) {
    return res.status(409).json({ error: 'email_in_use' });
  }
  
  const passwordHash = bcrypt.hashSync(password, 10);
  const user = {
    id: nextUserId++,
    name,
    email,
    password_hash: passwordHash,
    role,
    created_at: new Date().toISOString()
  };
  
  users.push(user);
  
  const token = jwt.sign({ id: user.id, name, email, role }, JWT_SECRET, { expiresIn: '7d' });
  
  console.log(`User registered: ${email} with role: ${role}`);
  
  res.status(201).json({ 
    token, 
    user: { id: user.id, name, email, role } 
  });
});

app.post('/api/auth/login', [
  body('email').isEmail(),
  body('password').isString().isLength({min:6}),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  
  if (!user) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  
  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  
  console.log(`User logged in: ${email}`);
  
  res.json({ 
    token, 
    user: { id: user.id, name: user.name, email: user.email, role: user.role } 
  });
});

app.post('/api/contact', [
  body('name').isString().isLength({min:2}),
  body('email').isEmail(),
  body('message').isString().isLength({min:5})
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { name, email, phone, message, listingId } = req.body;
  
  console.log(`Contact form submission from: ${name} (${email})`);
  
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
      
      res.json({ success: true, message: 'Message sent successfully!' });
    } catch (error) {
      console.error('Email error:', error.message);
      res.json({ success: true, message: 'Message received! (Email service unavailable)' });
    }
  } else {
    console.log('Email not configured, but contact form submitted');
    res.json({ success: true, message: 'Message received!' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`✅ Database loaded with ${listings.length} sample listings`);
  console.log(`✅ All functionality ready for testing`);
  console.log(`\n🔗 Test URLs:`);
  console.log(`   - Health: http://localhost:${PORT}/api/health`);
  console.log(`   - Listings: http://localhost:${PORT}/api/listings`);
  console.log(`   - Website: http://localhost:${PORT}`);
});
