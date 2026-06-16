"""Shared authorization helpers for project and ticket access."""

from django.db.models import Q

from apps.projects.models import Project
from apps.tickets.models import Ticket


def user_can_access_project(user, project: Project) -> bool:
    if user.role == 'admin':
        return True
    if project.created_by_id == user.id:
        return True
    return project.members.filter(pk=user.pk).exists()


def user_can_create_ticket_on_project(user, project: Project) -> bool:
    if user.role == 'admin':
        return True
    if user.role == 'manager':
        return (
            project.created_by_id == user.id
            or project.members.filter(pk=user.pk).exists()
        )
    return project.members.filter(pk=user.pk).exists()


def user_can_access_ticket(user, ticket: Ticket) -> bool:
    if user.role == 'admin':
        return True
    if user.role == 'manager':
        return (
            ticket.project.created_by_id == user.id
            or ticket.project.members.filter(pk=user.pk).exists()
            or ticket.assignees.filter(pk=user.pk).exists()
            or ticket.created_by_id == user.id
        )
    return (
        ticket.assignees.filter(pk=user.pk).exists()
        or ticket.project.members.filter(pk=user.pk).exists()
        or ticket.created_by_id == user.id
    )


def get_accessible_project(user, project_id: int) -> Project:
    from rest_framework.exceptions import NotFound, PermissionDenied

    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist as exc:
        raise NotFound('Project not found.') from exc

    if not user_can_access_project(user, project):
        raise PermissionDenied('You do not have access to this project.')

    return project


def get_accessible_ticket(user, ticket_id: int) -> Ticket:
    from rest_framework.exceptions import NotFound, PermissionDenied

    try:
        ticket = Ticket.objects.select_related('project').get(pk=ticket_id)
    except Ticket.DoesNotExist as exc:
        raise NotFound('Ticket not found.') from exc

    if not user_can_access_ticket(user, ticket):
        raise PermissionDenied('You do not have access to this ticket.')

    return ticket


def accessible_ticket_ids_for_user(user):
    if user.role == 'admin':
        return Ticket.objects.values_list('pk', flat=True)

    if user.role == 'manager':
        return Ticket.objects.filter(
            Q(project__created_by=user)
            | Q(project__members=user)
            | Q(assignees=user)
            | Q(created_by=user)
        ).distinct().values_list('pk', flat=True)

    return Ticket.objects.filter(
        Q(assignees=user)
        | Q(project__members=user)
        | Q(created_by=user)
    ).distinct().values_list('pk', flat=True)
