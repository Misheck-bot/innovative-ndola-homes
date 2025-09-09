import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

// Real estate websites that list Ndola properties
const SOURCES = [
  {
    name: 'ZambiaProperty',
    baseUrl: 'https://www.zambiaproperty.com',
    searchUrl: 'https://www.zambiaproperty.com/search?location=ndola',
    selectors: {
      listings: '.property-card',
      title: '.property-title',
      price: '.property-price',
      description: '.property-description',
      bedrooms: '.bedrooms',
      bathrooms: '.bathrooms',
      location: '.property-location',
      image: '.property-image img',
      link: 'a'
    }
  },
  {
    name: 'PropertyZambia',
    baseUrl: 'https://www.propertyzambia.com',
    searchUrl: 'https://www.propertyzambia.com/properties?city=ndola',
    selectors: {
      listings: '.listing-item',
      title: 'h3.title',
      price: '.price-tag',
      description: '.description',
      bedrooms: '.bed-count',
      bathrooms: '.bath-count',
      location: '.location-text',
      image: '.listing-image img',
      link: 'a.listing-link'
    }
  }
];

class NdolaPropertyScraper {
  constructor() {
    this.properties = [];
    this.outputDir = path.join(process.cwd(), 'data');
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async scrapeSource(source) {
    try {
      console.log(`Scraping ${source.name}...`);
      
      const response = await axios.get(source.searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      const listings = $(source.selectors.listings);

      console.log(`Found ${listings.length} listings on ${source.name}`);

      listings.each((index, element) => {
        try {
          const $el = $(element);
          
          const title = $el.find(source.selectors.title).text().trim();
          const priceText = $el.find(source.selectors.price).text().trim();
          const description = $el.find(source.selectors.description).text().trim();
          const location = $el.find(source.selectors.location).text().trim();
          const imageUrl = $el.find(source.selectors.image).attr('src');
          const link = $el.find(source.selectors.link).attr('href');

          // Extract bedrooms and bathrooms
          const bedroomsText = $el.find(source.selectors.bedrooms).text();
          const bathroomsText = $el.find(source.selectors.bathrooms).text();
          
          const bedrooms = this.extractNumber(bedroomsText);
          const bathrooms = this.extractNumber(bathroomsText);
          
          // Parse price
          const price = this.parsePrice(priceText);
          const type = this.determineType(priceText, description);

          if (title && price > 0) {
            const property = {
              title: title.substring(0, 200),
              description: description.substring(0, 500) || `Property in ${location || 'Ndola'}`,
              price: price,
              type: type,
              bedrooms: bedrooms || null,
              bathrooms: bathrooms || null,
              city: 'Ndola',
              area: this.extractArea(location) || 'Ndola',
              address: location || null,
              owner_name: null,
              owner_email: null,
              owner_phone: this.extractPhone(description),
              latitude: this.getRandomNdolaCoordinate('lat'),
              longitude: this.getRandomNdolaCoordinate('lng'),
              thumbnail_url: imageUrl ? this.resolveImageUrl(imageUrl, source.baseUrl) : null,
              source: source.name,
              source_url: link ? this.resolveUrl(link, source.baseUrl) : null,
              scraped_at: new Date().toISOString()
            };

            this.properties.push(property);
          }
        } catch (error) {
          console.error(`Error parsing listing ${index}:`, error.message);
        }
      });

    } catch (error) {
      console.error(`Error scraping ${source.name}:`, error.message);
    }
  }

  extractNumber(text) {
    if (!text) return null;
    const match = text.match(/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  parsePrice(priceText) {
    if (!priceText) return 0;
    
    // Remove currency symbols and spaces
    const cleanPrice = priceText.replace(/[^\d.,]/g, '');
    const number = parseFloat(cleanPrice.replace(/,/g, ''));
    
    if (isNaN(number)) return 0;
    
    // Convert to ZMW if needed (assuming USD rates)
    if (priceText.toLowerCase().includes('usd') || priceText.includes('$')) {
      return Math.round(number * 25); // Approximate USD to ZMW conversion
    }
    
    return Math.round(number);
  }

  determineType(priceText, description) {
    const text = (priceText + ' ' + description).toLowerCase();
    
    if (text.includes('rent') || text.includes('/month') || text.includes('monthly')) {
      return 'rent';
    }
    
    return 'sale';
  }

  extractArea(location) {
    if (!location) return null;
    
    // Common Ndola areas
    const areas = [
      'Northrise', 'Kansenshi', 'Riverside', 'Masala', 'Chipulukusu',
      'Kabushi', 'Itawa', 'Lubuto', 'Ndeke', 'Mushili', 'Twapia'
    ];
    
    for (const area of areas) {
      if (location.toLowerCase().includes(area.toLowerCase())) {
        return area;
      }
    }
    
    return null;
  }

  extractPhone(text) {
    if (!text) return null;
    
    // Zambian phone number patterns
    const phoneRegex = /(\+260|0)[\s-]?[79]\d{2}[\s-]?\d{3}[\s-]?\d{3}/;
    const match = text.match(phoneRegex);
    
    return match ? match[0].replace(/[\s-]/g, '') : null;
  }

  getRandomNdolaCoordinate(type) {
    // Ndola approximate boundaries
    const bounds = {
      lat: { min: -12.9900, max: -12.9400 },
      lng: { min: 28.6000, max: 28.6700 }
    };
    
    const range = bounds[type];
    return range.min + Math.random() * (range.max - range.min);
  }

  resolveUrl(url, baseUrl) {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    if (url.startsWith('/')) return baseUrl + url;
    return baseUrl + '/' + url;
  }

  resolveImageUrl(imageUrl, baseUrl) {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('http')) return imageUrl;
    if (imageUrl.startsWith('/')) return baseUrl + imageUrl;
    return baseUrl + '/' + imageUrl;
  }

  async scrapeAll() {
    console.log('Starting Ndola property scraping...');
    
    for (const source of SOURCES) {
      await this.scrapeSource(source);
      // Add delay between requests to be respectful
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`Scraped ${this.properties.length} total properties`);
    return this.properties;
  }

  async saveToFile() {
    const filename = `ndola-properties-${Date.now()}.json`;
    const filepath = path.join(this.outputDir, filename);
    
    const data = {
      scraped_at: new Date().toISOString(),
      total_properties: this.properties.length,
      sources: SOURCES.map(s => s.name),
      properties: this.properties
    };
    
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    console.log(`Saved ${this.properties.length} properties to ${filepath}`);
    
    return filepath;
  }

  // Generate realistic sample data when scraping fails
  generateSampleData() {
    const sampleProperties = [
      {
        title: "Executive 4-Bedroom House - Northrise",
        description: "Spacious executive home in prestigious Northrise area. Features include modern kitchen, master ensuite, garage, and beautiful garden. Close to schools and shopping centers.",
        price: 650000,
        type: "sale",
        bedrooms: 4,
        bathrooms: 3,
        city: "Ndola",
        area: "Northrise",
        address: "Plot 156, Northrise Road",
        owner_phone: "+260977234567",
        latitude: -12.9584,
        longitude: 28.6369
      },
      {
        title: "Modern 2-Bedroom Apartment - Kansenshi",
        description: "Well-appointed apartment in secure complex. Features air conditioning, fitted kitchen, and parking. Perfect for young professionals.",
        price: 3200,
        type: "rent",
        bedrooms: 2,
        bathrooms: 2,
        city: "Ndola",
        area: "Kansenshi",
        address: "Block 12, Kansenshi Heights",
        owner_phone: "+260966345678",
        latitude: -12.9700,
        longitude: 28.6200
      },
      {
        title: "Luxury Villa with Swimming Pool - Riverside",
        description: "Stunning luxury villa featuring 5 bedrooms, swimming pool, landscaped gardens, and staff quarters. Premium location with excellent security.",
        price: 1200000,
        type: "sale",
        bedrooms: 5,
        bathrooms: 4,
        city: "Ndola",
        area: "Riverside",
        address: "House 23, Riverside Estate",
        owner_phone: "+260955456789",
        latitude: -12.9500,
        longitude: 28.6500
      },
      {
        title: "Affordable Family Home - Chipulukusu",
        description: "Great starter home for growing families. 3 bedrooms, large living area, and spacious yard. Quiet neighborhood with good access to amenities.",
        price: 280000,
        type: "sale",
        bedrooms: 3,
        bathrooms: 2,
        city: "Ndola",
        area: "Chipulukusu",
        address: "Plot 89, Chipulukusu Extension",
        owner_phone: "+260944567890",
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
        owner_phone: "+260933678901",
        latitude: -12.9650,
        longitude: 28.6350
      }
    ];

    this.properties = sampleProperties.map(prop => ({
      ...prop,
      owner_name: null,
      owner_email: null,
      thumbnail_url: null,
      source: 'Generated Sample',
      source_url: null,
      scraped_at: new Date().toISOString()
    }));

    return this.properties;
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const scraper = new NdolaPropertyScraper();
  
  const command = process.argv[2];
  
  if (command === 'scrape') {
    scraper.scrapeAll()
      .then(() => scraper.saveToFile())
      .catch(error => {
        console.error('Scraping failed, generating sample data:', error.message);
        scraper.generateSampleData();
        return scraper.saveToFile();
      });
  } else if (command === 'sample') {
    scraper.generateSampleData();
    scraper.saveToFile();
  } else {
    console.log('Usage: node real-estate-scraper.js [scrape|sample]');
    console.log('  scrape - Attempt to scrape real properties from websites');
    console.log('  sample - Generate realistic sample data');
  }
}

export default NdolaPropertyScraper;
