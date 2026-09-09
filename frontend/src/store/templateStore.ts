import { create } from 'zustand';
import { genId } from '../utils/id';
import { persist } from 'zustand/middleware';
import type { CatalogPage } from '../types/editor';

export interface SavedTemplate {
  id: string;
  userId: string; // Link to user
  name: string;
  thumbnail?: string;
  elements: CatalogPage['elements'];
  createdAt: number;
}

interface TemplateStore {
  templates: SavedTemplate[];
  saveTemplate: (page: CatalogPage, name: string, userId: string) => void;
  deleteTemplate: (id: string) => void;
  loadTemplate: (id: string) => SavedTemplate | undefined;
  getTemplatesByUser: (userId: string) => SavedTemplate[];
}

export const useTemplateStore = create<TemplateStore>()(
  persist(
    (set, get) => ({
      templates: [],

      saveTemplate: (page, name, userId) => {
        const newTemplate: SavedTemplate = {
          id: genId('template'),
          userId,
          name: name || `Template ${new Date().toLocaleDateString()}`,
          elements: page.elements,
          createdAt: Date.now(),
        };

        set((state) => ({
          templates: [newTemplate, ...state.templates],
        }));
      },

      deleteTemplate: (id) => {
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== id),
        }));
      },

      loadTemplate: (id) => {
        return get().templates.find((t) => t.id === id);
      },

      getTemplatesByUser: (userId) => {
        return get().templates.filter((t) => t.userId === userId);
      }
    }),
    {
      name: 'catana-templates-storage',
    }
  )
);
