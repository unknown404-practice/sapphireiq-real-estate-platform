# FINAL INDEPENDENT VERIFICATION AUDIT REPORT: SAPPHIREIQ PLATFORM

**Auditing Agent:** Independent Security & Quality Assurance Subagent  
**Audit Target:** SapphireIQ Full-Stack Real Estate Platform  
**Target Environments:** Backend API (`http://localhost:4000`), Vite React Frontend (`http://localhost:5173`), MongoDB Atlas Cluster  
**Prior Audits Under Review:** `docs/QA_CRITICAL_01_BOUNDARY_AUDIT.md` & `docs/QA_CRITICAL_02_LIFECYCLE_AUDIT.md`  
**Automated Suites Examined:** `backend/tests/flaw_fixes.test.ts`, `backend/tests/appointments.test.ts`, `backend/tests/properties.test.ts`, `backend/tests/auth.test.ts`, `backend/tests/health.test.ts`  
**Overall Verdict:** **VERIFIED (ALL 5 FIXES TESTED LIVE WITH FULL REGRESSION TEST SUITE PASSING)**

---

## 1. Executive Summary & Verification Verdicts

An exhaustive, independent verification audit was conducted without assuming the correctness of prior QA reports. The investigation examined source code, evaluated regression test coverage, executed live API requests with isolated test data, and interacted directly with the frontend client in Google Chrome.

### Verdict per Original Fix:

| Fix Identifier | Description | Audit Status | Key Live Evidence |
| :--- | :--- | :--- | :--- |
| **Fix A** | **String Type Guards in Controllers** | **VERIFIED** | 100% of malformed payloads (numbers, arrays, NoSQL injection objects) across Auth, Property, and Appointment controllers produced HTTP 400 Bad Request. Route parameters (`:id`) guarded against non-ObjectId values. Zero unhandled 500 `TypeError` exceptions. |
| **Fix B** | **Multer File Filter Error Handling** | **VERIFIED** | Live multipart file uploads with disallowed MIME types (`text/plain`, `application/pdf`, `image/gif`, `text/html`), oversized files (6MB), excessive files (5 files), and empty uploads returned HTTP 400 with clean JSON error messages. Valid PNGs accepted with HTTP 200. Rejected files never persisted to disk. |
| **Fix C** | **CORS Rejection Callback & Auth Gate** | **VERIFIED** | Permitted origin (`http://localhost:5173`) receives `Access-Control-Allow-Origin: http://localhost:5173` and `Access-Control-Allow-Credentials: true`. Disallowed origins receive no CORS allowance headers via `callback(null, false)` without 500 errors. Protected endpoints return HTTP 401 Unauthorized regardless of origin or CORS headers, proving auth independence. |
| **Fix D** | **Property Deletion & Appointment Integrity** | **VERIFIED** | Deletion of a property with appointments across **all 4 states** (`pending`, `confirmed`, `cancelled`, `completed`) demonstrated dual-resilience. `pending` transitioned to `cancelled` with removal note; `confirmed`, `cancelled`, and `completed` appointments preserved their exact state and notes. Denormalized property summaries remained 100% intact. Dashboard rendered cleanly with `(Listing no longer active)`. |
| **Fix E** | **Full Image Decoding, Decompression Bomb Defense & Atomic Storage** | **VERIFIED** | Full raster decoding via Sharp (`failOn: 'error'`), 4096px/16MP decompression bomb defense, metadata/polyglot stripping, safe re-encoding, and atomic multi-file upload rollback verified live with zero orphaned files on mid-stream failure. |

---

## 2. Automated Test Counts Reconciliation

The automated test suite was executed via the project repository's root command `npm test` (`npm --workspace=backend run test`, invoking `vitest run --passWithNoTests`) against the isolated MongoDB Atlas test database (`sapphireiq_test`).

