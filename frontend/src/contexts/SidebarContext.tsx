import { createContext, useContext, useState, type ReactNode } from 'react';

interface SidebarContextType {
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(320);

  return (
    <SidebarContext.Provider value={{ sidebarWidth, setSidebarWidth }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebarWidth() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebarWidth must be used within a SidebarProvider');
  }
  return context;
}
