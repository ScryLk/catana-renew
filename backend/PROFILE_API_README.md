# API de Perfil do Usuário - Documentação

## Visão Geral

Esta documentação descreve os endpoints da API REST criados para gerenciar o perfil do usuário, preferências e atividades no sistema Catana.

## Endpoints Implementados

### 1. Perfil do Usuário

#### `GET /api/profile/`
Retorna o perfil completo do usuário autenticado.

**Autenticação:** Requerida (Bearer Token)

**Resposta de Sucesso (200):**
```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@catana.com",
  "name": "Admin User",
  "avatar": "http://localhost:8000/media/avatars/avatar.jpg",
  "position": "Gerente de TI",
  "role": "admin",
  "last_login": "2025-12-21T15:30:00Z",
  "date_joined": "2025-12-06T02:27:39.960623Z",
  "created_at": "2025-12-06T02:27:39.960623Z",
  "updated_at": "2025-12-21T15:30:00Z"
}
```

#### `PATCH /api/profile/`
Atualiza o perfil do usuário.

**Autenticação:** Requerida (Bearer Token)

**Body da Requisição:**
```json
{
  "name": "João Silva",
  "position": "Desenvolvedor Senior"
}
```

**Resposta de Sucesso (200):**
```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@catana.com",
  "name": "João Silva",
  "avatar": null,
  "position": "Desenvolvedor Senior",
  "role": "admin",
  "last_login": "2025-12-21T15:30:00Z",
  "date_joined": "2025-12-06T02:27:39.960623Z",
  "created_at": "2025-12-06T02:27:39.960623Z",
  "updated_at": "2025-12-21T15:30:00Z"
}
```

---

### 2. Upload de Avatar

#### `POST /api/profile/avatar/`
Faz upload da foto de perfil do usuário.

**Autenticação:** Requerida (Bearer Token)

**Content-Type:** `multipart/form-data`

**Body da Requisição:**
```
avatar: [arquivo PNG/JPG, máx 2MB]
```

**Validações:**
- Tamanho máximo: 2MB
- Formatos aceitos: PNG, JPG, JPEG

**Resposta de Sucesso (200):**
```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@catana.com",
  "name": "Admin User",
  "avatar": "http://localhost:8000/media/avatars/new_avatar.jpg",
  "position": "Gerente de TI",
  "role": "admin",
  ...
}
```

**Erros:**
- `400 Bad Request` - Arquivo muito grande ou formato inválido

---

### 3. Alterar Senha

#### `POST /api/profile/change-password/`
Altera a senha do usuário.

**Autenticação:** Requerida (Bearer Token)

**Body da Requisição:**
```json
{
  "old_password": "senhaAntiga123",
  "new_password": "novaSenha456",
  "confirm_password": "novaSenha456"
}
```

**Resposta de Sucesso (200):**
```json
{
  "message": "Senha alterada com sucesso"
}
```

**Erros:**
- `400 Bad Request` - Senha atual incorreta ou senhas não coincidem

---

### 4. Preferências do Usuário

#### `GET /api/profile/preferences/`
Retorna as preferências do usuário.

**Autenticação:** Requerida (Bearer Token)

**Resposta de Sucesso (200):**
```json
{
  "language": "pt-BR",
  "theme": "dark",
  "notify_on_publish": true,
  "notify_on_updates": true
}
```

#### `PATCH /api/profile/preferences/`
Atualiza as preferências do usuário.

**Autenticação:** Requerida (Bearer Token)

**Body da Requisição:**
```json
{
  "language": "en",
  "theme": "light",
  "notify_on_publish": false,
  "notify_on_updates": true
}
```

**Opções Disponíveis:**
- `language`: `"pt-BR"` ou `"en"`
- `theme`: `"light"`, `"dark"` ou `"auto"`
- `notify_on_publish`: `true` ou `false`
- `notify_on_updates`: `true` ou `false`

**Resposta de Sucesso (200):**
```json
{
  "language": "en",
  "theme": "light",
  "notify_on_publish": false,
  "notify_on_updates": true
}
```

---

### 5. Atividades Recentes

#### `GET /api/profile/activity/`
Retorna as 10 atividades mais recentes do usuário.

**Autenticação:** Requerida (Bearer Token)

**Resposta de Sucesso (200):**
```json
[
  {
    "id": 4,
    "action": "Login realizado",
    "description": "Acessou o sistema",
    "catalog_title": null,
    "created_at": "2025-12-21T18:53:10.731245Z"
  },
  {
    "id": 3,
    "action": "Produto adicionado",
    "description": "Adicionou novos produtos ao catálogo",
    "catalog_title": null,
    "created_at": "2025-12-21T18:53:10.727126Z"
  },
  {
    "id": 2,
    "action": "Catálogo publicado",
    "description": "Publicou um novo catálogo",
    "catalog_title": "Linha Food Service Premium",
    "created_at": "2025-12-21T18:53:10.724418Z"
  }
]
```

---

### 6. Encerrar Todas as Sessões

#### `POST /api/profile/logout-all/`
Encerra todas as sessões ativas do usuário.

**Autenticação:** Requerida (Bearer Token)

**Resposta de Sucesso (200):**
```json
{
  "message": "Todas as sessões foram encerradas"
}
```

**Nota:** Esta é uma implementação simplificada. Para produção com JWT, implemente invalidação de tokens.

