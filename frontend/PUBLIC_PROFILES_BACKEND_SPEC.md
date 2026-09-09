# 👤 Especificação Backend - Perfis Públicos e Descoberta

## 📋 Visão Geral

Sistema de perfis públicos para descoberta, interações sociais e visualização de catálogos na plataforma Catana.

**Objetivo**: Transformar o Catana em uma plataforma de descoberta de oportunidades de negócio através de perfis profissionais e catálogos públicos.

---

## 🎯 Modelo de Dados

### PublicProfile (Perfil Público)

```python
from django.db import models
from django.contrib.auth.models import User

class PublicProfile(models.Model):
    """
    Perfil público de um usuário
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
    display_name = models.CharField(max_length=100)  # Nome da empresa ou pessoa
    bio = models.CharField(max_length=160)  # Bio curta
    description = models.TextField(blank=True, null=True)  # Descrição completa

    # Mídia
    avatar = models.ImageField(upload_to='profiles/avatars/', blank=True, null=True)
    cover_image = models.ImageField(upload_to='profiles/covers/', blank=True, null=True)

    # Classificação
    profile_type = models.CharField(max_length=20, choices=PROFILE_TYPE_CHOICES)
    segments = models.JSONField(default=list)  # Lista de segmentos ["Moda", "Eletrônicos"]

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
        return self.user.catalogs.filter(is_public=True).count()
```

### ProfileFollow (Seguir)

```python
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
```

### ProfileSave (Salvar)

```python
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
```

### CatalogLike (Curtir Catálogo)

```python
class CatalogLike(models.Model):
    """
    Curtidas em catálogos públicos
    """
    user = models.ForeignKey(User, related_name='catalog_likes', on_delete=models.CASCADE)
    catalog = models.ForeignKey('Catalog', related_name='likes', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'catalog_likes'
        unique_together = ('user', 'catalog')
        indexes = [
            models.Index(fields=['catalog']),
        ]
```

### CatalogView (Visualização de Catálogo)

```python
class CatalogView(models.Model):
    """
    Registro de visualizações de catálogos
    """
    catalog = models.ForeignKey('Catalog', related_name='views', on_delete=models.CASCADE)
    user = models.ForeignKey(User, blank=True, null=True, on_delete=models.SET_NULL)  # Pode ser anônimo
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'catalog_views'
        indexes = [
            models.Index(fields=['catalog', 'created_at']),
        ]
```

### BlockedUser (Usuários Bloqueados)

```python
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
```

---

## 🛣️ Endpoints da API

### 1. Perfil Público

#### `GET /api/public-profiles/{id}/`
Busca perfil público por ID

**Resposta:**
```json
{
  "id": 123,
  "userId": 456,
  "username": "loja_exemplo",
  "displayName": "Loja Exemplo LTDA",
  "bio": "Moda feminina com qualidade e estilo desde 2010",
  "description": "Descrição completa...",
  "avatar": "https://...",
  "coverImage": "https://...",
  "profileType": "empresa",
  "segments": ["Moda", "Acessórios"],
  "city": "São Paulo",
  "state": "SP",
  "catalogCount": 15,
  "followersCount": 342,
  "visibility": "publico",
  "allowMessages": true,
  "isFollowing": false,
  "isSaved": false,
  "createdAt": "2024-01-15T10:00:00Z"
}
```

#### `GET /api/public-profiles/username/{username}/`
Busca perfil público por username

#### `GET /api/public-profiles/me/`
Busca perfil público do usuário logado (versão completa com dados privados)

#### `POST /api/public-profiles/me/`
Cria perfil público do usuário logado

**Request:**
```json
{
  "displayName": "Minha Empresa",
  "bio": "Descrição curta",
  "profileType": "empresa",
  "segments": ["Eletrônicos"]
}
```

#### `PATCH /api/public-profiles/me/`
Atualiza perfil público

