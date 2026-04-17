import React, { createContext, useContext, ReactNode } from 'react';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';

interface InactivityContextType {
  setOnCall: (onCall: boolean) => void;
}

const InactivityContext = createContext<InactivityContextType>({ setOnCall: () => {} });

export function InactivityProvider({ children }: { children: ReactNode }) {
  const { setOnCall } = useInactivityLogout();

  return (
    <InactivityContext.Provider value={{ setOnCall }}>
      {children}
    </InactivityContext.Provider>
  );
}

export function useInactivity() {
  return useContext(InactivityContext);
}
