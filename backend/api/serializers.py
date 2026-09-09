from rest_framework import serializers
from .models import (
    User, Product, Media, MediaFolder, Theme, Catalog, Page, Component, PageComponent, Comment, Activity, Organization, Sede, SedeSharing, Category, UserPreferences, Conversation, Message, Notification, ProductMedia,
    PublicProfile, ProfileFollow, ProfileSave, CatalogLike, CatalogView, BlockedUser
)

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'recipient', 'organization', 'type', 'title', 'content', 'link', 'read_at', 'created_at']
        read_only_fields = ['id', 'created_at']

class SedeSerializer(serializers.ModelSerializer):
    members_count = serializers.IntegerField(source='members.count', read_only=True)
    class Meta:
        model = Sede
        fields = ['id', 'name', 'organization', 'responsible_user', 'created_at', 'updated_at', 'members_count']
        read_only_fields = ['created_at', 'updated_at']

class SedeSharingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SedeSharing
        fields = '__all__'
        read_only_fields = ['created_at']

class OrganizationSerializer(serializers.ModelSerializer):
    sedes = SedeSerializer(many=True, read_only=True)
    class Meta:
        model = Organization
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'owner']

class UserSerializer(serializers.ModelSerializer):
    organizations = OrganizationSerializer(many=True, read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'avatar', 'role', 'organizations']

class MediaFolderSerializer(serializers.ModelSerializer):
    class Meta:
        model = MediaFolder
        fields = '__all__'
        read_only_fields = ['created_by']

class CategorySerializer(serializers.ModelSerializer):
    subcategories = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ['id', 'name', 'description', 'parent', 'organization', 'sede', 'created_by', 'created_at', 'updated_at', 'subcategories']
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_subcategories(self, obj):
        if hasattr(obj, 'subcategories'):
            return CategorySerializer(obj.subcategories.all(), many=True).data
        return []

class ProductSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']
    
    likes_count = serializers.IntegerField(source='likes.count', read_only=True)
    saves_count = serializers.IntegerField(source='saves.count', read_only=True)
    is_liked = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()

    def get_image_url(self, obj):
        if obj.image and obj.image.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.file.url)
            return obj.image.file.url
        return None

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(id=request.user.id).exists()
        return False

    def get_is_saved(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.saves.filter(id=request.user.id).exists()
    def get_is_saved(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.saves.filter(id=request.user.id).exists()
        return False

    def validate_specs(self, value):
        # DIV-07: specs é uma lista de especificações.
        if not isinstance(value, list):
            raise serializers.ValidationError('specs deve ser uma lista.')
        return value

    def validate_dropshipping_info(self, value):
        # DIV-07: dropshipping_info é um objeto.
        if not isinstance(value, dict):
            raise serializers.ValidationError('dropshipping_info deve ser um objeto JSON.')
        return value

class PublicProductSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    category_name = serializers.CharField(source='category.name', read_only=True)
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    
    class Meta:
        model = Product
        fields = [
            'id', 'name', 'public_slug', 'description', 'price', 'currency',
            'image_url', 'category_name', 'organization_name', 'badge',
            'public_at', 'likes_count'
        ]
        read_only_fields = fields

    likes_count = serializers.IntegerField(source='likes.count', read_only=True)

    def get_image_url(self, obj):
        if obj.image and obj.image.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.file.url)
            return obj.image.file.url
        return None

class MediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Media
        fields = '__all__'
        read_only_fields = ['uploaded_by']

class ThemeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Theme
        fields = '__all__'

    def validate_styles(self, value):
        # DIV-07: styles guarda designTokens e aparência global; deve ser objeto.
        if not isinstance(value, dict):
            raise serializers.ValidationError('styles deve ser um objeto JSON.')
        return value

class CatalogSerializer(serializers.ModelSerializer):
    cover_image = serializers.SerializerMethodField()
    pages_count = serializers.SerializerMethodField()
    author_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    author_avatar = serializers.SerializerMethodField()
    is_public = serializers.BooleanField(default=False)

    # 🏢 Informações de Organização e Sede para Explorer
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    organization_logo = serializers.SerializerMethodField()
    sede_name = serializers.CharField(source='sede.name', read_only=True, allow_null=True)

    likes_count = serializers.IntegerField(source='likes.count', read_only=True)
    saves_count = serializers.IntegerField(source='saves.count', read_only=True)
    is_liked = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()

    class Meta:
        model = Catalog
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_cover_image(self, obj):
        # Primeiro tenta usar a capa definida no catálogo
        if obj.cover_image and obj.cover_image.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.cover_image.file.url)
            return obj.cover_image.file.url

        # Fallback: usa a imagem de fundo da primeira página
        first_page = obj.pages.order_by('order').first()
        if first_page and first_page.background_image and first_page.background_image.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(first_page.background_image.file.url)
            return first_page.background_image.file.url

        return None

    def get_pages_count(self, obj):
        return obj.pages.count()

    def get_author_avatar(self, obj):
        # Mock avatar since User doesn't have one yet, or use a default
        return f"https://ui-avatars.com/api/?name={obj.created_by.username}&background=random"

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(id=request.user.id).exists()
        return False

    def get_is_saved(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.saves.filter(id=request.user.id).exists()
        return False

    def get_organization_logo(self, obj):
        """Retorna URL do logo da organização se existir"""
        if obj.organization and obj.organization.logo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.organization.logo.url)
            return obj.organization.logo.url
        return None

