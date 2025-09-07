const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const csv = require('csv-parser');
const axios = require('axios');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'realestate.db');
const db = new sqlite3.Database(DB_FILE);

class RealDataImporter {
  constructor() {
    this.importedCount = 0;
    this.errorCount = 0;
  }

  // Import from CSV file (for manual data entry or exports from other platforms)
  async importFromCSV(csvFilePath) {
    console.log(`Starting CSV import from: ${csvFilePath}`);
    
    return new Promise((resolve, reject) => {
      const results = [];
      
      fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
          console.log(`Found ${results.length} records in CSV`);
          
          for (const record of results) {
            try {
              await this.insertListing(this.cleanCSVRecord(record));
              this.importedCount++;
            } catch (error) {
              console.error('Error importing record:', error.message);
              this.errorCount++;
            }
          }
          
          console.log(`Import complete: ${this.importedCount} imported, ${this.errorCount} errors`);
          resolve({ imported: this.importedCount, errors: this.errorCount });
        })
        .on('error', reject);
    });
  }

  // Clean and standardize CSV data
  cleanCSVRecord(record) {
    return {
      title: this.cleanString(record.title || record.Title || record.property_title),
      description: this.cleanString(record.description || record.Description || record.details),
      price: this.cleanPrice(record.price || record.Price || record.amount),
      type: this.cleanType(record.type || record.Type || record.listing_type),
      bedrooms: this.cleanNumber(record.bedrooms || record.Bedrooms || record.beds),
      bathrooms: this.cleanNumber(record.bathrooms || record.Bathrooms || record.baths),
      city: 'Ndola', // Default to Ndola
      area: this.cleanString(record.area || record.Area || record.location || record.suburb),
      address: this.cleanString(record.address || record.Address || record.full_address),
      owner_name: this.cleanString(record.owner_name || record.contact_name || record.agent_name),
      owner_email: this.cleanEmail(record.owner_email || record.contact_email || record.email),
      owner_phone: this.cleanPhone(record.owner_phone || record.contact_phone || record.phone),
      latitude: this.cleanCoordinate(record.latitude || record.lat),
      longitude: this.cleanCoordinate(record.longitude || record.lng || record.lon)
    };
  }

  // Import from JSON file (for API exports or structured data)
  async importFromJSON(jsonFilePath) {
    console.log(`Starting JSON import from: ${jsonFilePath}`);
    
    try {
      const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
      const listings = Array.isArray(data) ? data : data.listings || data.properties || [data];
      
      console.log(`Found ${listings.length} records in JSON`);
      
      for (const listing of listings) {
        try {
          await this.insertListing(this.cleanJSONRecord(listing));
          this.importedCount++;
        } catch (error) {
          console.error('Error importing listing:', error.message);
          this.errorCount++;
        }
      }
      
      console.log(`Import complete: ${this.importedCount} imported, ${this.errorCount} errors`);
      return { imported: this.importedCount, errors: this.errorCount };
    } catch (error) {
      console.error('Error reading JSON file:', error.message);
      throw error;
    }
  }

  // Clean and standardize JSON data
  cleanJSONRecord(record) {
    return {
      title: this.cleanString(record.title || record.name || record.property_name),
      description: this.cleanString(record.description || record.details || record.summary),
      price: this.cleanPrice(record.price || record.cost || record.amount),
      type: this.cleanType(record.type || record.listing_type || record.category),
      bedrooms: this.cleanNumber(record.bedrooms || record.beds || record.bedroom_count),
      bathrooms: this.cleanNumber(record.bathrooms || record.baths || record.bathroom_count),
      city: 'Ndola',
      area: this.cleanString(record.area || record.location || record.suburb || record.neighborhood),
      address: this.cleanString(record.address || record.full_address || record.street_address),
      owner_name: this.cleanString(record.owner_name || record.contact_name || record.agent_name || record.seller_name),
      owner_email: this.cleanEmail(record.owner_email || record.contact_email || record.email),
      owner_phone: this.cleanPhone(record.owner_phone || record.contact_phone || record.phone || record.mobile),
      latitude: this.cleanCoordinate(record.latitude || record.lat || record.coordinates?.lat),
      longitude: this.cleanCoordinate(record.longitude || record.lng || record.lon || record.coordinates?.lng)
    };
  }

  // Manual data entry helper
  async addRealListing(listingData) {
    console.log('Adding real listing manually...');
    
    try {
      const cleanData = {
        title: this.cleanString(listingData.title),
        description: this.cleanString(listingData.description),
        price: this.cleanPrice(listingData.price),
        type: this.cleanType(listingData.type),
        bedrooms: this.cleanNumber(listingData.bedrooms),
        bathrooms: this.cleanNumber(listingData.bathrooms),
        city: 'Ndola',
        area: this.cleanString(listingData.area),
        address: this.cleanString(listingData.address),
        owner_name: this.cleanString(listingData.owner_name),
        owner_email: this.cleanEmail(listingData.owner_email),
        owner_phone: this.cleanPhone(listingData.owner_phone),
        latitude: this.cleanCoordinate(listingData.latitude),
        longitude: this.cleanCoordinate(listingData.longitude)
      };

      const id = await this.insertListing(cleanData);
      console.log(`Successfully added listing with ID: ${id}`);
      return id;
    } catch (error) {
      console.error('Error adding real listing:', error.message);
      throw error;
    }
  }

  // Insert listing into database
  insertListing(data) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO listings (
          title, description, price, type, bedrooms, bathrooms, 
          city, area, address, owner_name, owner_email, owner_phone, 
          latitude, longitude, thumbnail_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const params = [
        data.title, data.description, data.price, data.type,
        data.bedrooms, data.bathrooms, data.city, data.area,
        data.address, data.owner_name, data.owner_email, data.owner_phone,
        data.latitude, data.longitude, null // thumbnail_url will be added separately
      ];

      db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  // Data cleaning utilities
  cleanString(str) {
    if (!str) return null;
    return String(str).trim().replace(/\s+/g, ' ') || null;
  }

  cleanPrice(price) {
    if (!price) return 0;
    // Remove currency symbols and convert to number
    const cleaned = String(price).replace(/[^\d.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.round(num);
  }

  cleanType(type) {
    if (!type) return 'sale';
    const cleaned = String(type).toLowerCase().trim();
    return ['rent', 'rental', 'for rent'].includes(cleaned) ? 'rent' : 'sale';
  }

  cleanNumber(num) {
    if (!num) return null;
    const cleaned = parseInt(String(num).replace(/\D/g, ''));
    return isNaN(cleaned) ? null : cleaned;
  }

  cleanEmail(email) {
    if (!email) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleaned = String(email).trim().toLowerCase();
    return emailRegex.test(cleaned) ? cleaned : null;
  }

  cleanPhone(phone) {
    if (!phone) return null;
    // Clean and format Zambian phone numbers
    let cleaned = String(phone).replace(/\D/g, '');
    
    // Handle different Zambian number formats
    if (cleaned.startsWith('260')) {
      // Already has country code
      return '+' + cleaned;
    } else if (cleaned.startsWith('0')) {
      // Remove leading 0 and add country code
      return '+260' + cleaned.substring(1);
    } else if (cleaned.length === 9) {
      // Assume it's missing country code and leading 0
      return '+260' + cleaned;
    }
    
    return '+260' + cleaned; // Default format
  }

  cleanCoordinate(coord) {
    if (!coord) return null;
    const num = parseFloat(coord);
    return isNaN(num) ? null : num;
  }

  // Clear all demo data before importing real data
  async clearDemoData() {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('DELETE FROM media WHERE listing_id IN (SELECT id FROM listings)', (err) => {
          if (err) console.warn('Warning clearing media:', err.message);
        });
        
        db.run('DELETE FROM listings', (err) => {
          if (err) {
            reject(err);
          } else {
            console.log('Demo data cleared successfully');
            resolve();
          }
        });
      });
    });
  }
}

