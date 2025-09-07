const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const RealDataImporter = require('./data-import');

class NdolaPropertyScraper {
  constructor() {
    this.importer = new RealDataImporter();
    this.scrapedData = [];
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };
  }

  // Scrape Property24 Zambia (Ndola listings)
  async scrapeProperty24() {
    console.log('Scraping Property24 Zambia for Ndola listings...');
    
    try {
      const url = 'https://www.property24.co.zm/property-for-sale/ndola';
      const response = await axios.get(url, { headers: this.headers });
      const $ = cheerio.load(response.data);
      
      const listings = [];
      
      $('.listing-result').each((index, element) => {
        const $el = $(element);
        
        const listing = {
          title: $el.find('.listing-result-title').text().trim(),
          description: $el.find('.listing-result-description').text().trim(),
          price: this.extractPrice($el.find('.listing-result-price').text()),
          type: this.determineType($el.find('.listing-result-title').text()),
          bedrooms: this.extractBedrooms($el.find('.listing-result-features').text()),
          bathrooms: this.extractBathrooms($el.find('.listing-result-features').text()),
          area: this.extractArea($el.find('.listing-result-location').text()),
          address: $el.find('.listing-result-location').text().trim(),
          owner_name: $el.find('.listing-agent-name').text().trim(),
          owner_phone: this.extractPhone($el.find('.listing-agent-contact').text()),
          latitude: null, // Would need geocoding
          longitude: null,
          source: 'Property24'
        };
        
        if (listing.title && listing.price) {
          listings.push(listing);
        }
      });
      
      console.log(`Found ${listings.length} listings on Property24`);
      return listings;
      
    } catch (error) {
      console.error('Error scraping Property24:', error.message);
      return [];
    }
  }

  // Scrape Lamudi Zambia (Ndola listings)
  async scrapeLamudi() {
    console.log('Scraping Lamudi Zambia for Ndola listings...');
    
    try {
      const url = 'https://www.lamudi.co.zm/ndola/';
      const response = await axios.get(url, { headers: this.headers });
      const $ = cheerio.load(response.data);
      
      const listings = [];
      
      $('.ListingCell-row').each((index, element) => {
        const $el = $(element);
        
        const listing = {
          title: $el.find('.ListingCell-KeyInfo-title').text().trim(),
          description: $el.find('.ListingCell-shortDescription').text().trim(),
          price: this.extractPrice($el.find('.PriceSection-FirstPrice').text()),
          type: this.determineType($el.find('.ListingCell-KeyInfo-title').text()),
          bedrooms: this.extractBedrooms($el.find('.KeyInformation-value').eq(0).text()),
          bathrooms: this.extractBathrooms($el.find('.KeyInformation-value').eq(1).text()),
          area: this.extractArea($el.find('.ListingCell-KeyInfo-address-text').text()),
          address: $el.find('.ListingCell-KeyInfo-address-text').text().trim(),
          owner_name: $el.find('.AgentContactInfo-name').text().trim(),
          owner_phone: this.extractPhone($el.find('.AgentContactInfo-phone').text()),
          latitude: null,
          longitude: null,
          source: 'Lamudi'
        };
        
        if (listing.title && listing.price) {
          listings.push(listing);
        }
      });
      
      console.log(`Found ${listings.length} listings on Lamudi`);
      return listings;
      
    } catch (error) {
      console.error('Error scraping Lamudi:', error.message);
      return [];
    }
  }

  // Facebook Marketplace scraper (requires special handling due to authentication)
  async scrapeFacebookMarketplace() {
    console.log('Note: Facebook Marketplace requires manual data export due to authentication requirements');
    console.log('To get Facebook data:');
    console.log('1. Go to Facebook Marketplace');
    console.log('2. Search for "property ndola" or "house ndola"');
    console.log('3. Manually copy listing details to CSV/JSON format');
    console.log('4. Use the data import tool to load the data');
    
    return [];
  }

  // Extract price from text
  extractPrice(priceText) {
    if (!priceText) return 0;
    
    // Remove currency symbols and extract numbers
    const cleaned = priceText.replace(/[^\d,]/g, '').replace(/,/g, '');
    const price = parseInt(cleaned);
    
    // Handle K (thousands) and M (millions) suffixes
    if (priceText.toLowerCase().includes('k')) {
      return price * 1000;
    } else if (priceText.toLowerCase().includes('m')) {
      return price * 1000000;
    }
    
    return price || 0;
  }

  // Determine listing type from title
  determineType(title) {
    if (!title) return 'sale';
    const lowerTitle = title.toLowerCase();
    return lowerTitle.includes('rent') || lowerTitle.includes('rental') ? 'rent' : 'sale';
  }

  // Extract number of bedrooms
  extractBedrooms(text) {
    if (!text) return null;
    const match = text.match(/(\d+)\s*(bed|bedroom)/i);
    return match ? parseInt(match[1]) : null;
  }

  // Extract number of bathrooms
  extractBathrooms(text) {
    if (!text) return null;
    const match = text.match(/(\d+)\s*(bath|bathroom)/i);
    return match ? parseInt(match[1]) : null;
  }

  // Extract area/location
  extractArea(locationText) {
    if (!locationText) return null;
    
    // Common Ndola areas
    const ndolaAreas = [
      'Kansenshi', 'Northrise', 'Masala', 'Town Centre', 'CBD', 
      'Chipulukusu', 'Riverside', 'Industrial Area', 'Levy Junction'
    ];
    
    for (const area of ndolaAreas) {
      if (locationText.toLowerCase().includes(area.toLowerCase())) {
        return area;
      }
    }
    
    return locationText.split(',')[0].trim(); // First part of address
  }

  // Extract phone number
  extractPhone(text) {
    if (!text) return null;
    
    // Zambian phone number patterns
    const phoneMatch = text.match(/(\+?260\d{9}|\d{10})/);
    return phoneMatch ? phoneMatch[1] : null;
  }

  // Run all scrapers
  async scrapeAll() {
    console.log('Starting comprehensive scraping of Ndola property listings...');
    
    const allListings = [];
    
    // Scrape different sources
    const property24Listings = await this.scrapeProperty24();
    const lamudiListings = await this.scrapeLamudi();
    
    allListings.push(...property24Listings, ...lamudiListings);
    
    // Remove duplicates based on title similarity
    const uniqueListings = this.removeDuplicates(allListings);
    
    console.log(`Total unique listings found: ${uniqueListings.length}`);
    
    // Save to JSON file
    const outputPath = path.join(__dirname, '..', 'data', 'scraped-listings.json');
    fs.writeFileSync(outputPath, JSON.stringify({ listings: uniqueListings }, null, 2));
    console.log(`Scraped data saved to: ${outputPath}`);
    
    return uniqueListings;
  }

  // Remove duplicate listings
  removeDuplicates(listings) {
    const seen = new Set();
    return listings.filter(listing => {
      const key = `${listing.title}-${listing.price}`.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  // Import scraped data to database
  async importScrapedData() {
    try {
      const listings = await this.scrapeAll();
      
      if (listings.length === 0) {
        console.log('No listings found to import');
        return;
      }
      
      console.log('Importing scraped listings to database...');
      
      let imported = 0;
      let errors = 0;
      
      for (const listing of listings) {
        try {
          await this.importer.addRealListing(listing);
          imported++;
        } catch (error) {
          console.error(`Error importing listing "${listing.title}":`, error.message);
          errors++;
        }
      }
      
      console.log(`Import complete: ${imported} imported, ${errors} errors`);
      return { imported, errors, total: listings.length };
      
    } catch (error) {
      console.error('Error in import process:', error.message);
      throw error;
    }
  }
}

// CLI interface
if (require.main === module) {
  const scraper = new NdolaPropertyScraper();
  const command = process.argv[2];

  switch (command) {
    case 'scrape':
      scraper.scrapeAll().then(listings => {
        console.log(`Scraping complete: ${listings.length} listings found`);
        process.exit(0);
      }).catch(err => {
        console.error('Scraping failed:', err.message);
        process.exit(1);
      });
      break;

    case 'import':
      scraper.importScrapedData().then(result => {
        console.log('Import result:', result);
        process.exit(0);
      }).catch(err => {
        console.error('Import failed:', err.message);
        process.exit(1);
      });
      break;

    default:
      console.log(`
Ndola Property Web Scraper

Usage:
  node web-scraper.js scrape    - Scrape listings and save to JSON
  node web-scraper.js import    - Scrape and import directly to database

Note: Web scraping should be done responsibly and in compliance with website terms of service.
For Facebook Marketplace, manual data export is recommended.
      `);
  }
}

module.exports = NdolaPropertyScraper;
