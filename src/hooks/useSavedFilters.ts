import { useState, useCallback, useEffect } from "react";

export interface SavedFilter {
  id: string;
  name: string;
  filters: Record<string, any>;
  createdAt: string;
}

const STORAGE_KEY = "fiscal_saved_filters";

export function useSavedFilters() {
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load filters from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSavedFilters(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Error loading saved filters:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save a new filter preset
  const saveFilter = useCallback(
    (name: string, filters: Record<string, any>) => {
      const newFilter: SavedFilter = {
        id: Date.now().toString(),
        name,
        filters,
        createdAt: new Date().toISOString(),
      };

      const updated = [...savedFilters, newFilter];
      setSavedFilters(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return newFilter;
    },
    [savedFilters]
  );

  // Delete a saved filter
  const deleteFilter = useCallback(
    (id: string) => {
      const updated = savedFilters.filter((f) => f.id !== id);
      setSavedFilters(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    },
    [savedFilters]
  );

  // Update a saved filter
  const updateFilter = useCallback(
    (id: string, name: string, filters: Record<string, any>) => {
      const updated = savedFilters.map((f) =>
        f.id === id
          ? {
              ...f,
              name,
              filters,
              createdAt: new Date().toISOString(),
            }
          : f
      );
      setSavedFilters(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    },
    [savedFilters]
  );

  return {
    savedFilters,
    isLoading,
    saveFilter,
    deleteFilter,
    updateFilter,
  };
}
