# Deployment Guide

## Prerequisites

- Docker and Docker Compose installed
- GitHub account with repository access
- Server with SSH access (for production)
- Domain name (optional, for production)

## Local Development

1. **Clone the repository**
```bash
git clone <repository-url>
cd tickethub
```

2. **Set up environment variables**
```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your settings

# Frontend
cp frontend/.env.example frontend/.env.local
# Edit frontend/.env.local with your settings
```

3. **Start services**
```bash
docker-compose up -d
```

4. **Create superuser (optional)**
```bash
docker-compose exec backend python manage.py createsuperuser
```

5. **Access the application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api
- API Documentation: http://localhost:8000/api/docs

## Production Deployment

### Option 1: Using Docker Compose

1. **Prepare the server**
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

2. **Set up environment variables**
Create a `.env` file with production values:
```env
SECRET_KEY=your-secret-key-here
DEBUG=False
POSTGRES_DB=tickethub
POSTGRES_USER=tickethub
POSTGRES_PASSWORD=strong-password-here
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
CORS_ALLOWED_ORIGINS=https://your-domain.com
```

3. **Deploy**
```bash
# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Run migrations
docker-compose -f docker-compose.prod.yml exec backend python manage.py migrate

# Collect static files
docker-compose -f docker-compose.prod.yml exec backend python manage.py collectstatic --noinput

# Create superuser
docker-compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

### Option 2: Using GitHub Actions (Recommended)

1. **Set up GitHub Secrets**
   - Go to Settings > Secrets and variables > Actions
   - Add the following secrets:
     - `SSH_PRIVATE_KEY`: SSH private key for server access
     - `SSH_HOST`: Server IP or domain
     - `SSH_USER`: SSH username
     - `SLACK_WEBHOOK_URL`: (Optional) For deployment notifications

2. **Configure GitHub Environments**
   - Go to Settings > Environments
   - Create `staging` and `production` environments
   - Add environment protection rules (optional)

3. **Trigger Deployment**
   - Push to `main` branch to trigger automatic deployment
   - Or manually trigger from Actions tab using `deploy-prod.yml`

## Monitoring and Maintenance

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
```

### Backup Database
```bash
# Create backup
docker-compose exec postgres pg_dump -U tickethub tickethub > backup_$(date +%Y%m%d).sql

# Restore backup
docker-compose exec -T postgres psql -U tickethub tickethub < backup_20240101.sql
```

### Update Application
```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

### Health Checks
- Backend: http://your-domain/api/health/
- Frontend: http://your-domain/
- Database: `docker-compose exec postgres pg_isready`

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs <service-name>

# Check container status
docker-compose ps
```

### Database connection issues
```bash
# Verify postgres is running
docker-compose exec postgres pg_isready

# Check database exists
docker-compose exec postgres psql -U tickethub -l
```

### Static files not loading
```bash
# Rebuild static files
docker-compose exec backend python manage.py collectstatic --noinput --clear
```

## Security Checklist

- [ ] Change default passwords
- [ ] Use strong SECRET_KEY
- [ ] Enable HTTPS in production
- [ ] Set DEBUG=False in production
- [ ] Configure proper CORS origins
- [ ] Enable rate limiting
- [ ] Set up SSL certificates
- [ ] Configure firewall rules
- [ ] Regular security updates
