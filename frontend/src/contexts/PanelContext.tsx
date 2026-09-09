import { createContext, useContext, useState, type FC, type ReactNode } from 'react';

interface PanelState {
  components: boolean;
  layers: boolean;
  groups: boolean;
}

interface PanelContextType {
  minimizedPanels: PanelState;
  togglePanel: (panel: keyof PanelState) => void;
}

const PanelContext = createContext<PanelContextType | undefined>(undefined);

export const usePanelContext = () => {
  const context = useContext(PanelContext);
  if (!context) {
    throw new Error('usePanelContext must be used within PanelProvider');
  }
  return context;
};

interface PanelProviderProps {
  children: ReactNode;
}

export const PanelProvider: FC<PanelProviderProps> = ({ children }) => {
  const [minimizedPanels, setMinimizedPanels] = useState<PanelState>({
    components: false,
    layers: false,
    groups: false,
  });

  const togglePanel = (panel: keyof PanelState) => {
    setMinimizedPanels((prev) => ({
      ...prev,
      [panel]: !prev[panel],
    }));
  };

  return (
    <PanelContext.Provider value={{ minimizedPanels, togglePanel }}>
      {children}
    </PanelContext.Provider>
  );
};
