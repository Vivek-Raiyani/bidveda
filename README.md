# Bidveda Mini RFQ Portal

> **Full-Stack / Backend Lead Developer Assignment**  
> **Candidate:** Vivek Raiyani  
> **Date:** October 2026  
> **Repository:** [https://github.com/Vivek-Raiyani/bidveda](https://github.com/Vivek-Raiyani/bidveda)  
> **Submission Contact:** tech@bidveda.in

---

## 🌟 Executive Summary

The **Bidveda Mini RFQ Portal** is a production-grade procurement platform built to streamline the Request for Quotation (RFQ) lifecycle for enterprise buyers and industrial vendors. 

It provides strict role-based access control, a sealed-bid quotation mechanism, automated deadline enforcement with real-time state expiration, granular per-line-item pricing, a side-by-side comparative evaluation matrix, and an atomic transactional contract award engine with automated competitor rejections and status history auditing.

---

## 🏗 System Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Next.js 14 Web Frontend                         │
│       React 18 · TypeScript · TailwindCSS · Lucide Icons · Bun         │
│                        (Port: 3003 / 3000)                             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST (Secure HttpOnly JWT Cookies)
┌───────────────────────────────────▼────────────────────────────────────┐
│                         FastAPI Backend API                            │
│         Python 3.12 / 3.14 · Pydantic v2 · SQLAlchemy 2.0 (Async)      │
│                            (Port: 8002)                                │
└─────────────────┬───────────────────────────────────┬──────────────────┘
                  │                                   │
┌─────────────────▼─────────────────┐   ┌─────────────▼──────────────────┐
│        Relational Database        │   │          File Storage          │
│   Neon PostgreSQL (Asyncpg Pool)  │   │  Local Persistent Volume / S3  │
│     or Isolated Local SQLite      │   │  UUID Storage Key + Mime Check │
└───────────────────────────────────┘   └────────────────────────────────┘
```

### Core Architecture Components
1. **Frontend**: Next.js 14 App Router with server-side rendering and client-side reactive components. Communicates with the backend exclusively via typed API clients and credentials-included HTTP requests.
2. **Backend**: FastAPI asynchronous application with native dependency injection for session management, JWT authentication via HttpOnly cookies, and granular role/permission checks (`Buyer`, `Vendor`, `Admin`).
3. **Database & ORM**: PostgreSQL (hosted on Neon with asyncpg pool and PgBouncer compatibility) and SQLite (for isolated development/testing), managed through SQLAlchemy 2.0 async engine and Alembic schema migrations.
4. **File Storage**: Local persistent media volume (`media/`) or AWS S3 / Cloudflare R2 compatible object storage with random UUID hashing to prevent directory traversal attacks.
5. **Audit Logging & State Tracking**: Dedicated `status_histories` table recording every state transition for RFQs and Quotes with actor attribution and timestamps.

---

## 🚀 Quickstart: One-Command Docker Setup

The easiest way to run the entire application (frontend + backend) is using Docker Compose.

### 1. Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & Docker Compose installed and running.
- A Neon PostgreSQL connection string (or use the provided defaults).

### 2. Configure Environment
Copy the example environment file to `.env`:

```bash
# Windows PowerShell
Copy-Item .env.example .env

# Linux / macOS
cp .env.example .env
```

Ensure `DATABASE_URL` in `.env` points to your PostgreSQL database (e.g. Neon connection string):
```env
DATABASE_URL="postgresql+asyncpg://neondb_owner:YOUR_PASSWORD@ep-sample.us-east-2.aws.neon.tech/neondb?ssl=require"
RUN_MIGRATIONS=true
RUN_SEED=true
```

### 3. Run with One Command
```bash
docker compose up --build -d
```

### 4. Access the Application
- 🌐 **Frontend Application**: [http://localhost:3003](http://localhost:3003)
- 🔌 **FastAPI Backend API**: [http://localhost:8002](http://localhost:8002)
- 📖 **Interactive Swagger Docs**: [http://localhost:8002/docs](http://localhost:8002/docs)
- 📑 **ReDoc Documentation**: [http://localhost:8002/redoc](http://localhost:8002/redoc)

---

## 💻 Local Development Setup (Without Docker)

If you prefer running services directly on your host machine:

### 1. Backend Setup (FastAPI)
```bash
cd backend

# Create and activate virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env

# Run database migrations
alembic upgrade head

# Seed initial demo accounts and RFQs
python seed.py

# Start backend server on port 8002
uvicorn main:app --host 0.0.0.0 --port 8002 --reload
```

### 2. Frontend Setup (Next.js)
```bash
cd frontend

# Install dependencies (Bun or npm)
bun install
# or: npm install

# Start development server on port 3003
bun run dev -- -p 3003
# or: npm run dev -- -p 3003
```

---

## 🔑 Demo Login Credentials & Seed Data

The database seed script (`backend/seed.py`) provisions the exact scenario described in the assignment specification:

| Role | Email | Password | Organization / Purpose |
| :--- | :--- | :--- | :--- |
| **Buyer** | `buyer@bidveda.in` | `Password123!` | Acme Constructions (Creates RFQs, evaluates bids, awards contracts) |
| **Vendor 1** | `vendor1@bidveda.in` | `Password123!` | Vendor Alpha (Submits quotes, revises pricing) |
| **Vendor 2** | `vendor2@bidveda.in` | `Password123!` | Vendor Beta (Offers express delivery) |
| **Admin** | `admin@bidveda.in` | `Password123!` | System Administrator (Global platform oversight, user management) |

### Pre-Seeded RFQ Scenario:
1. **RFQ: "Office supplies for Hyderabad site"** (`Published`)
   - **Deadline**: 10 days in the future
   - **Delivery Location**: Hyderabad
   - **Budget**: ₹4,00,000.00
   - **Line Items**: 100 Chairs, 20 Desks
   - **Bids Submitted**:
     - *Vendor Alpha*: ₹1,900/chair + ₹8,000/desk = **₹3,50,000.00** | Delivery: **10 days** (Revision Version 2)
     - *Vendor Beta*: ₹2,200/chair + ₹7,000/desk = **₹3,60,000.00** | Delivery: **7 days** (Version 1)
2. **RFQ: "IT Equipment for Bangalore site"** (`Draft`)
   - 15 Developer Laptops, 25 4K Monitors. Only editable by Buyer.

---

## ⚙️ Environment Variables Reference

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PROJECT_NAME` | `"Bidveda RFQ Portal"` | Application branding name |
| `SERVER_HOST` | `"http://localhost:8002"` | Backend base URL |
| `FRONTEND_URL` | `"http://localhost:3003"` | Frontend origin for CORS and cookie dispatch |
| `BACKEND_CORS_ORIGINS` | `["http://localhost:3003", "http://127.0.0.1:3003"]` | Whitelisted origins for credentialed CORS |
| `DATABASE_URL` | `postgresql+asyncpg://...` | Asynchronous database connection string (Neon or local PostgreSQL) |
| `SECRET_KEY` | `secure-random-key` | Cryptographic secret for signing JWT tokens and session cookies |
| `ALGORITHM` | `"HS256"` | JWT token hashing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES`| `300` (5 hours) | Lifetime of access tokens |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Lifetime of refresh tokens |
| `COOKIE_SECURE` | `false` (dev) / `true` (prod)| Enables `Secure` flag on cookies in HTTPS environments |
| `RUN_MIGRATIONS` | `true` | Runs `alembic upgrade head` on Docker container boot |
| `RUN_SEED` | `false` | Runs `python seed.py` on container boot if true |
| `NEXT_PUBLIC_API_URL` | `"http://localhost:8002/api"` | Base API endpoint consumed by the Next.js frontend |

---

## 🧪 Testing Suite: Single Command Execution

The backend includes a comprehensive, automated test suite covering all key procurement flows, boundary conditions, access permissions, and edge cases.

### Run All Tests
```bash
# From backend directory
pytest

# Or run specific test suites
pytest tests/test_permissions.py
pytest tests/test_rfq_and_quotes.py
pytest tests/test_admin_users.py
```

### Test Coverage Highlights
* ✅ **Quote Submission Before Deadline**: Asserts quote creation with line item calculations, default `version=1`, and status `submitted`.
* ✅ **Strict Deadline Enforcement**: Submissions past deadline are immediately rejected with `400 Bad Request`.
* ✅ **Quote Revisions**: Vendor revises pricing prior to deadline; verifies `version` increments to 2 and line totals recalculate correctly.
* ✅ **Late Revision Rejection**: Revisions attempted after deadline are rejected with `400 Bad Request`.
* ✅ **Award Flow State Transitions**: Awards RFQ to winning vendor; verifies atomic state changes (RFQ becomes `awarded`, winning quote becomes `accepted`, competing quotes become `rejected`).
* ✅ **Vendor Data Isolation**: Vendor A attempting to read Vendor B's quote receives `403 Forbidden`. Buyer can view all quotes.
* ✅ **Real-Time Auto-Close Guard**: Expired RFQs automatically transition to `closed` upon query and disappear from open vendor listings.
* ✅ **Role-Based Access Control**: Validates granular endpoint protection across Buyer, Vendor, and Admin roles.

---

## 📖 API Documentation & Endpoints

FastAPI generates automated OpenAPI 3.0 schemas available at:
- **Swagger Interactive UI**: [http://localhost:8002/docs](http://localhost:8002/docs)
- **ReDoc Interactive UI**: [http://localhost:8002/redoc](http://localhost:8002/redoc)
- **OpenAPI JSON Schema**: [http://localhost:8002/api/openapi.json](http://localhost:8002/api/openapi.json)

### Primary API Routes

| Method | Path | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public | Authenticate user & issue HttpOnly JWT cookies |
| `POST` | `/api/auth/register` | Public | Register new Buyer or Vendor account |
| `POST` | `/api/auth/logout` | Authenticated | Revoke session & clear auth cookies |
| `GET` | `/api/rfqs` | Authenticated | Browse published RFQs with search, category & location filters |
| `GET` | `/api/rfqs/my` | Buyer, Admin | View buyer's own RFQs with received bid counts |
| `POST` | `/api/rfqs` | Buyer, Admin | Create a new RFQ with line items in `draft` status |
| `PUT` | `/api/rfqs/{id}` | Buyer (Owner), Admin | Update draft RFQ specifications and line items |
| `POST` | `/api/rfqs/{id}/publish` | Buyer (Owner), Admin | Publish RFQ (`draft` → `published`) |
| `GET` | `/api/rfqs/{id}/compare` | Buyer (Owner), Admin | Side-by-side comparison matrix sortable by price/delivery |
| `POST` | `/api/rfqs/{id}/award` | Buyer (Owner), Admin | Award RFQ to winning quote (atomic transaction) |
| `POST` | `/api/rfqs/{rfq_id}/quotes` | Vendor, Admin | Submit quote with line item unit pricing |
| `PUT` | `/api/quotes/{id}` | Vendor (Owner), Admin | Revise quote pricing before deadline (increments version) |
| `GET` | `/api/quotes/my` | Vendor, Admin | List vendor's submitted quote portfolio |
| `GET` | `/api/quotes/{id}` | Authenticated | View quote details (enforcing strict vendor isolation) |
| `POST` | `/api/quotes/{id}/shortlist` | Buyer (Owner), Admin | Shortlist promising quote during evaluation |
| `GET` | `/api/rfqs/{id}/status-history` | Buyer, Admin | View audit trail of RFQ state changes |
| `POST` | `/api/assets/upload` | Authenticated | Safe file upload (PDF/XLSX) with UUID storage keys |

---

## 🔒 Security and Access Control

1. **HttpOnly Cookie Authentication**:
   - JWT tokens are transported strictly inside `HttpOnly`, `SameSite=Lax` cookies. JavaScript cannot access tokens, nullifying XSS token-stealing attacks.
2. **Sealed-Bid Isolation**:
   - Vendors can only view their own quotes. Any attempt by a vendor to access a competing vendor's quote via direct URL or ID manipulation returns `403 Forbidden`.
   - Competing quotes are completely excluded from public RFQ responses until award.
3. **Safe File Uploads**:
   - File extensions are validated against a strict whitelist (`.pdf`, `.xlsx`, `.xls`, `.csv`, `.png`, `.jpg`).
   - Uploaded files are renamed using cryptographic UUIDs (`uuid4()`) and stored in isolated storage paths, preventing path traversal attacks (`../../`).

---

## 🌟 Bonus Features Implemented

* **State Audit History (`status_histories`)**:
  - Implemented a dedicated audit log tracking who changed what and when for all RFQs and Quotes.
  - Keeps historical records of transitions (`draft` → `published` → `closed` → `awarded`) along with user ID and optional reasoning.
* **Real-Time Auto-Close Guard**:
  - Automatically checks `now() > rfq.deadline` whenever an RFQ is accessed. If the deadline has expired, its status is immediately updated to `closed`, removing it from the open marketplace.
* **Granular Line Item CRUD**:
  - Dedicated endpoints to add, update, or remove line items individually from draft RFQs.
* **Quote Shortlisting**:
  - Implemented intermediate quote state (`submitted` → `shortlisted`) to assist buyers in narrowing down top contenders prior to awarding.

---

## ⚠️ Known Limitations & Next Steps

### What is Incomplete / Simplified by Design:
1. **Multi-Currency & Tax Engine**: All financial figures currently assume standard domestic currency (INR ₹). Real-world B2B procurement often involves GST/VAT breakdowns and multi-currency exchange rates.
2. **Partial Line-Item Split Awards**: Current architecture awards an RFQ to a single winning vendor. Expanding to partial awards (awarding Item A to Vendor 1 and Item B to Vendor 2) requires splitting purchase orders at the database level.
3. **Real-Time WebSockets**: Status transitions currently refresh upon client query. Adding WebSockets would allow instant notification alerts when a buyer awards an RFQ or when a vendor submits a bid.

### What Would Break First at 100x Scale:
1. **Database Connection Saturation**: When hundreds of vendors submit quotes in the final 5 minutes before a popular RFQ deadline, direct database connections can bottleneck.
   - *Fix*: Deploy PgBouncer in transaction pooling mode (already pre-configured in our asyncpg connection parameters with `statement_cache_size=0`).
2. **Comparison Matrix Computation**: Loading all bids and line items for an RFQ with 500+ items and 100 quotes into memory for client rendering.
   - *Fix*: Implement database-level aggregation queries or pre-compute cached summary projections in Redis.

---

## 🤖 AI Tools Usage Disclosure

In compliance with the assignment instructions, AI coding assistants (Google Antigravity & Claude) were utilized during the development process for:
- Initial project scaffolding and boilerplate generation (Alembic migration templates, Pydantic schemas).
- Drafting mock seed data and comprehensive unit test cases (`test_rfq_and_quotes.py`).
- Generating architectural Markdown diagrams and documentation formatting.

All architectural design decisions, state machine boundaries, security policies, database constraints, and business logic were actively guided, reviewed, verified, and debugged by the author.

---

## 📋 Submission Checklist

- [x] **Deliverable 1: System Design Document** ([docs/system_design.md](file:///e:/bidveda/docs/system_design.md)) covering all 10 required sections.
- [x] **Deliverable 2: Code in GitHub** ([https://github.com/Vivek-Raiyani/bidveda](https://github.com/Vivek-Raiyani/bidveda)).
- [x] **README.md** with one-command setup, environment variables, architecture overview, and test commands.
- [x] **Working Frontend & Backend** covering all must-have functional requirements.
- [x] **Database Migrations & Seed Script** with demo buyers, vendors, RFQs, and quotes.
- [x] **API Documentation** available via interactive Swagger UI at `/docs`.
- [x] **Single-Command Test Suite** (`pytest`) with 100% passing core flows.
- [x] **Docker Containerization** with `Dockerfile` and `docker-compose.yml`.
- [x] **Known Limitations & Next Steps** documented honestly.
- [x] **Audit Log Bonus Feature** implemented in `status_histories`.
