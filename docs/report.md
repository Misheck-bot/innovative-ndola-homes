Ndola Homes: A Real-Time Real Estate Platform for Ndola
=======================================================

1. Abstract
-----------
This project delivers a comprehensive, real-time real estate web platform tailored specifically for Ndola, Zambia. Users can search listings for rent/sale, view photos/videos, contact agents via email notifications, and discover nearby properties using geolocation. Real-time capabilities notify users of new listings instantly. The system integrates real Ndola property data and includes advanced features like location-based search, email notifications, and dynamic admin statistics.

2. Problem Statement and Motivation
-----------------------------------
Existing property portals in Zambia provide broad coverage but often lack localized, real-time discovery and lightweight tools for small agencies and independent agents. In Ndola, up-to-date availability and fast communication are critical. The gap: a focused, low-cost, real-time solution enabling fast listing, search, contact, and location-based discovery for Ndola's market with actual property data integration.

3. Objectives
-------------
- Provide a searchable catalog of real properties for rent and sale in Ndola
- Support rich media (photos and videos) with file upload capabilities
- Enable instant notifications for newly posted listings via WebSocket
- Implement email notifications for property inquiries
- Offer location-based "Near Me" property discovery with GPS integration
- Persist data across sessions with a reliable database
- Integrate real Ndola property data from multiple sources
- Provide admin dashboard with dynamic statistics and property management
- Offer a responsive UI that works across devices with custom branding
- Keep the stack lightweight and easy to deploy locally or on a small VPS

4. Literature and Market Review
--------------------------------
Global portals (e.g., Zillow, Rightmove) and regional sites provide large-scale discovery but require heavy infrastructure and are not Ndola-specific. Academic work on real-time systems highlights websockets for push updates and normalized relational storage for integrity. We combine pragmatic web engineering (Express, SQLite) with real-time transport (Socket.IO) to achieve low-latency updates without complex ops.

5. Methodology and System Design
--------------------------------
- Architecture: Node.js (Express) server, SQLite database, Socket.IO for real-time events, Nodemailer for email integration.
- Data Model: `users` (auth with roles: user/agent/admin), `listings` (core property info incl. owner fields), `media` (image/video per listing), `contacts` (inquiries).
- API Endpoints: listings search/read with geolocation filtering; contact submission with email notifications; admin upload for new listings with media; admin registration endpoint.
- Real-time: server emits `listing:new` on successful creation; clients subscribe and update UX with live notifications.
- Email System: Gmail SMTP integration for contact form notifications sent to misheckmwamba99@gmail.com with visitor details and reply-to functionality.
- Geolocation: "Near Me" functionality using GPS coordinates, Haversine distance calculations, and 10km radius filtering.
- Frontend: Bootstrap-based responsive layout with custom favicon, dynamic admin statistics, and location-aware property display.
- Security: server-side validation via `express-validator`; JWT authentication with roles (user/agent/admin); admin/agent-only listing creation; CORS and static file serving with safe upload directory.

6. Implementation Details
-------------------------
- Database: SQLite3 file stored at `data/realestate.db` with auto-migration on server start. Tables:
  - `users(id, name, email UNIQUE, password_hash, role, created_at)`
  - `listings(id, title, description, price, type, bedrooms, bathrooms, city, area, address, owner_name, owner_email, owner_phone, latitude, longitude, thumbnail_url, created_at)`
  - `media(id, listing_id, url, kind)`
  - `contacts(id, listing_id, name, email, phone, message, created_at)`
  Geolocation search supported via lat/lon + radius with Haversine distance calculations for accurate proximity filtering.
- Real Data Integration: CSV import system (`data-import.js`) for importing actual Ndola property listings from `manual-ndola-listings.csv` with 10 real properties across Kansenshi, Northrise, CBD, Masala, and other Ndola areas.
- Email Notifications: Nodemailer integration with Gmail SMTP using app passwords for secure authentication. Contact form submissions automatically send formatted emails to misheckmwamba99@gmail.com with visitor details and reply-to functionality.
- Geolocation Features: "Near Me" button uses browser GPS to find properties within 10km radius, calculates distances using Haversine formula, and displays results sorted by proximity with distance indicators.
- Admin Dashboard: Dynamic statistics showing real-time counts of total listings, active listings, properties for rent/sale. Statistics auto-refresh when new properties are added.
- Media: `multer` to store uploads in `public/uploads`; URLs served via `/public/uploads/...` with support for images and videos.
- Search: server-side filtering by keyword, type, price, bedrooms, city, and geolocation with radius-based proximity search.
- Branding: Custom favicon with house icon, professional styling, and Ndola-specific branding throughout the application.
- Responsiveness: Bootstrap grid and custom CSS for hero sections, property cards, and mobile-optimized layouts.
- Accessibility: semantic HTML, color contrast via dark navbar, clear typography, and keyboard navigation support.

