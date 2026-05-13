# Implementation Plan: Multi-Tenancy Transition

This plan details the technical steps to convert **Ticket.np** into a multi-tenant application using `django-tenants`.

## 1. Prerequisites
- [ ] Backup current production database.
- [ ] Ensure all current migrations are applied.

## 2. Backend Changes (Django)

### A. New App: `apps.customers`
- [ ] Create a new app to handle tenant metadata.

### B. Settings Overhaul
- [ ] Install `django-tenants`.
- [ ] Split `INSTALLED_APPS` into `SHARED_APPS` and `TENANT_APPS`.

### C. Middleware
- [ ] Add `TenantMainMiddleware` to `MIDDLEWARE`.

## 3. Data Migration Strategy

### Step 1: Create the "Default" Tenant pointing to `public`.
### Step 2: Create new tenant schemas for isolated data.
