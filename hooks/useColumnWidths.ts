import { useState, useEffect, useCallback } from 'react';

interface ColumnWidth {
  [key: string]: number;
}

export function useColumnWidths(tableId: string, defaultWidths: ColumnWidth) {
  const [columnWidths, setColumnWidths] = useState<ColumnWidth>(defaultWidths);
  const storageKey = `column-widths-${tableId}`;

  // Carregar larguras salvas do localStorage
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setColumnWidths(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error('Erro ao carregar larguras das colunas:', e);
      }
    }
  }, [tableId, storageKey]);

  // Salvar largura quando mudar
  const setColumnWidth = useCallback((columnId: string, width: number) => {
    setColumnWidths(prev => {
      const newWidths = { ...prev, [columnId]: Math.max(60, width) }; // Mínimo de 60px
      localStorage.setItem(storageKey, JSON.stringify(newWidths));
      return newWidths;
    });
  }, [storageKey]);

  // Resetar para valores padrão
  const resetWidths = useCallback(() => {
    setColumnWidths(defaultWidths);
    localStorage.removeItem(storageKey);
  }, [defaultWidths, storageKey]);

  return {
    columnWidths,
    setColumnWidth,
    resetWidths,
  };
}
