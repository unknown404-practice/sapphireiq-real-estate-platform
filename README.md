# SapphireIQ - Premium Real Estate Platform for India

SapphireIQ is a full-stack real estate platform built with **React + TypeScript**, **Node.js + Express + TypeScript**, and **MongoDB (Mongoose)**. The platform enables browsing and filtering verified Indian properties for sale and rent, direct viewing appointment bookings (both guest and authenticated), user property listing management with server-side ownership enforcement, and a comprehensive user dashboard.

---

## 1. Architecture & Tech Stack

```
sapphireiq/
├── backend/
│   ├── src/
│   │   ├── config/          # Environment variables & DB connection
│   │   ├── controllers/     # Auth, Property, and Appointment business logic
│   │   ├── middleware/      # JWT auth, strict CORS, Helmet, error handler, rate limiters
│   │   ├── models/          # User, Property, and Appointment Mongoose schemas
│   │   ├── routes/          # Express API route definitions
│   │   ├── services/        # Email (Nodemailer) and Image upload (ImageKit/Disk)
│   │   ├── scripts/         # Realistic Indian demo database seeder
│   │   ├── types/           # Shared backend TypeScript types
│   │   ├── app.ts           # Express application setup
│   │   └── server.ts        # Server entrypoint and graceful shutdown
│   └── tests/               # Vitest + Supertest + In-Memory MongoDB test suite
├── frontend/
│   ├── public/              # Static assets, robots.txt, sitemap.xml
│   ├── src/
│   │   ├── components/      # Navbar, Footer, PropertyCard, ViewingModal, ProtectedRoute
│   │   ├── context/         # AuthContext (JWT management & session state)
│   │   ├── pages/           # Home, Properties, Detail, Dashboard, Login, Register, Forgot/Reset
│   │   ├── services/        # Typed API client
│   │   ├── types/           # Frontend TypeScript interfaces
│   │   ├── utils/           # INR currency & date formatters
│   │   ├── App.tsx          # React Router configuration with React.lazy
│   │   └── main.tsx         # App bootstrap with Tailwind CSS
└── docs/                    # Architecture Decision Record (ADR) and Agent Task Ledger
```

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide React icons, React Router DOM v6.
- **Backend**: Express, TypeScript, Mongoose, JWT (`jsonwebtoken`), bcryptjs, Multer, Helmet, CORS, Express-Rate-Limit, Nodemailer.
- **Database**: MongoDB (with local/in-memory test server support via `mongodb-memory-server`).
- **Testing**: Vitest with in-memory MongoDB for fully reproducible, zero-setup automated test suites.

---

## 2. Getting Started & Setup

### Prerequisites
- Node.js `v18+` (Tested on `v24.15.0`)
- npm `v9+`
- MongoDB instance (Local MongoDB, Docker, or MongoDB Atlas connection string)

### Quick Start Installation

```bash
# 1. Install all dependencies across root, backend, and frontend
npm install

# 2. Seed database with realistic Indian property catalog (Mumbai, Bengaluru, Delhi NCR, Kolkata, etc.)
npm run seed

# 3. Start both backend and frontend development servers in separate terminals
# Terminal 1 (Backend API on http://localhost:4000):
npm run dev:backend

# Terminal 2 (Frontend Client on http://localhost:5173):
npm run dev:frontend
```

---

## 3. Environment Configuration

### Backend (`backend/.env`)
| Variable | Description | Default |
| :--- | :--- | :--- |
| `NODE_ENV` | Environment mode (`development`, `production`, `test`) | `development` |
| `PORT` | API server port | `4000` |
| `MONGODB_URI` | MongoDB connection URI | `mongodb://localhost:27017/sapphireiq` |
| `JWT_SECRET` | Secret key for signing authentication tokens | (Change in production) |
| `APP_ORIGIN` | Allowed client origin for CORS | `http://localhost:5173` |
| `SMTP_HOST` | *(Optional)* SMTP host for password reset emails | *Unset (simulated)* |
| `SMTP_PORT` | *(Optional)* SMTP port | `587` |
| `SMTP_USER` | *(Optional)* SMTP user credentials | *Unset* |
| `SMTP_PASS` | *(Optional)* SMTP password | *Unset* |
| `EMAIL_FROM` | Outgoing email address | `no-reply@sapphireiq.local` |
| `IMAGEKIT_PUBLIC_KEY` | *(Optional)* ImageKit CDN public key | *Unset (falls back to local uploads)* |
| `IMAGEKIT_PRIVATE_KEY`| *(Optional)* ImageKit private key | *Unset* |
| `IMAGEKIT_URL_ENDPOINT`| *(Optional)* ImageKit URL endpoint | *Unset* |

### Frontend (`frontend/.env`)
| Variable | Description | Default |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Base endpoint for backend API | `/api` |
| `VITE_ENABLE_AI_HUB` | Feature flag for optional AI scraping/ranking | `false` |

---

## 4. API Endpoints

