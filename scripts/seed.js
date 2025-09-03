const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'realestate.db');
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
const db = new sqlite3.Database(DB_FILE);

db.serialize(() => {
  const createSql = `
    CREATE TABLE IF NOT EXISTS listings (
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
    );
    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      kind TEXT NOT NULL,
      FOREIGN KEY(listing_id) REFERENCES listings(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id INTEGER,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  db.exec(createSql, (createErr) => {
    if (createErr) {
      console.error('Failed to create tables:', createErr.message);
      db.close();
      return;
    }

    db.run('DELETE FROM media', (delMediaErr) => {
      if (delMediaErr) console.warn('Warning deleting media:', delMediaErr.message);
      db.run('DELETE FROM listings', (delListingsErr) => {
        if (delListingsErr) console.warn('Warning deleting listings:', delListingsErr.message);

        // Seed users
        db.run('DELETE FROM users', (delUsersErr) => {
          if (delUsersErr) console.warn('Warning deleting users:', delUsersErr.message);
          const adminPass = bcrypt.hashSync('admin123', 10);
          const agentPass = bcrypt.hashSync('agent123', 10);
          const userPass = bcrypt.hashSync('user123', 10);
          const userStmt = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
          userStmt.run('Admin', 'admin@example.com', adminPass, 'admin');
          userStmt.run('Agent Smith', 'agent@example.com', agentPass, 'agent');
          userStmt.run('John Doe', 'user@example.com', userPass, 'user');
          userStmt.finalize((uErr) => {
            if (uErr) console.warn('Seed users warning:', uErr.message);

            const stmt = db.prepare(`INSERT INTO listings (title, description, price, type, bedrooms, bathrooms, city, area, address, owner_name, owner_email, owner_phone, latitude, longitude, thumbnail_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            const sample = [
              ['Modern 3BR Apartment', 'Spacious 3-bedroom apartment near Levy Mall with parking and security.', 6500, 'rent', 3, 2, 'Ndola', 'Town Centre', 'Levy Junction, Ndola', 'Agent Smith', 'agent@example.com', '+260971234567', -12.9667, 28.6333, null],
              ['Family House with Garden', 'Beautiful 4-bedroom house with a large garden in Kansenshi.', 1800000, 'sale', 4, 3, 'Ndola', 'Kansenshi', 'Plot 1234, Kansenshi', 'Agent Smith', 'agent@example.com', '+260971234567', -12.9900, 28.6500, null],
              ['Studio Near CBD', 'Affordable studio apartment ideal for young professionals.', 3500, 'rent', 1, 1, 'Ndola', 'Masala', 'Masala Road, Ndola', 'Agent Smith', 'agent@example.com', '+260971234567', -12.9700, 28.6400, null]
            ];
            for (const s of sample) stmt.run(s);
            stmt.finalize(() => {
              console.log('Seeded users and listings.');
              db.close();
            });
          });
        });
      });
    });
  });
});