### Test Count Progression & Discrepancy Resolution
1. **Initial Audit Baseline**: 47 tests passed (17 flaw fixes + 10 appointments + 9 properties + 9 auth + 2 health).
2. **Magic Byte Signature Addition**: 4 tests added to `flaw_fixes.test.ts` (bringing the file to 21 tests, and total to 51 tests).
3. **Full Image Decoding & Decompression Bomb Addition**: 3 tests added to `flaw_fixes.test.ts` (bringing the file to 24 tests, and total to 54 tests).
4. **Mid-Stream Storage Failure Rollback Test Addition**: 1 test added to `flaw_fixes.test.ts` simulating a disk I/O failure on file 2 to prove active rollback and removal of file 1 (bringing the file to 25 tests, and total to 55 tests).
5. **Failed Cleanup Detection & Safe Logging Addition**: 1 test added simulating an unlink failure (`EPERM`) during rollback cleanup to confirm that cleanup failure is detected, logged safely without exposing secrets, and surfaced as an unresolved failure (bringing the file to 26 tests, and total to 56 tests).
6. **Orphaned Upload Security & Resilience Addition**: 6 tests added to `flaw_fixes.test.ts` covering `reconcile-orphans` admin authorization, path traversal attack blocking, worker idempotency, concurrency safety with atomic claiming, tracking persistence failure detection, and fallback directory-level disk sweeping (bringing the file to 32 tests, and total to 62 tests).
7. **Orphan Sweeper Safety & Upload Lifecycle Addition**: 5 tests added to `flaw_fixes.test.ts` validating upload-before-property-save grace period protection, slow form submission survival, abandoned upload purge after 1 hour, property-save failure recovery, and concurrent sweeper execution safety (bringing the file to 37 tests, and total to **67 tests**).

The actual test runner output confirms that **67 tests executed, 67 passed, 0 failed, and 0 skipped** across all 5 test files:

| Test Suite File | Test Count | Pass Count | Fail Count | Focus Area |
| :--- | :--- | :--- | :--- | :--- |
| `tests/flaw_fixes.test.ts` | 37 | 37 | 0 | Type guards, Multer 400 status, binary magic bytes, Sharp raster decoding, 4096px/16MP decompression bomb defense, atomic pre-validation, mid-stream storage failure rollback, failed cleanup detection with safe secret-free logging, persistent orphan tracking, admin authorization on reconciliation, path traversal blocking, worker idempotency, atomic claiming concurrency protection, tracking persistence failure detection, directory-level disk sweeping with 1-hour grace period, upload-before-save preservation, slow-form submission tolerance, abandoned upload purging, property-save failure recovery, concurrent sweeper safety, appointment snapshot denormalization across all 4 states, route parameter ObjectId guards |
| `tests/appointments.test.ts` | 10 | 10 | 0 | Guest/auth bookings, owner self-booking rejection, privacy isolation, cancellation workflows |
| `tests/properties.test.ts` | 9 | 9 | 0 | Property CRUD, owner authorization enforcement, query filters, image limit constraints |
| `tests/auth.test.ts` | 9 | 9 | 0 | Registration, bcrypt hashing, login, token issuance, `/api/users/me`, and password reset |
| `tests/health.test.ts` | 2 | 2 | 0 | System health readiness and unhandled route 404 handler |
| **Total Across Monorepo** | **67** | **67** | **0** | **100% Passing Rate (Duration: ~61.1s)** |

---

## 3. Independent Upload Boundary & Multer Testing

The real upload endpoint (`POST /api/properties/upload-images`) was tested with real multipart form-data requests with an authenticated user Bearer token:

| Test Scenario | Input Payload / Form Data | Expected Result | Actual Observed Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Upload Size Limit** | 6MB buffer (> 5MB max) | HTTP 400 | HTTP 400 `{"success":false,"error":"File size limit exceeded (maximum 5MB allowed per image)"}` | **PASS** |
| **Four-Image Maximum** | 5 PNG attachments (> 4 limit) | HTTP 400 | HTTP 400 `{"success":false,"error":"Maximum of 4 images allowed per property"}` | **PASS** |
| **Unsupported MIME Type** | `malicious.php` (`application/x-php`) | HTTP 400 | HTTP 400 `{"success":false,"error":"Invalid file type. Only JPEG, PNG, and WebP images are allowed."}` | **PASS** |
| **MIME/Content Mismatch** | `exploit.jpg` with `text/html` content | HTTP 400 | HTTP 400 `{"success":false,"error":"Invalid file type. Only JPEG, PNG, and WebP images are allowed."}` | **PASS** |
| **Empty Upload Body** | 0 files attached in multipart | HTTP 400 | HTTP 400 `{"success":false,"error":"No image files uploaded"}` | **PASS** |
| **Valid PNG Image** | 1x1 valid PNG (`image/png`) | HTTP 200 | HTTP 200 `{"success":true,"data":[{"url":"/uploads/1793269991140-927930483.png",...}]}` | **PASS** |
| **Storage Isolation** | Direct GET to rejected upload URLs | HTTP 404 | All rejected files returned HTTP 404 (never stored on disk) | **PASS** |

