# QA-CRITICAL-02: PROPERTY/APPOINTMENT LIFECYCLE INTEGRITY AUDIT REPORT

**Audit Date:** 2026-10-29  
**Engineer:** Senior Database Integrity & Backend Testing Engineer  
**Target Platform:** SapphireIQ Full-Stack Real Estate Platform  
**Status:** PASS (All Criteria Met)

---

## 1. Executive Summary & Strategy Identification

The SapphireIQ platform implements a **Hybrid Dual-Resilience Architecture** to guarantee appointment data integrity across the property lifecycle:

1. **Primary Strategy for Property Deletion: Strategy B (Denormalized Property Summary Fields on Appointment Records)**
   - The `Appointment` Mongoose schema (`backend/src/models/Appointment.ts`) denormalizes:
     - `propertyTitle: String`
     - `propertyCity: String`
     - `propertyThumbnail: String`
     - `propertyPrice: Number`
     - `propertyOwner: ObjectId (ref: 'User')`
   - When a property is hard-deleted via `DELETE /api/properties/:id`:
     - The property document is deleted from the `Property` collection.
     - Associated `pending` viewing appointments are gracefully updated to `status: 'cancelled'` with note: `"Property listing was removed by owner"`.
     - Existing `confirmed` and `completed` appointments remain intact in their respective states.
     - All appointments retain the immutable historical property summary.
     - Querying `/api/appointments/mine` utilizes an `$or` clause matching `{ propertyOwner: req.user.id }` and `{ user: req.user.id }`, ensuring both owner and viewer can retrieve appointments even when the property reference (`appt.property`) resolves to `null`.
     - Frontend (`frontend/src/pages/DashboardPage.tsx`) checks `propObj = typeof appt.property === 'object' && appt.property !== null ? appt.property : null`, safely rendering `appt.propertyTitle` and `appt.propertyCity (Listing no longer active)` without dashboard crashes.

2. **Secondary Strategy for Listing Management: Strategy A (Soft Archival using `status: 'archived'`)**
   - The `Property` schema allows `status: 'draft' | 'published' | 'archived'`.
   - Updating `status: 'archived'` via `PATCH /api/properties/:id` keeps the property record in MongoDB.
   - Public discovery (`GET /api/properties`) filters by `{ status: 'published' }`, excluding archived properties.
   - Single property retrieval (`GET /api/properties/:id`) returns `404 Not Found` for unauthenticated or non-owner users, while allowing the owner to access it.
   - New viewing appointment bookings on archived properties are rejected with `404 Not available for booking`.
   - Existing appointments maintain active populated property details.

---

## 2. Live Reproduction & Verification Walkthrough

The audit was executed against the running backend API (`http://localhost:4000/api`) and verified live in Google Chrome running the React frontend (`http://localhost:5173/dashboard`).

### Step 1: User & Property Provisioning
- **Owner (User A):** Ranadeep Saha (`ranadeep2021saha@gmail.com`, ID: `6ae2e9f7dd39f7ddfb591c0c`)
- **Buyer (User B):** Priya Mukherjee (`user2@sapphireiq.local`, ID: `6ae2e859a91caba14ec1d783`)
- **Intruder (User C):** Aarav Sharma (`user1@sapphireiq.local`, ID: `6ae2e859a91caba14ec1d781`)
- **Created Property:**
  - **Property ID:** `6ae31d247706b11489bf9402`
  - **Title:** `"QA Audit DLF Magnolias Super Luxury Villa"`
  - **Type:** Villa (Sale) | **Price:** ₹6,50,00,000 (INR 65,000,000)
  - **City:** Gurugram | **Locality:** DLF Golf Links, Sector 42
  - **Status:** `published`

### Step 2: Appointment Creation
1. **Appointment 1 (Public Guest Booking):**
   - **ID:** `6ae31d247706b11489bf9407`
   - **Guest Name:** `Dr. Evelyn Reed (Guest)`
   - **Guest Email:** `evelyn.reed.audit@example.com`
   - **Scheduled:** `2026-11-03T10:17:08.163Z`
   - **Status:** `pending`
   - **Captured Denormalized Fields:**
     - `propertyTitle`: `"QA Audit DLF Magnolias Super Luxury Villa"`
     - `propertyCity`: `"Gurugram"`
     - `propertyPrice`: `65000000`
     - `propertyThumbnail`: `"https://images.unsplash.com/photo-1580587771525-78b9dba3b914..."`
     - `propertyOwner`: `"6ae2e9f7dd39f7ddfb591c0c"`

2. **Appointment 2 (Authenticated Buyer Booking):**
   - **ID:** `6ae31d247706b11489bf940b`
   - **User ID:** `6ae2e859a91caba14ec1d783` (Priya Mukherjee)
   - **Scheduled:** `2026-11-05T10:17:08.373Z`
   - **Status:** `confirmed` (Confirmed by Owner via `PATCH /api/appointments/:id/status`)
   - **Captured Denormalized Fields:** Matches Property fields identically.

### Step 3: Property Deletion via Authorized API
- **Endpoint:** `DELETE /api/properties/6ae31d247706b11489bf9402`
- **Caller:** User A (Owner)
- **HTTP Response:** `200 OK` — `{"success":true,"message":"Property successfully deleted"}`

