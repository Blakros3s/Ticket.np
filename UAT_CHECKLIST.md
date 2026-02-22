# TicketHub - User Acceptance Testing (UAT) Checklist

## Environment
- [ ] Application deployed to staging environment
- [ ] Database seeded with test data
- [ ] All services running (backend, frontend, database)
- [ ] Email notifications configured (if applicable)

## Authentication & User Management

### Admin Role
- [ ] Admin can login with credentials
- [ ] Admin can view user management page
- [ ] Admin can create new users (Employee/Manager roles)
- [ ] Admin can edit user details
- [ ] Admin can deactivate/activate users
- [ ] Admin can view all projects and tickets
- [ ] Admin can access admin dashboard with system metrics
- [ ] Admin cannot be deactivated by other admins

### Manager Role
- [ ] Manager can login with credentials
- [ ] Manager can create new projects
- [ ] Manager can edit own projects
- [ ] Manager can add members to own projects
- [ ] Manager can remove members from own projects
- [ ] Manager can archive own projects
- [ ] Manager cannot edit/delete other managers' projects
- [ ] Manager can create tickets in own projects
- [ ] Manager can assign tickets to project members
- [ ] Manager can view manager dashboard

### Employee Role
- [ ] Employee can login with credentials
- [ ] Employee can view assigned projects only
- [ ] Employee can create tickets in assigned projects
- [ ] Employee can edit own tickets
- [ ] Employee can update status of assigned tickets
- [ ] Employee cannot edit other users' tickets (unless authorized)
- [ ] Employee can log work time on tickets
- [ ] Employee can add comments to tickets
- [ ] Employee can view employee dashboard
- [ ] Deactivated employee cannot login

## Project Management

### Project Creation
- [ ] Manager can create project with name and description
- [ ] Project name must be unique
- [ ] Project is created with "active" status by default
- [ ] Creator is automatically added as member

### Project Editing
- [ ] Only creator or admin can edit project
- [ ] Project name and description can be updated
- [ ] Changes are saved and visible immediately

### Project Members
- [ ] Manager can add existing users as members
- [ ] Manager cannot add users who are already members
- [ ] Manager can remove members from project
- [ ] Removed members lose access to project tickets
- [ ] Member list displays correctly with user details

### Project Archiving
- [ ] Manager can archive own projects
- [ ] Archived projects are visible but read-only
- [ ] New tickets cannot be created in archived projects
- [ ] Existing tickets in archived projects remain accessible

## Ticket Management

### Ticket Creation
- [ ] User can create ticket with all required fields
- [ ] Ticket ID is auto-generated (TKT-YYYYMMDD-XXXX format)
- [ ] Title, description, type, priority are required
- [ ] Project and assignee selection works correctly
- [ ] Ticket appears in project ticket list immediately

### Ticket Listing & Filtering
- [ ] All project members can view project tickets
- [ ] Tickets can be filtered by status
- [ ] Tickets can be filtered by priority
- [ ] Tickets can be filtered by type
- [ ] Tickets can be filtered by assignee
- [ ] Multiple filters can be applied simultaneously
- [ ] Pagination works correctly for large lists

### Ticket Search
- [ ] Full-text search works on ticket title
- [ ] Full-text search works on ticket description
- [ ] Search by ticket ID works
- [ ] Search results are scoped to user's visible projects
- [ ] Empty search returns all visible tickets

### Ticket Updates
- [ ] Title can be updated
- [ ] Description can be updated
- [ ] Type can be changed
- [ ] Priority can be changed
- [ ] Assignee can be changed
- [ ] Only authorized users can update tickets

### Ticket Status Flow
- [ ] Status can change from New → In Progress
- [ ] Status can change from In Progress → QA
- [ ] Status can change from QA → Closed
- [ ] Status can change from Closed → Reopened
- [ ] Reopened tickets can go back to In Progress
- [ ] Invalid status transitions are blocked
- [ ] Status changes are logged in activity history

### Ticket Assignment
- [ ] Ticket can be assigned to project members only
- [ ] Assignment change is logged in activity history
- [ ] Assignee receives notification (if implemented)
- [ ] Unassigned tickets show as "Unassigned"

### Ticket Deletion
- [ ] Ticket creator can delete ticket
- [ ] Project managers can delete project tickets
- [ ] Admin can delete any ticket
- [ ] Deleted tickets are removed from database
- [ ] Associated comments and work logs are handled

## Time Logging

### Start Work
- [ ] User can start work on a ticket
- [ ] Cannot start work if already working on another ticket
- [ ] Start time is recorded accurately
- [ ] Work log entry is created

### Stop Work
- [ ] User can stop work on active ticket
- [ ] End time is recorded accurately
- [ ] Duration is calculated correctly (in minutes)
- [ ] Duration is displayed in hours/minutes

### Work Log Display
- [ ] Work logs visible on ticket detail page
- [ ] Total time per ticket is calculated
- [ ] Work logs can be filtered by user
- [ ] Work logs can be filtered by ticket
- [ ] Work logs ordered by start time (newest first)

### Work Log Notes
- [ ] User can add notes when stopping work
- [ ] Notes can be edited later
- [ ] Only work log owner can edit notes

## Comments

### Adding Comments
- [ ] Project members can add comments to tickets
- [ ] Comment content is required
- [ ] Comment appears immediately on ticket
- [ ] Comment timestamp is accurate

