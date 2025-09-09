import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';

const DB_FILE = process.env.DB_FILE || './database.sqlite';

class ScrapedDataImporter {
  constructor() {
    this.db = null;
  }

  initDB() {
    if (!this.db) {
      this.db = new sqlite3.verbose().Database(DB_FILE);
      
      this.db.serialize(() => {
        this.db.run(`CREATE TABLE IF NOT EXISTS listings (
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
          source TEXT,
          source_url TEXT,
          scraped_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
      });
    }
    return this.db;
  }

  async importFromFile(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const properties = data.properties || data;

    if (!Array.isArray(properties)) {
      throw new Error('Invalid data format. Expected array of properties.');
    }

    this.initDB();

    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO listings (
          title, description, price, type, bedrooms, bathrooms, 
          city, area, address, owner_name, owner_email, owner_phone,
          latitude, longitude, thumbnail_url, source, source_url, scraped_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      let imported = 0;
      let skipped = 0;

      properties.forEach(property => {
        try {
          // Validate required fields
          if (!property.title || !property.price || !property.city) {
            skipped++;
            return;
          }

          stmt.run([
            property.title.substring(0, 200),
            property.description?.substring(0, 500) || '',
            parseInt(property.price) || 0,
            property.type || 'sale',
            property.bedrooms || null,
            property.bathrooms || null,
            property.city || 'Ndola',
            property.area || null,
            property.address || null,
            property.owner_name || null,
            property.owner_email || null,
            property.owner_phone || null,
            property.latitude || null,
            property.longitude || null,
            property.thumbnail_url || null,
            property.source || 'Imported',
            property.source_url || null,
            property.scraped_at || new Date().toISOString()
          ], function(err) {
            if (err) {
              console.error('Error inserting property:', err.message);
              skipped++;
            } else {
              imported++;
            }
          });
        } catch (error) {
          console.error('Error processing property:', error.message);
          skipped++;
        }
      });

      stmt.finalize((err) => {
        if (err) {
          reject(err);
        } else {
          resolve({ imported, skipped, total: properties.length });
        }
      });
    });
  }

  async clearExistingData(source = null) {
    this.initDB();

    return new Promise((resolve, reject) => {
      let query = 'DELETE FROM listings';
      let params = [];

      if (source) {
        query += ' WHERE source = ?';
        params.push(source);
      }

      this.db.run(query, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  async getStats() {
    this.initDB();

    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN type = 'sale' THEN 1 END) as for_sale,
          COUNT(CASE WHEN type = 'rent' THEN 1 END) as for_rent,
          source,
          COUNT(*) as count
        FROM listings 
        GROUP BY source
        UNION ALL
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN type = 'sale' THEN 1 END) as for_sale,
          COUNT(CASE WHEN type = 'rent' THEN 1 END) as for_rent,
          'TOTAL' as source,
          COUNT(*) as count
        FROM listings
      `, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const importer = new ScrapedDataImporter();
  const command = process.argv[2];
  const filePath = process.argv[3];

  async function runCommand() {
    try {
      switch (command) {
        case 'import':
          if (!filePath) {
            console.error('Usage: node import-scraped-data.js import <file-path>');
            process.exit(1);
          }
          
          console.log(`Importing data from ${filePath}...`);
          const result = await importer.importFromFile(filePath);
          console.log(`Import completed: ${result.imported} imported, ${result.skipped} skipped, ${result.total} total`);
          break;

        case 'clear':
          const source = filePath; // Optional source filter
          console.log(source ? `Clearing data from source: ${source}` : 'Clearing all data...');
          const deleted = await importer.clearExistingData(source);
          console.log(`Deleted ${deleted} records`);
          break;

        case 'stats':
          console.log('Database statistics:');
          const stats = await importer.getStats();
          stats.forEach(stat => {
            if (stat.source === 'TOTAL') {
              console.log(`\nTotal: ${stat.total} properties (${stat.for_sale} for sale, ${stat.for_rent} for rent)`);
            } else {
              console.log(`${stat.source}: ${stat.count} properties`);
            }
          });
          break;

        case 'latest':
          // Import the latest scraped file
          const dataDir = path.join(process.cwd(), 'data');
          if (!fs.existsSync(dataDir)) {
            console.error('Data directory not found. Run scraping first.');
            process.exit(1);
          }

          const files = fs.readdirSync(dataDir)
            .filter(f => f.startsWith('ndola-properties-') && f.endsWith('.json'))
            .sort()
            .reverse();

          if (files.length === 0) {
            console.error('No scraped data files found. Run scraping first.');
            process.exit(1);
          }

          const latestFile = path.join(dataDir, files[0]);
          console.log(`Importing latest scraped data from ${latestFile}...`);
          const latestResult = await importer.importFromFile(latestFile);
          console.log(`Import completed: ${latestResult.imported} imported, ${latestResult.skipped} skipped`);
          break;

        default:
          console.log('Usage: node import-scraped-data.js <command> [options]');
          console.log('Commands:');
          console.log('  import <file>  - Import data from JSON file');
          console.log('  clear [source] - Clear all data or data from specific source');
          console.log('  stats          - Show database statistics');
          console.log('  latest         - Import the latest scraped data file');
          break;
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    } finally {
      importer.close();
    }
  }

  runCommand();
}

export default ScrapedDataImporter;