---

## 4. Property Deletion & All 4 Appointment States Lifecycle Verification

### Investigation: Policy for Confirmed Appointments
- **Policy Definition:** In real estate workflows, an appointment with status `confirmed` represents an agreement between seller and buyer that a viewing was scheduled. When a property listing is removed or sold, the confirmed booking represents historical business record data.
- **Intended Behavior:**
  - `pending` requests are automatically moved to `status: 'cancelled'` with note: `"Property listing was removed by owner"`, because an unconfirmed viewing can no longer take place.
  - `confirmed` appointments are **preserved** in `status: 'confirmed'`, retaining the historical schedule, visitor particulars, and denormalized property title/price/city. The UI flags the listing as `(Listing no longer active)`.
  - `cancelled` appointments preserve their original cancellation reason (e.g. `"Buyer cancelled with note: Cannot attend"`).
  - `completed` appointments preserve their completed viewing record and feedback.

### Live Deletion Evidence Across All 4 States:
- **Test Property Created:** ID `6ae320e7d3d454871da4ce7b` ("Audit Evidence Luxury Penthouse", Hyderabad, ₹2,50,00,000)
- **Appointments Provisioned Prior to Deletion:**
  1. `6ae320e7d3d454871da4ce7f` — `pending`
  2. `6ae320e7d3d454871da4ce83` — `confirmed` (Confirmed by owner)
  3. `6ae320e7d3d454871da4ce8a` — `cancelled` (Cancelled by buyer with note: "Cannot attend")
  4. `6ae320e8d3d454871da4ce91` — `completed` (Confirmed and marked completed by owner)
- **Action:** Executed `DELETE /api/properties/6ae320e7d3d454871da4ce7b` (`HTTP 200 OK`).
- **Post-Deletion Observation:**
  - Property document removed (`GET /api/properties/:id` returns HTTP 404).
  - Appt 1 (`pending`): `status: "cancelled"`, `notes: "Property listing was removed by owner"`, `propertyTitle: "Audit Evidence Luxury Penthouse"`, `property: null`.
  - Appt 2 (`confirmed`): `status: "confirmed"`, `notes: "Audit Tour 2 - Confirmed state test"`, `propertyTitle: "Audit Evidence Luxury Penthouse"`, `property: null`.
  - Appt 3 (`cancelled`): `status: "cancelled"`, `notes: "Audit Tour 3 - Buyer cancelled with note: Cannot attend"`, `propertyTitle: "Audit Evidence Luxury Penthouse"`, `property: null`.
  - Appt 4 (`completed`): `status: "completed"`, `notes: "Audit Tour 4 - Completed viewing tour"`, `propertyTitle: "Audit Evidence Luxury Penthouse"`, `property: null`.
  - Attempts to book deleted property: `POST /api/appointments` returns **HTTP 404 Not available for booking**.

---

## 5. Source Diff Inspection (Fixes A, B, C, D, and E)

1. **Fix A (String Type Guards):**
   - [backend/src/controllers/authController.ts](/c:/Users/RANADEEP/Documents/Real%20State%20Platform%20%28Full%20Stack%29/backend/src/controllers/authController.ts): Added top-level `!req.body || typeof req.body !== 'object'` guard; checked `typeof name !== 'string'`, `typeof email !== 'string'`, `typeof password !== 'string'`.
   - [backend/src/controllers/propertyController.ts](/c:/Users/RANADEEP/Documents/Real%20State%20Platform%20%28Full%20Stack%29/backend/src/controllers/propertyController.ts): Added `typeof !== 'string'` for query params (`city`, `search`, `propertyType`, `listingType`, `sort`, `page`, `limit`), body fields, and validated array types (`amenities`, `images`).
   - [backend/src/controllers/appointmentController.ts](/c:/Users/RANADEEP/Documents/Real%20State%20Platform%20%28Full%20Stack%29/backend/src/controllers/appointmentController.ts): Added `typeof !== 'string'` for `scheduledAt`, `guestName`, `guestEmail`, `guestPhone`, and `notes`.
   - Route parameters: Replaced bare `req.params.id` with `Array.isArray(req.params.id) ? req.params.id[0] : req.params.id` and checked `mongoose.Types.ObjectId.isValid(id)`.

