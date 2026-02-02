# TicketHub AI Coding Guidelines

## Architecture Overview
TicketHub is a project-based ticket management system with Django REST backend and Next.js frontend. Projects are the core organizational unit - users can only see/access content within projects they're members of.

**Key Components:**
- **Backend (Django apps/)**: users, projects, tickets, timelogs, comments, activity
- **Frontend (Next.js lib/)**: API clients, auth context, protected routes
- **Roles**: admin (system-wide), manager (project authority), employee (project worker)

## Critical Patterns

### Backend Permissions
Use custom permissions from `apps/users/permissions.py`:
- `IsProjectMember`: Checks if user is member of object's project
- `IsProjectManager`: Verifies manager owns the project
- `IsAdminUser`: System admin access

Example: Ticket views require `IsProjectMember` for read, `IsProjectManager` for write.

### Model Relationships
- Projects have many-to-many members via `ProjectMember`
- Tickets belong to projects, assigned to users
- All models use explicit `db_table` names (e.g., `'tickets'`)
- Activity logs use generic foreign keys for auditing

### API Structure
- RESTful endpoints in each app's `urls.py`
- JWT authentication with refresh tokens
- CORS enabled for frontend communication
- Use `drf-spectacular` for OpenAPI docs

### Frontend Auth Flow
- JWT tokens stored in localStorage (`access_token`, `refresh_token`)
- Axios interceptors handle token refresh automatically
- `AuthContext` manages user state and login/logout
- Protected routes check authentication status

## Development Workflows

### Local Setup
```bash
# Start services
docker-compose up -d

# Run migrations
docker-compose exec backend python manage.py migrate

# Create admin user
docker-compose exec backend python manage.py createsuperuser
```

### Adding New Features
1. **Backend**: Create model in appropriate app, add to `INSTALLED_APPS`, run migrations
2. **Permissions**: Add custom permission class if needed
3. **Frontend**: Create API client in `lib/`, add to auth context if user-related
4. **Testing**: Use Docker for integration, check role-based access

### Database Changes
- Use SQLite for development (configured in `settings.py`)
- Production uses PostgreSQL (Docker setup)
- Always run `makemigrations` and `migrate` after model changes

## Code Conventions

### Backend
- Custom User model extends `AbstractUser` with `role` field
- Serializers in each app mirror model fields
- Views use DRF generics with custom permissions
- Error handling via DRF validation

### Frontend
- TypeScript interfaces in `lib/` files (e.g., `User`, `Project`)
- API calls return Promises, handle errors in components
- Use `js-cookie` for client-side storage
- Tailwind for styling, component-based structure

## Common Pitfalls
- **Project Isolation**: Always filter data by project membership, never show cross-project data
- **Role Checks**: Managers have employee permissions + project management, admins are separate
- **Token Handling**: Refresh tokens on 401, redirect to login on failure
- **Migrations**: Test in Docker environment before committing

## Key Files
- `backend/config/settings.py`: App config, database, middleware
- `backend/apps/users/permissions.py`: Role-based access control
- `frontend/lib/api.ts`: Axios setup with JWT interceptors
- `frontend/lib/auth-context.tsx`: Authentication state management
- `docker-compose.yml`: Service orchestration</content>
<parameter name="filePath">d:/Technest/Ticket/.github/copilot-instructions.md