7. Evaluation
-------------
- Functional tests: verified CRUD read endpoints, contact form insert with email notifications, listing creation with real-time updates, geolocation-based search, and admin registration functionality.
- Performance: fast local response; SQLite sufficient for small/medium datasets. Socket.IO offers instantaneous notifications under typical loads for Ndola's market size. Geolocation calculations perform efficiently with Haversine formula.
- Real Data Integration: Successfully imported and displays 10 actual Ndola properties with authentic contact details, GPS coordinates, and area-specific information.
- Email System: Contact form notifications working with Gmail SMTP integration, providing immediate email alerts for property inquiries.
- User Experience: "Near Me" functionality provides accurate distance-based property discovery with GPS integration and proximity sorting.
- Validation: HTML references external CSS; forms validate required fields client- and server-side with comprehensive error handling.

8. Novelty and Contribution
---------------------------
Localized, real-time-first property discovery for Ndola with actual property data integration, built with a minimal and replicable stack. The novelty includes: Ndola-specific focus with real property data, GPS-based "Near Me" discovery with distance calculations, instant email notifications for inquiries, dynamic admin statistics, and WebSocket-powered real-time listing updates. The system bridges the gap between global property platforms and local Ndola market needs.

9. Current Features Implemented
-------------------------------
- ✅ Real Ndola property data (10 properties across multiple areas)
- ✅ Email notifications via Gmail SMTP for contact form submissions
- ✅ GPS-based "Near Me" functionality with 10km radius search
- ✅ Dynamic admin dashboard with real-time statistics
- ✅ Admin registration system with proper role assignment
- ✅ Custom favicon and professional branding
- ✅ WebSocket real-time notifications for new listings
- ✅ Comprehensive search and filtering system
- ✅ Media upload support for property images/videos
- ✅ Responsive design optimized for mobile and desktop

10. Limitations and Future Work
-------------------------------
- Map integration (OpenStreetMap/Google Maps) for visual property locations
- Advanced geospatial queries beyond current Haversine implementation
- Cloud storage (S3) and CDN for media at scale
- SMS notifications alongside email alerts
- Password reset and email verification for enhanced security
- Migration to Postgres when multi-writer concurrency is required
- Integration with additional property data sources
- Advanced analytics and reporting features

11. How to Run
--------------
1) Install Node.js LTS
2) `npm install` (installs all dependencies including nodemailer)
3) Set up email configuration in `.env` file with Gmail app password
4) `npm run seed` (optional - creates demo users)
5) Import real data: `node scripts/data-import.js csv data/manual-ndola-listings.csv`
6) `npm run dev` (starts server with nodemon)
7) Visit `http://localhost:3000` for main site or `http://localhost:3000/admin` for admin panel

Email Setup:
- Generate Gmail app password at https://myaccount.google.com/apppasswords
- Update EMAIL_PASS in .env file with the generated password
- Contact form submissions will be sent to misheckmwamba99@gmail.com

Auth quick start:
- Register new admin via admin panel registration tab
- Login (agent): `agent@example.com` / `agent123` → can create listings
- Login (admin): `admin@example.com` / `admin123`
- Login (user): `user@example.com` / `user123`

Real Data:
- 10 actual Ndola properties imported from manual-ndola-listings.csv
- Properties span Kansenshi, Northrise, CBD, Masala, Town Centre, and Industrial areas
- Includes both rental and sale properties with authentic contact details

12. References
--------------
- Express.js documentation
- SQLite documentation  
- Socket.IO documentation
- Bootstrap documentation
- Nodemailer documentation
- MDN Geolocation API documentation


