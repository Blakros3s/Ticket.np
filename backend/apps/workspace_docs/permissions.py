from rest_framework import permissions

from apps.core.access import user_can_access_project


class WorkspaceDocPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.role == 'admin':
            return True

        if view.action == 'retrieve':
            if obj.created_by_id == user.id:
                return True
            if obj.project_id:
                return user_can_access_project(user, obj.project)
            return user.role == 'manager'

        if view.action in ('destroy',) and obj.created_by_id != user.id:
            return False

        if view.action in ('update', 'partial_update'):
            if obj.created_by_id == user.id:
                return True
            if user.role == 'manager' and obj.project_id:
                return user_can_access_project(user, obj.project)
            return False

        if obj.project_id:
            return user_can_access_project(user, obj.project)

        return obj.created_by_id == user.id or user.role == 'manager'


class CanCreateShareLink(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ('admin', 'manager')

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.role == 'admin':
            return True
        if obj.created_by_id == user.id:
            return True
        return user.role == 'manager' and obj.project_id and user_can_access_project(user, obj.project)
