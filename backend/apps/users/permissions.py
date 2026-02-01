from rest_framework import permissions


class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'admin'


class IsManagerOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ['manager', 'admin']


class IsEmployeeOrAbove(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ['employee', 'manager', 'admin']


class IsProjectMember(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.role == 'admin':
            return True
        
        if hasattr(obj, 'project'):
            return obj.project.members.filter(id=user.id).exists()
        
        return False


class IsProjectManager(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.role == 'admin':
            return True
        if user.role != 'manager':
            return False
        
        if hasattr(obj, 'project'):
            return obj.project.created_by == user
        if hasattr(obj, 'created_by'):
            return obj.created_by == user
        
        return False
