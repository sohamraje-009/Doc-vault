# DocVault

Enterprise-grade document management platform built with React, TypeScript, FastAPI, and PostgreSQL.

Centralized document management for company departments with secure storage, search, download tracking, auditability, and role-based access control.

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 19, TypeScript, Vite, MUI, React Router, Axios, React Query |
| Backend | FastAPI, Python 3.13+, SQLAlchemy, Alembic, JWT, Pydantic |
| Database | PostgreSQL |
| Storage | Local filesystem (cloud-ready abstraction) |

## Project Structure

```
docvault/
├── backend/          # FastAPI application
│   ├── app/
│   │   ├── api/      # REST endpoints
│   │   ├── core/     # Config, security, dependencies
│   │   ├── db/       # Database session & seeding
│   │   ├── models/   # SQLAlchemy models
│   │   ├── schemas/  # Pydantic schemas
│   │   ├── services/ # Business logic
│   │   └── storage/  # File storage abstraction
│   └── alembic/      # Database migrations
├── frontend/         # React SPA
└── docker-compose.yml
```

## Quick Start (Docker)

```bash
cd docvault
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| Swagger Docs | http://localhost:8000/docs |

**Default admin credentials:** `admin` / `Admin@123`

## Local Development

### Prerequisites

- Python 3.13+
- Node.js 22+
- PostgreSQL 16+

### Backend

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

## Modules (Build Progress)

- [x] **Authentication** — JWT login, refresh tokens, bcrypt, protected routes
- [x] **Database** — Models, migrations, default departments, admin seed
- [ ] **Dashboard** — Executive analytics and activity feed
- [ ] **Documents** — Upload, list, search, viewer
- [ ] **Download History** — Audit trail and CSV export
- [ ] **Admin Panel** — Users and departments management

## Default Departments

Seeded automatically on startup:

- IT Support Documents
- Store Documents
- Automation Documents
- Maintenance Documents
- Accounts Documents
- HR Documents

## API Documentation

FastAPI auto-generates OpenAPI docs at `/docs` (Swagger UI) and `/redoc`. The API title is **DocVault**.

## Security.

- JWT access + refresh token flow
- bcrypt password hashing
- Role-based authorization (Admin / Employee)
- SQL injection protection via SQLAlchemy ORM
- File type and size validation (documents module)
- Activity audit logging

## Environment Variables

See `backend/.env.example` and `frontend/.env.example` for configuration options.

## License

Proprietary — DocVault Secure Enterprise Document Management System
