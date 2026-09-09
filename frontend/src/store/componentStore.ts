import { create } from 'zustand';
import { genId } from '../utils/id';
import type { CatalogElement } from '../types/editor';

export interface CustomComponent {
  id: string;
  name: string;
  category: 'header' | 'footer' | 'section' | 'card' | 'other';
  thumbnail?: string;
  elements: Omit<CatalogElement, 'id' | 'pageId'>[];
  createdAt: number;
  updatedAt: number;
}

interface ComponentStore {
  components: CustomComponent[];
  addComponent: (component: Omit<CustomComponent, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateComponent: (id: string, updates: Partial<CustomComponent>) => void;
  deleteComponent: (id: string) => void;
  getComponentsByCategory: (category: CustomComponent['category']) => CustomComponent[];
}

export const useComponentStore = create<ComponentStore>((set, get) => ({
  components: [],

  addComponent: (component) => {
    const newComponent: CustomComponent = {
      ...component,
      id: genId('component'),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    set((state) => ({
      components: [...state.components, newComponent],
    }));
  },

  updateComponent: (id, updates) => {
    set((state) => ({
      components: state.components.map((comp) =>
        comp.id === id
          ? { ...comp, ...updates, updatedAt: Date.now() }
          : comp
      ),
    }));
  },

  deleteComponent: (id) => {
    set((state) => ({
      components: state.components.filter((comp) => comp.id !== id),
    }));
  },

  getComponentsByCategory: (category) => {
    return get().components.filter((comp) => comp.category === category);
  },
}));
