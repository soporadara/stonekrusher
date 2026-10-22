# StoneKrusher / KONSTRUCTZ - Web Platform & Management CMS

Enterprise web platform and administrative Content Management System (CMS) for **StoneKrusher / KONSTRUCTZ Machinery**.

---

## 1. Architecture Overview

- **Frontend**: React 19, Vite, responsive vanilla CSS design system with light/dark theme persistence.
- **Backend API**: Modern PHP 8.x REST endpoints located under `public/api/`:
  - `public/api/auth.php`: Session-based authentication, Google OAuth linking, rate limiting, and password management.
  - `public/api/cms.php`: Authoritative administration for dashboard telemetry, blog posts, machinery catalog, CRM quote inquiries, customer support tickets, and SEO suite.
  - `public/api/upload.php`: Secure media uploads with strict MIME inspection via `finfo_file`, SVG sanitization, and execution barriers.
  - `public/api/db.php`: Database abstraction layer with explicit driver support for SQLite (local development) and MySQL (production/Hostinger).
  - `public/api/security.php`: CSRF protection, session management, 10-attempt progressive lockout policy, trusted proxy detection, and audit logging.
- **Publishing & Catalog Workflow**:
  - The CMS acts as the single source of truth for machinery products.
  - When products are saved or published, they are synchronized to `src/data/equipment-products.json`.
  - The static build generator (`generate-product-pages.js` via `catalog-seo-data.js`) automatically pre-renders crawlable static HTML pages for all products with rich Schema.org metadata and generates the full XML sitemap.

---

## 2. Local Development Setup

### Prerequisites
- **Node.js**: v22.0.0 or higher
- **PHP**: v8.2 or higher with `pdo_sqlite`, `pdo_mysql`, `curl`, `mbstring`, `fileinfo`

### Installation & Environment Setup

1. **Clone the repository and install dependencies**:
   ```bash
   git clone https://github.com/soporadara/stonekrusher.git
   cd stonekrusher
   npm install
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

   For local development, SQLite is configured by default:
   ```ini
   DB_DRIVER=sqlite
   DB_FILE=data/site.db
   CMS_CSRF_SALT=your_secure_local_salt_here
   CMS_INITIAL_ADMIN_PASSWORD=Admin@StoneKrusher2026!
   VITE_API_BACKEND=http://127.0.0.1:8000
   ```

3. **Start the Local Development Servers**:
   Run the PHP backend and Vite frontend together:

   - **Terminal 1** (PHP Backend Server):
     ```bash
     npm run dev:php
     # Serves http://127.0.0.1:8000
     ```

   - **Terminal 2** (Vite Frontend):
     ```bash
     npm run dev
     # Serves http://localhost:5173 (or next available port)
     ```

   Vite will automatically proxy requests matching `/api`, `/uploads`, and `/medialibrary` to the local PHP backend at `http://127.0.0.1:8000`.

---

## 3. Database Driver & Schema Initialization

- **SQLite (Local Dev & Testing)**:
  - Database file: `data/site.db`
  - Automatic migration: Tables and initial seed data are automatically provisioned on first API run via `ensure_cms_schema_migrated()`.
  - Test isolation: Running `npm test` runs against an isolated temporary database `data/test_site.db`.

- **MySQL (Production / Hostinger)**:
  - Set `DB_DRIVER=mysql` in `.env` or production server environment.
  - Provide `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASS`.
  - No silent fallback: If MySQL connection fails in production, an explicit error is thrown rather than silently falling back to a local SQLite file.

---

## 4. Administrative CMS Modules

The CMS is accessed via `/` (click CMS / Admin Console or navigate to the CMS shell):
- **Overview**: Real-time telemetry dashboard with 100% verified database counts, inbound RFQs, support tickets, 7-day activity stream, and external analytics integration status.
- **Content**:
  - **Blog Articles**: Create, edit, schedule, publish, revision history snapshot, trash, restore, and slug validation.
  - **Categories & Topics**: Create and manage categories with safe reassignment before deletion.
- **Catalog**:
  - **Products**: Manage machinery fleet, SKUs, pricing, specifications, gallery images, and one-click live publishing.
  - **Media Library**: Secure asset uploads, previews, alt text metadata, and reference deletion safeguards.
- **Customer Operations**:
  - **CRM Leads & Inquiries**: Inbound machinery quotes, customer contact records, qualification pipeline, and CSV export.
  - **Support Tickets**: Warranty claims, technical support tracking, priority assignments, and resolution notes.
- **Marketing & SEO**:
  - **SEO Management**: XML sitemap validation, pre-rendered static crawlable pages status, robots.txt, and IndexNow real-time engine pings.
- **Administration**:
  - **Users & Roles**: Role-based access control (Super Admin, Editor, Viewer).
  - **Security Center**: Firewall IP blocks, failed login monitoring, user lockout management, and immutable audit logs.
  - **Website Settings**: Site URL, Google OAuth Web Client ID, GA4 measurement ID, Google Search Console URL.
  - **System & Database Status**: Runtime environment, OPcache status, storage diagnostics, and one-click catalog synchronization.

---

## 5. Security & Verification

- **CSRF Protection**: All state-changing API operations (`POST`, `PUT`, `DELETE`) require a valid session CSRF token sent via `X-CSRF-Token` header.
- **Lockout Policy**: Progressive delay and account lockout after 10 consecutive failed attempts (configurable in settings).
- **Upload Hardening**: Strict MIME detection via `finfo_file`, SVG script removal, execution denied via `.htaccess`.
- **Audit Logs**: Administrative actions (creates, updates, deletes, logins, lockouts) are logged to `cms_audit_logs`.

### Running Automated Security Tests

Run the automated test suite in an isolated test database:
```bash
npm test
# Or: php tests/test_cms_security.php
```
All 15+ test suites run and report passing results across authentication, lockout, permissions, product catalog sync, media reference protection, and CSRF validation.

---

## 6. Production Build & SEO Pre-rendering

To compile the production build:
```bash
npm run build
```
This command performs:
1. `generate-product-pages.js`: Generates 313+ crawlable static product pages in `public/products/`.
2. `generate-category-pages.js`: Generates category hubs in `public/equipment/`.
3. `generate-blog-routes.js`: Pre-renders blog articles in `public/blog/`.
4. `generate-legal-pages.js`: Pre-renders terms and privacy policy.
5. `generate-sitemap.js`: Updates `public/sitemap.xml` and `public/sitemap_index.xml` (440+ URLs).
6. `vite build`: Compiles production React JS & CSS bundles.
7. `post-build-seo.js`: Injects production bundle scripts into all pre-rendered HTML pages.
