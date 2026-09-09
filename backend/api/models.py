from django.contrib.auth.models import AbstractUser
from django.db import models

class Organization(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    logo = models.ImageField(upload_to='org_logos/', null=True, blank=True)
    owner = models.ForeignKey('User', on_delete=models.CASCADE, related_name='owned_organizations')
    default_sede = models.ForeignKey('Sede', on_delete=models.SET_NULL, null=True, blank=True, related_name='default_for_org')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class Sede(models.Model):
    name = models.CharField(max_length=255)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='sedes')
    responsible_user = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='responsible_for_sedes')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.organization.name})"

class SedeSharing(models.Model):
    PERMISSION_CHOICES = [
        ('read', 'Somente Leitura'),
        ('write', 'Leitura e Escrita'),
    ]
    RESOURCE_CHOICES = [
        ('media', 'Mídia'),
        ('catalog', 'Catálogos'),
        ('all', 'Todos'),
    ]

    source_sede = models.ForeignKey(Sede, on_delete=models.CASCADE, related_name='shares_sent')
    target_sede = models.ForeignKey(Sede, on_delete=models.CASCADE, related_name='shares_received')
    resource_type = models.CharField(max_length=20, choices=RESOURCE_CHOICES, default='all')
    permission_level = models.CharField(max_length=10, choices=PERMISSION_CHOICES, default='read')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('source_sede', 'target_sede', 'resource_type')

class User(AbstractUser):
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    position = models.CharField(max_length=100, blank=True, null=True)
    role = models.CharField(max_length=20, choices=[('admin', 'Admin'), ('editor', 'Editor'), ('viewer', 'Viewer')])
    organizations = models.ManyToManyField(Organization, related_name='members', blank=True)
    sedes = models.ManyToManyField(Sede, related_name='members', blank=True)
    groups = models.ManyToManyField(
        'auth.Group',
        related_name='api_user_set',  # Choose a unique related_name
        blank=True,
        help_text='The groups this user belongs to. A user will get all permissions granted to each of their groups.',
        related_query_name='user',
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='api_user_set',  # Choose a unique related_name
        blank=True,
        help_text='Specific permissions for this user.',
        related_query_name='user',
    )

class MediaFolder(models.Model):
    name = models.CharField(max_length=255)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='subfolders')
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='media_folders', null=True, blank=True)
    sede = models.ForeignKey(Sede, on_delete=models.SET_NULL, related_name='media_folders', null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class Media(models.Model):
    name = models.CharField(max_length=255, blank=True)
    file = models.FileField(upload_to='media/')
    media_type = models.CharField(max_length=50, blank=True)  # image, video, document, other
    folder = models.ForeignKey(MediaFolder, on_delete=models.SET_NULL, null=True, blank=True, related_name='media_files')
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='media_files', null=True, blank=True)
    sede = models.ForeignKey(Sede, on_delete=models.SET_NULL, related_name='media_files', null=True, blank=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.name and self.file:
            import os
            self.name = os.path.basename(self.file.name)
            
        if not self.media_type and self.file:
            import mimetypes
            mime_type, _ = mimetypes.guess_type(self.file.name)
            if mime_type:
                if mime_type.startswith('image/'):
                    self.media_type = 'image'
                elif mime_type.startswith('video/'):
                    self.media_type = 'video'
                elif mime_type == 'application/pdf':
                    self.media_type = 'document'
                else:
                    self.media_type = 'other'
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

class Notification(models.Model):
    TYPE_CHOICES = [
        ('message', 'Mensagem'),
        ('system', 'Sistema'),
        ('alert', 'Alerta'),
    ]

    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='system')
    title = models.CharField(max_length=255)
    content = models.TextField()
    link = models.CharField(max_length=255, blank=True, null=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} - {self.recipient.username}"

