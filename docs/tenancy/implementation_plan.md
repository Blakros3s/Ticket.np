# Multi-Tenancy Implementation Plan

Phased rollout for schema-per-tenant + server admin. Each phase is independently deployable where noted.

---

## Phase 0 — Prerequisites

- [ ] Full production database backup
- [ ] All existing migrations applied
- [ ] Staging environment with PostgreSQL 18
- [ ] DNS wildcard: `*.ticketnp.com` → load balancer

---

## Phase 1 — Platform foundation (this PR)

**Goal:** django-tenants infrastructure + server admin API. Existing single-tenant data unchanged until Phase 3.

### Backend deliverables

| Item | Status |
|------|--------|
| `django-tenants` dependency | ✅ |
| `apps.customers` — Client, Domain, Plan, TenantSubscription | ✅ |
| `apps.platform` — PlatformUser, server auth, server API | ✅ |
| `settings.py` — SHARED/TENANT split, middleware, routers | ✅ |
| `config/urls_public.py` — platform routes | ✅ |
| Tenant provisioning service | ✅ |
| Plan/subscription service | ✅ |
| `TenantJWTAuthentication` + JWT tenant claims | ✅ |
| `TenantHeaderMiddleware` dev fallback | ✅ |
| Rate limit schema prefix | ✅ |
| `manage.py createsuperuser` (platform server admin) | ✅ |
| Docker entrypoint `migrate_schemas` | ✅ |

### Bootstrap new environment

```bash
# 1. Install deps
pip install -r requirements.txt

# 2. Shared schema migrations
python manage.py migrate_schemas --shared

# 3. Create first tenant (fresh install)
python manage.py create_tenant \
  --schema_name=demo \
  --name="Demo Organization" \
  --domain=demo.localhost \
  --admin-username=admin \
  --admin-password=changeme123

# 4. Bootstrap platform server admin + default plans
python manage.py createsuperuser --noinput \
  --username=serveradmin \
  --password=changeme123

# 5. Run tenant migrations
python manage.py migrate_schemas
```

### Verify

```bash
# Server admin login (public host / localhost)
curl -X POST http://localhost:8000/api/server/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"serveradmin","password":"changeme123"}'

# List tenants
curl http://localhost:8000/api/server/tenants/ \
  -H "Authorization: Bearer <access>"

# Tenant staff login (subdomain or header)
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Schema: demo" \
  -d '{"username":"admin","password":"changeme123"}'
```

---

## Phase 2 — Tenant auth hardening

- [ ] Subscription check on tenant login + token refresh
- [ ] Plan limit enforcement on user/project creation
- [ ] JWT `tenant_schema` validation in all tenant views (via auth class)
- [ ] Deactivate tenant → block all tenant staff login
- [ ] Update `populate_db` / `create_test_users` to use `schema_context`

### Files

- `apps/users/views.py` — subscription gate on login
- `apps/users/serializers.py` — subscription claims in JWT
- `apps/projects/views.py` — `max_projects` check
- `apps/users/management_views.py` — `max_users` check

---

## Phase 3 — Legacy data migration

**Goal:** Move existing single-tenant data from `public` → `main` schema.

### Steps

1. Deploy Phase 1 to staging with maintenance window
2. `python manage.py migrate_schemas --shared`
3. Create legacy tenant without auto-migrate:
   ```python
   Client(schema_name='main', name='Main Organization', auto_create_schema=True).save()
   Domain(domain='main.localhost', tenant=client, is_primary=True).save()
   ```
4. Move tables (SQL script below)
5. `python manage.py migrate_schemas`
6. Assign subscription to `main` tenant
7. Smoke test all features on `main.localhost`

### SQL: move tables to `main` schema

```sql
-- Run in transaction; adjust if table names differ
DO $$
DECLARE
    tables TEXT[] := ARRAY[
        'users', 'user_roles', 'users_department_roles',
        'projects', 'project_members', 'project_documents',
        'tickets', 'ticket_media',
        'work_logs', 'comments', 'activity_logs',
        'calendar_events', 'todo_items',
        'office_settings', 'leave_requests', 'attendance_logs', 'attendance_records',
        'notifications',
        'django_admin_log', 'auth_group', 'auth_group_permissions',
        'auth_permission', 'django_content_type',
        'token_blacklist_outstandingtoken', 'token_blacklist_blacklistedtoken'
    ];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY tables
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = t
        ) THEN
            EXECUTE format('ALTER TABLE public.%I SET SCHEMA main', t);
        END IF;
    END LOOP;
END $$;
```

