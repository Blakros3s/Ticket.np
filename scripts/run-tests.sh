#!/bin/bash

# TicketHub Test Runner Script
# Runs all backend tests with coverage report

set -e

echo "==================================="
echo "TicketHub Test Suite"
echo "==================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Change to backend directory
cd "$(dirname "$0")/../backend" || exit 1

echo -e "${BLUE}Running Django checks...${NC}"
python manage.py check --deploy --fail-level WARNING 2>/dev/null || echo -e "${YELLOW}Warning: Django deployment checks found issues${NC}"

echo ""
echo -e "${BLUE}Running database migrations check...${NC}"
python manage.py showmigrations | grep "\[ \]" && echo -e "${YELLOW}Warning: Unapplied migrations detected${NC}" || echo -e "${GREEN}✓ All migrations applied${NC}"

echo ""
echo -e "${BLUE}Running test suite with coverage...${NC}"
pytest --cov=apps --cov-report=term-missing --cov-report=html:coverage_html -v

echo ""
echo -e "${GREEN}===================================${NC}"
echo -e "${GREEN}Tests completed successfully!${NC}"
echo -e "${GREEN}===================================${NC}"
echo ""
echo "Coverage report generated in: backend/coverage_html/index.html"
echo ""