class Category(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='subcategories')
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='categories', null=True, blank=True)
    sede = models.ForeignKey(Sede, on_delete=models.SET_NULL, related_name='categories', null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'Categories'
        ordering = ['name']

    def __str__(self):
        return self.name

class Product(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    sku = models.CharField(max_length=100, unique=True)
    stock = models.IntegerField(default=0)
    currency = models.CharField(max_length=10, default='BRL')
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    badge = models.CharField(max_length=50, blank=True, null=True)
    specs = models.JSONField(default=list, blank=True)
    dropshipping_info = models.JSONField(default=dict, blank=True)

    # Imagens
    image = models.ForeignKey(Media, on_delete=models.SET_NULL, null=True, blank=True, related_name='product_legacy')  # Legado
    cover_image = models.ForeignKey(Media, on_delete=models.SET_NULL, null=True, blank=True, related_name='product_covers')  # Nova imagem principal

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='products', null=True, blank=True)
    sede = models.ForeignKey(Sede, on_delete=models.SET_NULL, related_name='products', null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Public / Explore fields
    is_public = models.BooleanField(default=False)
    public_slug = models.SlugField(max_length=255, unique=True, null=True, blank=True)
    public_at = models.DateTimeField(null=True, blank=True)

    likes = models.ManyToManyField(User, related_name='liked_products', blank=True)
    saves = models.ManyToManyField(User, related_name='saved_products', blank=True)

class ProductMedia(models.Model):
    """
    Galeria de imagens do produto
    """
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='gallery')
    media = models.ForeignKey(Media, on_delete=models.CASCADE, related_name='product_gallery_items')
    order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'created_at']
        verbose_name = 'Product Media'
        verbose_name_plural = 'Product Media'

    def __str__(self):
        return f"{self.product.name} - Image {self.order}"

