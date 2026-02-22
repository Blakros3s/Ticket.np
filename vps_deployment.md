# VPS Deployment Guide: Ticket Management System

This guide provides a comprehensive, step-by-step process for deploying the Ticket Management System on a fresh Virtual Private Server (VPS). It assumes a clean installation of **Ubuntu 22.04 LTS** or **Ubuntu 24.04 LTS**.

## 1. Server Initialization & Security

Connect to your VPS via SSH:
```bash
ssh root@your_server_ip
```

### Update Packages
```bash
apt update && apt upgrade -y
```

### Configure Firewall (UFW)
```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

---

## 2. Install Docker & Docker Compose

Run the official Docker installation script:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

Verify installation:
```bash
docker --version
docker compose version
```

---

## 3. Project Setup

### Clone the Repository
```bash
git clone <your-repository-url> /opt/ticket
cd /opt/ticket
```

### Environment Configuration
Create the production environment file:
```bash
# Backend Environment
cp backend/.env.example backend/.env
nano backend/.env
```

**Required Production settings in `backend/.env`:**
- `DEBUG=False`
- `SECRET_KEY=generate-a-long-random-string`
- `ALLOWED_HOSTS=yourdomain.com,your_server_ip`
- `CORS_ALLOWED_ORIGINS=https://yourdomain.com`
- `POSTGRES_DB=tickethub`
- `POSTGRES_USER=ticketuser`
- `POSTGRES_PASSWORD=use-a-strong-password`
- `DB_HOST=db`
- `DB_PORT=5432`

---

## 4. Deployment Launch

Start the production services:
```bash
docker compose -f docker/docker-compose.prod.yml up -d --build
```

### Initial Database Setup
```bash
# Run Migrations
docker compose -f docker/docker-compose.prod.yml exec backend python manage.py migrate

# Collect Static Files
docker compose -f docker/docker-compose.prod.yml exec backend python manage.py collectstatic --noinput

# Create Administrative User
docker compose -f docker/docker-compose.prod.yml exec backend python manage.py createsuperuser
```

---

## 5. Reverse Proxy & SSL (Certbot)

We use Nginx as a reverse proxy. 

### Install Certbot
```bash
apt install certbot python3-certbot-nginx -y
```

### Obtain SSL Certificate
Replace `yourdomain.com` with your actual domain:
```bash
certbot --nginx -d yourdomain.com
```

### Auto-Renewal
Certbot automatically adds a renewal task. Test it with:
```bash
certbot renew --dry-run
```

---

## 6. Lifecycle Management

### Viewing Logs
```bash
# View all logs
docker compose -f docker/docker-compose.prod.yml logs -f

# View backend only
docker compose -f docker/docker-compose.prod.yml logs -f backend
```

### Updating the Application
```bash
git pull origin main
docker compose -f docker/docker-compose.prod.yml up -d --build
docker compose -f docker/docker-compose.prod.yml exec backend python manage.py migrate
```

### Maintenance: Database Backup
```bash
# Manual backup
docker compose -f docker/docker-compose.prod.yml exec db pg_dump -U ticketuser tickethub > backup_$(date +%F).sql
```

---

## 7. Troubleshooting

| Issue | Verification Command |
| :--- | :--- |
| **Containers not starting** | `docker ps -a` |
| **Server Error 500** | `docker compose -f docker/docker-compose.prod.yml logs backend` |
| **Media/Static files missing** | `ls -la /opt/ticket/static_volume` |
| **Nginx Config Error** | `nginx -t` |

---
**Note:** Ensure your domain's DNS A-record points to your VPS IP before running the Certbot command.
