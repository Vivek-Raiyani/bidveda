# Bidveda Mini RFQ Portal — Backend

A robust, enterprise-grade FastAPI backend for the **Mini RFQ Portal**, powering buyer-vendor procurement, competitive sealed-bid quoting, side-by-side quote comparison, and transactional award workflows.

📖 **System Design Document**: Full 10-section design document is located at [docs/system_design.md](../docs/system_design.md).

---

## ⚡ Quick Start

### 1. Run Server
```bash
# Start development server
fastapi dev
```
* **API Documentation (Swagger UI)**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
* **OpenAPI Schema**: [http://127.0.0.1:8000/api/openapi.json](http://127.0.0.1:8000/api/openapi.json)

### 2. Seed Sample Data
Populate the database with sample buyers, vendors, published & draft RFQs, and competitive quotes:
```bash
python seed.py
```

### 3. Run Automated Tests
Run the automated pytest suite covering key business and security flows:
```bash
pytest -v -W ignore::DeprecationWarning tests/
```

---

## 👥 Seed Test Credentials

| Role | Email | Password | Pre-seeded Context |
| :--- | :--- | :--- | :--- |
| **Buyer** | `buyer@bidveda.in` | `Password123!` | Acme Constructions (owner of Hyderabad Office Supplies RFQ) |
| **Vendor 1** | `vendor1@bidveda.in` | `Password123!` | Vendor Alpha (submitted Quote 1: ₹3,50,000, 10 days) |
| **Vendor 2** | `vendor2@bidveda.in` | `Password123!` | Vendor Beta (submitted Quote 2: ₹3,60,000, 7 days) |
| **Admin** | `admin@bidveda.in` | `Password123!` | System Administrator (full platform oversight) |

---


---

## 🗄️ Database Migrations

This project uses **Alembic** to manage database schema migrations. Migrations run asynchronously against your database using the dynamic driver configuration.

### 1. Generating a New Migration
Whenever you modify your models in `app/models/`, generate a migration script:

```bash
alembic revision --autogenerate -m "Description of your changes"
```

> **Automatic Model Discovery**: All models placed in `app/models/` are discovered automatically in `alembic/env.py`. Type discrepancies between SQLite and UUIDs are safely filtered to prevent accidental destructive column alterations.

### 2. Applying Migrations
To apply pending migrations:

```bash
alembic upgrade head
```

### 3. Rolling Back
To undo the last migration:

```bash
alembic downgrade -1
```

---

## 🔀 Switching Databases

By default, the application is configured to use **SQLite** with the `aiosqlite` async driver (`sqlite+aiosqlite:///test.db`).

### Switching to PostgreSQL:

1. **Install the async Postgres driver**:
   ```bash
   pip install asyncpg psycopg2-binary
   ```
2. **Update your `.env` file**:
   ```env
   DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/dbname
   ```
3. **Apply your schema**:
   ```bash
   alembic upgrade head
   ```

---

## 📦 Storage System (`app/utils/storage.py`)

The project uses a unified storage abstraction layer supporting both local filesystem storage and cloud S3-compatible object stores (AWS S3, Backblaze B2, Cloudflare R2, MinIO).

### Configuration (`.env`)

Set `STORAGE_PROVIDER` to either `local` or `s3`:

```env
# Choose: "local" or "s3"
STORAGE_PROVIDER=local

# AWS / S3 / Backblaze B2 Configuration (required when STORAGE_PROVIDER=s3)
AWS_ENDPOINT=https://s3.us-east-005.backblazeb2.com
AWS_BUCKET_NAME=my-bucket
AWS_REGION_NAME=us-east-005
AWS_ACCESS_KEY_ID=your_key_id
AWS_SECRET_ACCESS_KEY=your_app_key
```

### Key Features & Updates

1. **S3 Presigned `PUT` Compatibility (Backblaze B2 & AWS S3)**:
   - Direct presigned uploads use `generate_presigned_url("put_object", ...)` instead of HTML Form POST.
   - Compatible with **Backblaze B2**, Cloudflare R2, and AWS S3 without `501 NotImplemented` errors.
2. **Auto File Extension Resolution**:
   - If an asset is uploaded or requested without an extension in `filename` (e.g. `"filename": "test"`), the backend automatically infers the extension from `content_type` (e.g. `application/pdf` -> `.pdf`).
3. **Non-Blocking Local Storage**:
   - Local file operations (`os.makedirs`, file writing, deletion) are offloaded to worker threads via `asyncio.to_thread` to ensure zero event-loop blocking.

### Direct Upload Flow:

1. **Request Presigned Upload**:
   `POST /api/assets/upload/presigned`
   ```json
   {
     "filename": "document.pdf",
     "content_type": "application/pdf",
     "file_size": 150000,
     "folder": "assets/common"
   }
   ```
2. **Upload File**:
   - **For S3 / Backblaze B2** (`provider="s3"`): Send an HTTP `PUT` request with binary file data directly to `upload_url`:
     ```powershell
     curl.exe -i -X PUT "<upload_url>" --upload-file "path/to/file.pdf"
     ```
   - **For Local Storage** (`provider="local"`): Send multipart form-data to `/api/assets/upload/local/{asset_id}`.
3. **Complete Upload**:
   `POST /api/assets/upload/complete/{asset_id}` confirms the file in storage, verifies file size, and marks status as `completed`.

---

## 📧 Email System (`app/utils/emails.py`)

The email service provides an asynchronous, non-blocking interface for sending transactional emails.

### Configuration (`.env`)

Set `EMAIL_PROVIDER` to `smtp` or `resend`:

```env
# Choose: "smtp" or "resend"
EMAIL_PROVIDER=smtp

# SMTP Configuration (aiosmtplib)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
EMAILS_FROM_EMAIL=noreply@yourdomain.com

# Resend API Configuration (when EMAIL_PROVIDER=resend)
RESEND_API_KEY=re_123456789
```

### Key Features & Updates

1. **Asynchronous SMTP via `aiosmtplib`**:
   - Replaced synchronous `smtplib` with **`aiosmtplib.send(...)`**.
   - Fully non-blocking: Sending emails never blocks FastAPI's async event loop.
   - Automatic TLS negotiation: Uses `STARTTLS` for port `587` and direct `SSL/TLS` for port `465`.
2. **Resend HTTP API**:
   - Asynchronous HTTP delivery using `httpx.AsyncClient`.
3. **Usage in Application**:

```python
from app.utils.emails import email_provider

success = await email_provider.send_email(
    to_email="user@example.com",
    subject="Welcome to our platform!",
    html_content="<h1>Welcome!</h1><p>Thanks for joining us.</p>"
)
```
