# Product Requirements Document (PRD)
## Simple Project-Based Ticket Management System

---

## 1. Product Overview

### Product Name
*(Working title)* TicketHub

### Purpose
TicketHub is a **simple, project-based ticket management system** designed to help teams track tasks, bugs, and feature requests with clarity and minimal overhead.

The system prioritizes:
- Clear project boundaries
- Shared visibility inside projects
- Simple workflows
- Practical insights without enterprise bloat

---

## 2. Core Philosophy

- **Projects are the main unit of organization**
- **If you are part of a project, you can see everything inside it**
- **Managers manage projects, not people globally**
- **Admins do not interfere with daily work**

---

## 3. Target Users

- **Admin** – Maintains the system
- **Employees** – Work on tickets inside projects
- **Managers** – Employees with additional project management responsibilities

> A Manager is still an Employee, just with extra permissions inside projects.

---

## 4. User Roles & Responsibilities

### 4.1 Admin (System-Level Only)

**Purpose:** Keep the system running and secure.

Permissions:
- Create, deactivate, and manage users
- Assign or remove global roles (Employee / Manager)
- View system-level health and usage
- No involvement in project or ticket workflows

**Explicitly NOT responsible for:**
- Creating projects
- Managing tickets
- Assigning work

---

### 4.2 Employee (Base Role)

**Purpose:** Execute work inside projects.

Permissions:
- View all projects they are added to
- View **all tickets (active and closed)** within those projects
- Comment on tickets
- Log work time
- Update ticket status (based on project rules)

Restrictions:
- Cannot see projects they are not part of
- Cannot manage project membership

---

### 4.3 Manager (Employee + Project Authority)

**Purpose:** Manage work inside projects.

Additional permissions (on top of Employee):
- Create projects
- Add or remove employees from projects
- Create, edit, assign, and prioritize tickets
- View time logs and project insights
- Monitor progress and workload inside projects

Scope:
- Authority is **limited to projects they manage**
- No system-wide control

---

## 5. Project Management

### 5.1 Project Definition

A Project includes:
- Name
- Description
- Status (Active / Archived)
- Created by (Manager)
- Members (Employees & Managers)

### 5.2 Project Membership Rules

- Managers add/remove users from projects
- Only project members can:
  - View tickets
  - Comment
  - Log time
- All project members can see:
  - Active tickets
  - Closed tickets
  - Ticket history

**Key Rule:**
> Project membership defines visibility. No membership = no access.

---

## 6. Ticket Management

### 6.1 Ticket Creation

Each ticket must belong to a project and includes:
- Ticket ID (auto-generated)
- Title
- Description
- Type (Bug, Task, Feature)
- Priority (Low, Medium, High, Critical)
- Status
- Assignee (optional)
- Attachments (optional)
- Created by

---

### 6.2 Ticket Status Flow (v1)


Optional:
- Reopened (from Closed)

All project members can see all statuses.

---

### 6.3 Assignment Rules

- Managers assign tickets
- Employees may self-assign if allowed by project settings
- One primary assignee per ticket (v1)

---

## 7. Time & Work Logging

### Work Logs
Employees can:
- Start work on a ticket
- Stop work when done

System records:
- Start time
- End time
- Total duration
- User
- Ticket reference

Visibility:
- All project members can see time logs
- Managers get aggregated insights

(No billing, estimates, or approvals in v1)

---

## 8. Communication & Activity Tracking

### Comments
- Threaded comments per ticket
- Visible to all project members

### Activity Log (Automatic)
Tracks:
- Status changes
- Assignment changes
- Edits
- Work log events

Read-only, cannot be modified.

---

## 9. Dashboards & Insights

### Employee Dashboard
- Assigned tickets
- Tickets in progress
- Recent activity

### Manager Dashboard
- Project overview
- Ticket distribution by status
- Time spent per ticket
- Team workload snapshot

### Admin Dashboard
- User count
- Active projects count
- System usage metrics

---

## 10. Search & Filtering

Search tickets by:
- Ticket ID
- Title
- Description

Filters:
- Project
- Status
- Priority
- Assignee

All searches are scoped to visible projects only.

---

## 11. Non-Functional Requirements

- Performance: < 2s ticket load time
- Security:
  - Strict project-based access
  - Role-based permissions
- Scalability:
  - Multiple projects per manager
  - Hundreds of tickets per project
- Maintainability:
  - Clean migrations
  - Modular domain design
- Deployment:
  - Dockerized
  - CI/CD ready

---

## 12. Technical Stack (Proposed)

- Backend: Django REST Framework
- Frontend: Next Js
- Database: PostgreSQL
- Authentication: JWT
- DevOps: Docker, CI/CD pipelines

---

## 13. Out of Scope (v1)

- Sprints / epics
- Story points
- External integrations
- SLA management
- Client-facing portals

---

## 14. Future Enhancements

- Email notifications
- GitHub/GitLab integration
- Advanced analytics
- Mobile app
- Custom workflows per project

---

## 15. Success Metrics

- Project onboarding time
- Ticket resolution time
- Manager visibility satisfaction
- Reduced dependency on external tools