class Theme(models.Model):
    name = models.CharField(max_length=255)
    styles = models.JSONField()
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='themes', null=True, blank=True)
    sede = models.ForeignKey(Sede, on_delete=models.SET_NULL, related_name='themes', null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

class Catalog(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField()
    cover_image = models.ForeignKey(Media, on_delete=models.SET_NULL, null=True, blank=True, related_name='catalog_covers')
    theme = models.ForeignKey(Theme, on_delete=models.SET_NULL, null=True, blank=True)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='catalogs', null=True, blank=True)
    sede = models.ForeignKey(Sede, on_delete=models.SET_NULL, related_name='catalogs', null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    is_public = models.BooleanField(default=False)
    # Catálogo de demonstração gerado automaticamente (marketing). Permite
    # filtrar, badgear e limpar os demos sem misturar com catálogos reais.
    is_demo = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    likes = models.ManyToManyField(User, related_name='liked_catalogs', blank=True)
    saves = models.ManyToManyField(User, related_name='saved_catalogs', blank=True)

class Page(models.Model):
    catalog = models.ForeignKey(Catalog, related_name='pages', on_delete=models.CASCADE)
    order = models.IntegerField()
    background_image = models.ForeignKey(Media, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class Component(models.Model):
    name = models.CharField(max_length=255)
    component_type = models.CharField(max_length=50, choices=[('text', 'Text'), ('image', 'Image'), ('product', 'Product')])
    content = models.JSONField()
    is_reusable = models.BooleanField(default=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='components', null=True, blank=True)
    sede = models.ForeignKey(Sede, on_delete=models.SET_NULL, related_name='components', null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

class PageComponent(models.Model):
    page = models.ForeignKey(Page, related_name='components', on_delete=models.CASCADE)
    component = models.ForeignKey(Component, on_delete=models.CASCADE)
    position_x = models.IntegerField()
    position_y = models.IntegerField()
    width = models.IntegerField()
    height = models.IntegerField()
    layer = models.IntegerField()

class Comment(models.Model):
    catalog = models.ForeignKey(Catalog, related_name='comments', on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    position_x = models.IntegerField(null=True, blank=True)
    position_y = models.IntegerField(null=True, blank=True)

class Activity(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    action = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    catalog = models.ForeignKey(Catalog, on_delete=models.SET_NULL, null=True, blank=True, related_name='activities')
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='activities', null=True, blank=True)
    sede = models.ForeignKey(Sede, on_delete=models.SET_NULL, related_name='activities', null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    details = models.JSONField(null=True, blank=True)

    class Meta:
        ordering = ['-timestamp']
        verbose_name_plural = 'Activities'

class UserPreferences(models.Model):
    LANGUAGE_CHOICES = [
        ('pt-BR', 'Português (Brasil)'),
        ('en', 'English'),
    ]
    THEME_CHOICES = [
        ('light', 'Claro'),
        ('dark', 'Escuro'),
        ('auto', 'Automático'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='preferences')
    language = models.CharField(max_length=10, choices=LANGUAGE_CHOICES, default='pt-BR')
    theme = models.CharField(max_length=10, choices=THEME_CHOICES, default='dark')
    notify_on_publish = models.BooleanField(default=True)
    notify_on_updates = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'User Preferences'

    def __str__(self):
        return f"Preferences for {self.user.username}"

class Conversation(models.Model):
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('closed', 'Closed'),
    ]
    ORIGIN_TYPE_CHOICES = [
        ('catalog', 'Catalog'),
        ('product', 'Product'),
    ]

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='conversations')
    sede = models.ForeignKey(Sede, on_delete=models.SET_NULL, null=True, blank=True, related_name='conversations')
    
    # Context link (Polymorphic-like behavior)
    origin_type = models.CharField(max_length=20, choices=ORIGIN_TYPE_CHOICES)
    origin_id = models.PositiveIntegerField()
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    
    participants = models.ManyToManyField(User, related_name='conversations', blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='messages_sent')
    content = models.TextField()

    read_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']


# ============================================
# Perfis Públicos e Descoberta
# ============================================

class PublicProfile(models.Model):
    """
    Perfil público de um usuário para descoberta e interações sociais
    """
    PROFILE_TYPE_CHOICES = [
        ('empresa', 'Empresa'),
        ('criador', 'Criador'),
        ('revendedor', 'Revendedor'),
    ]

    VISIBILITY_CHOICES = [
        ('publico', 'Público'),
        ('semi-publico', 'Semi-Público'),
        ('privado', 'Privado'),
    ]

    # Relacionamento
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='public_profile')

    # Identidade
    username = models.SlugField(max_length=50, unique=True)
    display_name = models.CharField(max_length=100)
    bio = models.CharField(max_length=160)
    description = models.TextField(blank=True, null=True)

    # Mídia
    avatar = models.ImageField(upload_to='profiles/avatars/', blank=True, null=True)
    cover_image = models.ImageField(upload_to='profiles/covers/', blank=True, null=True)

    # Classificação
    profile_type = models.CharField(max_length=20, choices=PROFILE_TYPE_CHOICES)
    segments = models.JSONField(default=list)

    # Localização (opcional)
    city = models.CharField(max_length=100, blank=True, null=True)
    state = models.CharField(max_length=50, blank=True, null=True)
    country = models.CharField(max_length=50, default='Brasil')

    # Configurações de privacidade
    visibility = models.CharField(max_length=20, choices=VISIBILITY_CHOICES, default='publico')
    show_in_search = models.BooleanField(default=True)
    allow_messages = models.BooleanField(default=True)
    allow_follows = models.BooleanField(default=True)
    show_followers_count = models.BooleanField(default=True)
    show_catalog_count = models.BooleanField(default=True)

    # Metadados
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'public_profiles'
        verbose_name = 'Perfil Público'
        verbose_name_plural = 'Perfis Públicos'
        indexes = [
            models.Index(fields=['username']),
            models.Index(fields=['profile_type']),
            models.Index(fields=['show_in_search', 'visibility']),
        ]

    def __str__(self):
        return f"@{self.username} - {self.display_name}"

    @property
    def followers_count(self):
        return self.followers.count()

    @property
    def following_count(self):
        return self.user.following.count()

    @property
    def catalog_count(self):
        return self.user.catalog_set.filter(is_public=True).count()


class ProfileFollow(models.Model):
    """
    Relacionamento de seguir entre perfis
    """
    follower = models.ForeignKey(User, related_name='following', on_delete=models.CASCADE)
    followed_profile = models.ForeignKey(PublicProfile, related_name='followers', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'profile_follows'
        unique_together = ('follower', 'followed_profile')
        indexes = [
            models.Index(fields=['follower']),
            models.Index(fields=['followed_profile']),
        ]

    def __str__(self):
        return f"{self.follower.username} follows {self.followed_profile.username}"


class ProfileSave(models.Model):
    """
    Perfis salvos por um usuário
    """
    user = models.ForeignKey(User, related_name='saved_profiles', on_delete=models.CASCADE)
    profile = models.ForeignKey(PublicProfile, related_name='saved_by', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'profile_saves'
        unique_together = ('user', 'profile')
        indexes = [
            models.Index(fields=['user']),
        ]

    def __str__(self):
        return f"{self.user.username} saved @{self.profile.username}"


class CatalogLike(models.Model):
    """
    Curtidas em catálogos públicos
    """
    user = models.ForeignKey(User, related_name='catalog_likes', on_delete=models.CASCADE)
    catalog = models.ForeignKey(Catalog, related_name='catalog_likes', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'catalog_likes'
        unique_together = ('user', 'catalog')
        indexes = [
            models.Index(fields=['catalog']),
        ]

    def __str__(self):
        return f"{self.user.username} likes {self.catalog.title}"


class CatalogView(models.Model):
    """
    Registro de visualizações de catálogos
    """
    catalog = models.ForeignKey(Catalog, related_name='catalog_views', on_delete=models.CASCADE)
    user = models.ForeignKey(User, blank=True, null=True, on_delete=models.SET_NULL)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'catalog_views'
        indexes = [
            models.Index(fields=['catalog', 'created_at']),
        ]

    def __str__(self):
        user_str = self.user.username if self.user else 'Anonymous'
        return f"{user_str} viewed {self.catalog.title}"


class BlockedUser(models.Model):
    """
    Bloqueio de usuários
    """
    blocker = models.ForeignKey(User, related_name='blocked_users', on_delete=models.CASCADE)
    blocked = models.ForeignKey(User, related_name='blocked_by', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'blocked_users'
        unique_together = ('blocker', 'blocked')
        indexes = [
            models.Index(fields=['blocker']),
        ]

    def __str__(self):
        return f"{self.blocker.username} blocked {self.blocked.username}"


# ==============================================================================
# CATANA 2.0 - MODELOS DE ASSINATURA, LIMITES E CONTABILIZACAO DE TOKENS
# ==============================================================================

class SubscriptionPlan(models.Model):
    """
    Plano de assinatura e limites operacionais de IA e catalogos
    """
    name = models.CharField(max_length=100)
    tier = models.CharField(max_length=50, unique=True, default='free')
    monthly_token_quota = models.BigIntegerField(default=100000)
    max_active_catalogs = models.PositiveIntegerField(default=5)
    rate_limit_rpm = models.PositiveIntegerField(default=15)
    can_use_council = models.BooleanField(default=False)
    can_export_pdf = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'subscription_plans'

    def __str__(self):
        return f"{self.name} ({self.tier})"


class OrganizationQuota(models.Model):
    """
    Cotas e consumo mensal por organizacao
    """
    organization = models.OneToOneField(Organization, on_delete=models.CASCADE, related_name='quota')
    plan = models.ForeignKey(SubscriptionPlan, null=True, blank=True, on_delete=models.SET_NULL, related_name='assigned_quotas')
    tokens_used_this_month = models.BigIntegerField(default=0)
    billing_cycle_anchor = models.DateField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'organization_quotas'

    def __str__(self):
        return f"Quota: {self.organization.name} ({self.tokens_used_this_month} tokens)"


class TokenUsageLog(models.Model):
    """
    Auditoria e registro granular de consumo de tokens por requisicao de IA
    """
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True, related_name='token_logs')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='token_logs')
    catalog = models.ForeignKey('StudioCatalog', on_delete=models.SET_NULL, null=True, blank=True, related_name='token_logs')
    agent_role = models.CharField(max_length=50)
    prompt_tokens = models.IntegerField(default=0)
    completion_tokens = models.IntegerField(default=0)
    total_tokens = models.IntegerField(default=0)
    model_name = models.CharField(max_length=100, default='gemini-2.0-flash')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'token_usage_logs'
        indexes = [
            models.Index(fields=['organization', 'created_at']),
            models.Index(fields=['agent_role']),
        ]

    def __str__(self):
        return f"[{self.agent_role}] {self.total_tokens} tokens ({self.created_at})"


# ==============================================================================
# CATANA 2.0 - STUDIO MULTI-AGENTES E PAGINAS DUPLAS (SPREADS)
# ==============================================================================

class StudioCatalog(models.Model):
    """
    Catalogo interativo do Studio com suporte a spreads e geracao por IA
    """
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    brand_name = models.CharField(max_length=255, blank=True, null=True)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True, related_name='studio_catalogs')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_studio_catalogs')
    style_preset = models.CharField(max_length=50, default='editorial_clean')
    primary_color = models.CharField(max_length=30, default='#111827')
    secondary_color = models.CharField(max_length=30, default='#6366f1')
    accent_color = models.CharField(max_length=30, default='#f59e0b')
    font_family = models.CharField(max_length=100, default='Inter')
    page_width = models.PositiveIntegerField(default=794)
    page_height = models.PositiveIntegerField(default=1123)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'studio_catalogs'
        ordering = ['-updated_at']

    def __str__(self):
        return self.title


class CatalogSpread(models.Model):
    """
    Par de paginas (spread duplo A4: 794x1123 por pagina) do catalogo
    """
    catalog = models.ForeignKey(StudioCatalog, on_delete=models.CASCADE, related_name='spreads')
    spread_index = models.PositiveIntegerField(default=0)
    title = models.CharField(max_length=255, blank=True, null=True)
    left_page_elements = models.JSONField(default=list, blank=True)
    right_page_elements = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'catalog_spreads'
        unique_together = ('catalog', 'spread_index')
        ordering = ['spread_index']

    def __str__(self):
        return f"{self.catalog.title} - Spread {self.spread_index}"


class ChatThread(models.Model):
    """
    Sessao de conversa com os agentes de IA
    """
    catalog = models.ForeignKey(StudioCatalog, on_delete=models.CASCADE, null=True, blank=True, related_name='threads')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='studio_threads')
    title = models.CharField(max_length=255, default='Nova Sessao')
    active_agent = models.CharField(max_length=50, default='orchestrator')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'studio_chat_threads'
        ordering = ['-updated_at']

    def __str__(self):
        return f"Thread: {self.title} ({self.active_agent})"


class ChatMessage(models.Model):
    """
    Mensagem individual no chat com suporte a metadados de anexos e sugestoes
    """
    SENDER_CHOICES = [
        ('user', 'User'),
        ('agent', 'Agent'),
        ('system', 'System'),
    ]

    thread = models.ForeignKey(ChatThread, on_delete=models.CASCADE, related_name='messages')
    sender_type = models.CharField(max_length=20, choices=SENDER_CHOICES)
    agent_role = models.CharField(max_length=50, blank=True, default='')
    content = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'studio_chat_messages'
        ordering = ['created_at']

    def __str__(self):
        return f"[{self.sender_type}:{self.agent_role}] {self.content[:40]}"


class CatalogTemplate(models.Model):
    """
    Modelos e Blueprints de Laminas e Catalogos para alimentacao RAG dos Agentes
    """
    CATEGORY_CHOICES = [
        ('cover', 'Capa'),
        ('manifesto', 'Manifesto Editorial'),
        ('hero', 'Destaque Heroico (1 Produto)'),
        ('duo', 'Lamina Dupla (2 Produtos)'),
        ('single', 'Produto Individual'),
        ('grid_4', 'Grade Comercial (4 Produtos)'),
        ('divider', 'Divisor de Secao'),
        ('backcover', 'Contracapa'),
        ('full_catalog', 'Catalogo Completo'),
    ]

    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='hero')
    industry = models.CharField(max_length=100, default='luxury_fashion')
    style_preset = models.CharField(max_length=50, default='editorial_clean')
    product_capacity = models.PositiveIntegerField(default=1)
    description = models.TextField(blank=True, default='')
    editorial_reasoning = models.TextField(blank=True, default='')
    blueprint_data = models.JSONField(default=dict, blank=True)
    embedding = models.JSONField(default=list, blank=True)
    thumbnail_url = models.CharField(max_length=500, blank=True, default='')
    is_system = models.BooleanField(default=True)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True, related_name='catalog_templates')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'catalog_templates'
        ordering = ['category', 'title']

    def __str__(self):
        return f"{self.title} ({self.category})"