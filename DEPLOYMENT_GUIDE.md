# Ndola Homes - Deployment & Environment Setup Guide

## Environment Variables Setup

To complete the deployment and enable all features, you need to set up the following environment variables in your Netlify dashboard:

### Required Environment Variables

1. **Email Configuration** (for contact form notifications):
   ```
   EMAIL_USER=your-gmail-address@gmail.com
   EMAIL_PASS=your-app-specific-password
   EMAIL_FROM=your-gmail-address@gmail.com
   EMAIL_TO=misheckmwamba99@gmail.com
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   ```

2. **Security**:
   ```
   JWT_SECRET=your-secure-random-string-here
   ```

3. **Site Configuration**:
   ```
   SITE_NAME=Ndola Homes
   ```

### Setting Up Gmail App Password

1. Go to your Google Account settings
2. Enable 2-Factor Authentication if not already enabled
3. Go to Security → App passwords
4. Generate a new app password for "Mail"
5. Use this app password (not your regular password) for `EMAIL_PASS`

### Setting Environment Variables in Netlify

1. Go to your Netlify dashboard
2. Select your site (innovative-homes-ndola)
3. Go to Site settings → Environment variables
4. Add each variable listed above

## Real Estate Data Integration

### Option 1: Use Sample Data (Immediate)
```bash
npm run scrape:sample
npm run import:scraped
```

### Option 2: Attempt Real Data Scraping
```bash
npm run scrape:real
npm run import:scraped
```

### Option 3: Manual Data Import
1. Create a JSON file with property data in the `data/` folder
2. Run: `npm run import:file path/to/your/data.json`

### Data Management Commands
- `npm run db:stats` - View database statistics
- `npm run db:clear` - Clear all property data
- `npm run import:scraped` - Import latest scraped data

## Deployment Checklist

- [x] Serverless function created (`netlify/functions/api.js`)
- [x] Static assets paths fixed for Netlify
- [x] Contact email functionality implemented
- [x] Real estate data scraper created
- [x] Data import utilities created
- [ ] Environment variables set in Netlify dashboard
- [ ] Test contact form after deployment
- [ ] Import real property data

## Testing After Deployment

1. **Search Functionality**: Verify properties appear in search results
2. **Contact Form**: Submit a test message and check if email is received
3. **Admin Login**: Test admin authentication
4. **Property Details**: Check individual property pages

## Troubleshooting

### Contact Form Not Sending Emails
- Verify all email environment variables are set correctly
- Check Netlify function logs for errors
- Ensure Gmail app password is used (not regular password)

### No Search Results
- Run `npm run db:stats` to check if properties exist in database
- Import sample data: `npm run scrape:sample && npm run import:scraped`

### Deployment Issues
- Check `netlify.toml` configuration
- Verify all dependencies are in `package.json`
- Check Netlify build logs for errors

## Next Steps for Real Data

1. **Research Local Sources**: Contact local real estate agents in Ndola
2. **API Integration**: Look for Zambian property listing APIs
3. **Manual Data Entry**: Create admin interface for property management
4. **User Submissions**: Allow property owners to submit listings

## Support

For issues or questions, check:
- Netlify function logs in dashboard
- Browser console for frontend errors
- Network tab for API request failures