**Request:**
```json
{
  "displayName": "Novo Nome",
  "bio": "Nova bio",
  "description": "Descrição completa",
  "profileType": "criador",
  "segments": ["Moda", "Acessórios"],
  "city": "Rio de Janeiro",
  "state": "RJ"
}
```

#### `POST /api/public-profiles/me/avatar/`
Upload de avatar (multipart/form-data)

#### `POST /api/public-profiles/me/cover/`
Upload de imagem de capa (multipart/form-data)

#### `GET /api/public-profiles/me/stats/`
Estatísticas do meu perfil

**Resposta:**
```json
{
  "catalogViews": 1250,
  "catalogLikes": 89,
  "profileViews": 456,
  "newFollowersThisWeek": 12,
  "topCatalog": {
    "id": 42,
    "title": "Coleção Verão 2024",
    "views": 523
  }
}
```

---

### 2. Busca e Descoberta

#### `GET /api/public-profiles/search/`
Busca perfis com filtros

**Query Params:**
- `query` (string): Termo de busca
- `profileType` (string): Tipo de perfil
- `segments` (array): Segmentos
- `city` (string): Cidade
- `page` (int): Página
- `pageSize` (int): Itens por página

**Resposta:**
```json
{
  "profiles": [...],
  "total": 150,
  "page": 1,
  "pageSize": 20,
  "hasMore": true
}
```

#### `GET /api/public-profiles/suggested/`
Perfis sugeridos (baseado em segmentos do usuário)

#### `GET /api/public-profiles/featured/`
Perfis em destaque (curados ou por algoritmo)

---

### 3. Catálogos de um Perfil

#### `GET /api/public-profiles/{id}/catalogs/`
Lista catálogos públicos de um perfil

**Query Params:**
- `page` (int)
- `pageSize` (int)
- `sortBy` (string): `recent`, `popular`, `views`

**Resposta:**
```json
{
  "catalogs": [
    {
      "id": 42,
      "title": "Coleção Primavera",
      "description": "...",
      "coverImage": "https://...",
      "viewCount": 523,
      "likeCount": 45,
      "profileId": 123,
      "profileName": "Loja Exemplo",
      "profileAvatar": "https://...",
      "isPublic": true,
      "isLiked": false,
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 15,
  "page": 1,
  "pageSize": 12
}
```

---

### 4. Interações - Seguir

#### `POST /api/public-profiles/{id}/follow/`
Seguir um perfil

**Resposta:**
```json
{
  "success": true
}
```

#### `DELETE /api/public-profiles/{id}/follow/`
Deixar de seguir

#### `GET /api/public-profiles/me/following/`
Lista perfis que estou seguindo

#### `GET /api/public-profiles/me/followers/`
Lista meus seguidores

---

### 5. Interações - Salvar

#### `POST /api/public-profiles/{id}/save/`
Salvar perfil

#### `DELETE /api/public-profiles/{id}/save/`
Remover dos salvos

#### `GET /api/public-profiles/me/saved/`
Lista perfis salvos

---

### 6. Interações - Catálogos

#### `POST /api/public-catalogs/{id}/like/`
Curtir catálogo

**Resposta:**
```json
{
  "success": true,
  "likeCount": 46
}
```

#### `DELETE /api/public-catalogs/{id}/like/`
Descurtir catálogo

#### `POST /api/public-catalogs/{id}/view/`
Registrar visualização de catálogo

#### `POST /api/public-catalogs/{id}/share/`
Registrar compartilhamento

**Request:**
```json
{
  "platform": "whatsapp"
}
```

---

### 7. Configurações e Privacidade

#### `PATCH /api/public-profiles/me/settings/`
Atualiza configurações de privacidade

**Request:**
```json
{
  "visibility": "publico",
  "showInSearch": true,
  "allowMessages": true,
  "allowFollows": true
}
```

#### `POST /api/public-profiles/block/{userId}/`
Bloquear usuário

