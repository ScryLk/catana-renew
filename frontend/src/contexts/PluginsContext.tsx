import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  icon?: string;
  installed: boolean;
}

interface PluginsContextType {
  plugins: Plugin[];
  installPlugin: (pluginId: string) => void;
  uninstallPlugin: (pluginId: string) => void;
  isPluginInstalled: (pluginId: string) => boolean;
}

const defaultPlugins: Plugin[] = [
  {
    id: 'dipack',
    name: 'DiPack Templates',
    description: 'Adiciona templates e geradores de catálogos exclusivos da DiPack (Açougue, Confeitaria, Festa, Food Service).',
    version: '1.0.0',
    author: 'DiPack',
    installed: false,
  },
];

const PluginsContext = createContext<PluginsContextType | undefined>(undefined);

export const PluginsProvider = ({ children }: { children: ReactNode }) => {
  const [plugins, setPlugins] = useState<Plugin[]>(() => {
    const saved = localStorage.getItem('catana_plugins');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Merge saved state with default plugins to ensure new plugins appear
        return defaultPlugins.map(def => {
          const savedPlugin = parsed.find((p: Plugin) => p.id === def.id);
          return savedPlugin ? { ...def, installed: savedPlugin.installed } : def;
        });
      } catch (e) {
        console.error('Failed to parse plugins from localStorage', e);
        return defaultPlugins;
      }
    }
    return defaultPlugins;
  });

  useEffect(() => {
    localStorage.setItem('catana_plugins', JSON.stringify(plugins));
  }, [plugins]);

  const installPlugin = (pluginId: string) => {
    setPlugins(prev => prev.map(p => p.id === pluginId ? { ...p, installed: true } : p));
  };

  const uninstallPlugin = (pluginId: string) => {
    setPlugins(prev => prev.map(p => p.id === pluginId ? { ...p, installed: false } : p));
  };

  const isPluginInstalled = (pluginId: string) => {
    return plugins.find(p => p.id === pluginId)?.installed ?? false;
  };

  return (
    <PluginsContext.Provider value={{ plugins, installPlugin, uninstallPlugin, isPluginInstalled }}>
      {children}
    </PluginsContext.Provider>
  );
};

export const usePlugins = () => {
  const context = useContext(PluginsContext);
  if (context === undefined) {
    throw new Error('usePlugins must be used within a PluginsProvider');
  }
  return context;
};