class PageSerializer(serializers.ModelSerializer):
    background_image_url = serializers.SerializerMethodField()

    class Meta:
        model = Page
        fields = '__all__'

    def get_background_image_url(self, obj):
        if obj.background_image and obj.background_image.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.background_image.file.url)
            return obj.background_image.file.url
        return None

class CatalogDetailSerializer(CatalogSerializer):
    pages = PageSerializer(many=True, read_only=True)

class ComponentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Component
        fields = '__all__'

    def validate_content(self, value):
        # DIV-07: content guarda o JSON do elemento do editor; deve ser objeto.
        if not isinstance(value, dict):
            raise serializers.ValidationError('content deve ser um objeto JSON.')
        return value

class PageComponentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PageComponent
        fields = '__all__'

class CommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = '__all__'

class ActivitySerializer(serializers.ModelSerializer):
    catalog_title = serializers.CharField(source='catalog.title', read_only=True)
    created_at = serializers.DateTimeField(source='timestamp', read_only=True)

    class Meta:
        model = Activity
        fields = ['id', 'action', 'description', 'catalog_title', 'created_at']
        read_only_fields = ['id', 'created_at']

class UserPreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreferences
        fields = ['language', 'theme', 'notify_on_publish', 'notify_on_updates']

class UserProfileSerializer(serializers.ModelSerializer):
    avatar = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'name', 'avatar', 'position', 'role', 'last_login', 'date_joined', 'created_at', 'updated_at']
        read_only_fields = ['id', 'username', 'email', 'last_login', 'date_joined']

    def get_avatar(self, obj):
        if obj.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None

    def get_name(self, obj):
        return obj.get_full_name() or obj.username

    # Adicionar campos created_at e updated_at que não existem no AbstractUser
    created_at = serializers.DateTimeField(source='date_joined', read_only=True)
    updated_at = serializers.DateTimeField(source='last_login', read_only=True)

class UpdateProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'position']

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True)
    confirm_password = serializers.CharField(required=True)

    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "As senhas não coincidem"})
        return data

class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.get_full_name', read_only=True)
    sender_username = serializers.CharField(source='sender.username', read_only=True)
    sender_avatar = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ['id', 'conversation', 'sender', 'sender_name', 'sender_username', 'sender_avatar', 'content', 'read_at', 'created_at']
        read_only_fields = ['created_at', 'sender']

    def get_sender_avatar(self, obj):
        if obj.sender.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.sender.avatar.url)
            return obj.sender.avatar.url
        return None

