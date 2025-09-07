# Real Data Integration Guide for Ndola Real Estate App

This guide explains how to integrate real property data from actual listings in Ndola, Zambia into your real estate application.

## Quick Start

### 1. Install Required Dependencies
```bash
npm install axios cheerio csv-parser
```

### 2. Import Sample Real Data
```bash
# Import from CSV file
npm run import:csv data/sample-listings.csv

# Import from JSON file  
npm run import:json data/sample-listings.json

# Clear demo data first (optional)
npm run clear:demo
```

### 3. Web Scraping (Advanced)
```bash
# Scrape listings from popular sites
npm run scrape

# Scrape and import directly to database
npm run scrape:import
```

## Data Sources for Ndola Properties

### Online Platforms
1. **Property24 Zambia** - https://www.property24.co.zm/ndola
2. **Lamudi Zambia** - https://www.lamudi.co.zm/ndola/
3. **ZambiaProperty.com** - Local property portal
4. **Facebook Marketplace** - Search "property ndola" or "house ndola"
5. **WhatsApp Groups** - Local real estate groups

### Manual Data Collection
1. **Real Estate Agents** - Contact local agents in Ndola
2. **Property Developers** - Reach out to construction companies
3. **Newspapers** - Times of Zambia, Daily Mail classifieds
4. **Radio Stations** - Property advertisements on local radio

## Data Import Methods

### Method 1: CSV Import
Create a CSV file with the following columns:
```
title,description,price,type,bedrooms,bathrooms,area,address,owner_name,owner_email,owner_phone,latitude,longitude
```

Example:
```csv
"Modern 4BR House","Beautiful house in Kansenshi",2500000,sale,4,3,"Kansenshi","Plot 123","John Doe","john@email.com","+260977123456",-12.99,28.65
```

### Method 2: JSON Import
Create a JSON file with listing objects:
```json
{
  "listings": [
    {
      "title": "Modern 4BR House",
      "description": "Beautiful house in Kansenshi",
      "price": 2500000,
      "type": "sale",
      "bedrooms": 4,
      "bathrooms": 3,
      "area": "Kansenshi",
      "address": "Plot 123 Kansenshi Road",
      "owner_name": "John Doe",
      "owner_email": "john@email.com",
      "owner_phone": "+260977123456",
      "latitude": -12.99,
      "longitude": 28.65
    }
  ]
}
```

### Method 3: Manual Entry via API
Use the existing `/api/listings` POST endpoint with agent/admin authentication.

### Method 4: Web Scraping
The web scraper can automatically collect data from:
- Property24 Zambia
- Lamudi Zambia
- Other real estate websites

**Note:** Always respect website terms of service and rate limits.

## Data Fields Explained

| Field | Description | Example |
|-------|-------------|---------|
| `title` | Property title/headline | "Modern 3BR Apartment" |
| `description` | Detailed description | "Spacious apartment with parking..." |
| `price` | Price in Zambian Kwacha | 2500000 (for K2.5M) |
| `type` | "rent" or "sale" | "sale" |
| `bedrooms` | Number of bedrooms | 3 |
| `bathrooms` | Number of bathrooms | 2 |
| `area` | Neighborhood/suburb | "Kansenshi" |
| `address` | Full address | "Plot 123 Kansenshi Road" |
| `owner_name` | Contact person name | "John Mwanza" |
| `owner_email` | Contact email | "john@email.com" |
| `owner_phone` | Phone number | "+260977123456" |
| `latitude` | GPS latitude | -12.9900 |
| `longitude` | GPS longitude | 28.6500 |

## Common Ndola Areas

- **Kansenshi** - Residential area, popular for families
- **Northrise** - Upmarket residential area
- **Town Centre/CBD** - Central business district
- **Masala** - Mixed residential/commercial
- **Chipulukusu** - Growing residential area
- **Riverside** - Near Copperbelt University
- **Industrial Area** - Commercial/industrial properties
- **Levy Junction** - Commercial hub near Levy Mall

## Phone Number Formats

The system automatically formats Zambian phone numbers:
- Input: `0977123456` → Output: `+260977123456`
- Input: `977123456` → Output: `+260977123456`
- Input: `260977123456` → Output: `+260977123456`

## Data Validation

The import system automatically:
- Cleans and validates email addresses
- Formats phone numbers
- Validates price ranges
- Standardizes property types
- Removes duplicate listings

## Getting Real Data

### 1. Contact Local Agents
Reach out to real estate agents in Ndola:
- Explain your platform
- Offer to list their properties for free
- Request property data in CSV/Excel format

### 2. Partner with Developers
Contact property developers:
- New housing projects
- Commercial developments
- Apartment complexes

### 3. Manual Collection
Visit popular areas and collect:
- "For Sale" signs with contact details
- Rental advertisements
- Property management companies

### 4. Social Media
Monitor Facebook groups:
- "Ndola Properties"
- "Houses for Sale Ndola"
- "Ndola Rentals"

## Legal Considerations

- Always get permission before listing someone's property
- Respect copyright on property photos
- Follow data protection laws
- Honor website terms of service when scraping

## Geocoding Addresses

To get latitude/longitude for addresses:
1. Use Google Maps Geocoding API
2. Use OpenStreetMap Nominatim (free)
3. Manual lookup using Google Maps

Example coordinates for Ndola:
- City Center: -12.9584, 28.6367
- Kansenshi: -12.9900, 28.6500
- Northrise: -12.9500, 28.6200

## Troubleshooting

### Import Errors
- Check CSV/JSON format
- Ensure required fields are present
- Verify phone number formats
- Check for special characters

### Missing Data
- Use default values for optional fields
- Geocode addresses separately
- Contact property owners for missing info

### Duplicate Listings
The system automatically removes duplicates based on title and price similarity.

## Next Steps

1. Start with the sample data provided
2. Contact 2-3 local real estate agents
3. Manually add 10-20 real listings
4. Set up automated data collection
5. Launch with real data

## Support

For technical issues with data import:
1. Check the console logs
2. Verify file formats
3. Test with sample data first
4. Contact system administrator

---

**Remember:** Quality over quantity. It's better to have 50 accurate, real listings than 500 fake ones.
