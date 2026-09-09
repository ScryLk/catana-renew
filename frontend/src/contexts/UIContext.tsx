import { createContext, useContext, useState, type FC, type ReactNode } from 'react';

interface UIContextType {
  uiVisible: boolean;
  commentsVisible: boolean;
  toggleUI: () => void;
  toggleComments: () => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const useUIContext = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUIContext must be used within UIProvider');
  }
  return context;
};

interface UIProviderProps {
  children: ReactNode;
}

export const UIProvider: FC<UIProviderProps> = ({ children }) => {
  const [uiVisible, setUIVisible] = useState(true);
  const [commentsVisible, setCommentsVisible] = useState(false);

  const toggleUI = () => {
    setUIVisible((prev) => !prev);
  };

  const toggleComments = () => {
    setCommentsVisible((prev) => !prev);
  };

  return (
    <UIContext.Provider value={{ uiVisible, commentsVisible, toggleUI, toggleComments }}>
      {children}
    </UIContext.Provider>
  );
};
