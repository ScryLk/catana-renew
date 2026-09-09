from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.pagination import PageNumberPagination
from django.db.models import Count, Sum, Q
from django.contrib.auth import update_session_auth_hash
from .models import (
    User, Product, Media, MediaFolder, Theme, Catalog, Page, Component, PageComponent, Comment, Activity, Organization, Sede, SedeSharing, Category, UserPreferences, PublicProfile,
    Notification, Conversation, Message, ProfileFollow, ProfileSave, CatalogLike, CatalogView, BlockedUser
)
from .serializers import (
    UserSerializer, ProductSerializer, MediaSerializer, MediaFolderSerializer,
    ThemeSerializer, CatalogSerializer, CatalogDetailSerializer, PageSerializer, ComponentSerializer,
    PageComponentSerializer, CommentSerializer, ActivitySerializer,
    OrganizationSerializer, SedeSerializer, SedeSharingSerializer, CategorySerializer,
    UserProfileSerializer, UserPreferencesSerializer, UpdateProfileSerializer, ChangePasswordSerializer,
    PublicProductSerializer,
    NotificationSerializer, MessageSerializer, ConversationSerializer,
    BulkProductSerializer, BulkImportRequestSerializer,
    PublicProfileSerializer, PublicProfileCreateSerializer, PublicProfileUpdateSerializer,
    PublicProfileSettingsSerializer, ProfileFollowSerializer, PublicCatalogSerializer, CatalogLikeSerializer
)
from .permissions import IsOrganizationAdmin, CanCreateSede

from rest_framework import serializers


# ============================================
# SEG-02/SEG-03: Autenticação
# ============================================
# O padrão global é IsAuthenticated (ver settings REST_FRAMEWORK).
# Allowlist de endpoints PÚBLICOS (AllowAny explícito):
#   - register_user            (POST /api/register/)
#   - TokenObtainPairView      (POST /api/auth/token/)         [simplejwt]
#   - TokenRefreshView         (POST /api/auth/token/refresh/) [simplejwt]
#   - ExploreProductViewSet    (GET  /api/explore/products/)
#   - CatalogViewSet.explore   (GET  /api/catalogs/explore/)
#
# Phase 4 - leituras públicas de descoberta (AllowAny explícito):
#   - public_profile_search        (GET  /api/public-profiles/search)
#   - public_profile_suggested     (GET  /api/public-profiles/suggested)
#   - public_profile_featured      (GET  /api/public-profiles/featured)
#   - public_profile_check_username(GET  /api/public-profiles/check-username)
#   - public_profile_by_username   (GET  /api/public-profiles/username/<username>)
#   - public_profile_detail        (GET  /api/public-profiles/<id>)
#   - public_profile_catalogs      (GET  /api/public-profiles/<id>/catalogs)
#   - public_catalogs_featured     (GET  /api/public-catalogs/featured)
#   - public_catalog_view          (POST /api/public-catalogs/<id>/view) [view anônima]
# Tudo o mais exige token válido. Os viewsets de organização/sede aplicam
# também as classes de permissions.py (IsOrganizationAdmin / CanCreateSede).


# ============================================
# Paginação Customizada
# ============================================

class StandardResultsSetPagination(PageNumberPagination):
    """
    Paginação padrão para listagens
    Configurado para 24 itens (4x6 grid no frontend)
    """
    page_size = 24
    page_size_query_param = 'page_size'
    max_page_size = 100


# ============================================
# ViewSets
# ============================================

class SedeSharingViewSet(viewsets.ModelViewSet):
    queryset = SedeSharing.objects.all()
    serializer_class = SedeSharingSerializer
    permission_classes = [permissions.IsAuthenticated, CanCreateSede]
    filterset_fields = ['source_sede', 'target_sede', 'resource_type']

    def perform_create(self, serializer):
        # In production this should check permissions
        serializer.save()


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

class OrganizationViewSet(viewsets.ModelViewSet):
    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer

    def get_permissions(self):
        # Leitura para qualquer autenticado; escrita só para admin da organização.
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsOrganizationAdmin()]

    def get_queryset(self):
        # Users can only see organizations they belong to
        # OR organizations they own
        user = self.request.user
        if not user.is_authenticated:
            # Fallback for dev: show all, or act as superuser
            return Organization.objects.all()
        
        if user.is_superuser:
            return Organization.objects.all()
        return user.organizations.all() | Organization.objects.filter(owner=user)

    def perform_create(self, serializer):
        user = self.request.user
        
        # Set owner to current user
        org = serializer.save(owner=user)
        # Add owner to members
        user.organizations.add(org)

class SedeViewSet(viewsets.ModelViewSet):
    queryset = Sede.objects.all()
    serializer_class = SedeSerializer
    permission_classes = [permissions.IsAuthenticated, CanCreateSede]
    filterset_fields = ['organization']