2. **Fix B (Multer File Filter Error Status):**
   - [backend/src/services/imageService.ts](/c:/Users/RANADEEP/Documents/Real%20State%20Platform%20%28Full%20Stack%29/backend/src/services/imageService.ts): Attached `(error as any).statusCode = 400;` on fileFilter rejection; normalized `file.mimetype.toLowerCase()`.
   - [backend/src/middleware/errorHandler.ts](/c:/Users/RANADEEP/Documents/Real%20State%20Platform%20%28Full%20Stack%29/backend/src/middleware/errorHandler.ts): Added checking for `err.code === 'LIMIT_FILE_SIZE'` and `LIMIT_FILE_COUNT` returning clean HTTP 400.

3. **Fix C (CORS Rejection Callback):**
   - [backend/src/app.ts](/c:/Users/RANADEEP/Documents/Real%20State%20Platform%20%28Full%20Stack%29/backend/src/app.ts): Replaced `callback(new Error(...))` with `callback(null, false)`. Normalized origin strings by stripping trailing slashes.

4. **Fix D (Appointment Denormalization & Lifecycle):**
   - [backend/src/models/Appointment.ts](/c:/Users/RANADEEP/Documents/Real%20State%20Platform%20%28Full%20Stack%29/backend/src/models/Appointment.ts): Added `propertyTitle`, `propertyCity`, `propertyThumbnail`, `propertyPrice`, and `propertyOwner`.
   - [backend/src/controllers/appointmentController.ts](/c:/Users/RANADEEP/Documents/Real%20State%20Platform%20%28Full%20Stack%29/backend/src/controllers/appointmentController.ts): Automatically populated snapshot fields on creation. Extended `/api/appointments/mine` `$or` query to include `{ propertyOwner: req.user.id }`.
   - [frontend/src/pages/DashboardPage.tsx](/c:/Users/RANADEEP/Documents/Real%20State%20Platform%20%28Full%20Stack%29/frontend/src/pages/DashboardPage.tsx): Added fallback to snapshot fields when `appointment.property` is null.

5. **Fix E (Full Image Decoding & Atomic Multi-Upload Handling):**
   - [backend/src/services/imageService.ts](/c:/Users/RANADEEP/Documents/Real%20State%20Platform%20%28Full%20Stack%29/backend/src/services/imageService.ts): Integrated `sharp` to implement `decodeAndSanitizeImage()`. Parses complete raster structure (`failOn: 'error'`), enforces 4096px dimension limit and 16 Megapixel (`limitInputPixels`) decompression bomb protection, strips all EXIF/metadata/polyglots, and safely re-encodes images.
   - [backend/src/controllers/propertyController.ts](/c:/Users/RANADEEP/Documents/Real%20State%20Platform%20%28Full%20Stack%29/backend/src/controllers/propertyController.ts): In `uploadPropertyImages()`, implemented atomic in-memory pre-validation across all files before storage, and wrapped storage iterations in an atomic rollback block that calls `deleteImage()` to purge any partially saved files if mid-batch storage failure occurs.

---

## 6. CORS Policy Architecture Clarification

- **Browser Context**: CORS (Cross-Origin Resource Sharing) is a browser-enforced security mechanism implementing the Same-Origin Policy. When an origin is disallowed, the server executes `callback(null, false)`. The server emits no `Access-Control-Allow-Origin` header, prompting the browser to block the response from web scripts.
- **Non-Browser Context**: Direct API clients (e.g. `curl`, Postman, server-to-server microservices) do not send browser `Origin` headers. The server allows the request to reach the API router (`HTTP 200` for public catalog discovery).
- **Independent Authorization**: CORS is not an authentication mechanism. Any attempt by a client (browser or non-browser) to perform protected operations (e.g. `POST /api/properties`) without a valid JWT Bearer token is rejected by the `authenticate` middleware with **HTTP 401 Unauthorized**.

---

## 7. Deep-Dive: Image Content, Full Raster Decoding & Upload Security Audit

