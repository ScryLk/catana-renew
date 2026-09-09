import { create } from 'zustand';
import { genId } from '../utils/id';

export interface Asset {
  id: string;
  name: string;
  url: string;
  type: 'image';
  size: number;
  width?: number;
  height?: number;
  uploadedAt: number;
}

interface AssetStore {
  assets: Asset[];
  addAsset: (file: File) => Promise<Asset>;
  addAssetByUrl: (url: string, name: string) => Promise<Asset>;
  removeAsset: (id: string) => void;
  getAsset: (id: string) => Asset | undefined;
  getAssetByUrl: (url: string) => Asset | undefined;
}

export const useAssetStore = create<AssetStore>((set, get) => ({
  assets: [],

  addAsset: async (file: File): Promise<Asset> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const url = e.target?.result as string;
        const img = new Image();

        img.onload = () => {
          const asset: Asset = {
            id: genId('asset'),
            name: file.name,
            url: url,
            type: 'image',
            size: file.size,
            width: img.width,
            height: img.height,
            uploadedAt: Date.now(),
          };

          set((state) => ({
            assets: [...state.assets, asset],
          }));

          resolve(asset);
        };

        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };

        img.src = url;
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsDataURL(file);
    });
  },

  addAssetByUrl: async (url: string, name: string): Promise<Asset> => {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        const asset: Asset = {
          id: genId('asset'),
          name: name,
          url: url,
          type: 'image',
          size: 0, // Tamanho desconhecido para URL
          width: img.width,
          height: img.height,
          uploadedAt: Date.now(),
        };

        set((state) => ({
          assets: [...state.assets, asset],
        }));

        resolve(asset);
      };

      img.onerror = () => {
        reject(new Error('Failed to load image from URL'));
      };

      img.src = url;
    });
  },

  removeAsset: (id: string) => {
    set((state) => ({
      assets: state.assets.filter((asset) => asset.id !== id),
    }));
  },

  getAsset: (id: string) => {
    return get().assets.find((asset) => asset.id === id);
  },

  getAssetByUrl: (url: string) => {
    return get().assets.find((asset) => asset.url === url);
  },
}));