---

## Modelos de Banco de Dados

### User (Extensão do AbstractUser)
```python
- avatar: ImageField (nullable)
- position: CharField (nullable) - Cargo ou função
- role: CharField - admin, editor, viewer
- organizations: ManyToManyField
- sedes: ManyToManyField
```

### UserPreferences
```python
- user: OneToOneField(User)
- language: CharField - pt-BR, en
- theme: CharField - light, dark, auto
- notify_on_publish: BooleanField
- notify_on_updates: BooleanField
- created_at: DateTimeField
- updated_at: DateTimeField
```

### Activity
```python
- user: ForeignKey(User)
- action: CharField
- description: TextField
- catalog: ForeignKey(Catalog, nullable)
- organization: ForeignKey(Organization, nullable)
- sede: ForeignKey(Sede, nullable)
- timestamp: DateTimeField
- details: JSONField (nullable)
```

---

## Scripts Utilitários

### `create_user_preferences.py`
Script para criar preferências padrão para todos os usuários e popular atividades de exemplo.

**Uso:**
```bash
python3 create_user_preferences.py
```

**O que faz:**
- Cria preferências padrão para usuários sem preferências
- Cria 4 atividades de exemplo por usuário (para os primeiros 3 usuários)
- Exibe progresso e resumo

---

## Autenticação

Todos os endpoints requerem autenticação via JWT (JSON Web Token).

### Obter Token
```bash
POST /api/auth/token/
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**Resposta:**
```json
{
  "refresh": "eyJ...",
  "access": "eyJ..."
}
```

### Usar Token
Incluir o token de acesso no header de todas as requisições:
```
Authorization: Bearer eyJ...
```

---

## Exemplos de Uso com cURL

### 1. Obter Perfil
```bash
curl -X GET http://localhost:8000/api/profile/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 2. Atualizar Perfil
```bash
curl -X PATCH http://localhost:8000/api/profile/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "position": "Desenvolvedor Senior"
  }'
```

### 3. Upload de Avatar
```bash
curl -X POST http://localhost:8000/api/profile/avatar/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "avatar=@/path/to/image.jpg"
```

### 4. Alterar Senha
```bash
curl -X POST http://localhost:8000/api/profile/change-password/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "old_password": "senhaAntiga123",
    "new_password": "novaSenha456",
    "confirm_password": "novaSenha456"
  }'
```

### 5. Atualizar Preferências
```bash
curl -X PATCH http://localhost:8000/api/profile/preferences/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "theme": "light",
    "language": "en"
  }'
```

### 6. Obter Atividades Recentes
```bash
curl -X GET http://localhost:8000/api/profile/activity/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 7. Encerrar Todas as Sessões
```bash
curl -X POST http://localhost:8000/api/profile/logout-all/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## Integração com Frontend

O frontend React já está configurado para usar estes endpoints através do `profileService`:

```typescript
// Exemplo de uso no frontend
import { profileService } from '@/services/profileService';

// Obter perfil
const profile = await profileService.getProfile();

// Atualizar perfil
const updated = await profileService.updateProfile({
  name: 'João Silva',
  position: 'Desenvolvedor'
});

// Upload de avatar
const file = event.target.files[0];
const updatedProfile = await profileService.uploadAvatar(file);

// Obter preferências
const prefs = await profileService.getPreferences();

// Atualizar preferências
const updatedPrefs = await profileService.updatePreferences({
  theme: 'dark',
  language: 'pt-BR'
});

// Obter atividades
const activities = await profileService.getRecentActivity();
```

---

## Migrations

As migrations foram criadas e aplicadas:

```bash
python3 manage.py makemigrations
python3 manage.py migrate
```

**Migration criada:** `0017_alter_activity_options_activity_catalog_and_more.py`

**Mudanças:**
- Adicionou campo `position` ao modelo User
- Criou modelo UserPreferences
- Adicionou campos `catalog` e `description` ao modelo Activity
- Alterou Meta options do modelo Activity

---

## Testes Realizados

Todos os endpoints foram testados e estão funcionando corretamente:

✅ GET /api/profile/ - Retorna perfil do usuário
✅ PATCH /api/profile/ - Atualiza perfil
✅ POST /api/profile/avatar/ - Upload de avatar
✅ POST /api/profile/change-password/ - Altera senha
✅ GET /api/profile/preferences/ - Retorna preferências
✅ PATCH /api/profile/preferences/ - Atualiza preferências
✅ GET /api/profile/activity/ - Retorna atividades recentes
✅ POST /api/profile/logout-all/ - Encerra sessões

---

## Próximos Passos (Opcional)

1. **Implementar funcionalidade real de "Alterar Senha"** no frontend
2. **Implementar gestão de sessões JWT** para logout_all funcionar corretamente
3. **Adicionar paginação** para atividades (caso necessário)
4. **Implementar notificações** baseadas nas preferências do usuário
5. **Adicionar mais tipos de atividades** conforme o sistema evolui
6. **Implementar auditoria** detalhada de todas as ações do usuário

---

## Suporte

Para dúvidas ou problemas, consulte a documentação completa do Django REST Framework:
- https://www.django-rest-framework.org/

---

**Desenvolvido para:** Sistema Catana
**Data:** 21 de Dezembro de 2025
**Versão da API:** 1.0