### Health & Monitoring
- `GET /api/health` - Safe readiness probe checking database connectivity and service uptime.

### Authentication (`/api/auth` & `/api/users`)
- `POST /api/auth/register` - Create account (`name`, `email`, `password`, `phone`).
- `POST /api/auth/login` - Authenticate and receive JWT token.
- `GET /api/auth/me` & `GET /api/users/me` - Retrieve current authenticated profile (Requires Bearer token).
- `POST /api/auth/forgot-password` - Request password reset token.
- `POST /api/auth/reset-password` - Reset password with token.

### Properties (`/api/properties`)
- `GET /api/properties` - List published properties with query filters (`city`, `propertyType`, `listingType`, `minPrice`, `maxPrice`, `bedrooms`, `search`, `sort`, `page`, `limit`).
- `GET /api/properties/:id` - Fetch single property details.
- `POST /api/properties` - Create new listing (Requires Bearer token; `owner` derived from auth).
- `PATCH /api/properties/:id` - Edit listing (Enforces server-side ownership: only owner or admin).
- `DELETE /api/properties/:id` - Delete listing (Enforces server-side ownership: only owner or admin).
- `POST /api/properties/upload-images` - Upload up to 4 images (Multipart form-data, max 5MB/image).
- `GET /api/properties/user/mine` - Fetch listings created by the current authenticated user.

### Viewing Appointments (`/api/appointments`)
- `POST /api/appointments/guest` - Public, rate-limited appointment booking for guests.
- `POST /api/appointments` - Authenticated appointment booking.
- `GET /api/appointments/mine` - View appointments booked by user or for properties owned by user.
- `PATCH /api/appointments/:id/cancel` - Cancel viewing appointment (Requires booker/owner authorization).

---

## 5. Security & Verification Record

- **Server-Side Authorization**: Property and appointment modifications strictly verify `req.user.id === resource.owner` on the server before mutating records. Client-provided owners are rejected.
- **HTTP Hardening**: Configured with `helmet`, strict CORS allowlisting, and request size boundaries.
- **Rate Limiting**: Protects sensitive authentication routes and public booking endpoints from brute force and denial of service.
- **Automated Tests**: Comprehensive integration test suite using Vitest and `mongodb-memory-server` testing all critical flows (health, auth, ownership attacks, bookings). Run tests using `npm test`.

---

## 6. Deployment Guide (Render Backend & Vercel Frontend)

### Step 1: Push to GitHub

Initialize the repository, commit all tracked files, and push to your GitHub account:

```bash
git init
git add .
git commit -m "feat: complete SapphireIQ full-stack real estate platform"
git branch -M main
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/<YOUR_REPOSITORY_NAME>.git
git push -u origin main
```

*(Note: `.env`, `node_modules/`, `dist/`, and local uploads are ignored by `.gitignore` to ensure zero credentials or build artifacts are pushed).*

---

### Step 2: Deploy Backend to Render

1. Log in to [Render](https://dashboard.render.com/) and click **New +** -> **Web Service** (or use **Blueprint** with the included `render.yaml`).
2. Connect your GitHub repository.
3. If creating manually via Web Service:
   - **Name**: `sapphireiq-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Health Check Path**: `/api/health`
4. In the **Environment Variables** tab, add:
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (Render sets this automatically)
   - `MONGODB_URI`: `<YOUR_MONGODB_ATLAS_CONNECTION_STRING>`
   - `JWT_SECRET`: `<STRONG_RANDOM_SECRET_AT_LEAST_32_CHARS>`
   - `APP_ORIGIN`: `https://<YOUR_VERCEL_FRONTEND_DOMAIN>.vercel.app`
   - *(Optional for cloud media)*: `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT`
5. Click **Deploy Web Service**. Once deployed, copy your backend URL (e.g. `https://sapphireiq-backend.onrender.com`).

---

### Step 3: Deploy Frontend to Vercel

1. Log in to [Vercel](https://vercel.com/) and click **Add New...** -> **Project**.
2. Import your GitHub repository.
3. In project configuration:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend` (or leave as root; both root and frontend include pre-configured `vercel.json` rewrite files for single-page client routing)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. In the **Environment Variables** section, add:
   - `VITE_API_BASE_URL`: `https://<YOUR_RENDER_BACKEND_NAME>.onrender.com/api`
   - `VITE_ENABLE_AI_HUB`: `false`
5. Click **Deploy**. Vercel will build and assign your production domain (e.g. `https://sapphireiq.vercel.app`).

---

### Step 4: Final Connection & CORS Alignment

1. Return to the Render dashboard for your backend service.
2. In **Environment Variables**, verify `APP_ORIGIN` matches your assigned Vercel URL (e.g. `https://sapphireiq.vercel.app`).
3. Render will redeploy with the updated CORS configuration, enabling secure communication between frontend and backend.
4. Verify by visiting `https://<YOUR_VERCEL_FRONTEND_DOMAIN>.vercel.app` in your browser.
