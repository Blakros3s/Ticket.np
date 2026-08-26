# TicketHub demo data (`populate_demo`)

Layered demo seeding for local development, QA, and sales demos.

## Tiers

| Tier | Purpose | Entry point |
|------|---------|-------------|
| **Full demo** | One realistic tenant across tickets, projects, todos, calendar, reports | `populate_demo` |
| **Granular seeds** | Partial data on an existing tenant | `seed_demo_users`, `seed_projects` |
| **Legacy bulk** | Random volume on any schema (older workflow) | `populate_db` |

Canonical module: `apps/core/populate_demo.py` — catalogs at the top, orchestration below.

## Primary command — `populate_demo`

```bash
cd backend
python manage.py migrate_schemas --noinput
python manage.py populate_demo
python manage.py populate_demo --flush
python manage.py populate_demo --flush --password "YourPass1!"
```

Docker:

```bash
docker compose -f docker/docker-compose.base.yml -f docker/docker-compose.dev.yml \
  exec backend python manage.py populate_demo --flush
```

| Flag | Effect |
|------|--------|
| (none) | Upsert demo tenant + all data (idempotent) |
| `--flush` | Drop demo tenant schema (`technest_hub`), then re-seed |
| `--password` | Password for all seeded accounts (default: `technest2026`) |
| `--include-legacy-flush` | Also drop `LEGACY_FLUSH_SCHEMAS` (empty by default) |

### What it creates

**Public schema**

- Platform user: `serveradmin` (server / tenant management UI)

**Tenant: Technest Innovations (Demo)**

- Schema: `technest_hub` · slug: `technest-hub` · login domain: `technest.com`
- Premium plan subscription
- 1 admin, 3 managers, 6 employees
- 6 projects (5 active, 1 archived) with GitHub repos on key projects
- **Scenario tickets** on Website Redesign — every board column:
  - New (unassigned)
  - In progress
  - QA
  - Closed
  - Reopened
  - Due soon (SLA risk)
- Bulk tickets across active projects (random statuses)
- ~14 days of historical closed tickets (Analytics Dashboard) for reports charts
- Comments and work logs on scenario tickets
- Notifications and activity logs
- Personal todos and team calendar events

## Login credentials

All tenant users share the seed password (`technest2026` by default).

Login format: `username@technest.com` (e.g. `admin@technest.com`, `mike.brown@technest.com`).

| Role | Username | Login |
|------|----------|-------|
| Admin | `admin` | `admin@technest.com` |
| Manager | `john.smith` | `john.smith@technest.com` |
| Manager | `sarah.johnson` | `sarah.johnson@technest.com` |
| Manager | `david.williams` | `david.williams@technest.com` |
| Employee | `mike.brown` | `mike.brown@technest.com` |
| Employee | `emily.jones` | `emily.jones@technest.com` |
| Employee | `robert.garcia` | `robert.garcia@technest.com` |
| Employee | `lisa.miller` | `lisa.miller@technest.com` |
| Employee | `james.davis` | `james.davis@technest.com` |
| Employee | `maria.wilson` | `maria.wilson@technest.com` |

Platform: `serveradmin` / same password → `/server/login`

## Demo script (what to click)

1. **Board** — log in as `mike.brown@technest.com`, open Tickets → Board; see columns populated.
2. **Ticket detail** — open `[Demo] In progress — active development` for assignee, module, comments, work log.
3. **Reports** — log in as `admin@technest.com`, Reports & Analytics → system overview + export (project: Website Redesign).
4. **My tickets** — `mike.brown@technest.com` sees assigned scenario tickets.
5. **Todos / Calendar** — personal todos and upcoming sprint/release events.
6. **Archived project** — Projects list shows Legacy Customer Portal as archived.

Scenario ticket titles are prefixed with `[Demo]` so they are easy to find.

## Granular seeds

```bash
# Users only on demo tenant (or --tenant=<schema|slug>)
python manage.py seed_demo_users
python manage.py seed_demo_users --tenant technest_hub --password technest2026

# Projects (+ optional full ticket scenarios)
python manage.py seed_projects
python manage.py seed_projects --tenant technest_hub --tickets
```

`populate_demo` supersedes these for normal dev. Use partial commands when you only need one slice on an existing tenant.

## Legacy — `populate_db`

```bash
python manage.py populate_db --clear --schema=main
```

Populates whichever schema you pass (default `main`) with the same seed catalogs via bulk mode. Prefer `populate_demo` for the fixed demo tenant.

## Programmatic API

```python
from apps.core.populate_demo import (
    ensure_demo_tenant,
    seed_existing_demo_tenant,
    run_all_demo_scenarios,
    run_populate_demo,
)

ctx = run_populate_demo(password='technest2026', flush=True)
# or on an existing client:
ctx = seed_existing_demo_tenant(client, password='technest2026')
run_all_demo_scenarios(ctx)
```

## Flush safety

`--flush` only drops tenants listed in `DEMO_FLUSH_SCHEMAS` (`technest_hub`). It does **not** wipe the full database. Add schemas to `LEGACY_FLUSH_SCHEMAS` in code if you need to clean old dev tenants with `--include-legacy-flush`.

## Tests

```bash
python manage.py test apps.core.tests.test_populate_demo
```
