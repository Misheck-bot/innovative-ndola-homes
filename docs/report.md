Ndola Homes: A Real-Time Real Estate Platform for Ndola
=======================================================

1. Abstract
-----------
This project delivers a responsive, real-time real estate web platform tailored to Ndola. Users can search listings for rent/sale, view photos/videos, and contact agents. Real-time capabilities notify users of new listings instantly. The system persists data using SQLite.

2. Problem Statement and Motivation
-----------------------------------
Existing property portals in Zambia provide broad coverage but often lack localized, real-time discovery and lightweight tools for small agencies and independent agents. In Ndola, up-to-date availability and fast communication are critical. The gap: a focused, low-cost, real-time solution enabling fast listing, search, and contact for Ndola’s market.

3. Objectives
-------------
- Provide a searchable catalog of properties for rent and sale in Ndola
- Support rich media (photos and videos)
- Enable instant notifications for newly posted listings
- Persist data across sessions with a reliable database
- Offer a responsive UI that works across devices
- Keep the stack lightweight and easy to deploy locally or on a small VPS

4. Literature and Market Review
--------------------------------
Global portals (e.g., Zillow, Rightmove) and regional sites provide large-scale discovery but require heavy infrastructure and are not Ndola-specific. Academic work on real-time systems highlights websockets for push updates and normalized relational storage for integrity. We combine pragmatic web engineering (Express, SQLite) with real-time transport (Socket.IO) to achieve low-latency updates without complex ops.

5. Methodology and System Design
--------------------------------
- Architecture: Node.js (Express) server, SQLite database, Socket.IO for real-time events.
- Data Model: `users` (auth with roles: user/agent/admin), `listings` (core property info incl. owner fields), `media` (image/video per listing), `contacts` (inquiries).
- API Endpoints: listings search/read; contact submission; admin upload for new listings with media.
- Real-time: server emits `listing:new` on successful creation; clients subscribe and update UX.
- Frontend: Bootstrap-based responsive layout; external CSS file for validation.
- Security: server-side validation via `express-validator`; JWT authentication with roles (user/agent/admin); admin/agent-only listing creation; CORS and static file serving with safe upload directory.

6. Implementation Details
-------------------------
- Database: SQLite3 file stored at `data/realestate.db` with auto-migration on server start. Tables:
  - `users(id, name, email UNIQUE, password_hash, role, created_at)`
  - `listings(id, title, description, price, type, bedrooms, bathrooms, city, area, address, owner_name, owner_email, owner_phone, latitude, longitude, thumbnail_url, created_at)`
  - `media(id, listing_id, url, kind)`
  - `contacts(id, listing_id, name, email, phone, message, created_at)`
  Geolocation search supported via lat/lon + radius (bounding-box approximation).
- Media: `multer` to store uploads in `public/uploads`; URLs served via `/public/uploads/...`.
- Search: server-side filtering by keyword, type, price, bedrooms, and city.
- Responsiveness: Bootstrap grid and custom CSS for hero and cards.
- Accessibility: semantic HTML, color contrast via dark navbar and clear text.

7. Evaluation
-------------
- Functional tests: verified CRUD read endpoints, contact form insert, and listing creation.
- Performance: fast local response; SQLite sufficient for small/medium datasets. Socket.IO offers instantaneous notifications under typical loads for Ndola’s market size.
- Validation: HTML references an external CSS; forms validate required fields client- and server-side.

8. Novelty and Contribution
---------------------------
Localized, real-time-first property discovery for Ndola, built with a minimal and replicable stack. The novelty is in focus (Ndola), speed-to-list (admin upload), and instant discovery (websocket events) for small agencies.

9. Limitations and Future Work
------------------------------
- Authentication/authorization implemented with JWT and roles; future work: password reset, email verification, refresh tokens.
- Add map view and precise geospatial queries (Haversine) beyond bounding-box approximation.
- Map integration (OpenStreetMap) for geospatial filters.
- Cloud storage (S3) and CDN for media at scale.
- Email/SMS notifications for contact submissions.
- Migration to Postgres when multi-writer concurrency is required.

10. How to Run
--------------
1) Install Node.js LTS. 2) `npm install`. 3) `npm run seed` (optional but recommended). 4) `npm run dev`. Visit `http://localhost:3000`.

Auth quick start:
- Login (agent): `agent@example.com` / `agent123` → can create listings
- Login (admin): `admin@example.com` / `admin123`
- Login (user): `user@example.com` / `user123`

11. References
--------------
- Express.js documentation
- SQLite documentation
- Socket.IO documentation
- Bootstrap documentation


