# ⚡ Quick Start - Perfis Públicos

## 🎯 Ativar em 5 Minutos

### 1️⃣ Adicionar Rotas (App.tsx)

```typescript
// src/App.tsx
import { ProfileSearch } from './pages/ProfileSearch';
import { PublicProfilePage } from './pages/PublicProfile';

// Dentro de <Routes>
<Route path="/discover" element={<ProfileSearch />} />
<Route path="/profile/:profileId" element={<PublicProfilePage />} />
```

### 2️⃣ Adicionar Link no Menu

```tsx
// src/components/Header.tsx ou Sidebar.tsx
import { Search } from 'lucide-react';
import { Link } from 'react-router-dom';

<Link
  to="/discover"
  className="flex items-center gap-2 px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
>
  <Search className="w-5 h-5" />
  Descobrir
</Link>
```

### 3️⃣ Testar

```bash
# Abra no navegador:
http://localhost:5173/discover

# Ou acesse diretamente um perfil:
http://localhost:5173/profile/1
```

---

## 🧪 Testar com Dados Mock

Se o backend ainda não estiver pronto, use estes mocks temporários:

```typescript
// src/services/publicProfileService.ts

// MOCK - Remover quando backend estiver pronto
async searchProfiles(filters, page, pageSize) {
  return {
    profiles: [
      {
        id: 1,
        displayName: 'Loja Exemplo',
        bio: 'Moda feminina de qualidade',
        avatar: 'https://i.pravatar.cc/150?img=1',
        profileType: 'empresa',
        segments: ['Moda'],
        catalogCount: 15,
        followersCount: 342,
        isFollowing: false,
      },
      {
        id: 2,
        displayName: 'Designer Criativo',
        bio: 'Criando catálogos incríveis',
        avatar: 'https://i.pravatar.cc/150?img=2',
        profileType: 'criador',
        segments: ['Design'],
        catalogCount: 8,
        followersCount: 156,
        isFollowing: false,
      },
    ],
    total: 2,
    page: 1,
    pageSize: 20,
    hasMore: false,
  };
}
```

---

## 🎨 Personalizar

### Mudar Cores dos Tipos de Perfil

```typescript
// src/components/profile/ProfileCard.tsx

const getProfileTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    empresa: 'bg-blue-100 text-blue-700',      // Azul
    criador: 'bg-purple-100 text-purple-700',  // Roxo
    revendedor: 'bg-green-100 text-green-700', // Verde
    // Adicione mais:
    influencer: 'bg-pink-100 text-pink-700',
  };
  return colors[type] || 'bg-zinc-100 text-zinc-700';
};
```

### Adicionar Mais Segmentos

```typescript
// src/types/profile.ts

export const AVAILABLE_SEGMENTS = [
  'Moda',
  'Eletrônicos',
  'Alimentos e Bebidas',
  'Casa e Decoração',
  // Adicione aqui:
  'Pets',
  'Automotivo',
  'Fitness',
] as const;
```

---

## 🔌 Exemplos de Uso

### Usar ProfileCard em Qualquer Lugar

```tsx
import { ProfileCard } from './components/profile/ProfileCard';

const MyComponent = () => {
  const profile = {
    id: 1,
    displayName: 'Minha Loja',
    bio: 'Descrição',
    avatar: 'https://...',
    profileType: 'empresa',
    segments: ['Moda'],
    catalogCount: 10,
  };

  return (
    <ProfileCard
      profile={profile}
      onFollowChange={(id, following) => {
        console.log(`Profile ${id} ${following ? 'followed' : 'unfollowed'}`);
      }}
    />
  );
};
```

### Abrir Modal de Configurações

```tsx
import { ProfileSettingsModal } from './components/profile/ProfileSettingsModal';

const [showSettings, setShowSettings] = useState(false);

<button onClick={() => setShowSettings(true)}>
  Configurações
</button>

<ProfileSettingsModal
  isOpen={showSettings}
  onClose={() => setShowSettings(false)}
  onSave={(settings) => console.log(settings)}
/>
```

### Usar Serviço de API Diretamente

```tsx
import { publicProfileService } from './services/publicProfileService';

// Buscar perfil
const profile = await publicProfileService.getPublicProfile(1);

// Seguir perfil
await publicProfileService.followProfile(1);

// Buscar perfis
const results = await publicProfileService.searchProfiles(
  { query: 'moda' },
  1,
  20
);
```

---

## 📱 Navegação Programática

```tsx
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();

// Ir para descoberta
navigate('/discover');

// Ir para perfil
navigate(`/profile/${profileId}`);

// Ir para perfil por username
navigate(`/profile/username/${username}`);
```

---

## 🎯 Próximos Passos

1. ✅ Adicionar rotas
2. ✅ Adicionar link no menu
3. ✅ Testar interface
4. ⏳ Implementar backend (veja `PUBLIC_PROFILES_BACKEND_SPEC.md`)
5. ⏳ Integrar com APIs reais
6. ⏳ Adicionar analytics
7. ⏳ Deploy

---

## 🐛 Problemas Comuns

### "Página não encontra"
→ Verifique se adicionou as rotas no App.tsx

### "Imagens não aparecem"
→ Use URLs de teste como `https://i.pravatar.cc/150?img=1`

### "Erro ao seguir perfil"
→ Backend ainda não implementado, use mocks

### "Dark mode não funciona"
→ Adicione classe `dark` ao `<html>` ou `<body>`

---

## 💡 Dicas Rápidas

1. **Use React DevTools** para debugar estados
2. **Inspecione Network** para ver chamadas API
3. **Teste mobile** com Chrome DevTools (F12 > Toggle Device)
4. **Use console.log** para debugar dados

---

Pronto! Você está pronto para usar o sistema de perfis públicos! 🚀

**Need help?** Veja `IMPLEMENTATION_GUIDE.md` para guia completo.
