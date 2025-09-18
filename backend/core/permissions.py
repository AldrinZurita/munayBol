from rest_framework import permissions

class IsSuperAdmin(permissions.BasePermission):
    """
    Permite acceso sólo a usuarios superadmin y activos.
    """
    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(user and getattr(user, "rol", None) == "superadmin" and getattr(user, "estado", False))