### Step 4: Post-Deletion Database & API Inspection
- **Property Get (`GET /api/properties/6ae31d247706b11489bf9402`):** `404 Not Found` (Verified hard deletion).
- **Public Search (`GET /api/properties?search=Magnolias`):** Property not found (`foundInPublicSearch: false`).
- **Owner Appointment Retrieval (`GET /api/appointments/mine`):**
  - **Appointment 1 (`6ae31d247706b11489bf9407`):**
    - `property: null`
    - `status: "cancelled"` (Correctly cancelled due to property removal)
    - `notes: "Property listing was removed by owner"`
    - `propertyTitle`, `propertyCity`, `propertyThumbnail`, `propertyPrice`, `propertyOwner`: 100% intact.
  - **Appointment 2 (`6ae31d247706b11489bf940b`):**
    - `property: null`
    - `status: "confirmed"` (Confirmed status preserved)
    - `propertyTitle`, `propertyCity`, `propertyThumbnail`, `propertyPrice`, `propertyOwner`: 100% intact.
- **Buyer Appointment Retrieval (`GET /api/appointments/mine`):**
  - Appointment 2 retrieved successfully with full denormalized summary.
- **Intruder Appointment Retrieval (`GET /api/appointments/mine`):**
  - Returned `0` appointments. Privacy strictly preserved.

### Step 5: Frontend Dashboard & Live Browser Interaction
- Navigated browser to `http://localhost:5173/dashboard`.
- Property tab showed: `My Property Listings (0)`.
- Appointments tab showed: `Viewing Appointments (3)`.
- **Rendered Output:**
  - Confirmed Appointment: Rendered green `CONFIRMED` badge, `QA Audit DLF Magnolias Super Luxury Villa`, `Gurugram (Listing no longer active)`, visitor details, and action buttons (`Mark Completed`, `Cancel Booking`).
  - Cancelled Appointment: Rendered strike-through `CANCELLED` badge, `Note: Property listing was removed by owner`.
- **Browser Refresh Test:** Refreshed browser tab; full state reloaded cleanly with zero console warnings or React render errors.
- **State Transition on Deleted Property Appointment:**
  - Owner clicked `Mark Completed` on the confirmed appointment in the browser.
  - Status transitioned to `COMPLETED` (`200 OK`, `Appointment status successfully marked as completed.`).
  - Proves that controller status update authorization correctly checks `appointment.propertyOwner` when `appointment.property` is `null`.

---

## 3. Soft Archival Verification (Strategy A)

A dedicated property (`QA Soft Archival Luxury Penthouse - Worli`, ID `6ae31e...`) was created and transitioned to `status: 'archived'`:

| Check | Expected Result | Actual Result | Status |
|---|---|---|---|
| Property status becomes `'archived'` | `status: 'archived'` | `status: 'archived'` | PASS |
| DB record remains present | Record exists in MongoDB | Accessible by owner (`200 OK`) | PASS |
| Public search excludes archived | Excluded from `GET /api/properties` | `foundInPublicSearch: false` | PASS |
| Unauthenticated access blocked | Returns 404 | `404 Not Found` | PASS |
| Unauthorized user access blocked | Returns 404 | `404 Not Found` | PASS |
| Appointments retrievable by owner & buyer | Appointments returned | Appointments returned with populated property | PASS |
| Intruder blocked from appointments | Intruder receives 0 appointments | `intruderCount: 0` | PASS |
| Repeated archive requests safe | Idempotent | `200 OK` | PASS |
| Unauthorized publish/modification blocked | 403 Forbidden | `403 Forbidden` | PASS |
| Booking on archived property blocked | 404 Not available | `404 Not available for booking` | PASS |

---

## 4. Edge Cases Audit Matrix

| Edge Case | Test Scenario | Observed Outcome | Status |
|---|---|---|---|
| **Property with zero appointments** | Delete property that has no appointments | Property deleted cleanly (`200 OK`) | PASS |
| **Property with multiple mixed appointments** | Property with pending, confirmed, completed appointments deleted | Pending appointments transitioned to `cancelled`; confirmed and completed appointments remained intact with denormalized summary | PASS |
| **Pre-cancelled appointment** | Appointment manually cancelled before property deletion | Status remained `cancelled`; original notes preserved without overwrite | PASS |
| **Repeated deletion request** | Call `DELETE /api/properties/:id` on already deleted property | Returns `404 Not Found` safely without crash | PASS |
| **Invalid property reference** | Booking with invalid ObjectId or non-existent ID | Invalid ObjectId returns `400 Bad Request`; non-existent ID returns `404 Not Found` | PASS |
| **Failed deletion / Auth check** | Non-owner/intruder attempts `DELETE /api/properties/:id` | Returns `403 Forbidden`; property and appointments remain 100% untouched | PASS |
| **Subsequent property edits** | Property title and price edited after appointment booking | Original appointment records retain initial denormalized snapshot without corruption | PASS |

---

## 5. Schema & Field Contract Audit

- **Backend Mongoose Schema (`backend/src/models/Appointment.ts`):**
  - Defines `propertyTitle`, `propertyCity`, `propertyThumbnail`, `propertyPrice`, `propertyOwner`.
- **Backend TypeScript Types (`backend/src/types/index.ts`):**
  - `IAppointment`: Includes all 5 denormalized fields.
- **Frontend TypeScript Types (`frontend/src/types/index.ts`):**
  - `Appointment`: Includes all 5 denormalized fields.
- **Frontend Component (`frontend/src/pages/DashboardPage.tsx`):**
  - Safely falls back to `appt.propertyTitle || 'Archived Property'` and `appt.propertyCity && `${appt.propertyCity} (Listing no longer active)`` when `appt.property` is `null`.