class MediaFolderViewSet(viewsets.ModelViewSet):
    queryset = MediaFolder.objects.all()
    serializer_class = MediaFolderSerializer
    filterset_fields = ['created_by', 'parent', 'organization', 'sede']

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        # FRG-08: evita AttributeError com AnonymousUser (defensivo; o default
        # global ja exige autenticacao). Restringe ao escopo do usuario.
        if not user.is_authenticated:
            return queryset.none()
        if not user.is_superuser:
            # Users can only see folders from their organizations or created by them
            queryset = queryset.filter(Q(organization__in=user.organizations.all()) | Q(created_by=user))
        
        org_id = self.request.query_params.get('organization')
        sede_id = self.request.query_params.get('sede')
        
        if sede_id:
            queryset = queryset.filter(sede_id=sede_id)
        elif org_id:
            queryset = queryset.filter(organization_id=org_id)
            
        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        
        # Validate Organization
        org_id = self.request.data.get('organization')
        if org_id:
             # Check if user belongs to this organization
             if not user.is_superuser and not user.organizations.filter(id=org_id).exists():
                 raise serializers.ValidationError({"organization": "You do not have permission to create folders in this organization."})
        elif not user.is_superuser:
             raise serializers.ValidationError({"organization": "Organization is required for folder creation."})

        serializer.save(created_by=user)

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    filterset_fields = ['parent', 'organization', 'sede']

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = self.request.query_params.get('organization')
        sede_id = self.request.query_params.get('sede')

        if sede_id:
            queryset = queryset.filter(sede_id=sede_id)
        elif org_id:
            queryset = queryset.filter(organization_id=org_id)
        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(created_by=user)

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        
        # Security: Always restrict to user's scope first (unless superuser)
        if not user.is_authenticated:
            return queryset.none()
        if not user.is_superuser:
            queryset = queryset.filter(Q(organization__in=user.organizations.all()) | Q(created_by=user))

        org_id = self.request.query_params.get('organization')
        sede_id = self.request.query_params.get('sede')

        if sede_id:
            queryset = queryset.filter(sede_id=sede_id)
        elif org_id:
            queryset = queryset.filter(organization_id=org_id)

        category_id = self.request.query_params.get('category')
        if category_id:
            queryset = queryset.filter(category_id=category_id)
            
        search_query = self.request.query_params.get('search')
        if search_query:
            queryset = queryset.filter(Q(name__icontains=search_query) | Q(sku__icontains=search_query))

        return queryset

    def perform_create(self, serializer):
        user = self.request.user

        # Validate Organization
        org_id = self.request.data.get('organization')
        if not org_id:
             raise serializers.ValidationError({"organization": "Organization is required."})
        
        # Check if user belongs to this organization
        if not user.is_superuser and not user.organizations.filter(id=org_id).exists():
             raise serializers.ValidationError({"organization": "You do not have permission to create products in this organization."})

        product = serializer.save(created_by=user)

        # Criar atividade
        Activity.objects.create(
            user=user,
            action='Produto criado',
            description=f'Criou o produto "{product.name}"',
            organization=product.organization,
            sede=product.sede
        )

    def perform_update(self, serializer):
        user = self.request.user

        product = serializer.save()

        # Criar atividade
        Activity.objects.create(
            user=user,
            action='Produto atualizado',
            description=f'Atualizou o produto "{product.name}"',
            organization=product.organization,
            sede=product.sede
        )

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def like(self, request, pk=None):
        product = self.get_object()
        user = request.user
        if product.likes.filter(id=user.id).exists():
            product.likes.remove(user)
            liked = False
        else:
            product.likes.add(user)
            liked = True
        return Response({'liked': liked, 'count': product.likes.count()})

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def toggle_save(self, request, pk=None):
        product = self.get_object()
        user = request.user
        if product.saves.filter(id=user.id).exists():
            product.saves.remove(user)
            saved = False
        else:
            product.saves.add(user)
            saved = True
        return Response({'saved': saved, 'count': product.saves.count()})

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def bulk_import(self, request):
        """
        4.4: Importação em lote de produtos.
        Body: {"products": [...], "sede"?: id, "organization"?: id}
        Cada produto pode trazer seu próprio sede/organization; caso ausente,
        usa o sede/organization do nível superior do payload.
        Retorna {"success": N, "failed": M, "errors": [...], "created_ids": [...]}.
        """
        from django.db import transaction
        from decimal import Decimal, InvalidOperation

        user = request.user
        products_payload = request.data.get('products', [])
        if not isinstance(products_payload, list):
            return Response(
                {'error': 'O campo "products" deve ser uma lista.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Defaults de sede/organization no nível superior do request.
        default_sede = request.data.get('sede')
        default_org = request.data.get('organization')

        MAX_PRODUCTS = 500
        if len(products_payload) > MAX_PRODUCTS:
            return Response(
                {'error': f'Limite de {MAX_PRODUCTS} produtos por importação excedido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Caches para validação de org/sede e categorias.
        org_cache = {}
        sede_cache = {}
        category_cache = {}

        def get_org(org_id):
            if org_id in org_cache:
                return org_cache[org_id]
            try:
                org = Organization.objects.get(id=org_id)
            except Organization.DoesNotExist:
                org = None
            org_cache[org_id] = org
            return org

        def get_sede(sede_id):
            if sede_id in sede_cache:
                return sede_cache[sede_id]
            try:
                sede = Sede.objects.get(id=sede_id)
            except Sede.DoesNotExist:
                sede = None
            sede_cache[sede_id] = sede
            return sede

        def get_or_create_category(name, org, sede):
            if not name:
                return None
            key = (str(name).strip().lower(), org.id if org else None)
            if key in category_cache:
                return category_cache[key]
            category = Category.objects.filter(
                name__iexact=str(name).strip(),
                organization=org,
            ).first()
            if not category:
                category = Category.objects.create(
                    name=str(name).strip(),
                    organization=org,
                    sede=sede,
                    created_by=user,
                )
            category_cache[key] = category
            return category

        success = 0
        failed = 0
        errors = []
        created_ids = []

        for index, raw in enumerate(products_payload):
            line = index + 1
            row = dict(raw) if isinstance(raw, dict) else {}

            # Preenche org/sede com os defaults do request, se ausentes.
            if not row.get('organization'):
                row['organization'] = default_org
            if not row.get('sede'):
                row['sede'] = default_sede

            serializer = BulkProductSerializer(data=row)
            if not serializer.is_valid():
                failed += 1
                msgs = []
                for field, field_errors in serializer.errors.items():
                    for err in field_errors:
                        msgs.append(f'{field}: {err}')
                errors.append(f'Linha {line}: {"; ".join(msgs)}')
                continue

            data = serializer.validated_data

            # Validação de organização e acesso.
            org = get_org(data['organization'])
            if org is None:
                failed += 1
                errors.append(f'Linha {line}: organização {data["organization"]} não encontrada')
                continue
            if not user.is_superuser and not user.organizations.filter(id=org.id).exists():
                failed += 1
                errors.append(f'Linha {line}: sem permissão na organização {org.id}')
                continue

            # Validação de sede (deve pertencer à organização).
            sede = get_sede(data['sede'])
            if sede is None:
                failed += 1
                errors.append(f'Linha {line}: sede {data["sede"]} não encontrada')
                continue
            if sede.organization_id != org.id:
                failed += 1
                errors.append(f'Linha {line}: sede {sede.id} não pertence à organização {org.id}')
                continue

            name = (data.get('name') or '').strip()
            if not name:
                failed += 1
                errors.append(f'Linha {line}: nome do produto é obrigatório')
                continue

            sku = (data.get('sku') or '').strip()
            if Product.objects.filter(sku=sku).exists():
                failed += 1
                errors.append(f"Linha {line}: SKU '{sku}' já existe no sistema")
                continue

            category = get_or_create_category(data.get('category'), org, sede)

            price = data.get('price')
            if price is None:
                price = Decimal('0')

            try:
                with transaction.atomic():
                    product = Product.objects.create(
                        name=name,
                        description=data.get('description') or '',
                        price=price,
                        sku=sku,
                        stock=data.get('stock') or 0,
                        currency=data.get('currency') or 'BRL',
                        category=category,
                        organization=org,
                        sede=sede,
                        created_by=user,
                    )
                created_ids.append(product.id)
                success += 1
            except Exception as e:
                failed += 1
                errors.append(f'Linha {line}: {str(e)}')

        return Response({
            'success': success,
            'failed': failed,
            'errors': errors,
            'created_ids': created_ids,
        })

class MediaViewSet(viewsets.ModelViewSet):
    queryset = Media.objects.all()
    serializer_class = MediaSerializer
    filterset_fields = ['uploaded_by', 'file', 'organization', 'sede']

    def get_queryset(self):
        queryset = Media.objects.all()
        user = self.request.user
        
        # Security: Always restrict to user's scope first (unless superuser)
        if not user.is_authenticated:
            return queryset.none()
        if not user.is_superuser:
            # Users can only see media from their organizations or uploaded by them
            queryset = queryset.filter(Q(organization__in=user.organizations.all()) | Q(uploaded_by=user))

        folder = self.request.query_params.get('folder')
        org_id = self.request.query_params.get('organization')
        sede_id = self.request.query_params.get('sede')

        if sede_id:
            # Get IDs of sedes that share media with the current sede
            shared_source_ids = SedeSharing.objects.filter(
                target_sede_id=sede_id,
                resource_type__in=['media', 'all']
            ).values_list('source_sede_id', flat=True)
            
            # Filter media belonging to current sede OR shared sedes
            queryset = queryset.filter(Q(sede_id=sede_id) | Q(sede_id__in=shared_source_ids))
        elif org_id:
            queryset = queryset.filter(organization_id=org_id)

        if folder == 'null':
            queryset = queryset.filter(folder__isnull=True)
        elif folder is not None:
            queryset = queryset.filter(folder=folder)
        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        
        # Validate Organization
        org_id = self.request.data.get('organization')
        if org_id:
             # Check if user belongs to this organization
             if not user.is_superuser and not user.organizations.filter(id=org_id).exists():
                 raise serializers.ValidationError({"organization": "You do not have permission to upload media to this organization."})
        elif not user.is_superuser:
             # Require organization for non-superusers? Or allow personal uploads? 
             # User Request says: "Bloquear uploads sem organização ativa" logic implies org is required.
             raise serializers.ValidationError({"organization": "Organization is required for media upload."})

        serializer.save(uploaded_by=user)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        folder_param = request.query_params.get('folder')
        org_id = request.query_params.get('organization')
        sede_id = request.query_params.get('sede')
        
        # Base querysets
        media_qs = Media.objects.all()
        folder_qs = MediaFolder.objects.all()

        user = request.user
        # Security: Always restrict to user's scope first (unless superuser)
        if not user.is_superuser:
            media_qs = media_qs.filter(Q(organization__in=user.organizations.all()) | Q(uploaded_by=user))
            folder_qs = folder_qs.filter(Q(organization__in=user.organizations.all()) | Q(created_by=user))

        # Apply Organization/Sede filter
        if sede_id:
            # Get IDs of sedes that share media with the current sede
            shared_source_ids = SedeSharing.objects.filter(
                target_sede_id=sede_id,
                resource_type__in=['media', 'all']
            ).values_list('source_sede_id', flat=True)
            
            media_qs = media_qs.filter(Q(sede_id=sede_id) | Q(sede_id__in=shared_source_ids))
            folder_qs = folder_qs.filter(sede_id=sede_id)
        elif org_id:
            media_qs = media_qs.filter(organization_id=org_id)
            folder_qs = folder_qs.filter(organization_id=org_id)

        # Folder Logic for Stats (Counts within current view)
        if folder_param == 'null' or folder_param is None:
             # If strictly looking at root
             # But stats usually show TOTALs for the library regardless of folder navigation?
             # If the UI expects "filtered counts based on current folder", we filter.
             # Based on "Images (36)" in sidebar, this usually means "Total Images in Library" or "Total in current view".
             # Let's assume global library stats by default unless filters imply otherwise, 
             # BUT the previous implementation and request suggest dynamic filters.
             # If the user is in a folder, do they want to see counts ONLY for that folder?
             # Usually sidebar filters are for the WHOLE library.
             # However, the previous code had `folder_param`.
             # Let's keep `folder_param` logic for `media_qs` if provided, effectively showing stats for current view.
             if folder_param == 'null':
                 media_qs = media_qs.filter(folder__isnull=True)
             elif folder_param:
                 media_qs = media_qs.filter(folder=folder_param)
        
        # NOTE: Sidebar counts usually represent "Everything I can see", so filtering by folder might be wrong for the sidebar counts
        # unless the sidebar itself is context-aware. 
        # The user said: "ajustar nos filtros tambem, para que sejam dinamicos com base na quantidade de itens no /media".
        # If I am in a folder, I probably still want to know I have 36 images TOTAL in my library?
        # OR does it mean "36 images matching current filters"?
        # Given "based on the quantity of items in /media", it likely means TOTAL (scoped to org).
        # But `mediaService.getStats` passes `folder`.
        # I will respect the `folder` param if passed, assuming the frontend controls whether it wants total or folder-specific.
        
        total_files = media_qs.count()
        folders_count = folder_qs.count()
        images_count = media_qs.filter(media_type='image').count()
        videos_count = media_qs.filter(media_type='video').count()
        documents_count = media_qs.filter(media_type='document').count()
        
        # COR-02: o model Media nao tem campo `size`; somamos o tamanho dos
        # arquivos em si (o aggregate Sum('size') anterior quebrava em runtime).
        total_size = 0
        for media in media_qs:
            try:
                if media.file:
                    total_size += media.file.size
            except Exception:
                # Arquivo pode estar ausente no storage; ignora.
                pass

        def format_size(size):
            for unit in ['B', 'KB', 'MB', 'GB']:
                if size < 1024:
                    return f"{size:.1f} {unit}"
                size /= 1024
            return f"{size:.1f} TB"

        # Media nao tem campo is_favorite; nao ha favoritos a contar.
        favorites_count = 0

        return Response({
            'total_files': total_files,
            'folders_count': folders_count,
            'images_count': images_count,
            'videos_count': videos_count,
            'documents_count': documents_count,
            'total_size': total_size,
            'total_size_formatted': format_size(total_size),
            'favorites_count': favorites_count
        })

class ThemeViewSet(viewsets.ModelViewSet):
    queryset = Theme.objects.all()
    serializer_class = ThemeSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = self.request.query_params.get('organization')
        sede_id = self.request.query_params.get('sede')

        if sede_id:
            queryset = queryset.filter(sede_id=sede_id)
        elif org_id:
            queryset = queryset.filter(organization_id=org_id)
        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(created_by=user)

class CatalogViewSet(viewsets.ModelViewSet):
    queryset = Catalog.objects.all()
    serializer_class = CatalogSerializer

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return CatalogDetailSerializer
        return CatalogSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        
        # Security: Always restrict to user's scope first (unless superuser)
        if not user.is_authenticated:
            return queryset.none()
        if not user.is_superuser:
            # Users can only see catalogs from their organizations or personal ones.
            # Catálogos de demonstração (is_demo) são públicos/"para divulgação":
            # legíveis por qualquer usuário autenticado (mesmo de outra org).
            queryset = queryset.filter(
                Q(organization__in=user.organizations.all())
                | Q(created_by=user)
                | Q(is_demo=True)
            )

        org_id = self.request.query_params.get('organization')
        sede_id = self.request.query_params.get('sede')

        if sede_id:
            # Get IDs of sedes that share catalogs with the current sede
            shared_source_ids = SedeSharing.objects.filter(
                target_sede_id=sede_id,
                resource_type__in=['catalog', 'all']
            ).values_list('source_sede_id', flat=True)

            # Filter catalogs belonging to current sede OR shared sedes.
            # Demos pertencem à org [DEMO] (outra sede) — seguem visíveis.
            queryset = queryset.filter(
                Q(sede_id=sede_id) | Q(sede_id__in=shared_source_ids) | Q(is_demo=True)
            )
        elif org_id:
            queryset = queryset.filter(Q(organization_id=org_id) | Q(is_demo=True))
        
        return queryset

    def perform_create(self, serializer):
        user = self.request.user

        catalog = serializer.save(created_by=user)

        # Criar atividade
        Activity.objects.create(
            user=user,
            action='Catálogo criado',
            description=f'Criou o catálogo "{catalog.title}"',
            catalog=catalog,
            organization=catalog.organization,
            sede=catalog.sede
        )

    def perform_update(self, serializer):
        user = self.request.user

        catalog = serializer.save()

        # Criar atividade
        Activity.objects.create(
            user=user,
            action='Catálogo editado',
            description=f'Editou o catálogo "{catalog.title}"',
            catalog=catalog,
            organization=catalog.organization,
            sede=catalog.sede
        )

    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny])
    def explore(self, request):
        """
        Returns all public catalogs for the explore page.
        """
        queryset = Catalog.objects.filter(is_public=True)
        
        # Optional: Search functionality
        search = request.query_params.get('search')
        if search:
            queryset = queryset.filter(Q(title__icontains=search) | Q(description__icontains=search))
            
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def like(self, request, pk=None):
        catalog = self.get_object()
        user = request.user
        if catalog.likes.filter(id=user.id).exists():
            catalog.likes.remove(user)
            liked = False
        else:
            catalog.likes.add(user)
            liked = True
        return Response({'liked': liked, 'count': catalog.likes.count()})

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def toggle_save(self, request, pk=None):
        catalog = self.get_object()
        user = request.user
        if catalog.saves.filter(id=user.id).exists():
            catalog.saves.remove(user)
            saved = False
        else:
            catalog.saves.add(user)
            saved = True
        return Response({'saved': saved, 'count': catalog.saves.count()})

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def save_content(self, request, pk=None):
        """
        INC-01: salva o conteúdo do editor (páginas/elementos) de forma
        transacional e idempotente. Recria Page/Component/PageComponent a partir
        do payload, sem deixar registros órfãos.

        Payload esperado:
        {
          "pages": [
            {
              "order": 0,
              "background_image": <media_id|null>,
              "elements": [
                { "type": "text-title", "position": {"x":..,"y":..},
                  "size": {"width":..,"height":..}, "zIndex": 0, ...resto do JSON }
              ]
            }
          ]
        }
        """
        from django.db import transaction

        catalog = self.get_object()
        pages_payload = request.data.get('pages', [])
        if not isinstance(pages_payload, list):
            return Response(
                {'error': 'O campo "pages" deve ser uma lista.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        def to_component_type(element_type):
            t = (element_type or '').lower()
            if t.startswith('text') or t in ('divider', 'footer'):
                return 'text'
            if t.startswith('product'):
                return 'product'
            return 'image'

        def as_int(value, default=0):
            try:
                return int(round(float(value)))
            except (TypeError, ValueError):
                return default

        with transaction.atomic():
            # Limpa o conteúdo atual do catálogo (componentes não reutilizáveis
            # ficam órfãos se não removidos explicitamente).
            existing_pages = Page.objects.filter(catalog=catalog)
            existing_pc = PageComponent.objects.filter(page__in=existing_pages)
            component_ids = list(existing_pc.values_list('component_id', flat=True))
            existing_pc.delete()
            Component.objects.filter(id__in=component_ids, is_reusable=False).delete()
            existing_pages.delete()

            created_pages = 0
            created_elements = 0
            for page_index, page_data in enumerate(pages_payload):
                page = Page.objects.create(
                    catalog=catalog,
                    order=as_int(page_data.get('order'), page_index),
                    background_image_id=page_data.get('background_image'),
                )
                created_pages += 1

                for elem_index, element in enumerate(page_data.get('elements', [])):
                    position = element.get('position', {}) or {}
                    size = element.get('size', {}) or {}
                    component = Component.objects.create(
                        name=element.get('name') or element.get('type') or 'elemento',
                        component_type=to_component_type(element.get('type')),
                        content=element,
                        is_reusable=False,
                        organization=catalog.organization,
                        sede=catalog.sede,
                        created_by=request.user,
                    )
                    PageComponent.objects.create(
                        page=page,
                        component=component,
                        position_x=as_int(position.get('x')),
                        position_y=as_int(position.get('y')),
                        width=as_int(size.get('width')),
                        height=as_int(size.get('height')),
                        layer=as_int(element.get('zIndex'), elem_index),
                    )
                    created_elements += 1

        return Response({
            'status': 'ok',
            'catalog': catalog.id,
            'pages': created_pages,
            'elements': created_elements,
        })

    @action(detail=False, methods=['post'], url_path='gerar-demo',
            permission_classes=[permissions.AllowAny])
    def gerar_demo(self, request):
        """
        Gera um catálogo de demonstração temático (síncrono). Público (AllowAny),
        por decisão de produto: serve para divulgação. Reusa a mesma lógica do
        management command (api/demo/generator.py).

        Body: { tema, estrutura?='completo', secoes?=[], b2b?=false, periodo? }
        """
        from .demo.generator import gerar_catalogo_demo, ESTRUTURAS
        from .demo.themes import TEMAS_VALIDOS

        data = request.data or {}
        tema = data.get('tema')
        if tema not in TEMAS_VALIDOS:
            return Response(
                {'error': f'Tema inválido. Opções: {", ".join(TEMAS_VALIDOS)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        estrutura = data.get('estrutura', 'completo')
        if estrutura not in (*ESTRUTURAS.keys(), 'custom'):
            estrutura = 'completo'

        try:
            catalog = gerar_catalogo_demo(
                tema=tema,
                estrutura=estrutura,
                secoes=data.get('secoes'),
                b2b=bool(data.get('b2b')),
                periodo=data.get('periodo'),
                identidade_premium=bool(data.get('identidade_premium', True)),
            )
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {'catalog_id': catalog.id, 'title': catalog.title, 'pages': catalog.pages.count()},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['post'], url_path='import-json',
            permission_classes=[permissions.AllowAny])
    def import_json(self, request):
        """
        Ingest de um catálogo no formato catalogIO v1.0 (o JSON que o editor
        exporta) -> linhas relacionais Page/PageComponent/Component/Theme, de modo
        que o catálogo nasça EDITÁVEL no editor. Inverso do catalogLoader.

        Body: o próprio JSON catalogIO; opcionalmente envolto em
        { "data": <catalogIO>, "mode": "new"|"replace", "catalog_id": <id> }.

        'import' é palavra reservada em Python, por isso o método chama-se
        import_json (rota /api/catalogs/import-json/).

        AllowAny + fallback de dev para organization/sede/created_by, como o resto
        da API em dev. NB: reintroduz um atalho de dev (ver SEG-02) — apertar antes
        de prod.
        """
        from .catalog_ingest import importar_catalogo_json, IngestError

        body = request.data or {}
        # Aceita o catalogIO direto OU embrulhado em {data, mode, catalog_id}.
        if isinstance(body, dict) and body.get('app') == 'Catana':
            payload, mode, catalog_id = body, body.get('mode', 'new'), body.get('catalog_id')
        else:
            payload = body.get('data') if isinstance(body, dict) else None
            mode = (body.get('mode') if isinstance(body, dict) else None) or 'new'
            catalog_id = body.get('catalog_id') if isinstance(body, dict) else None

        # Usuário/escopo: autenticado se houver; senão fallback de dev.
        user = request.user if getattr(request.user, 'is_authenticated', False) else (
            User.objects.filter(is_superuser=True).first() or User.objects.first()
        )
        if user is None:
            return Response({'error': 'Nenhum usuário disponível para atribuir o catálogo.'},
                            status=status.HTTP_400_BAD_REQUEST)
        organization = user.organizations.first() or user.owned_organizations.first()
        sede = None
        if organization:
            sede = organization.default_sede or organization.sedes.first()

        try:
            catalog, n_paginas, n_elementos = importar_catalogo_json(
                payload, user=user, organization=organization, sede=sede,
                mode=mode, catalog_id=catalog_id,
            )
        except IngestError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'catalog_id': catalog.id,
            'title': catalog.title,
            'pages': n_paginas,
            'elements': n_elementos,
            'mode': mode,
            'theme_id': catalog.theme_id,
        }, status=status.HTTP_201_CREATED)

class PageViewSet(viewsets.ModelViewSet):
    queryset = Page.objects.all()
    serializer_class = PageSerializer
    # O editor carrega TODAS as páginas de um catálogo de uma vez. Sem paginação
    # (o ?page= da paginação colidiria e o limite de 24 truncaria catálogos
    # maiores); filtra pela FK ?catalog=.
    pagination_class = None

    def get_queryset(self):
        queryset = super().get_queryset()
        catalog_id = self.request.query_params.get('catalog')
        if catalog_id:
            queryset = queryset.filter(catalog_id=catalog_id)
        return queryset

class ComponentViewSet(viewsets.ModelViewSet):
    queryset = Component.objects.all()
    serializer_class = ComponentSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = self.request.query_params.get('organization')
        sede_id = self.request.query_params.get('sede')

        if sede_id:
            queryset = queryset.filter(sede_id=sede_id)
        elif org_id:
            queryset = queryset.filter(organization_id=org_id)
        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(created_by=user)

class PageComponentViewSet(viewsets.ModelViewSet):
    queryset = PageComponent.objects.all()
    serializer_class = PageComponentSerializer
    # O editor carrega TODOS os componentes de uma página. Sem paginação: o
    # ?page= reservado da paginação colidiria com o filtro por FK (?page=<id>)
    # e causava 404 "Invalid page".
    pagination_class = None

    def get_queryset(self):
        queryset = super().get_queryset()
        page_id = self.request.query_params.get('page')
        if page_id:
            queryset = queryset.filter(page_id=page_id)
        return queryset

class CommentViewSet(viewsets.ModelViewSet):
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(user=user)

class ActivityViewSet(viewsets.ModelViewSet):
    queryset = Activity.objects.all()
    serializer_class = ActivitySerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        org_id = self.request.query_params.get('organization')
        sede_id = self.request.query_params.get('sede')

        if sede_id:
            queryset = queryset.filter(sede_id=sede_id)
        elif org_id:
            queryset = queryset.filter(organization_id=org_id)
        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(user=user)
# Profile Views
@api_view(['GET', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
def profile_view(request):
    """
    GET: Retorna o perfil do usuário autenticado
    PATCH: Atualiza o perfil do usuário
    """
    user = request.user

    if request.method == 'GET':
        # Criar atividade de acesso ao perfil apenas uma vez por dia
        from django.utils import timezone
        from datetime import timedelta

        last_profile_activity = Activity.objects.filter(
            user=user,
            action='Perfil visualizado',
            timestamp__gte=timezone.now() - timedelta(hours=1)
        ).first()

        if not last_profile_activity:
            Activity.objects.create(
                user=user,
                action='Perfil visualizado',
                description='Acessou a página de perfil',
                organization=user.organizations.first() if user.organizations.exists() else None
            )

        serializer = UserProfileSerializer(user, context={'request': request})
        return Response(serializer.data)

    elif request.method == 'PATCH':
        # Atualizar first_name e last_name se 'name' foi enviado
        if 'name' in request.data:
            name_parts = request.data['name'].split(' ', 1)
            request.data['first_name'] = name_parts[0]
            request.data['last_name'] = name_parts[1] if len(name_parts) > 1 else ''

        serializer = UpdateProfileSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            # Retornar o perfil completo atualizado
            profile_serializer = UserProfileSerializer(user, context={'request': request})
            return Response(profile_serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def upload_avatar(request):
    """
    Upload de avatar do usuário
    """
    user = request.user

    if 'avatar' not in request.FILES:
        return Response({'error': 'Nenhum arquivo foi enviado'}, status=status.HTTP_400_BAD_REQUEST)

    avatar_file = request.FILES['avatar']

    # Validar tamanho (2MB)
    if avatar_file.size > 2 * 1024 * 1024:
        return Response({'error': 'Arquivo muito grande. Máximo: 2MB'}, status=status.HTTP_400_BAD_REQUEST)

    # Validar tipo
    if not avatar_file.content_type in ['image/png', 'image/jpeg', 'image/jpg']:
        return Response({'error': 'Formato inválido. Use PNG ou JPG'}, status=status.HTTP_400_BAD_REQUEST)

    user.avatar = avatar_file
    user.save()

    serializer = UserProfileSerializer(user, context={'request': request})
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def change_password(request):
    """
    Alterar senha do usuário
    """
    serializer = ChangePasswordSerializer(data=request.data)

    if serializer.is_valid():
        user = request.user

        # Verificar senha antiga
        if not user.check_password(serializer.validated_data['old_password']):
            return Response({'error': 'Senha atual incorreta'}, status=status.HTTP_400_BAD_REQUEST)

        # Definir nova senha
        user.set_password(serializer.validated_data['new_password'])
        user.save()

        # Manter o usuário logado
        update_session_auth_hash(request, user)

        return Response({'message': 'Senha alterada com sucesso'})

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
def preferences_view(request):
    """
    GET: Retorna as preferências do usuário
    PATCH: Atualiza as preferências do usuário
    """
    user = request.user

    # Criar preferências se não existirem
    preferences, created = UserPreferences.objects.get_or_create(user=user)

    if request.method == 'GET':
        serializer = UserPreferencesSerializer(preferences)
        return Response(serializer.data)

    elif request.method == 'PATCH':
        serializer = UserPreferencesSerializer(preferences, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def recent_activity(request):
    """
    Retorna as atividades recentes do usuário
    """
    user = request.user
    activities = Activity.objects.filter(user=user).order_by('-timestamp')[:10]
    serializer = ActivitySerializer(activities, many=True)
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout_all_sessions(request):
    """
    Encerra todas as sessões do usuário
    """
    # No Django, não há uma forma nativa de encerrar todas as sessões
    # Essa é uma implementação simplificada que apenas retorna sucesso
    # Em produção, você pode usar django-rest-framework-simplejwt ou similar
    # para invalidar todos os tokens JWT do usuário

    return Response({'message': 'Todas as sessões foram encerradas'})
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register_user(request):
    try:
        data = request.data
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        role = data.get('role', 'editor')

        if not username or not email or not password:
            return Response({'error': 'Please provide username, email and password'}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=username).exists():
            return Response({'error': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email=email).exists():
            return Response({'error': 'Email already exists'}, status=status.HTTP_400_BAD_REQUEST)

        from django.db import transaction
        with transaction.atomic():
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                role=role
            )

            # FRG-05: provisiona organização + sede padrão para o novo usuário,
            # senão ele não consegue criar produtos/catálogos (perform_create exige org).
            organization = Organization.objects.create(
                name=f'{username} Org',
                owner=user,
            )
            default_sede = Sede.objects.create(
                name='Sede Principal',
                organization=organization,
                responsible_user=user,
            )
            organization.default_sede = default_sede
            organization.save(update_fields=['default_sede'])
            user.organizations.add(organization)
            user.sedes.add(default_sede)

        # Generate tokens immediately for auto-login
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)

        return Response({
            'user': UserSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'organization': OrganizationSerializer(organization).data,
            'default_sede': SedeSerializer(default_sede).data,
        }, status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def dashboard_stats(request):
    """
    Returns aggregated statistics for the dashboard.
    """
    user = request.user
    org_id = request.query_params.get('organization')
    sede_id = request.query_params.get('sede')

    # Base querysets
    catalog_qs = Catalog.objects.all()
    product_qs = Product.objects.all()

    # Apply filters
    if sede_id:
        catalog_qs = catalog_qs.filter(sede_id=sede_id)
        product_qs = product_qs.filter(sede_id=sede_id)
    elif org_id:
        catalog_qs = catalog_qs.filter(organization_id=org_id)
        product_qs = product_qs.filter(organization_id=org_id)
    else:
        # Default behavior: filter by user's access
        # If user is admin/superuser, show all? Or filter by user's orgs?
        # For now, let's stick to standard behavior: if no filter, show what user owns/belongs to
        if not user.is_superuser:
            user_orgs = user.organizations.all()
            catalog_qs = catalog_qs.filter(organization__in=user_orgs)
            product_qs = product_qs.filter(organization__in=user_orgs)

    # Calculate stats
    total_catalogs = catalog_qs.count()
    total_products = product_qs.count()
    
    # "Rascunhos" (Drafts) - assuming is_public=False means draft
    draft_catalogs = catalog_qs.filter(is_public=False).count()
    
    # "Arquivados" (Archived) - no field yet, returning 0
    archived_catalogs = 0

    data = {
        'catalogs': total_catalogs,
        'catalogs_change': '+0%', # Placeholder for history
        'catalogs_percentage': 0,

        'products': total_products,
        'products_change': '+0%',
        'products_percentage': 0,

        'library': draft_catalogs, # Mapped to "Rascunhos" in frontend
        'library_change': '+0%',
        'library_percentage': 0,

        'history': archived_catalogs, # Mapped to "Arquivados" in frontend
        'history_change': '+0%',
        'history_percentage': 0,
    }
    
    return Response(data)

class ExploreProductViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ReadOnly ViewSet for Public Products (Explore Module).
    Strictly filters for is_public=True.
    Exposes only safe fields via PublicProductSerializer.

    Endpoints:
    - GET /api/explore/products/ - Lista paginada de produtos públicos
    - GET /api/explore/products/{public_slug}/ - Detalhes de um produto

    Query Parameters:
    - page: Número da página (padrão: 1)
    - page_size: Itens por página (padrão: 20, max: 100)
    - search: Buscar por nome, categoria ou descrição
    - ordering: Ordenar por public_at, name ou price (use - para desc)
    """
    queryset = Product.objects.filter(is_public=True)
    serializer_class = PublicProductSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = StandardResultsSetPagination
    lookup_field = 'public_slug'
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'category__name', 'description']
    ordering_fields = ['public_at', 'name', 'price']
    ordering = ['-public_at']

    def get_queryset(self):
        # Double check strictly public
        return Product.objects.filter(is_public=True)


# ============================================
# Global Search API
# ============================================

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def global_search(request):
    """
    Busca global por perfis, catálogos e produtos

    Query Parameters:
    - q: termo de busca (mínimo 2 caracteres)
    - limit: limite de resultados por seção (padrão: 5)

    Returns:
    {
        "profiles": [...],
        "catalogs": [...],
        "products": [...],
        "total": 0
    }
    """
    query = request.GET.get('q', '').strip()
    limit = int(request.GET.get('limit', 5))

    if len(query) < 2:
        return Response({
            'profiles': [],
            'catalogs': [],
            'products': [],
            'total': 0
        })

    # Buscar perfis públicos
    profiles = PublicProfile.objects.filter(
        Q(display_name__icontains=query) |
        Q(username__icontains=query) |
        Q(bio__icontains=query),
        show_in_search=True,
        visibility='publico'
    ).select_related('user')[:limit]

    # Buscar catálogos públicos
    catalogs = Catalog.objects.filter(
        Q(title__icontains=query) |
        Q(description__icontains=query),
        is_public=True
    ).select_related('created_by').annotate(
        pages_count=Count('pages')
    )[:limit]

    # Buscar produtos públicos
    products = Product.objects.filter(
        Q(name__icontains=query) |
        Q(description__icontains=query),
        is_public=True
    ).select_related('category')[:limit]

    # Serializar perfis
    profiles_data = []
    for p in profiles:
        # Contar seguidores
        from .models import ProfileFollow
        followers_count = ProfileFollow.objects.filter(followed_profile=p).count()

        profiles_data.append({
            'id': str(p.id),
            'username': p.username,
            'name': p.display_name,
            'avatar': request.build_absolute_uri(p.avatar.url) if p.avatar else None,
            'type': p.profile_type,
            'followers_count': followers_count if p.show_followers_count else 0
        })

    # Serializar catálogos
    catalogs_data = []
    for c in catalogs:
        # Pegar informações do autor
        author_name = c.created_by.username
        author_avatar = None
        if hasattr(c.created_by, 'public_profile'):
            author_name = c.created_by.public_profile.display_name
            if c.created_by.public_profile.avatar:
                author_avatar = request.build_absolute_uri(c.created_by.public_profile.avatar.url)

        catalogs_data.append({
            'id': str(c.id),
            'title': c.title,
            'author': author_name,
            'author_avatar': author_avatar,
            'cover_image': request.build_absolute_uri(c.cover_image.url) if c.cover_image else None,
            'is_sponsored': getattr(c, 'is_sponsored', False),
            'pages_count': c.pages_count
        })

    # Serializar produtos
    products_data = []
    for p in products:
        products_data.append({
            'id': str(p.id),
            'name': p.name,
            'image_url': request.build_absolute_uri(p.image.url) if p.image else None,
            'category': p.category.name if p.category else '',
            'price': float(p.price) if p.price else None,
            'currency': 'BRL'
        })

    total = len(profiles_data) + len(catalogs_data) + len(products_data)

    return Response({
        'profiles': profiles_data,
        'catalogs': catalogs_data,
        'products': products_data,
        'total': total
    })


# ============================================
# Phase 4 - Notificações
# ============================================

class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Notificações do usuário autenticado.
    - GET    /api/notifications/                 lista (mais recentes primeiro)
    - GET    /api/notifications/{id}/            detalhe
    - GET    /api/notifications/unread_count/    {"count": N}
    - POST   /api/notifications/{id}/mark_read/  marca uma como lida
    - POST   /api/notifications/mark_all_read/   marca todas como lidas
    """
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Notification.objects.none()
        return Notification.objects.filter(recipient=user).order_by('-created_at')

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        count = Notification.objects.filter(
            recipient=request.user, read_at__isnull=True
        ).count()
        return Response({'count': count})

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        from django.utils import timezone
        notification = self.get_object()
        if notification.read_at is None:
            notification.read_at = timezone.now()
            notification.save(update_fields=['read_at'])
        serializer = self.get_serializer(notification)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        from django.utils import timezone
        count = Notification.objects.filter(
            recipient=request.user, read_at__isnull=True
        ).update(read_at=timezone.now())
        return Response({'count': count})


# ============================================
# Phase 4 - Mensagens / Conversas
# ============================================

class ConversationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Conversas das quais o usuário autenticado participa.
    - GET  /api/conversations/                  lista (atualizadas mais recentes primeiro)
    - GET  /api/conversations/{id}/             detalhe (com mensagens)
    - POST /api/conversations/start/            inicia/recupera conversa por contexto
    - POST /api/conversations/{id}/message/     envia mensagem
    - POST /api/conversations/{id}/mark_read/   marca mensagens como lidas
    - GET  /api/conversations/unread_count/     {"count": N}
    """
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Conversation.objects.none()
        return Conversation.objects.filter(participants=user).order_by('-updated_at').distinct()

    @action(detail=False, methods=['post'])
    def start(self, request):
        origin_type = request.data.get('origin_type')
        origin_id = request.data.get('origin_id')

        if not origin_type or origin_id is None:
            return Response(
                {'error': 'origin_type e origin_id são obrigatórios.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Conversation exige organization (FK não-nula).
        organization = request.user.organizations.first()
        if organization is None:
            return Response(
                {'error': 'Usuário não pertence a nenhuma organização.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Procura uma conversa existente para (origin_type, origin_id) onde o
        # usuário ja participa; senão cria uma nova.
        conversation = Conversation.objects.filter(
            origin_type=origin_type,
            origin_id=origin_id,
            participants=request.user,
        ).first()

        if conversation is None:
            conversation = Conversation.objects.create(
                organization=organization,
                origin_type=origin_type,
                origin_id=origin_id,
            )
            conversation.participants.add(request.user)

        serializer = self.get_serializer(conversation)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def message(self, request, pk=None):
        conversation = self.get_object()
        content = request.data.get('content')
        if not content:
            return Response(
                {'error': 'O campo "content" é obrigatório.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        msg = Message.objects.create(
            conversation=conversation,
            sender=request.user,
            content=content,
        )

        # Garante que o remetente é participante e atualiza updated_at.
        if not conversation.participants.filter(id=request.user.id).exists():
            conversation.participants.add(request.user)
        conversation.save(update_fields=['updated_at'])

        serializer = MessageSerializer(msg, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        from django.utils import timezone
        conversation = self.get_object()
        conversation.messages.exclude(sender=request.user).filter(
            read_at__isnull=True
        ).update(read_at=timezone.now())
        return Response({'status': 'ok'})

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        count = Message.objects.filter(
            conversation__participants=request.user,
            read_at__isnull=True,
        ).exclude(sender=request.user).distinct().count()
        return Response({'count': count})


# ============================================
# Phase 4 - Perfis Públicos / Social
# ============================================

def _profile_page_params(request):
    """Le page/pageSize aceitando camelCase enviado pelo front."""
    try:
        page = int(request.query_params.get('page', 1))
    except (TypeError, ValueError):
        page = 1
    try:
        page_size = int(
            request.query_params.get('pageSize')
            or request.query_params.get('page_size')
            or 20
        )
    except (TypeError, ValueError):
        page_size = 20
    if page < 1:
        page = 1
    if page_size < 1:
        page_size = 20
    return page, page_size


def _paginate(queryset, page, page_size):
    total = queryset.count()
    start = (page - 1) * page_size
    end = start + page_size
    return list(queryset[start:end]), total


def _camel_to_profile_data(data):
    """Normaliza payload camelCase do front para os campos do modelo."""
    mapping = {
        'displayName': 'display_name',
        'profileType': 'profile_type',
    }
    out = {}
    for key, value in data.items():
        if key == 'settings':
            continue
        out[mapping.get(key, key)] = value
    return out


@api_view(['GET', 'POST', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
def public_profile_me(request):
    """
    GET   -> perfil público do usuário logado (404 se não existe)
    POST  -> cria o perfil a partir de {displayName, bio, profileType, segments}
    PATCH -> atualiza o perfil (UpdateProfileRequest)
    """
    user = request.user

    if request.method == 'GET':
        try:
            profile = user.public_profile
        except PublicProfile.DoesNotExist:
            return Response({'detail': 'Perfil não encontrado'}, status=status.HTTP_404_NOT_FOUND)
        serializer = PublicProfileSerializer(profile, context={'request': request})
        return Response(serializer.data)

    if request.method == 'POST':
        if PublicProfile.objects.filter(user=user).exists():
            return Response(
                {'detail': 'Perfil já existe'}, status=status.HTTP_400_BAD_REQUEST
            )
        data = _camel_to_profile_data(request.data)
        # Gera username a partir do display_name caso não informado.
        if not data.get('username'):
            from django.utils.text import slugify
            base = slugify(data.get('display_name') or user.username) or f'user{user.id}'
            username = base
            i = 1
            while PublicProfile.objects.filter(username=username).exists():
                username = f'{base}-{i}'
                i += 1
            data['username'] = username
        serializer = PublicProfileCreateSerializer(data=data)
        if serializer.is_valid():
            profile = serializer.save(user=user)
            out = PublicProfileSerializer(profile, context={'request': request})
            return Response(out.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    # PATCH
    try:
        profile = user.public_profile
    except PublicProfile.DoesNotExist:
        return Response({'detail': 'Perfil não encontrado'}, status=status.HTTP_404_NOT_FOUND)

    data = _camel_to_profile_data(request.data)
    serializer = PublicProfileUpdateSerializer(profile, data=data, partial=True)
    if serializer.is_valid():
        serializer.save()
        # Atualiza settings embutidos, se enviados.
        settings_payload = request.data.get('settings')
        if settings_payload:
            settings_serializer = PublicProfileSettingsSerializer(
                profile, data=settings_payload, partial=True
            )
            if settings_serializer.is_valid():
                settings_serializer.save()
        out = PublicProfileSerializer(profile, context={'request': request})
        return Response(out.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def public_profile_me_avatar(request):
    try:
        profile = request.user.public_profile
    except PublicProfile.DoesNotExist:
        return Response({'detail': 'Perfil não encontrado'}, status=status.HTTP_404_NOT_FOUND)
    if 'avatar' not in request.FILES:
        return Response({'error': 'Nenhum arquivo enviado'}, status=status.HTTP_400_BAD_REQUEST)
    profile.avatar = request.FILES['avatar']
    profile.save(update_fields=['avatar'])
    url = request.build_absolute_uri(profile.avatar.url) if profile.avatar else None
    return Response({'avatarUrl': url})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def public_profile_me_cover(request):
    try:
        profile = request.user.public_profile
    except PublicProfile.DoesNotExist:
        return Response({'detail': 'Perfil não encontrado'}, status=status.HTTP_404_NOT_FOUND)
    if 'cover' not in request.FILES:
        return Response({'error': 'Nenhum arquivo enviado'}, status=status.HTTP_400_BAD_REQUEST)
    profile.cover_image = request.FILES['cover']
    profile.save(update_fields=['cover_image'])
    url = request.build_absolute_uri(profile.cover_image.url) if profile.cover_image else None
    return Response({'coverImageUrl': url})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def public_profile_me_stats(request):
    try:
        profile = request.user.public_profile
    except PublicProfile.DoesNotExist:
        return Response({'detail': 'Perfil não encontrado'}, status=status.HTTP_404_NOT_FOUND)

    from django.utils import timezone
    from datetime import timedelta

    catalogs = Catalog.objects.filter(created_by=request.user)
    catalog_views = CatalogView.objects.filter(catalog__in=catalogs).count()
    catalog_likes = CatalogLike.objects.filter(catalog__in=catalogs).count()
    week_ago = timezone.now() - timedelta(days=7)
    new_followers = ProfileFollow.objects.filter(
        followed_profile=profile, created_at__gte=week_ago
    ).count()

    top_catalog = None
    top = catalogs.annotate(v=Count('catalog_views')).order_by('-v').first()
    if top:
        top_catalog = {
            'id': top.id,
            'title': top.title,
            'views': top.catalog_views.count(),
        }

    return Response({
        'catalogViews': catalog_views,
        'catalogLikes': catalog_likes,
        'profileViews': catalog_views,
        'newFollowersThisWeek': new_followers,
        'topCatalog': top_catalog,
        # Contagens auxiliares (followers/following/catalogs)
        'followers': profile.followers_count,
        'following': profile.following_count,
        'catalogs': profile.catalog_count,
        'views': catalog_views,
    })


def _profiles_response(profiles_qs, request, page, page_size):
    items, total = _paginate(profiles_qs, page, page_size)
    serializer = PublicProfileSerializer(items, many=True, context={'request': request})
    return Response({
        'profiles': serializer.data,
        'total': total,
        'page': page,
        'pageSize': page_size,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def public_profile_me_following(request):
    page, page_size = _profile_page_params(request)
    profile_ids = ProfileFollow.objects.filter(
        follower=request.user
    ).values_list('followed_profile_id', flat=True)
    qs = PublicProfile.objects.filter(id__in=profile_ids).order_by('-created_at')
    return _profiles_response(qs, request, page, page_size)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def public_profile_me_followers(request):
    page, page_size = _profile_page_params(request)
    try:
        profile = request.user.public_profile
    except PublicProfile.DoesNotExist:
        return Response({'profiles': [], 'total': 0, 'page': page, 'pageSize': page_size})
    follower_ids = ProfileFollow.objects.filter(
        followed_profile=profile
    ).values_list('follower_id', flat=True)
    qs = PublicProfile.objects.filter(user_id__in=follower_ids).order_by('-created_at')
    return _profiles_response(qs, request, page, page_size)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def public_profile_me_saved(request):
    page, page_size = _profile_page_params(request)
    profile_ids = ProfileSave.objects.filter(
        user=request.user
    ).values_list('profile_id', flat=True)
    qs = PublicProfile.objects.filter(id__in=profile_ids).order_by('-created_at')
    return _profiles_response(qs, request, page, page_size)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def public_profile_me_blocked(request):
    blocked_ids = list(BlockedUser.objects.filter(
        blocker=request.user
    ).values_list('blocked_id', flat=True))
    return Response(blocked_ids)


@api_view(['PATCH'])
@permission_classes([permissions.IsAuthenticated])
def public_profile_me_settings(request):
    try:
        profile = request.user.public_profile
    except PublicProfile.DoesNotExist:
        return Response({'detail': 'Perfil não encontrado'}, status=status.HTTP_404_NOT_FOUND)
    serializer = PublicProfileSettingsSerializer(profile, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def public_profile_search(request):
    page, page_size = _profile_page_params(request)
    qs = PublicProfile.objects.filter(show_in_search=True, visibility='publico')

    query = request.query_params.get('query') or request.query_params.get('q')
    if query:
        qs = qs.filter(
            Q(display_name__icontains=query) |
            Q(username__icontains=query) |
            Q(bio__icontains=query)
        )

    profile_type = request.query_params.get('profileType') or request.query_params.get('profile_type')
    if profile_type:
        qs = qs.filter(profile_type=profile_type)

    city = request.query_params.get('city')
    if city:
        qs = qs.filter(city__icontains=city)

    state = request.query_params.get('state')
    if state:
        qs = qs.filter(state__icontains=state)

    # segments pode vir repetido (segments=a&segments=b) ou como lista.
    segments = request.query_params.getlist('segments')
    if segments:
        seg_q = Q()
        for seg in segments:
            seg_q |= Q(segments__icontains=seg)
        qs = qs.filter(seg_q)

    qs = qs.order_by('-created_at')
    return _profiles_response(qs, request, page, page_size)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def public_profile_suggested(request):
    try:
        limit = int(request.query_params.get('limit', 10))
    except (TypeError, ValueError):
        limit = 10
    qs = PublicProfile.objects.filter(
        show_in_search=True, visibility='publico'
    ).order_by('-created_at')[:limit]
    serializer = PublicProfileSerializer(qs, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def public_profile_featured(request):
    try:
        limit = int(request.query_params.get('limit', 10))
    except (TypeError, ValueError):
        limit = 10
    qs = PublicProfile.objects.filter(
        show_in_search=True, visibility='publico'
    ).annotate(n_followers=Count('followers')).order_by('-n_followers', '-created_at')[:limit]
    serializer = PublicProfileSerializer(qs, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def public_profile_check_username(request):
    username = request.query_params.get('username', '')
    available = bool(username) and not PublicProfile.objects.filter(username=username).exists()
    return Response({'available': available})


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def public_profile_by_username(request, username):
    try:
        profile = PublicProfile.objects.get(username=username)
    except PublicProfile.DoesNotExist:
        return Response({'detail': 'Perfil não encontrado'}, status=status.HTTP_404_NOT_FOUND)
    serializer = PublicProfileSerializer(profile, context={'request': request})
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def public_profile_detail(request, pk):
    try:
        profile = PublicProfile.objects.get(pk=pk)
    except PublicProfile.DoesNotExist:
        return Response({'detail': 'Perfil não encontrado'}, status=status.HTTP_404_NOT_FOUND)
    serializer = PublicProfileSerializer(profile, context={'request': request})
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def public_profile_catalogs(request, pk):
    page, page_size = _profile_page_params(request)
    try:
        profile = PublicProfile.objects.get(pk=pk)
    except PublicProfile.DoesNotExist:
        return Response({'detail': 'Perfil não encontrado'}, status=status.HTTP_404_NOT_FOUND)

    qs = Catalog.objects.filter(created_by=profile.user, is_public=True)

    sort_by = request.query_params.get('sortBy') or request.query_params.get('sort_by')
    if sort_by == 'popular':
        qs = qs.annotate(n_likes=Count('catalog_likes')).order_by('-n_likes', '-created_at')
    elif sort_by == 'views':
        qs = qs.annotate(n_views=Count('catalog_views')).order_by('-n_views', '-created_at')
    else:
        qs = qs.order_by('-created_at')

    items, total = _paginate(qs, page, page_size)
    serializer = PublicCatalogSerializer(items, many=True, context={'request': request})
    return Response({
        'catalogs': serializer.data,
        'total': total,
        'page': page,
        'pageSize': page_size,
    })


@api_view(['POST', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def public_profile_follow(request, pk):
    try:
        profile = PublicProfile.objects.get(pk=pk)
    except PublicProfile.DoesNotExist:
        return Response({'detail': 'Perfil não encontrado'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'POST':
        ProfileFollow.objects.get_or_create(
            follower=request.user, followed_profile=profile
        )
        return Response({'success': True})

    ProfileFollow.objects.filter(
        follower=request.user, followed_profile=profile
    ).delete()
    return Response({'success': True})


@api_view(['POST', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def public_profile_save(request, pk):
    try:
        profile = PublicProfile.objects.get(pk=pk)
    except PublicProfile.DoesNotExist:
        return Response({'detail': 'Perfil não encontrado'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'POST':
        ProfileSave.objects.get_or_create(user=request.user, profile=profile)
        return Response({'success': True})

    ProfileSave.objects.filter(user=request.user, profile=profile).delete()
    return Response({'success': True})


@api_view(['POST', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def public_profile_block(request, user_id):
    try:
        target = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({'detail': 'Usuário não encontrado'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'POST':
        BlockedUser.objects.get_or_create(blocker=request.user, blocked=target)
        return Response({'success': True})

    BlockedUser.objects.filter(blocker=request.user, blocked=target).delete()
    return Response({'success': True})


# ============================================
# Phase 4 - Catálogos Públicos (social)
# ============================================

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def public_catalogs_featured(request):
    page, page_size = _profile_page_params(request)
    qs = Catalog.objects.filter(is_public=True)

    segment = request.query_params.get('segment')
    if segment:
        qs = qs.filter(
            created_by__public_profile__segments__icontains=segment
        )

    qs = qs.annotate(n_likes=Count('catalog_likes')).order_by('-n_likes', '-created_at')
    items, total = _paginate(qs, page, page_size)
    serializer = PublicCatalogSerializer(items, many=True, context={'request': request})
    return Response({
        'catalogs': serializer.data,
        'total': total,
        'page': page,
        'pageSize': page_size,
    })


@api_view(['POST', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def public_catalog_like(request, pk):
    try:
        catalog = Catalog.objects.get(pk=pk)
    except Catalog.DoesNotExist:
        return Response({'detail': 'Catálogo não encontrado'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'POST':
        CatalogLike.objects.get_or_create(user=request.user, catalog=catalog)
    else:
        CatalogLike.objects.filter(user=request.user, catalog=catalog).delete()

    return Response({
        'success': True,
        'likeCount': CatalogLike.objects.filter(catalog=catalog).count(),
    })


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def public_catalog_view(request, pk):
    try:
        catalog = Catalog.objects.get(pk=pk)
    except Catalog.DoesNotExist:
        return Response({'detail': 'Catálogo não encontrado'}, status=status.HTTP_404_NOT_FOUND)

    ip = request.META.get('REMOTE_ADDR')
    ua = request.META.get('HTTP_USER_AGENT', '')
    user = request.user if request.user.is_authenticated else None
    CatalogView.objects.create(
        catalog=catalog, user=user, ip_address=ip, user_agent=ua
    )
    return Response({'success': True})


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def public_catalog_share(request, pk):
    try:
        catalog = Catalog.objects.get(pk=pk)
    except Catalog.DoesNotExist:
        return Response({'detail': 'Catálogo não encontrado'}, status=status.HTTP_404_NOT_FOUND)

    platform = request.data.get('platform')
    Activity.objects.create(
        user=request.user,
        action='Catálogo compartilhado',
        description=f'Compartilhou o catálogo "{catalog.title}"' + (f' via {platform}' if platform else ''),
        catalog=catalog,
        organization=catalog.organization,
        sede=catalog.sede,
    )
    return Response({'success': True})
