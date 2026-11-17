# MAJESTIC BLAZER — PRODUCTION DEPLOYMENT GUIDE

**Brand**: MAJESTIC BLAZER  
**Tagline**: *STYLE THAT SPEAKS*  
**Flagship Atelier**: Sathy Road, Kurumbampalayam, Coimbatore - 641107  
**Official Phone**: +91 8903238882 | **Support**: contact@majesticblazer.com  

This guide provides end-to-end instructions for deploying the **Majestic Blazer** platform to production using **Railway** (Backend API), **Vercel** (Customer Storefront & Admin Suite), and **Aiven Cloud** (Managed PostgreSQL 18.7).

---

## Architecture Topology

```mermaid
flowchart TD
    PatronBrowser["Patrons (Browsers & Mobile)"] -->|HTTPS| VercelClient["Customer Storefront (Vercel)<br/>majesticblazer.com"]
    AdminBrowser["Atelier Staff (Desktop / Tablet)"] -->|HTTPS| VercelAdmin["Admin Operations Portal (Vercel)<br/>admin.majesticblazer.com"]
    
    VercelClient -->|REST APIs (JSON)| RailwayBackend["Backend API Cluster (Railway)<br/>api.majesticblazer.com"]
    VercelAdmin -->|REST APIs (JSON / Multipart)| RailwayBackend
    
    RailwayBackend -->|TLS / Strict CA Port 11497| AivenDB[("Aiven Cloud PostgreSQL (v18.7)<br/>defaultdb")]
    
    RailwayBackend <-->|Webhooks / Order Verification| RazorpayAPI["Razorpay Payment Gateway"]
```

---

## 1. Prerequisites Checklist

