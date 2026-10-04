import { createContext, useContext } from 'react';

interface StudioResponsiveState {
  pane: 'assistant' | 'catalog';
  setPane: (pane: 'assistant' | 'catalog') => void;
  pageNumber: number;
  phoneZoom: number;
  setPhoneZoom: (zoom: number) => void;
  selectPage: (page: number) => void;
}
export const StudioResponsiveContext = createContext<StudioResponsiveState>({
  pane: 'assistant', setPane: () => {}, pageNumber: 1, selectPage: () => {}, phoneZoom: 100, setPhoneZoom: () => {},
});
export const useStudioResponsive = () => useContext(StudioResponsiveContext);
