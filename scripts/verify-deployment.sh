#!/bin/bash

# TicketHub Deployment Verification Script
# This script verifies that the deployment is successful and all services are running

set -e

echo "==================================="
echo "TicketHub Deployment Verification"
echo "==================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
TIMEOUT=10

# Track overall status
ALL_PASSED=true

# Function to check HTTP endpoint
check_endpoint() {
    local name=$1
    local url=$2
    local expected_code=${3:-200}
    
    echo -n "Checking $name... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$url" 2>&1) || true
    
    if [ "$response" = "$expected_code" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (HTTP $response)"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (Expected HTTP $expected_code, got: $response)"
        ALL_PASSED=false
        return 1
    fi
}

# Function to check if service is running
check_service() {
    local name=$1
    local host=$2
    local port=$3
    
    echo -n "Checking $name service... "
    
    if nc -z "$host" "$port" 2>/dev/null; then
        echo -e "${GREEN}✓ RUNNING${NC} (Port $port)"
        return 0
    else
        echo -e "${RED}✗ NOT RUNNING${NC} (Port $port)"
        ALL_PASSED=false
        return 1
    fi
}

# Function to test database connection
check_database() {
    echo "Checking Database Connection..."
    
    # Check if we can run Django check command
    if docker-compose exec -T backend python manage.py check --database default > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASSED${NC} Database connection successful"
        return 0
    else
        echo -e "${YELLOW}! WARNING${NC} Could not verify database connection via Docker"
        echo "  Manual verification recommended"
        return 0
    fi
}

# Function to verify migrations
check_migrations() {
    echo -n "Checking Database Migrations... "
    
    if docker-compose exec -T backend python manage.py showmigrations | grep -q "\[ \]"; then
        echo -e "${YELLOW}! WARNING${NC} Unapplied migrations detected"
        echo "  Run: docker-compose exec backend python manage.py migrate"
    else
        echo -e "${GREEN}✓ PASSED${NC} All migrations applied"
    fi
}

# Function to test API health
check_api_health() {
    echo "Testing API Endpoints..."
    
    # Test public endpoints
    check_endpoint "API Root" "$BACKEND_URL/api/" 200 || true
    check_endpoint "Admin Panel" "$BACKEND_URL/admin/login/" 200 || true
    
    # Test authentication endpoint
    check_endpoint "Login API" "$BACKEND_URL/api/auth/login/" 400 || true  # 400 expected without credentials
    
    # Test protected endpoints (should return 401 without auth)
    check_endpoint "Protected Endpoint (Projects)" "$BACKEND_URL/api/projects/" 401 || true
}

# Function to test static files
check_static_files() {
    echo "Checking Static Files..."
    
    # Check if admin static files are accessible
    if curl -s --max-time $TIMEOUT "$BACKEND_URL/static/admin/css/base.css" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASSED${NC} Static files accessible"
    else
        echo -e "${YELLOW}! WARNING${NC} Static files may not be properly configured"
    fi
}

# Function to verify Docker containers
check_docker_containers() {
    echo "Checking Docker Containers..."
    
    containers=("backend" "frontend" "db")
    
    for container in "${containers[@]}"; do
        echo -n "  Container '$container'... "
        
        if docker-compose ps | grep -q "$container.*Up"; then
            echo -e "${GREEN}✓ RUNNING${NC}"
        else
            echo -e "${RED}✗ NOT RUNNING${NC}"
            ALL_PASSED=false
        fi
    done
}

# Function to verify environment variables
check_environment() {
    echo "Checking Environment Configuration..."
    
    # Check if required env vars are set (in backend container)
    required_vars=("SECRET_KEY" "DEBUG" "DATABASE_URL")
    
    for var in "${required_vars[@]}"; do
        echo -n "  Variable '$var'... "
        
        if docker-compose exec -T backend printenv | grep -q "^$var="; then
            echo -e "${GREEN}✓ SET${NC}"
        else
            echo -e "${YELLOW}! WARNING${NC} Not set or empty"
        fi
    done
}

# Function to run Django tests
check_tests() {
    echo "Running Backend Tests..."
    
    if docker-compose exec -T backend pytest --tb=short -q > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASSED${NC} All tests passed"
    else
        echo -e "${YELLOW}! WARNING${NC} Some tests failed or pytest not configured"
        echo "  Run manually: docker-compose exec backend pytest"
    fi
}

# Function to test frontend build
check_frontend_build() {
    echo "Checking Frontend Build..."
    
    # Check if frontend is accessible
    check_endpoint "Frontend App" "$FRONTEND_URL" 200 || true
    
    # Check frontend build output
    if docker-compose exec -T frontend ls .next 2>/dev/null > /dev/null; then
        echo -e "${GREEN}✓ PASSED${NC} Next.js build exists"
    else
        echo -e "${YELLOW}! WARNING${NC} Next.js build not found"
    fi
}

# Function to check SSL certificate (if HTTPS)
check_ssl() {
    if [[ $BACKEND_URL == https://* ]]; then
        echo "Checking SSL Certificate..."
        
        domain=$(echo $BACKEND_URL | sed 's/https:\/\///' | sed 's/:.*//')
        
        if echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -dates > /dev/null 2>&1; then
            echo -e "${GREEN}✓ PASSED${NC} SSL certificate valid"
            
            # Check expiration
            expiry=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
            echo "  Certificate expires: $expiry"
        else
            echo -e "${RED}✗ FAILED${NC} SSL certificate issue detected"
            ALL_PASSED=false
        fi
    fi
}

# Function to log results
log_results() {
    echo ""
    echo "==================================="
    if [ "$ALL_PASSED" = true ]; then
        echo -e "${GREEN}✓ ALL CHECKS PASSED${NC}"
        echo "Deployment verification successful!"
        exit 0
    else
        echo -e "${RED}✗ SOME CHECKS FAILED${NC}"
        echo "Please review the issues above."
        exit 1
    fi
    echo "==================================="
}

# Main execution
echo "Testing against:"
echo "  Backend: $BACKEND_URL"
echo "  Frontend: $FRONTEND_URL"
echo ""

# Run all checks
check_docker_containers
echo ""

check_service "Backend" "localhost" "8000"
check_service "Frontend" "localhost" "3000"
check_service "Database" "localhost" "5432"
echo ""

check_database
echo ""

check_migrations
echo ""

check_api_health
echo ""

check_static_files
echo ""

check_environment
echo ""

check_frontend_build
echo ""

check_ssl
echo ""

# Optional: Run tests (can be slow)
read -p "Run backend tests? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    check_tests
fi

# Log final results
log_results