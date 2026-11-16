# Majestic Blazer

Premium blazer e-commerce and rental platform. **Style that speaks.**
Sathy Road, Kurumbampalayam, Coimbatore - 641107 | 8903238882

> **Status: Phase 1 (foundation only).** Architecture, auth, schema and layout are in place.
> Most business features are stubs. See "Remaining work".

## Structure

```
majestic-blazer/
├── client/    Customer website (React + Vite, port 5173)
├── admin/     Admin dashboard  (React + Vite, port 5174)
├── server/    REST API (Node.js + Express, MVC, port 5000)
│   ├── src/config        env validation, PostgreSQL pool
│   ├── src/routes        route definitions per module
│   ├── src/controllers   request handlers (stubs return 501)
│   ├── src/models        SQL access (users, products, categories done)
│   ├── src/validators    express-validator rule sets
│   ├── src/middleware    auth (JWT), validate, errorHandler
│   └── scripts           initDb.js, createAdmin.js
└── database/schema.sql   PostgreSQL schema
```

## Requirements

Node.js 20+, PostgreSQL (Aiven Cloud or local).

## Quick Start (Unified Single-Command Startup)

From the project root:

```bash
# 1. Install root & service dependencies
npm install

# 2. Launch all three applications concurrently
npm run dev
```

This starts all three services simultaneously with distinct terminal prefixes:
- `[SERVER]` **Backend REST API**: http://localhost:5000 (Health: `http://localhost:5000/api/health`)
- `[CLIENT]` **Customer Storefront**: http://localhost:5173
- `[ADMIN]`  **Atelier Admin Portal**: http://localhost:5174

Pressing `Ctrl+C` cleanly shuts down all services.

### Individual Service Scripts

```bash
npm run dev:server   # Launch backend API only (port 5000)
npm run dev:client   # Launch customer storefront only (port 5173)
npm run dev:admin    # Launch admin portal only (port 5174)
npm run build        # Build customer and admin production bundles
npm run test         # Execute full backend automated test suite
npm run test:regression # Execute end-to-end regression audit
```

Both frontends proxy `/api` to the backend in development. In production, set `VITE_API_URL`
and list the deployed origins in `CORS_ORIGINS`.

## Working API

| Method | Path | Access |
| --- | --- | --- |
| GET | `/api/health` | public |
| POST | `/api/auth/register`, `/api/auth/login` | public (customer) |
| POST | `/api/auth/admin/login` | public (admin accounts only) |
| GET | `/api/auth/me` | signed in |
| GET | `/api/products`, `/api/products/:slug` | public |
| POST | `/api/products` | admin |
| GET / POST | `/api/categories` | public / admin |

All other routes exist with the correct auth guards and return `501 Not Implemented`.
Responses use `{ success, data, meta }` or `{ success: false, message, details }`.

## Conventions

- Backend flow: route -> validator -> controller -> model. Throw `AppError`; wrap async handlers in `asyncHandler`.
- To implement a stub module, replace `createStubs(...)` in its controller with real handlers and add a model in `src/models`.
- Frontend: reusable components in `components/`, one CSS Module per component or page, design tokens in `styles/variables.css`.
- Muted gold (`--color-gold`) is for the logo only. Do not use it in the UI.
- The logo lives at `src/assets/majestic-blazer-logo.jpeg` in both frontends. Size it by height only.
- Secrets live only in `server/.env`. Frontend env files hold public values only.

## Remaining work (Phase 2+)

1. Catalog: product CRUD (update/delete, images, variants), shop and rent listing pages, product details, filters.
2. Cart (client state) and checkout; order creation with stock decrement in a transaction.
3. Rental booking: date availability check against `rental_bookings`, deposit handling, return flow.
4. Razorpay: create order, verify signature, webhook (raw body already wired) and `payments` records.
5. Invoices: PDF generation (e.g. pdfkit) and `GET /api/invoices/:id/pdf`.
6. Customer pages: profile, addresses, orders, rental bookings; contact form; privacy and terms content.
7. Admin modules: all list/detail screens, inventory with low-stock alerts, analytics with Recharts, settings.
8. Hardening: ownership checks on `/orders/:id` and `/invoices/:id`, `is_active` check in `authenticate`, image upload, tests.
9. Consider a transparent PNG or SVG version of the logo for flexible placement on any background.