### Initial Flaw Detection & Magic-Byte Limitation
An audit of `backend/src/services/imageService.ts` revealed that initial validation checked only magic bytes (first 3–12 bytes: `FF D8 FF` for JPEG, `89 50 4E 47` for PNG, `RIFF...WEBP` for WebP).

**Risk Identified:** A file with a valid 3-byte JPEG header followed by arbitrary corrupt binary data, executable polyglots, or decompression bomb structures would pass header checks. Furthermore, in the event of an upload failure in a multi-file batch, partial files could potentially remain in storage.

### Implemented Countermeasures & Hardening with Full Decoding Pipeline
1. **Full Image Raster Parsing via `sharp`**:
   Added `decodeAndSanitizeImage(buffer, declaredMimeType)` in [imageService.ts](/c:/Users/RANADEEP/Documents/Real%20State%20Platform%20%28Full%20Stack%29/backend/src/services/imageService.ts).
   - Validates initial file magic bytes.
   - Parses the complete raster, Huffman, IDAT, or VP8 image structure with `failOn: 'error'`.
   - Rejects corrupt, incomplete, or truncated streams with **HTTP 400 Bad Request**.
2. **Decompression Bomb & Dimension Protection**:
   - `limitInputPixels`: Hard-capped at 16 Megapixels (`16 * 1024 * 1024` pixels) to prevent memory exhaustion / pixel flood DoS.
   - Enforces `MAX_IMAGE_DIMENSION` = 4096px (max width and max height). Any image exceeding 4096px or 16MP is rejected with **HTTP 400 Bad Request**.
3. **Metadata Stripping & Safe Re-encoding**:
   - Every accepted image is re-encoded into clean, normalized bytes (JPEG via `mozjpeg`, PNG with compression level 8, WebP).
   - All EXIF, IPTC, XMP metadata, embedded scripts, and polyglot payloads are eliminated during re-encoding.
4. **Strict Atomic Multi-Upload Processing**:
   - In [propertyController.ts](/c:/Users/RANADEEP/Documents/Real%20State%20Platform%20%28Full%20Stack%29/backend/src/controllers/propertyController.ts), `uploadPropertyImages` performs memory pre-validation across **all** files before writing any bytes to disk or ImageKit.
   - If any single image in a multi-file upload fails validation or decoding, the entire batch is rejected with **HTTP 400** and zero files are persisted.
   - Implements automated rollback: if an unexpected storage error occurs mid-write, any previously written files are immediately deleted via `deleteImage()`.

### Live Validation Test Matrix:

| Scenario | Declared Content-Type | Payload Bytes / Stream Structure | HTTP Status | Storage Outcome | Audit Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Genuine JPEG** | `image/jpeg` | 137 bytes complete JFIF stream | **HTTP 200** | Sanitized, re-encoded `.jpg` in `/uploads/` | **PASS** |
| **2. Genuine PNG** | `image/png` | 69 bytes complete IHDR/IDAT/IEND | **HTTP 200** | Sanitized, re-encoded `.png` in `/uploads/` | **PASS** |
| **3. Genuine WebP** | `image/webp` | 34 bytes complete RIFF/VP8L | **HTTP 200** | Sanitized, re-encoded `.webp` in `/uploads/` | **PASS** |
| **4. Disguised HTML Payload** | `image/jpeg` | 57 bytes (`<html><body>...`) | **HTTP 400** | **0 files written** (Invalid file signature) | **PASS** |
| **5. Truncated / Corrupt Header** | `image/jpeg` | 2 bytes (`0x00, 0x01`) | **HTTP 400** | **0 files written** (File is too small) | **PASS** |
| **6. MIME / Content Mismatch** | `image/jpeg` | 69 bytes valid PNG bytes | **HTTP 400** | **0 files written** (MIME type mismatch) | **PASS** |
| **7. Magic Bytes + Corrupted Stream** | `image/jpeg` | Valid JFIF header + garbled bytes | **HTTP 400** | **0 files written** (Corrupted image payload) | **PASS** |
| **8. Decompression Bomb / Oversized** | `image/png` | Width 4097px (> 4096px limit) | **HTTP 400** | **0 files written** (Exceeds maximum dimension) | **PASS** |
| **9. Mixed Batch (Valid + Corrupt)** | Mixed | File 1: Valid PNG, File 2: Corrupt JPG | **HTTP 400** | **0 files written** (Strict atomic pre-validation rollback) | **PASS** |
| **10. Mid-Stream Storage Failure Rollback** | Mixed | File 1: Valid PNG (saved), File 2: Disk I/O error | **HTTP 500** | **0 files written** (File 1 deleted via `deleteImage` rollback) | **PASS** |
| **11. Cleanup Operation Failure Handling** | Mixed | File 1: Valid PNG (saved), File 2: Storage failure, Simulated cleanup unlink error (`EPERM`) | **HTTP 500** | Unresolved cleanup failure surfaced; File 1 storage inspected (persists); logged safely without secrets; orphan tracked in `OrphanedUpload` | **PASS** |
| **12. Automated Reconciliation & Recovery** | Database Job | Pending `OrphanedUpload` record from Scenario 11 | **Job OK** | `retryOrphanedUploadCleanups()` unlinks stranded file; status updated to `resolved`; **0 orphaned files remain** | **PASS** |