class ConversationSerializer(serializers.ModelSerializer):
    messages = MessageSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    participants = UserSerializer(many=True, read_only=True)
    context = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ['id', 'organization', 'sede', 'origin_type', 'origin_id', 'status', 'participants', 'messages', 'last_message', 'context', 'unread_count', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at', 'participants']

    def get_last_message(self, obj):
        last_msg = obj.messages.order_by('-created_at').first()
        if last_msg:
            return MessageSerializer(last_msg, context=self.context).data
        return None

    def get_context(self, obj):
        context_data = {
            'title': f"{obj.origin_type.capitalize()} #{obj.origin_id}",
            'image': None,
            'subtitle': None
        }

        try:
            if obj.origin_type == 'catalog':
                catalog = Catalog.objects.select_related('cover_image').get(id=obj.origin_id)
                context_data['title'] = catalog.title

                # Logic to get image similar to CatalogSerializer
                if catalog.cover_image and catalog.cover_image.file:
                    request = self.context.get('request')
                    if request:
                        context_data['image'] = request.build_absolute_uri(catalog.cover_image.file.url)
                    else:
                        context_data['image'] = catalog.cover_image.file.url

            elif obj.origin_type == 'product':
                product = Product.objects.select_related('image').get(id=obj.origin_id)
                context_data['title'] = product.name
                context_data['subtitle'] = f"{product.price} {product.currency}" if hasattr(product, 'currency') else product.price

                if product.image and product.image.file:
                    request = self.context.get('request')
                    if request:
                        context_data['image'] = request.build_absolute_uri(product.image.file.url)
                    else:
                        context_data['image'] = product.image.file.url
        except (Catalog.DoesNotExist, Product.DoesNotExist):
            pass

        return context_data

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.messages.exclude(sender=request.user).filter(read_at__isnull=True).count()
        return 0

# Bulk Import Serializers
class BulkProductSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, required=True, allow_blank=True)
    sku = serializers.CharField(max_length=100, required=True)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    description = serializers.CharField(required=False, allow_blank=True, default='')
    category = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    stock = serializers.IntegerField(default=0, required=False)
    currency = serializers.CharField(max_length=10, default='BRL', required=False)

    # Imagens
    image_url = serializers.URLField(required=False, allow_blank=True, allow_null=True)  # Legado
    image_main = serializers.URLField(required=False, allow_blank=True, allow_null=True)  # Imagem principal
    image_gallery = serializers.CharField(required=False, allow_blank=True, allow_null=True)  # URLs separadas por |

    sede = serializers.IntegerField(required=True)
    organization = serializers.IntegerField(required=True)

class BulkImportRequestSerializer(serializers.Serializer):
    products = BulkProductSerializer(many=True)


# ============================================
# Serializers de Perfis Públicos
# ============================================

