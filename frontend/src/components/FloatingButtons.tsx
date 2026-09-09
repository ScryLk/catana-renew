import { type FC } from 'react';
import { FiLayers } from 'react-icons/fi';
import { usePanelContext } from '../contexts/PanelContext';

export const FloatingButtons: FC = () => {
  // Try to get panel context, but don't throw if not available
  let panelContext;
  try {
    panelContext = usePanelContext();
  } catch (e) {
    // Context not available, that's okay
    panelContext = null;
  }

  return (
    <div className="fixed bottom-8 right-8 flex flex-col gap-4 z-50">
      {/* Components Button - only show if PanelContext is available */}
      {panelContext && (
        <button
          onClick={() => panelContext.togglePanel('layers')}
          className="bg-gradient-to-br from-primary-500 to-primary-600 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 hover:scale-105 hover:shadow-2xl transition-all border-2 border-primary-400"
          title="Abrir Componentes"
        >
          <FiLayers className="w-5 h-5" />
          <span className="font-semibold text-sm">Componentes</span>
        </button>
      )}

      {/* Help Button */}
      <button
        className="w-14 h-14 bg-white rounded-full shadow-lg flex items-center justify-center text-2xl hover:scale-110 transition-transform border border-gray-200"
        title="Ajuda"
      >
        ❓
      </button>

      {/* Main FAB */}
      <button
        className="w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-500 rounded-full shadow-xl flex items-center justify-center text-white text-3xl hover:scale-110 hover:shadow-2xl transition-all"
        title="Nova ação"
      >
        ➕
      </button>
    </div>
  );
};
