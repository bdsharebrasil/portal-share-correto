import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface VencimentoSyncEvent {
  type: 'update' | 'create' | 'delete';
  entityType: 'crew_license' | 'flight_document' | 'manutencao';
  entityId: string;
  data?: any;
  timestamp: number;
}

interface VencimentosSyncContextType {
  lastUpdate: number;
  triggerUpdate: (event: VencimentoSyncEvent) => void;
  subscribe: (callback: (event: VencimentoSyncEvent) => void) => () => void;
}

const VencimentosSyncContext = createContext<VencimentosSyncContextType | undefined>(undefined);

export function VencimentosSyncProvider({ children }: { children: React.ReactNode }) {
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [listeners, setListeners] = useState<Set<(event: VencimentoSyncEvent) => void>>(new Set());

  const triggerUpdate = useCallback((event: VencimentoSyncEvent) => {
    setLastUpdate(Date.now());
    listeners.forEach(callback => {
      try {
        callback({...event, timestamp: Date.now()});
      } catch (error) {
        console.error('Erro ao chamar listener de sincronização:', error);
      }
    });
  }, [listeners]);

  const subscribe = useCallback((callback: (event: VencimentoSyncEvent) => void) => {
    setListeners(prev => new Set([...prev, callback]));
    
    return () => {
      setListeners(prev => {
        const newSet = new Set(prev);
        newSet.delete(callback);
        return newSet;
      });
    };
  }, []);

  // Configurar real-time listeners do Supabase para sincronização automática
  useEffect(() => {
    const crewLicenseChannel = supabase
      .channel('crew_license_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crew_licenses' },
        (payload: any) => {
          triggerUpdate({
            type: payload.eventType === 'INSERT' ? 'create' : payload.eventType === 'UPDATE' ? 'update' : 'delete',
            entityType: 'crew_license',
            entityId: payload.new?.id || payload.old?.id,
            data: payload.new || payload.old,
            timestamp: Date.now()
          });
        }
      )
      .subscribe();

    const flightDocumentChannel = supabase
      .channel('flight_document_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'flight_documents' },
        (payload: any) => {
          triggerUpdate({
            type: payload.eventType === 'INSERT' ? 'create' : payload.eventType === 'UPDATE' ? 'update' : 'delete',
            entityType: 'flight_document',
            entityId: payload.new?.id || payload.old?.id,
            data: payload.new || payload.old,
            timestamp: Date.now()
          });
        }
      )
      .subscribe();

    const manutencaoChannel = supabase
      .channel('manutencao_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'manutencoes' },
        (payload: any) => {
          triggerUpdate({
            type: payload.eventType === 'INSERT' ? 'create' : payload.eventType === 'UPDATE' ? 'update' : 'delete',
            entityType: 'manutencao',
            entityId: payload.new?.id || payload.old?.id,
            data: payload.new || payload.old,
            timestamp: Date.now()
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(crewLicenseChannel);
      supabase.removeChannel(flightDocumentChannel);
      supabase.removeChannel(manutencaoChannel);
    };
  }, [triggerUpdate]);

  return (
    <VencimentosSyncContext.Provider value={{ lastUpdate, triggerUpdate, subscribe }}>
      {children}
    </VencimentosSyncContext.Provider>
  );
}

export function useVencimentosSync() {
  const context = useContext(VencimentosSyncContext);
  if (!context) {
    throw new Error('useVencimentosSync deve ser usado dentro de VencimentosSyncProvider');
  }
  return context;
}
