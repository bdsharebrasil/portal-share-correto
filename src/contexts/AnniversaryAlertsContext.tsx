import { createContext, useContext, ReactNode } from 'react';
import { AnniversaryAlertsContainer } from '@/components/alerts/AnniversaryAlertsContainer';

interface AnniversaryAlertsContextType {
  isReady: boolean;
}

const AnniversaryAlertsContext = createContext<AnniversaryAlertsContextType>({
  isReady: true,
});

export function AnniversaryAlertsProvider({ children }: { children: ReactNode }) {
  return (
    <AnniversaryAlertsContext.Provider value={{ isReady: true }}>
      <AnniversaryAlertsContainer />
      {children}
    </AnniversaryAlertsContext.Provider>
  );
}

export function useAnniversaryAlertsProvider() {
  const context = useContext(AnniversaryAlertsContext);
  if (!context) {
    throw new Error(
      'useAnniversaryAlertsProvider must be used within AnniversaryAlertsProvider'
    );
  }
  return context;
}