#### `DELETE /api/public-profiles/block/{userId}/`
Desbloquear usuário

#### `GET /api/public-profiles/me/blocked/`
Lista usuários bloqueados

---

### 8. Utilidades

#### `GET /api/public-profiles/check-username/`
Verifica disponibilidade de username

**Query Params:**
- `username` (string)

**Resposta:**
```json
{
  "available": true
}
```

---

## 🔐 Regras de Privacidade

### Visibilidade de Perfis

| Visibilidade | Aparece na Busca | Pode Seguir | Pode Ver Catálogos |
|--------------|------------------|-------------|---------------------|
| `publico` | ✅ Sim | ✅ Sim | ✅ Sim |
| `semi-publico` | ❌ Não | ✅ Sim (via link direto) | ✅ Sim |
| `privado` | ❌ Não | ❌ Não | ❌ Não (apenas o dono) |

### Dados Nunca Expostos

- E-mail
- Telefone
- Endereço completo
- Dados de pagamento
- IDs internos do sistema

### Proteção Contra Spam

- Rate limiting em seguir/deixar de seguir (máximo 20 por hora)
- Rate limiting em curtidas (máximo 50 por hora)
- Bloqueio automático após 3 denúncias

---

## 📊 Métricas e Analytics

### Métricas por Perfil

```python
class ProfileStats:
    def get_stats(profile_id):
        return {
            'catalog_views': total_views_of_all_catalogs,
            'catalog_likes': total_likes_of_all_catalogs,
            'profile_views': profile_page_views,
            'new_followers_this_week': followers_last_7_days,
            'top_catalog': most_viewed_catalog,
        }
```

### Métricas por Catálogo

- `view_count`: Total de visualizações
- `unique_view_count`: Visualizações únicas (por IP/usuário)
- `like_count`: Total de curtidas
- `share_count`: Total de compartilhamentos

---

## 🚀 Implementação Sugerida (Django REST Framework)

### Serializers

```python
from rest_framework import serializers
from .models import PublicProfile

class PublicProfileSerializer(serializers.ModelSerializer):
    catalog_count = serializers.IntegerField(read_only=True)
    followers_count = serializers.IntegerField(read_only=True)
    is_following = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()

    class Meta:
        model = PublicProfile
        fields = [
            'id', 'user_id', 'username', 'display_name', 'bio', 'description',
            'avatar', 'cover_image', 'profile_type', 'segments',
            'city', 'state', 'catalog_count', 'followers_count',
            'visibility', 'allow_messages', 'is_following', 'is_saved',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user_id', 'created_at', 'updated_at']

    def get_is_following(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.followers.filter(follower=request.user).exists()
        return False

    def get_is_saved(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.saved_by.filter(user=request.user).exists()
        return False
```

### Views

