from rest_framework import permissions

class IsSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(user and getattr(user, "rol", None) == "superadmin" and getattr(user, "estado", False))

class IsUsuario(permissions.BasePermission):
    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(user and getattr(user, "rol", None) == "usuario" and getattr(user, "estado", False))