import { describe, it, expect, beforeEach } from 'vitest';
import {
  useStudioStore,
  getStoredBrands,
  saveStoredBrands,
  getStoredUnlinkedCatalogs,
  saveStoredUnlinkedCatalogs,
  getStoredProjectSession,
  saveStoredProjectSession,
} from './studioStore';
import { useAuthStore } from './authStore';

describe('Multi-Tenant Data Isolation & Anti-Leak Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    useStudioStore.getState().resetStudioState();
  });

  it('isolates stored brands per userId', () => {
    const userABrands = [
      {
        id: 'brand-user-a',
        name: 'Empresa do Usuário A',
        segment: 'Moda',
        paletteName: 'Minimaliste',
        catalogs: [{ id: 'cat-a-1', title: 'Catálogo A1', totalPages: 4, category: 'Geral', updatedAt: 'Agora' }],
        createdAt: '2026-10-01',
      },
    ];

    const userBBrands = [
      {
        id: 'brand-user-b',
        name: 'Corporação do Usuário B',
        segment: 'Tecnologia',
        paletteName: 'Luxe',
        catalogs: [{ id: 'cat-b-1', title: 'Catálogo B1', totalPages: 6, category: 'Tech', updatedAt: 'Agora' }],
        createdAt: '2026-10-02',
      },
    ];

    saveStoredBrands(userABrands, 101);
    saveStoredBrands(userBBrands, 202);

    expect(getStoredBrands(101)).toEqual(userABrands);
    expect(getStoredBrands(202)).toEqual(userBBrands);
    expect(getStoredBrands(303)).toEqual([]); // Usuário sem marcas cadastradas
  });

  it('isolates unlinked catalogs per userId', () => {
    const userAProjects = [
      { id: 'proj-a-1', title: 'Projeto do User A', totalPages: 4, category: 'Design', updatedAt: '1h' },
    ];
    const userBProjects = [
      { id: 'proj-b-1', title: 'Projeto Secreto User B', totalPages: 8, category: 'Engenharia', updatedAt: '5m' },
    ];

    saveStoredUnlinkedCatalogs(userAProjects, 101);
    saveStoredUnlinkedCatalogs(userBProjects, 202);

    expect(getStoredUnlinkedCatalogs(101)).toEqual(userAProjects);
    expect(getStoredUnlinkedCatalogs(202)).toEqual(userBProjects);
    expect(getStoredUnlinkedCatalogs(303)).toEqual([]);
  });

  it('isolates project sessions and chat threads per userId', () => {
    const sessionA = {
      threads: [
        {
          id: 'thread-a',
          title: 'Briefing A',
          mode: 'director',
          createdAt: '10:00',
          messages: [{ id: 'm1', role: 'user' as const, content: 'Dados confidenciais A' }],
        },
      ],
      activeThreadId: 'thread-a',
      catalogTitle: 'Catálogo Privado A',
      totalPages: 6,
    };

    const sessionB = {
      threads: [
        {
          id: 'thread-b',
          title: 'Briefing B',
          mode: 'commercial',
          createdAt: '11:00',
          messages: [{ id: 'm2', role: 'user' as const, content: 'Dados confidenciais B' }],
        },
      ],
      activeThreadId: 'thread-b',
      catalogTitle: 'Catálogo Privado B',
      totalPages: 8,
    };

    saveStoredProjectSession('shared-catalog-id', sessionA, 101);
    saveStoredProjectSession('shared-catalog-id', sessionB, 202);

    const loadedA = getStoredProjectSession('shared-catalog-id', 101);
    const loadedB = getStoredProjectSession('shared-catalog-id', 202);

    expect(loadedA?.catalogTitle).toBe('Catálogo Privado A');
    expect(loadedA?.threads[0].messages[0].content).toBe('Dados confidenciais A');

    expect(loadedB?.catalogTitle).toBe('Catálogo Privado B');
    expect(loadedB?.threads[0].messages[0].content).toBe('Dados confidenciais B');
  });

  it('automatically resets in-memory studio state when switching users via setActiveUserId', () => {
    const store = useStudioStore.getState();

    // Usuário 101 entra e define estado ativo
    store.setActiveUserId(101);
    useStudioStore.setState({
      hasStartedSession: true,
      activeCatalogId: 'cat-active-101',
      catalogTitle: 'Catálogo do Usuário 101',
      messages: [{ id: 'm1', role: 'user', content: 'Minha conversa' }],
    });

    expect(useStudioStore.getState().hasStartedSession).toBe(true);
    expect(useStudioStore.getState().catalogTitle).toBe('Catálogo do Usuário 101');

    // Usuário 202 entra -> o store deve detectar troca de usuário e limpar todo o estado residual
    store.setActiveUserId(202);

    const stateAfterSwitch = useStudioStore.getState();
    expect(stateAfterSwitch.activeUserId).toBe(202);
    expect(stateAfterSwitch.hasStartedSession).toBe(false);
    expect(stateAfterSwitch.activeCatalogId).toBeNull();
    expect(stateAfterSwitch.catalogTitle).toBe('Novo Catálogo');
    expect(stateAfterSwitch.messages).toEqual([]);
  });

  it('clears studio state on auth logout', async () => {
    useStudioStore.setState({
      activeUserId: 101,
      hasStartedSession: true,
      activeCatalogId: 'cat-101',
      catalogTitle: 'Projeto Antes do Logout',
    });

    await useAuthStore.getState().logout();

    const state = useStudioStore.getState();
    expect(state.activeUserId).toBeNull();
    expect(state.hasStartedSession).toBe(false);
    expect(state.activeCatalogId).toBeNull();
    expect(state.catalogTitle).toBe('Novo Catálogo');
  });
});
