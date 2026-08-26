# Database population

Demo and seed data are managed through Django management commands and `apps/core/populate_demo.py`.

**See [docs/populate.md](docs/populate.md)** for:

- `populate_demo` (canonical demo tenant)
- `seed_demo_users` / `seed_projects` (partial seeds)
- `populate_db` (legacy bulk on `--schema`)
- Login credentials and demo walkthrough

Quick start:

```bash
cd backend
python manage.py migrate_schemas --noinput
python manage.py populate_demo --flush
```