---

## Phase 4 — Media path isolation

- [x] Prefix `ticket_media_upload_path` with `connection.schema_name`
- [x] Prefix `project_documents` upload path
- [x] Update `media_views.py` to resolve tenant-scoped paths
- [x] `manage.py migrate_media_schemas` — move existing files under `{schema}/`

---

## Phase 5 — Background jobs

- [ ] `mark_absentees` — iterate all tenant schemas
- [ ] `cleanup_old_notifications` — iterate all tenant schemas
- [ ] `notifications/tasks.py` — accept `schema_name` kwarg
- [ ] Celery task base class with `schema_context`

---

## Phase 6 — Frontend

### Tenant app

| File | Change |
|------|--------|
| `frontend/lib/api.ts` | Dynamic base URL from subdomain |
| `frontend/lib/auth.ts` | Store `tenant_schema`; subscription error UX |
| `frontend/lib/auth-context.tsx` | Tenant context |
| `frontend/app/auth/login/page.tsx` | Handle expired subscription |

### Server admin UI (RestaurantMS-style)

| File | Purpose |
|------|---------|
| `frontend/app/(server)/layout.tsx` | `server_admin` guard |
| `frontend/app/(server)/server/tenants/page.tsx` | Tenant list |
| `frontend/app/(server)/server/tenants/[id]/page.tsx` | Tenant detail |
| `frontend/app/(server)/server/plans/page.tsx` | Plan management |
| `frontend/lib/server-api.ts` | Platform API client |

---

## Phase 7 — Testing & CI

- [ ] Tenant isolation tests (IDOR regression)
- [ ] Server admin permission tests
- [ ] Subscription expiry login tests
- [ ] Plan limit tests
- [ ] `settings_test.py` — tenant test runner or schema fixtures
- [ ] E2E: provision tenant → login → create project

---

## File change inventory

### New files

```
backend/apps/customers/
  __init__.py, apps.py, models.py, admin.py, middleware.py
  services/tenants.py, services/plans.py
  serializers/plans.py, serializers/tenants.py
  views/server_tenants.py, views/server_plans.py
  urls.py, migrations/0001_initial.py

backend/apps/platform/
  __init__.py, apps.py, models.py, admin.py
  serializers.py, views.py, urls.py, permissions.py
  authentication.py, migrations/0001_initial.py

backend/config/urls_public.py
backend/apps/users/authentication.py
backend/apps/customers/management/commands/createsuperuser.py
backend/apps/customers/management/commands/create_tenant.py
```

### Modified files

```
backend/config/settings.py
backend/config/settings_test.py
backend/requirements.txt
backend/apps/users/serializers.py
backend/apps/core/middleware.py
docker/backend/entrypoint.sh
docker/backend/entrypoint.prod.sh
docs/tenancy/architecture.md
docs/tenancy/implementation_plan.md
```

### Future (Phase 2+)

```
backend/apps/users/views.py
backend/apps/projects/views.py
backend/apps/tickets/models.py
backend/apps/projects/models.py
backend/apps/notifications/tasks.py
backend/apps/attendance/management/commands/mark_absentees.py
frontend/lib/api.ts
frontend/lib/server-api.ts
frontend/app/(server)/**
```

---

## Rollback plan

1. Restore database backup
2. Revert to standard `django.db.backends.postgresql` engine
3. Remove `TenantMainMiddleware`
4. Restore `migrate` in entrypoint

Schema-per-tenant is a one-way migration for production data — always backup before Phase 3.

---

## Default plans

| Plan | Users | Projects | Attendance | Calendar | Email |
|------|-------|----------|------------|----------|-------|
| Standard | 25 | 10 | ✓ | ✓ | ✓ |
| Premium | 100 | 50 | ✓ | ✓ | ✓ |

Seeded by `createsuperuser` and `ensure_default_plans()`.