### Orphaned Upload Recovery & Storage Outcomes Taxonomy

| Outcome Category | Architectural State | Observed Test Evidence |
| :--- | :--- | :--- |
| **1. Rollback Succeeded & No Orphan Remains** | **VERIFIED** | Mid-stream disk write failure triggers immediate rollback. File 1 is unlinked via `deleteImage()`. Physical inspection confirms `fs.existsSync(file) === false`. Directory file count remains unchanged (`countAfter === countBefore`). |
| **2. Cleanup Failed but Orphan Tracked for Recovery** | **VERIFIED** | Simulated `EPERM` during cleanup prevents immediate file deletion. File 1 remains on disk (`fs.existsSync(file) === true`). Zero references exist in `Property` collection. An `OrphanedUpload` document is created in MongoDB with `status: 'pending'`, `fileId`, and safe error message. The HTTP 500 response explicitly discloses: `"Orphaned file(s) tracked for automated recovery."` Zero secrets are logged. |
| **3. Automated Recovery / Reconciliation Succeeded** | **VERIFIED** | Once the file lock/EPERM condition clears, the reconciliation worker `retryOrphanedUploadCleanups()` (or `POST /api/properties/reconcile-orphans`) processes pending records. File 1 is physically deleted (`fs.existsSync(file) === false`), and the record transitions to `status: 'resolved'`. Zero orphaned files remain. |
| **4. Cleanup Failed & Orphan Untracked** | **RESOLVED / MITIGATED** | If MongoDB tracking persistence fails during rollback, the server catches the error, sets `orphansTracked: false`, and alerts with: `"Storage failure occurred. Cleanup rollback failed, and tracking persistence failed for X file(s). Manual filesystem reconciliation required."` Untracked disk files are subsequently recovered and purged by the directory sweeper `reconcileDiskOrphans()`. |
| **5. Outcome Could Not Be Verified** | **NONE** | All storage outcomes were physically verified using `fs.existsSync` inspections before and after execution. |

### Security & Concurrency Hardening of Recovery Mechanism

1. **Strict Admin Endpoint Protection**:
   `POST /api/properties/reconcile-orphans` is secured with `authenticate` and `authorizeAdmin` middleware. Unauthenticated requests are rejected with **HTTP 401 Unauthorized**; authenticated non-admin users are rejected with **HTTP 403 Forbidden**. The endpoint takes no user-supplied file paths, eliminating arbitrary file deletion vectors.

