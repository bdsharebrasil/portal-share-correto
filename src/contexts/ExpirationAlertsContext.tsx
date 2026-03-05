import { createContext, useContext, ReactNode } from 'react';
import { ExpirationAlertsContainer } from '@/components/alerts/ExpirationAlertsContainer';

interface ExpirationAlertsContextType {
  isReady: boolean;
}

const ExpirationAlertsContext = createContext<ExpirationAlertsContextType>({
  isReady: true,
});

export function ExpirationAlertsProvider({ children }: { children: ReactNode }) {
  return (
    <ExpirationAlertsContext.Provider value={{ isReady: true }}>
      <ExpirationAlertsContainer />
      {children}
    </ExpirationAlertsContext.Provider>
  );
}

export function useExpirationAlertsProvider() {
  const context = useContext(ExpirationAlertsContext);
  if (!context) {
    throw new Error(
      'useExpirationAlertsProvider must be used within ExpirationAlertsProvider'
    );
  }
  return context;
}
