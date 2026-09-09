"""
Catana Permissions System
Sistema de permissões em dois níveis: Organização e Sede

Regras:
1. Admin da Organização: pode tudo dentro da organização
2. Editor da Sede: pode criar/editar recursos dentro da sede
3. Viewer: apenas leitura
"""
from rest_framework import permissions


class IsOrganizationAdmin(permissions.BasePermission):
    """
    Permissão para admins da organização.
    Permite criar sedes, gerenciar membros e configurações globais.
    """
    message = "Apenas administradores da organização podem realizar esta ação."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        # Superuser sempre pode
        if request.user.is_superuser:
            return True

        # Verifica se é admin
        return request.user.role == 'admin'

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superuser:
            return True

        # Verifica se é owner da organização
        if hasattr(obj, 'organization'):
            return obj.organization.owner == request.user
        elif hasattr(obj, 'owner'):
            return obj.owner == request.user

        return False


class IsSedeEditor(permissions.BasePermission):
    """
    Permissão para editores de uma sede.
    Permite criar/editar catálogos, produtos e componentes.
    """
    message = "Você precisa ser editor desta sede para realizar esta ação."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superuser:
            return True

        # Admin e Editor podem
        return request.user.role in ['admin', 'editor']

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superuser:
            return True

        # Verifica se o usuário tem acesso à sede
        if hasattr(obj, 'sede') and obj.sede:
            return request.user.sedes.filter(id=obj.sede.id).exists()

        # Se não tem sede específica, verifica a organização
        if hasattr(obj, 'organization') and obj.organization:
            return request.user.organizations.filter(id=obj.organization.id).exists()

        return False


class CanCreateSede(permissions.BasePermission):
    """
    ✅ REGRA DE OURO: Apenas admins da organização podem criar sedes.
    """
    message = "Apenas administradores da organização podem criar novas sedes."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superuser:
            return True

        # Apenas Admin pode criar sedes
        if request.method == 'POST':
            return request.user.role == 'admin'

        # Para outras operações (GET, etc), permite
        return True

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superuser:
            return True

        # Para DELETE e PUT/PATCH, verifica se é owner da organização
        if request.method in ['DELETE', 'PUT', 'PATCH']:
            return obj.organization.owner == request.user or request.user.role == 'admin'

        return True


class IsSedeMember(permissions.BasePermission):
    """
    Verifica se o usuário é membro da sede.
    Usado para controle de acesso a recursos da sede.
    """
    message = "Você não tem acesso a esta sede."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        return True

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.is_superuser:
            return True

        # Verifica se é membro da sede
        if hasattr(obj, 'sede') and obj.sede:
            return request.user.sedes.filter(id=obj.sede.id).exists()

        return False


class CanViewResource(permissions.BasePermission):
    """
    Permissão de leitura que considera:
    1. Recursos públicos (is_public=True)
    2. Recursos da organização do usuário
    3. Recursos compartilhados entre sedes (via SedeSharing)
    """

    def has_permission(self, request, view):
        # Permite leitura para autenticados
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated

        # Para escrita, exige editor ou admin
        return request.user and request.user.is_authenticated and request.user.role in ['admin', 'editor']

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            # Se é público, permite
            if hasattr(obj, 'is_public') and obj.is_public:
                return True
            return False

        if request.user.is_superuser:
            return True

        # Verifica se pertence à organização do usuário
        if hasattr(obj, 'organization') and obj.organization:
            if request.user.organizations.filter(id=obj.organization.id).exists():
                return True

        # Verifica se é da sede do usuário
        if hasattr(obj, 'sede') and obj.sede:
            if request.user.sedes.filter(id=obj.sede.id).exists():
                return True

            # Verifica compartilhamento entre sedes
            from .models import SedeSharing
            user_sedes = request.user.sedes.all()

            # Verifica se alguma sede do usuário tem compartilhamento com a sede do recurso
            shared = SedeSharing.objects.filter(
                target_sede__in=user_sedes,
                source_sede=obj.sede
            ).exists()

            if shared:
                return True

        return False
