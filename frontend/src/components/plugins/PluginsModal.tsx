import { type FC } from 'react';
import { X, Download, Package } from 'lucide-react';
import { usePlugins } from '../../contexts/PluginsContext';
import { Button } from '../ui/button';

interface PluginsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PluginsModal: FC<PluginsModalProps> = ({ isOpen, onClose }) => {
  const { plugins, installPlugin, uninstallPlugin } = usePlugins();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200 dark:border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <Package className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Loja de Plugins</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Gerencie extensões para o seu editor</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <div className="grid gap-4">
            {plugins.map((plugin) => (
              <div
                key={plugin.id}
                className="flex items-start gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-primary-500 dark:hover:border-primary-500 transition-colors bg-white dark:bg-gray-800/50"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Package className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                      {plugin.name}
                    </h3>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                      v{plugin.version}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                    {plugin.description}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span>Por {plugin.author}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0">
                  {plugin.installed ? (
                    <div className="flex flex-col gap-2">
                      <Button
                        disabled
                        className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/50 opacity-100 cursor-default"
                      >
                        <Package className="w-4 h-4 mr-2" />
                        Instalado
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => uninstallPlugin(plugin.id)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 h-8 text-xs"
                      >
                        Remover
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={() => installPlugin(plugin.id)}
                      className="bg-primary-600 hover:bg-primary-700 text-white"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Instalar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
};
