import React from "react";
import { X, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface ActiveFilter {
  id: string;
  label: string;
  value: string;
  category: string;
}

interface ActiveFiltersChipsProps {
  filters: ActiveFilter[];
  onRemoveFilter: (filterId: string) => void;
  onClearAll: () => void;
  totalResults?: number;
}

export const ActiveFiltersChips = ({
  filters,
  onRemoveFilter,
  onClearAll,
  totalResults,
}: ActiveFiltersChipsProps) => {
  if (filters.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="space-y-3 p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl border border-primary/20"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            Filtros ativos
          </span>
          {totalResults !== undefined && (
            <span className="text-xs text-foreground/60 ml-2">
              {totalResults} resultado{totalResults !== 1 ? "s" : ""} encontrado{totalResults !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {filters.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="text-xs h-6 px-2 text-foreground/70 hover:text-foreground hover:bg-primary/20"
          >
            Limpar todos
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <AnimatePresence mode="popLayout">
          {filters.map((filter) => (
            <motion.div
              key={filter.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <Badge
                variant="secondary"
                className="gap-2 pl-3 pr-1 py-1.5 bg-primary/20 text-primary border-primary/30 hover:bg-primary/30 transition-colors"
              >
                <span className="text-xs font-medium">
                  {filter.label}: <span className="font-semibold">{filter.value}</span>
                </span>
                <button
                  onClick={() => onRemoveFilter(filter.id)}
                  className="inline-flex items-center justify-center rounded hover:bg-primary/40 transition-colors p-0.5"
                  aria-label={`Remover filtro ${filter.label}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