2. **Path Traversal & Storage Identifier Validation**:
   `retryOrphanedUploadCleanups()` validates every record before execution:
   - Local files: Verifies that URLs start with `/uploads/`, reject any path containing `..`, `/`, or `\`, and assert via `path.resolve` that the target strictly resides inside `uploadsDir + path.sep`. Malicious traversal payloads (e.g. `../../etc/passwd`) are rejected and marked `status: 'failed'`.
   - Remote identifiers: Validated against alphanumeric regex `/^[a-zA-Z0-9_.-]+$/` before delegating to ImageKit.

3. **Concurrency Protection via Atomic Claiming**:
   Worker processes claim records atomically using MongoDB `findOneAndUpdate` with `{ status: 'pending' } -> { status: 'processing', lastAttemptAt: new Date() }`. Stale leases (> 5 minutes in processing) are safely reclaimed. Parallel worker executions process disjoint record sets without duplicate unlinks or race conditions.

4. **Worker Idempotency**:
   Successive executions of `retryOrphanedUploadCleanups()` are strictly idempotent. The first execution purges the stranded file and marks the record `resolved`. Subsequent runs detect 0 pending records and perform zero redundant disk operations.

5. **Tracking Persistence Failure Detection & Sweeper Fallback**:
   When MongoDB persistence fails while logging an orphan, `uploadPropertyImages()` detects the failure, safely logs the disk file path to the server error log, and returns a composite HTTP 500 error indicating `orphansTracked: false`. The directory-level sweeper `reconcileDiskOrphans(activeReferencedFiles)` reconciles stranded files against the active database state, purging unreferenced disk files.

6. **Retry Limits & Safe Logging**:
   Transient errors increment `retryCount`. Once 5 retry attempts are exhausted, or if an invalid/traversal security violation is detected, the record permanently transitions to `status: 'failed'`. Error messages are sanitized and truncated (500 chars) with zero credentials, tokens, or absolute system paths exposed.

### 7.3 Orphan Sweeper Safety & In-Progress Upload Lifecycle Audit

To guarantee that background or on-demand reconciliation workers cannot inadvertently purge legitimate images during user listing creation, the platform enforces a multi-tier protection mechanism:

1. **Configurable Minimum-Age Grace Period (`maxAgeMs = 3,600,000` / 1 Hour)**:
   - When a user uploads images, the files are written to disk with an initial creation/modification timestamp (`mtimeMs`).
   - The directory sweeper `reconcileDiskOrphans(activeReferencedFiles, maxAgeMs)` calculates file age as `Date.now() - stats.mtimeMs`.
   - Any unreferenced image whose age is less than the 1-hour grace period is strictly preserved. In-progress form submissions, slow typists, and intermittent client-side network interruptions remain immune to deletion.
2. **Comprehensive Active Reference Aggregation**:
   - `POST /api/properties/reconcile-orphans` queries both `Property.images.url` and `Appointment.propertyThumbnail` (preserving historical listing thumbnails from deleted properties).
   - Both full URL strings (e.g. `/uploads/image.png`) and normalized base filenames (e.g. `image.png`) are indexed in the `activeReferencedFiles` lookup set.
3. **Abandoned Upload Cleanup Policy**:
   - When a user uploads images but abandons the creation form without saving, the uploaded files remain unreferenced.
   - Once their age exceeds the 1-hour grace period (`now - stats.mtimeMs >= 3,600,000`), the sweeper recognizes them as abandoned unreferenced files and unlinks them from disk.
4. **Resilience to Property-Save Failures**:
   - If property creation fails due to validation errors (e.g. negative price or missing title), the server returns HTTP 400.
   - The uploaded images remain safely preserved on disk within the grace period, enabling the user to correct input errors and re-submit the form without re-uploading files.
5. **Concurrent Sweeper Execution & Path Boundary Safety**:
   - Multiple sweeper instances running concurrently handle `ENOENT` silently, avoiding race-condition unhandled errors.
   - Strict `path.resolve` validation ensures unlinks are contained strictly inside `uploadsDir + path.sep`.

---

## 8. Final Verdicts

| Fix Area | Verification Verdict | Evidence Summary |
| :--- | :--- | :--- |
| **Fix A: String Type Guards** | **VERIFIED** | 100% of malformed payloads rejected with HTTP 400 Bad Request; route parameters validated; zero 500 errors. |
| **Fix B: Multer File Rejection** | **VERIFIED** | Disallowed MIME types, oversized buffers, excessive counts, and empty requests return HTTP 400; valid PNGs return HTTP 200. |
| **Fix C: CORS Rejection** | **VERIFIED** | Allowed origin receives CORS headers; disallowed origin denied CORS without 500 crashes; JWT auth protects endpoints independently. |
| **Fix D: Appointment Lifecycle** | **VERIFIED** | All 4 states (`pending`, `confirmed`, `cancelled`, `completed`) retain property summary snapshots and notes upon property deletion. |
| **Fix E: Full Image Decoding, Bomb Defense & Orphan Recovery** | **VERIFIED** | Full raster decoding via `sharp`, 4096px/16MP decompression bomb defense, metadata stripping, safe re-encoding, atomic multi-file upload rollback, admin-protected orphan reconciliation with path traversal guards, atomic lease claiming concurrency safety, and fallback directory sweeper. |