- [x] Live Aiven Cloud PostgreSQL instance running (`<your-aiven-host>.aivencloud.com:11497`)
- [x] Aiven CA certificate (`aiven-ca.pem` or PEM environment variable) generated and verified
- [ ] Railway account ([railway.app](https://railway.app))
- [ ] Vercel account ([vercel.com](https://vercel.com))
- [ ] Razorpay Merchant Account (Test keys available, Live keys pending business approval)
- [ ] Registered domain name (e.g. `majesticblazer.com`) with DNS access

---

## 2. Phase 1 — Deploy Backend API to Railway

### Step 1.1: Create Project on Railway
1. Log in to [Railway](https://railway.app).
2. Click **New Project** $\rightarrow$ **Deploy from GitHub repo**.
3. Select the `majestic-blazer` repository.
4. Set the **Root Directory** to `/server`.

### Step 1.2: Configure Build & Start Command
Railway automatically detects `nixpacks` using [server/railway.json](server/railway.json) and [server/Procfile](server/Procfile):
- **Build Command**: `npm install`
- **Start Command**: `node src/server.js`
- **Healthcheck Path**: `/api/health`

### Step 1.3: Configure Production Environment Variables in Railway
Under your Railway service settings $\rightarrow$ **Variables**, add:

| Variable | Value / Description | Sensitive |
| :--- | :--- | :---: |
| `NODE_ENV` | `production` | No |
| `PORT` | `5000` (Railway automatically binds this) | No |
| `CLIENT_URL` | `https://majesticblazer.com` | No |
| `ADMIN_URL` | `https://admin.majesticblazer.com` | No |
| `CORS_ORIGINS` | `https://majesticblazer.com,https://admin.majesticblazer.com` | No |
| `DB_HOST` | `<your-aiven-host>.aivencloud.com` | No |
| `DB_PORT` | `11497` (or your configured port) | No |
| `DB_USER` | `<your-aiven-username>` (e.g. `avnadmin`) | No |
| `DB_PASSWORD` | `<your-aiven-password>` | **YES** |
| `DB_NAME` | `defaultdb` | No |
| `DB_SSL` | `true` | No |
| `DB_SSL_CA` | Single-line Base64 of Aiven CA certificate (recommended; see command below) | No |
| `JWT_SECRET` | Strong random secret ($\ge 32$ chars, e.g. `openssl rand -hex 32`) | **YES** |
| `JWT_EXPIRES_IN` | `7d` | No |
| `RAZORPAY_KEY_ID` | `rzp_test_...` (or live key upon approval) | No |
| `RAZORPAY_KEY_SECRET` | `<razorpay-key-secret>` | **YES** |
| `RAZORPAY_WEBHOOK_SECRET` | `<razorpay-webhook-secret>` | **YES** |
| `RAZORPAY_LIVE` | `false` (Set `true` ONLY after explicit owner approval) | No |
| `DEMO_MODE` | `true` (Set `false` in strict production to enforce manual password checks) | No |
| `DEMO_ADMIN_EMAIL` | `admin@majesticblazer.com` | No |
| `DEMO_ADMIN_PASSWORD` | `<initial-admin-password>` (Only seeded if admin account does not exist) | **YES** |

*(Alternatively, use `DATABASE_URL=postgres://<username>:<password>@<your-aiven-host>.aivencloud.com:11497/defaultdb?sslmode=require` with `DB_SSL_CA`)*

> [!IMPORTANT]
> **Avoid Multi-Line Variables in Railway Dashboard**:
> To prevent Docker build errors (`failed to solve: dockerfile parse error on line 12: ENV names can not be blank`), **never paste multi-line raw PEM blocks or trailing blank lines** into Railway's Variables tab. Instead, generate a single-line Base64 string for `DB_SSL_CA`:
> ```bash
> # In PowerShell / Terminal:
> node -e "console.log(require('fs').readFileSync('server/aiven-ca.pem').toString('base64'))"
> ```
> Copy the output single-line string and paste it into Railway's `DB_SSL_CA` variable. The server (`src/config/env.js`) automatically detects and decodes Base64 certificates at runtime.
> Also verify that the Railway **Variables** tab contains no unnamed/empty rows or lines with only `=`.

### Step 1.4: Add Persistent Storage Volume for Uploads (Optional)
In Railway Service Settings $\rightarrow$ **Volumes**:
- Mount Path: `/app/uploads`
- Size: 5 GB – 10 GB

---

## 3. Phase 2 — Verify Backend Health

Once Railway finishes deployment:
1. Railway assigns a public URL (e.g. `https://server-production-xxxx.up.railway.app`).
2. Test health endpoint:
   ```bash
   curl https://server-production-xxxx.up.railway.app/api/health
   # Expected response: {"success":true,"status":"ok","timestamp":"..."}
   ```
3. Test settings endpoint:
   ```bash
   curl https://server-production-xxxx.up.railway.app/api/settings
   # Expected: Returns store name "Majestic Blazer", address, phone
   ```

---

## 4. Phase 3 — Deploy Customer Website to Vercel

### Step 4.1: Import Project on Vercel
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New** $\rightarrow$ **Project**.
3. Select `majestic-blazer` repository.
4. Set **Root Directory** to `client`.
5. Framework Preset: **Vite**.
6. Build Command: `npm run build`
7. Output Directory: `dist`

### Step 4.2: Configure Environment Variables
Under Vercel Project Settings $\rightarrow$ **Environment Variables**:

| Variable | Value | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `https://majestic-blazer-production.up.railway.app/api` | Railway backend API URL |
| `VITE_ADMIN_URL` | `https://majestic-blazer-admin.vercel.app` | Deployed Admin Operations Portal |

### Step 4.3: Deploy & Configure Custom Domain
1. Click **Deploy**. Vercel uses [client/vercel.json](client/vercel.json) for SPA routing.
2. In Project Settings $\rightarrow$ **Domains**:
   - Add `majesticblazer.com` (Apex domain)
   - Add `www.majesticblazer.com` (redirect to apex)
3. Update DNS records with your registrar:
   - `A` Record: `@` $\rightarrow$ `76.76.21.21`
   - `CNAME` Record: `www` $\rightarrow$ `cname.vercel-dns.com`

---

## 5. Phase 4 — Deploy Admin Operations Portal to Vercel

### Step 5.1: Import Admin Project
1. In Vercel, click **Add New** $\rightarrow$ **Project**.
2. Select `majestic-blazer` repository.
3. Set **Root Directory** to `admin`.
4. Framework Preset: **Vite**.
5. Build Command: `npm run build`
6. Output Directory: `dist`

### Step 5.2: Configure Environment Variables
Under Admin Project Settings $\rightarrow$ **Environment Variables**:

| Variable | Value | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `https://majestic-blazer-production.up.railway.app/api` | Railway backend API URL |
| `VITE_STOREFRONT_URL` | `https://majestic-blazer.vercel.app` | Deployed Customer Storefront |

### Step 5.3: Custom Domain for Admin
1. In Project Settings $\rightarrow$ **Domains**:
   - Add `admin.majesticblazer.com`
2. Update DNS record:
   - `CNAME` Record: `admin` $\rightarrow$ `cname.vercel-dns.com`

---

## 6. Phase 5 — Razorpay Webhook Configuration

1. Log into your [Razorpay Dashboard](https://dashboard.razorpay.com).
2. Navigate to **Settings** $\rightarrow$ **Webhooks**.
3. Click **Add New Webhook**.
4. Set Webhook URL:
   `https://api.majesticblazer.com/api/payments/razorpay/webhook`
5. Secret: Enter the exact value configured in `RAZORPAY_WEBHOOK_SECRET`.
6. Select Events:
   - `payment.captured`
   - `payment.failed`
   - `refund.processed`
7. Save Webhook.

> [!WARNING]
> **Switching to Live Mode**: Never toggle `RAZORPAY_LIVE=true` or enter live production keys until:
> 1. The business GST and bank account verification is complete.
> 2. You have explicit confirmation from the business owner.
> 3. Initial test-mode end-to-end checkout runs successfully.

---

## 7. Phase 6 — Post-Deployment Verification & Smoke Tests

Execute these verification checks immediately following production deployment:

### Test 1: Public Storefront Navigation & Rendering
- [ ] Visit `https://majesticblazer.com`
- [ ] Verify SSL certificate shows secure padlock
- [ ] Verify Luxury Hero section renders with headline "STYLE THAT SPEAKS"
- [ ] Verify phone (+91 8903238882) and boutique address (Kurumbampalayam, Coimbatore) display in header & footer
- [ ] Verify favicon shows the gold "MB" monogram

### Test 2: Catalog & Rental Availability Calendar
- [ ] Open `/shop` and test price and category filters
- [ ] Open `/rent` and select a blazer
- [ ] Open product details page and verify high-resolution imagery
- [ ] Pick 3-day rental window on the calendar $\rightarrow$ verify daily rate and refundable security deposit calculate in real-time

### Test 3: Customer Checkout & Invoice Streaming
- [ ] Register a new patron account at `/register`
- [ ] Add a blazer to cart, apply coupon code `MAJESTIC10`
- [ ] Proceed through multi-step checkout with test payment
- [ ] Click **Download Invoice PDF** $\rightarrow$ verify GST tax invoice streams cleanly with proper logo, business address, and deposit itemized separately

### Test 4: Admin Portal Security & Operations
- [ ] Visit `https://admin.majesticblazer.com`
- [ ] Verify unauthenticated users are redirected to `/login`
- [ ] Log in with admin credentials
- [ ] Verify executive overview dashboard renders real-time KPI cards and Recharts 30-day revenue trends
- [ ] Open **Orders** $\rightarrow$ verify new order appears with customer details
- [ ] Open **Rental Bookings** $\rightarrow$ test Dispatch and Garment Return Inspection workflow with deposit refund settlement

### Test 5: Automated E2E Verification Command
Run the complete automated audit against the production API:
```bash
# On your staging/local machine, set BASE_URL to your production endpoint:
cd server
npm run test:e2e
```

---

## 8. Ongoing Maintenance & Operations

- **Database Backups**: Aiven Cloud automatically creates daily snapshots with Point-In-Time-Recovery (PITR).
- **Log Inspection**: Inspect Railway deployment logs under the **Deployments** $\rightarrow$ **View Logs** tab.
- **SSL Auto-Renewal**: Handled automatically by Let's Encrypt through Vercel and Railway edge routers.

