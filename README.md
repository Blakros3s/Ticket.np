# TicketHub

A simple project-based ticket management system.

## Structure

- `backend/` - Django REST Framework API
- `frontend/` - Next.js frontend
- `docker-compose.yml` - Docker orchestration

## Setup

```bash
# Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Start with Docker
docker-compose up -d

# Run migrations
docker-compose exec backend python manage.py migrate

# Create superuser
docker-compose exec backend python manage.py createsuperuser
```