```python
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.db.models import Q, Count
from .models import PublicProfile, ProfileFollow, CatalogLike
from .serializers import PublicProfileSerializer

class PublicProfileViewSet(viewsets.ModelViewSet):
    queryset = PublicProfile.objects.all()
    serializer_class = PublicProfileSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'search', 'featured']:
            return [AllowAny()]
        return [IsAuthenticated()]

    @action(detail=False, methods=['get'])
    def search(self, request):
        """
        Busca perfis públicos
        """
        query = request.GET.get('query', '')
        profile_type = request.GET.get('profileType')
        segments = request.GET.getlist('segments')
        city = request.GET.get('city')
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('pageSize', 20))

        # Base query
        profiles = PublicProfile.objects.filter(
            visibility='publico',
            show_in_search=True
        )

        # Aplicar filtros
        if query:
            profiles = profiles.filter(
                Q(display_name__icontains=query) |
                Q(bio__icontains=query) |
                Q(username__icontains=query)
            )

        if profile_type:
            profiles = profiles.filter(profile_type=profile_type)

        if segments:
            profiles = profiles.filter(segments__overlap=segments)

        if city:
            profiles = profiles.filter(city__icontains=city)

        # Contagem total
        total = profiles.count()

        # Paginação
        start = (page - 1) * page_size
        end = start + page_size
        profiles = profiles[start:end]

        # Serializar
        serializer = self.get_serializer(profiles, many=True)

        return Response({
            'profiles': serializer.data,
            'total': total,
            'page': page,
            'pageSize': page_size,
            'hasMore': end < total
        })

    @action(detail=True, methods=['post'])
    def follow(self, request, pk=None):
        """
        Seguir um perfil
        """
        profile = self.get_object()

        if not profile.allow_follows:
            return Response(
                {'error': 'Este perfil não permite seguidores'},
                status=status.HTTP_403_FORBIDDEN
            )

        ProfileFollow.objects.get_or_create(
            follower=request.user,
            followed_profile=profile
        )

        return Response({'success': True})

    @action(detail=True, methods=['delete'])
    def unfollow(self, request, pk=None):
        """
        Deixar de seguir
        """
        profile = self.get_object()

        ProfileFollow.objects.filter(
            follower=request.user,
            followed_profile=profile
        ).delete()

        return Response({'success': True})
```

---

## ✅ Validações Necessárias

1. **Username único**: Verificar se username já existe
2. **Perfil por usuário**: Um usuário só pode ter um perfil público
3. **Rate limiting**: Limitar ações para evitar spam
4. **Bloqueios**: Usuário bloqueado não pode seguir/curtir/comentar
5. **Privacidade**: Respeitar configurações de visibilidade

---

## 🧪 Testes Recomendados

```python
class PublicProfileTestCase(TestCase):
    def test_create_public_profile(self):
        # Testa criação de perfil
        pass

    def test_search_profiles(self):
        # Testa busca com filtros
        pass

    def test_follow_unfollow(self):
        # Testa seguir/deixar de seguir
        pass

    def test_privacy_settings(self):
        # Testa configurações de privacidade
        pass

    def test_blocked_user_cannot_interact(self):
        # Testa que usuário bloqueado não pode interagir
        pass
```

---

## 📈 Performance e Otimização

### Índices Recomendados

```sql
CREATE INDEX idx_public_profiles_username ON public_profiles(username);
CREATE INDEX idx_public_profiles_search ON public_profiles(show_in_search, visibility);
CREATE INDEX idx_profile_follows_follower ON profile_follows(follower_id);
CREATE INDEX idx_profile_follows_followed ON profile_follows(followed_profile_id);
CREATE INDEX idx_catalog_likes_catalog ON catalog_likes(catalog_id);
```

### Caching

```python
from django.core.cache import cache

def get_profile_with_cache(profile_id):
    cache_key = f'profile:{profile_id}'
    profile = cache.get(cache_key)

    if not profile:
        profile = PublicProfile.objects.get(id=profile_id)
        cache.set(cache_key, profile, 60 * 15)  # 15 minutos

    return profile
```

---

## 🎯 Checklist de Implementação

- [ ] Criar models (PublicProfile, ProfileFollow, ProfileSave, CatalogLike, CatalogView, BlockedUser)
- [ ] Criar serializers
- [ ] Implementar endpoints de perfil público
- [ ] Implementar busca com filtros
- [ ] Implementar sistema de seguir/deixar de seguir
- [ ] Implementar sistema de salvar perfis
- [ ] Implementar curtidas em catálogos
- [ ] Implementar registro de visualizações
- [ ] Implementar configurações de privacidade
- [ ] Implementar bloqueio de usuários
- [ ] Adicionar validações e rate limiting
- [ ] Criar testes unitários
- [ ] Documentar endpoints no Swagger/OpenAPI
- [ ] Implementar cache para performance
- [ ] Adicionar logs de auditoria

---

**Versão**: 1.0
**Data**: 2025-12-28
**Plataforma**: Catana
**Autor**: Frontend Team