// Example usage and CLI interface
if (require.main === module) {
  const importer = new RealDataImporter();
  const command = process.argv[2];
  const filePath = process.argv[3];

  switch (command) {
    case 'csv':
      if (!filePath) {
        console.error('Usage: node data-import.js csv <path-to-csv-file>');
        process.exit(1);
      }
      importer.importFromCSV(filePath).then(result => {
        console.log('CSV import result:', result);
        process.exit(0);
      }).catch(err => {
        console.error('CSV import failed:', err.message);
        process.exit(1);
      });
      break;

    case 'json':
      if (!filePath) {
        console.error('Usage: node data-import.js json <path-to-json-file>');
        process.exit(1);
      }
      importer.importFromJSON(filePath).then(result => {
        console.log('JSON import result:', result);
        process.exit(0);
      }).catch(err => {
        console.error('JSON import failed:', err.message);
        process.exit(1);
      });
      break;

    case 'clear':
      importer.clearDemoData().then(() => {
        console.log('Demo data cleared');
        process.exit(0);
      }).catch(err => {
        console.error('Clear failed:', err.message);
        process.exit(1);
      });
      break;

    default:
      console.log(`
Real Estate Data Import Tool

Usage:
  node data-import.js csv <file.csv>     - Import from CSV file
  node data-import.js json <file.json>   - Import from JSON file
  node data-import.js clear              - Clear demo data

CSV Format Expected:
  title, description, price, type, bedrooms, bathrooms, area, address, owner_name, owner_email, owner_phone, latitude, longitude

JSON Format Expected:
  Array of objects with similar fields as CSV
      `);
  }
}

module.exports = RealDataImporter;
