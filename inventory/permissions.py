from rest_framework.permissions import BasePermission, SAFE_METHODS


def is_operational_admin(user):
    return bool(
        user and user.is_authenticated and user.is_superuser
    )


def user_capabilities(user):
    if not user or not user.is_authenticated:
        return set()
    if user.is_superuser:
        return set(user.ALL_ASSIGNABLE_PERMISSIONS)
    return set(user.get_effective_permissions())


def has_capability(user, capability):
    if user and user.is_authenticated and user.is_superuser:
        return True
    return capability in user_capabilities(user)


class IsAdmin(BasePermission):
    message = "You do not have permission. Admin role required."

    def has_permission(self, request, view):
        return is_operational_admin(request.user)


class IsSuperUser(BasePermission):
    message = "Only superuser can perform this action."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class CapabilityOrAdmin(BasePermission):
    message = "You do not have permission to perform this action."
    read_capability = None
    write_capability = None

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if is_operational_admin(user):
            return True
        if request.method in SAFE_METHODS:
            return bool(self.read_capability and has_capability(user, self.read_capability))
        return bool(self.write_capability and has_capability(user, self.write_capability))
