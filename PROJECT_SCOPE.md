# TicketHub Project Scope

This document provides a comprehensive overview of the current status of TicketHub, detailing the implemented features and outlining potential future improvements.

## 1. Current Project Status: Implemented Features

The following features have been successfully implemented in the core system:

### 🔐 Authentication & Access Control
- **Role-Based Access Control (RBAC)**: Robust permission system with three distinct roles:
    - **Admin**: System-wide management (users, health).
    - **Manager**: Project-level authority (create projects, manage members, assign tickets).
    - **Employee**: Core contributor (work on tickets, log time).
- **JWT Authentication**: Secure stateless authentication for the frontend-backend communication.
- **Project Isolation**: Strict boundaries; users can only see projects they are members of.

### 📁 Project Management
- **Project Lifecycle**: Managers can create, edit, and archive projects.
- **Membership Control**: Managers can add/remove employees from projects they manage.
- **Visibility**: Shared visibility of all tickets and activity within a project for all its members.

### 🎫 Ticket Management
- **Full CRUD Operations**: Create, Read, Update, and (optionally) Delete tickets.
- **Categorization**:
    - **Types**: Bug, Task, Feature.
    - **Priorities**: Low, Medium, High, Critical.
- **Dynamic Workflow**: Status transitions: `New` ➔ `In Progress` ➔ `QA` ➔ `Closed` ➔ `Reopened`.
- **Assignment**: Tickets can be assigned to specific project members.
- **Auto-ID**: Unique, readable Ticket IDs (e.g., `TKT-20260204-1234`).

### 💬 Collaboration & Tracking
- **Interaction**: Threaded comments on each ticket for team discussion.
- **History**: Automated activity logs tracking every status change, assignment update, and comment.
- **Transparency**: Every change is logged with the user and timestamp for accountability.

### ⏱️ Time & Work Logging
- **Effort Tracking**: Employees can log work sessions on specific tickets.
- **Auto-Calculation**: Automatic duration tracking based on start and end times.
- **Context**: Work logs include notes to describe the work performed.

---

## 2. Technical Stack
- **Backend**: Django REST Framework (Python)
- **Frontend**: Next.js (React/TypeScript) utilizing the App Router
- **Database**: PostgreSQL (Production) / SQLite (Development)
- **Styling**: Tailwind CSS for a responsive, modern UI
- **Infrastructure**: Docker & Docker Compose for orchestration

---

## 3. Road Map: Potential Future Improvements

Based on the current implementation, here are several areas for enhancement:

### 🚀 High Impact Additions
- **Real-Time Notifications**:
    - Push notifications or Email alerts for new ticket assignments.
    - Updates on ticket status or mentions in comments.
- **Kanban / Agile Board**:
    - A visual drag-and-drop board for better project overview.
- **GitHub Extension (NEW)**:
    - Dedicated browser extension to create tickets directly from GitHub Issues/PRs.
    - Seamless login and project selection within the GitHub UI.
- **Advanced Analytics & Reporting**:
    - PDF/CSV export for project reports and billable hours.
    - Visual charts for team performance and ticket resolution trends.

### 🛠️ Functionality Enhancements
- **Rich Text Editor**: Support for Markdown or rich text in ticket descriptions and comments.
- **File Management**: Dedicated UI for managing ticket attachments (images, logs).
- **Global Search**: Enhanced search capabilities across all visible projects and tickets.
- **SLA Tracking**: Monitor resolution times against defined Service Level Agreements.

### 🔗 Integrations & Expansion
- **VCS Integration**: Link tickets to GitHub/GitLab commits or PRs.
- **Mobile Application**: A dedicated mobile interface for on-the-go ticket management and time logging.
- **External API Access**: Public API for 3rd party tool integrations.
