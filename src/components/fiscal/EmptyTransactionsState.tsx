import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface EmptyTransactionsStateProps {
  onCreateNew?: () => void;
  hasFiltersActive?: boolean;
}

export const EmptyTransactionsState = ({
  onCreateNew,
  hasFiltersActive = false,
}: EmptyTransactionsStateProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-4"
    >
      {/* SVG Illustration */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          className="text-primary/40"
          fill="none"
          stroke="currentColor"
        >
          <rect x="15" y="20" width="90" height="60" rx="4" strokeWidth="2" />
          <path d="M15 35h90" strokeWidth="1.5" />
          <line x1="25" y1="45" x2="45" y2="45" strokeWidth="1.5" />
          <line x1="25" y1="55" x2="45" y2="55" strokeWidth="1.5" />
          <line x1="75" y1="45" x2="95" y2="45" strokeWidth="1.5" />
          <line x1="75" y1="55" x2="95" y2="55" strokeWidth="1.5" />
          
          <circle cx="75" cy="90" r="20" strokeWidth="2" />
          <path d="M75 80v20M65 90h20" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </motion.div>

      {/* Text Content */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center space-y-3 mb-6"
      >
        <h3 className="text-2xl font-bold text-foreground">
          {hasFiltersActive
            ? "Nenhuma transação encontrada"
            : "Nenhuma transação ainda"}
        </h3>
        <p className="text-foreground/60 max-w-sm">
          {hasFiltersActive
            ? "Tente ajustar os filtros ou limpar a busca para ver as transações disponíveis."
            : "Comece adicionando sua primeira movimentação bancária para gerenciar seu fluxo de caixa."}
        </p>
      </motion.div>

      {/* Action Button */}
      {!hasFiltersActive && onCreateNew && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Button
            onClick={onCreateNew}
            className="gap-2 bg-gradient-to-r from-primary/90 to-primary/80 hover:from-primary hover:to-primary/90"
          >
            <Plus className="w-4 h-4" />
            Nova Movimentação
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
};