class PublicProfileSerializer(serializers.ModelSerializer):
    """
    Serializer para perfil público
    """
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    catalog_count = serializers.SerializerMethodField()
    followers_count = serializers.SerializerMethodField()
    following_count = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    cover_image_url = serializers.SerializerMethodField()

    class Meta:
        model = PublicProfile
        fields = [
            'id', 'user_id', 'username', 'display_name', 'bio', 'description',
            'avatar', 'avatar_url', 'cover_image', 'cover_image_url',
            'profile_type', 'segments', 'city', 'state', 'country',
            'visibility', 'show_in_search', 'allow_messages', 'allow_follows',
            'show_followers_count', 'show_catalog_count',
            'catalog_count', 'followers_count', 'following_count',
            'is_following', 'is_saved',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user_id', 'created_at', 'updated_at']

    def get_catalog_count(self, obj):
        if not obj.show_catalog_count:
            return None
        return obj.catalog_count

    def get_followers_count(self, obj):
        if not obj.show_followers_count:
            return None
        return obj.followers_count

    def get_following_count(self, obj):
        return obj.following_count

    def get_is_following(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return ProfileFollow.objects.filter(
                follower=request.user,
                followed_profile=obj
            ).exists()
        return False

    def get_is_saved(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return ProfileSave.objects.filter(
                user=request.user,
                profile=obj
            ).exists()
        return False

    def get_avatar_url(self, obj):
        if obj.avatar:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None

    def get_cover_image_url(self, obj):
        if obj.cover_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.cover_image.url)
            return obj.cover_image.url
        return None


class PublicProfileCreateSerializer(serializers.ModelSerializer):
    """
    Serializer para criar perfil público
    """
    class Meta:
        model = PublicProfile
        fields = [
            'username', 'display_name', 'bio', 'description',
            'profile_type', 'segments', 'city', 'state', 'country'
        ]

    def validate_username(self, value):
        # Verificar se username já existe
        if PublicProfile.objects.filter(username=value).exists():
            raise serializers.ValidationError("Este username já está em uso")
        return value


class PublicProfileUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer para atualizar perfil público
    """
    class Meta:
        model = PublicProfile
        fields = [
            'display_name', 'bio', 'description',
            'profile_type', 'segments', 'city', 'state', 'country'
        ]


class PublicProfileSettingsSerializer(serializers.ModelSerializer):
    """
    Serializer para configurações de privacidade
    """
    class Meta:
        model = PublicProfile
        fields = [
            'visibility', 'show_in_search', 'allow_messages',
            'allow_follows', 'show_followers_count', 'show_catalog_count'
        ]


class ProfileFollowSerializer(serializers.ModelSerializer):
    """
    Serializer para seguir/deixar de seguir
    """
    follower_username = serializers.CharField(source='follower.username', read_only=True)
    followed_username = serializers.CharField(source='followed_profile.username', read_only=True)

    class Meta:
        model = ProfileFollow
        fields = ['id', 'follower', 'follower_username', 'followed_profile', 'followed_username', 'created_at']
        read_only_fields = ['id', 'created_at']


class PublicCatalogSerializer(serializers.ModelSerializer):
    """
    Serializer para catálogos públicos (usado na página de perfil)
    """
    cover_image_url = serializers.SerializerMethodField()
    profile_id = serializers.IntegerField(source='created_by.public_profile.id', read_only=True)
    profile_name = serializers.CharField(source='created_by.public_profile.display_name', read_only=True)
    profile_username = serializers.CharField(source='created_by.public_profile.username', read_only=True)
    profile_avatar = serializers.SerializerMethodField()
    view_count = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()

    class Meta:
        model = Catalog
        fields = [
            'id', 'title', 'description', 'cover_image_url',
            'profile_id', 'profile_name', 'profile_username', 'profile_avatar',
            'view_count', 'like_count', 'is_liked',
            'is_public', 'created_at', 'updated_at'
        ]
        read_only_fields = fields

    def get_cover_image_url(self, obj):
        if obj.cover_image and obj.cover_image.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.cover_image.file.url)
            return obj.cover_image.file.url
        return None

    def get_profile_avatar(self, obj):
        try:
            profile = obj.created_by.public_profile
            if profile.avatar:
                request = self.context.get('request')
                if request:
                    return request.build_absolute_uri(profile.avatar.url)
                return profile.avatar.url
        except:
            pass
        return None

    def get_view_count(self, obj):
        return obj.catalog_views.count()

    def get_like_count(self, obj):
        return obj.catalog_likes.count()

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return CatalogLike.objects.filter(
                user=request.user,
                catalog=obj
            ).exists()
        return False


class CatalogLikeSerializer(serializers.ModelSerializer):
    """
    Serializer para curtidas em catálogos
    """
    class Meta:
        model = CatalogLike
        fields = ['id', 'user', 'catalog', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']