### Comment Display
- [ ] Comments displayed in chronological order
- [ ] Author name and timestamp shown
- [ ] Edited comments show "edited" indicator
- [ ] All comments visible to project members

### Comment Editing
- [ ] Comment author can edit own comments
- [ ] Cannot edit other users' comments
- [ ] Edit timestamp is recorded
- [ ] Original content replaced with new content

### Comment Deletion
- [ ] Comment author can delete own comments
- [ ] Cannot delete other users' comments
- [ ] Deleted comments are removed from display

## Activity Log

### Activity Tracking
- [ ] Ticket creation is logged
- [ ] Ticket updates are logged
- [ ] Status changes are logged with old/new values
- [ ] Assignment changes are logged
- [ ] Comment additions are logged
- [ ] Work log events are logged

### Activity Display
- [ ] Activity log visible on ticket detail
- [ ] Activities ordered by time (newest first)
- [ ] User, action, and timestamp displayed
- [ ] Detailed description shown for each action

### Activity Filtering
- [ ] Can filter by action type
- [ ] Can filter by user
- [ ] Can filter by date range
- [ ] Can view all system activities (admin only)

## Dashboards

### Employee Dashboard
- [ ] Shows assigned tickets count
- [ ] Shows tickets in progress
- [ ] Shows recent activity
- [ ] Shows upcoming deadlines (if implemented)
- [ ] Quick access to assigned tickets

### Manager Dashboard
- [ ] Shows project overview
- [ ] Shows ticket distribution by status
- [ ] Shows ticket distribution by priority
- [ ] Shows time logged per project
- [ ] Shows team workload
- [ ] Shows recent project activity

### Admin Dashboard
- [ ] Shows total user count
- [ ] Shows active/inactive user counts
- [ ] Shows total projects count
- [ ] Shows total tickets count
- [ ] Shows system metrics
- [ ] Recent system activity

## UI/UX

### Navigation
- [ ] Navigation menu visible on all pages
- [ ] Role-based menu items shown correctly
- [ ] Breadcrumb navigation works
- [ ] Back buttons function correctly

### Responsive Design
- [ ] Application works on desktop (1920x1080)
- [ ] Application works on laptop (1366x768)
- [ ] Application works on tablet (768x1024)
- [ ] Mobile view is functional (if implemented)
- [ ] No horizontal scroll on small screens

### Forms & Validation
- [ ] Required fields marked with asterisk
- [ ] Validation errors shown clearly
- [ ] Form data persists on validation error
- [ ] Success messages displayed after actions
- [ ] Loading states shown during submissions

### Accessibility
- [ ] Color contrast meets WCAG standards
- [ ] Form labels associated with inputs
- [ ] Keyboard navigation works
- [ ] Focus states visible

## Error Handling

### API Errors
- [ ] 401 Unauthorized shows login prompt
- [ ] 403 Forbidden shows permission error
- [ ] 404 Not Found shows appropriate message
- [ ] 500 Server Error shows error page
- [ ] Network errors handled gracefully

### Form Errors
- [ ] Invalid credentials show error message
- [ ] Duplicate data shows validation error
- [ ] Missing required fields highlighted
- [ ] Invalid data formats rejected

### Edge Cases
- [ ] Empty states handled gracefully (no projects, no tickets)
- [ ] Long text handled with truncation or wrapping
- [ ] Special characters handled in all fields
- [ ] Large data sets handled with pagination

## Security

### Authentication
- [ ] JWT tokens expire correctly
- [ ] Refresh token works to get new access token
- [ ] Protected routes require authentication
- [ ] Token invalid after logout

### Authorization
- [ ] Users cannot access other users' private data
- [ ] Role-based access control enforced
- [ ] Admin-only endpoints protected
- [ ] Manager-only endpoints protected

### Data Protection
- [ ] Passwords hashed in database
- [ ] Sensitive data not exposed in API responses
- [ ] SQL injection attempts blocked
- [ ] XSS attempts blocked/sanitized

## Performance

### Load Testing
- [ ] Page loads within 3 seconds
- [ ] API responses within 500ms
- [ ] Dashboard loads within 5 seconds
- [ ] Search results return within 2 seconds

### Concurrent Users
- [ ] System handles 50 concurrent users
- [ ] System handles 100 concurrent users
- [ ] No data corruption with concurrent updates
- [ ] Database connections managed properly

## Deployment Verification

### Backend
- [ ] API endpoints accessible
- [ ] Database migrations applied
- [ ] Static files served correctly
- [ ] Environment variables configured
- [ ] Error logging configured

### Frontend
- [ ] Application builds without errors
- [ ] API URL configured correctly
- [ ] Static assets load correctly
- [ ] Routes work correctly

### Database
- [ ] Connection established
- [ ] All tables created
- [ ] Seed data inserted (if applicable)
- [ ] Indexes created for performance

### Infrastructure
- [ ] Docker containers running
- [ ] Load balancer configured (if applicable)
- [ ] SSL certificate installed
- [ ] Domain DNS configured

## Sign-off

### Tested By
- Name: _______________
- Role: _______________
- Date: _______________

### Issues Found
1. 
2. 
3. 

### Approved By
- Name: _______________
- Signature: _______________
- Date: _______________

---

## Test Data Reference

### Admin User
- Username: admin
- Password: admin123
- Email: admin@tickethub.com

### Manager User
- Username: manager
- Password: managerpass123
- Email: manager@tickethub.com

### Employee User
- Username: employee
- Password: employeepass123
- Email: employee@tickethub.com