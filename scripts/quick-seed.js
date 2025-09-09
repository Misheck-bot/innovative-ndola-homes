const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'data', 'realestate.db');

// Ensure data directory exists
const fs = require('fs');
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const db = new sqlite3.Database(DB_FILE);

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
    owner_email: "david@example.com",
    owner_phone: "+260955456789",
    latitude: -12.9500,
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
  },
  {
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
    owner_email: "grace@example.com",
    owner_phone: "+260944567890",
    latitude: -12.9650,
    longitude: 28.6350
  }
];

db.serialize(() => {
  // Create tables
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

  // Clear existing listings
  db.run('DELETE FROM listings', (err) => {
    if (err) {
      console.error('Error clearing listings:', err);
      return;
    }
    
    console.log('Cleared existing listings');
    
    // Insert sample listings
    const stmt = db.prepare(`INSERT INTO listings (title, description, price, type, bedrooms, bathrooms, city, area, address, owner_name, owner_email, owner_phone, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    
    sampleListings.forEach((listing, index) => {
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
      ], function(err) {
        if (err) {
          console.error(`Error inserting listing ${index + 1}:`, err);
        } else {
          console.log(`Inserted listing ${index + 1}: ${listing.title}`);
        }
      });
    });
    
    stmt.finalize((err) => {
      if (err) {
        console.error('Error finalizing statement:', err);
      } else {
        console.log(`Successfully seeded ${sampleListings.length} listings`);
        
        // Verify the data
        db.get('SELECT COUNT(*) as count FROM listings', (err, row) => {
          if (err) {
            console.error('Error counting listings:', err);
          } else {
            console.log(`Total listings in database: ${row.count}`);
          }
          db.close();
        });
      }
    });
  });
});
