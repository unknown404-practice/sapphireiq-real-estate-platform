# Architecture Decision Record (ADR) - SapphireIQ

## 1. Authentication & Session Strategy
- **Mechanism**: JWT (JSON Web Tokens) with Bearer token authentication header (`Authorization: Bearer <token>`).
- **Token Storage**: Frontend stores token in localStorage, cleared on logout or 401 response.
- **Security**: Passwords hashed with bcrypt (salt rounds = 10). Sensitive fields (`password`, `resetPasswordToken`, `resetPasswordExpires`) excluded from API responses and query projections (`select: false`).
- **Password Reset**: Cryptographically secure random tokens generated via `crypto.randomBytes(32).toString('hex')`. Stored as SHA-256 hashes with a 1-hour expiration. If SMTP is configured, email is dispatched; if not configured, safe generic response is returned and token is handled cleanly for development/testing without crashing.

## 2. API Contract & Conventions
- **Base URL**: `/api`
- **Response Format**: Standard JSON `{ success: boolean, data?: any, message?: string, error?: string, pagination?: { total, page, limit, pages } }`
- **HTTP Security**: Helmet headers, strict CORS against `APP_ORIGIN`, JSON body size limit (10MB for multi-image payloads), Express rate limiting on sensitive routes.
- **Error Handling**: Centralized error middleware converting Mongoose validation, CastErrors, DuplicateKey errors (11000), and custom AppErrors into clean, safe JSON responses with appropriate HTTP status codes.

## 3. Image Strategy
- **Constraint**: Up to 4 images per property.
- **Handling**: Multer parses multipart file uploads. Validation checks mime-types (`image/jpeg`, `image/png`, `image/webp`) and size limit (5MB per file).
- **Storage**: If ImageKit environment variables (`IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT`) are provided, images are uploaded to ImageKit CDN. If ImageKit is not configured, the system provides a seamless local static upload fallback (`/uploads/...`) and handles mock/seed image URLs gracefully so image display and upload work completely out of the box.

## 4. Property Domain & Security Model
- **Pricing**: INR (₹) representation across all UI elements and filters.
- **Ownership Verification**: All mutative operations (PATCH, DELETE) on properties and appointments strictly derive ownership from `req.user._id` and compare with resource owner ID on the server. Client-supplied owner fields are discarded.
- **Search & Filters**: Sanitized, type-checked query parameters (City, PropertyType, ListingType, Min/Max Price, Min/Max Area, Bedrooms). No raw MongoDB operators allowed from user input.

## 5. Viewing Appointments
- **Modes**: Both guest booking (with guest name, email, phone) and authenticated user booking (linked to `req.user._id`).
- **Validation**: Booking requires future date/time. Status workflow transitions: `pending -> confirmed | cancelled`. Users can only view and cancel their own bookings.
