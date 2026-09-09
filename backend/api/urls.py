from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserViewSet, ProductViewSet, MediaViewSet, MediaFolderViewSet, ThemeViewSet, CatalogViewSet, PageViewSet,
    ComponentViewSet, PageComponentViewSet, CommentViewSet, ActivityViewSet, OrganizationViewSet, SedeViewSet,
    SedeSharingViewSet, CategoryViewSet,
    profile_view, upload_avatar, change_password, preferences_view, recent_activity, logout_all_sessions,
    register_user, dashboard_stats, ExploreProductViewSet, global_search,
    NotificationViewSet, ConversationViewSet,
    public_profile_me, public_profile_me_avatar, public_profile_me_cover, public_profile_me_stats,
    public_profile_me_following, public_profile_me_followers, public_profile_me_saved,
    public_profile_me_blocked, public_profile_me_settings,
    public_profile_search, public_profile_suggested, public_profile_featured,
    public_profile_check_username, public_profile_by_username, public_profile_detail,
    public_profile_catalogs, public_profile_follow, public_profile_save, public_profile_block,
    public_catalogs_featured, public_catalog_like, public_catalog_view, public_catalog_share
)
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'organizations', OrganizationViewSet)
router.register(r'sedes', SedeViewSet)
router.register(r'sede-shares', SedeSharingViewSet)
router.register(r'categories', CategoryViewSet)
router.register(r'products', ProductViewSet)
router.register(r'explore/products', ExploreProductViewSet, basename='explore-products')
router.register(r'media-folders', MediaFolderViewSet)
router.register(r'media', MediaViewSet)
router.register(r'themes', ThemeViewSet)
router.register(r'catalogs', CatalogViewSet)
router.register(r'pages', PageViewSet)
router.register(r'components', ComponentViewSet)
router.register(r'page-components', PageComponentViewSet)
router.register(r'comments', CommentViewSet)
router.register(r'activities', ActivityViewSet)
router.register(r'notifications', NotificationViewSet, basename='notifications')
router.register(r'conversations', ConversationViewSet, basename='conversations')

from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    path('', include(router.urls)),
    path('auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('register/', register_user, name='register'),
    path('dashboard/stats/', dashboard_stats, name='dashboard_stats'),

    # Profile endpoints
    path('profile/', profile_view, name='profile'),
    path('profile/avatar/', upload_avatar, name='upload_avatar'),
    path('profile/change-password/', change_password, name='change_password'),
    path('profile/preferences/', preferences_view, name='preferences'),
    path('profile/activity/', recent_activity, name='recent_activity'),
    path('profile/logout-all/', logout_all_sessions, name='logout_all_sessions'),

    # Search endpoints
    path('search/global/', global_search, name='global_search'),

    # ============================================
    # Phase 4 - Perfis Públicos / Social
    # IMPORTANTE: rotas específicas (me, username, search...) ANTES do <int:pk>.
    # O front chama SEM barra final; registramos as variantes exatas.
    # ============================================
    path('public-profiles/me', public_profile_me, name='public_profile_me'),
    path('public-profiles/me/avatar', public_profile_me_avatar, name='public_profile_me_avatar'),
    path('public-profiles/me/cover', public_profile_me_cover, name='public_profile_me_cover'),
    path('public-profiles/me/stats', public_profile_me_stats, name='public_profile_me_stats'),
    path('public-profiles/me/following', public_profile_me_following, name='public_profile_me_following'),
    path('public-profiles/me/followers', public_profile_me_followers, name='public_profile_me_followers'),
    path('public-profiles/me/saved', public_profile_me_saved, name='public_profile_me_saved'),
    path('public-profiles/me/blocked', public_profile_me_blocked, name='public_profile_me_blocked'),
    path('public-profiles/me/settings', public_profile_me_settings, name='public_profile_me_settings'),
    path('public-profiles/search', public_profile_search, name='public_profile_search'),
    path('public-profiles/suggested', public_profile_suggested, name='public_profile_suggested'),
    path('public-profiles/featured', public_profile_featured, name='public_profile_featured'),
    path('public-profiles/check-username', public_profile_check_username, name='public_profile_check_username'),
    path('public-profiles/username/<str:username>', public_profile_by_username, name='public_profile_by_username'),
    path('public-profiles/block/<int:user_id>', public_profile_block, name='public_profile_block'),
    path('public-profiles/<int:pk>/catalogs', public_profile_catalogs, name='public_profile_catalogs'),
    path('public-profiles/<int:pk>/follow', public_profile_follow, name='public_profile_follow'),
    path('public-profiles/<int:pk>/save', public_profile_save, name='public_profile_save'),
    path('public-profiles/<int:pk>', public_profile_detail, name='public_profile_detail'),

    # Phase 4 - Catálogos Públicos (social)
    path('public-catalogs/featured', public_catalogs_featured, name='public_catalogs_featured'),
    path('public-catalogs/<int:pk>/like', public_catalog_like, name='public_catalog_like'),
    path('public-catalogs/<int:pk>/view', public_catalog_view, name='public_catalog_view'),
    path('public-catalogs/<int:pk>/share', public_catalog_share, name='public_catalog_share'),

    path('schema/', SpectacularAPIView.as_view(), name='schema'),
    path('schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('schema/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]

