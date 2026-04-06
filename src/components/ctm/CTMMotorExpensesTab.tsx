import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fromUntyped } from "@/lib/supabase-helpers";
import { MotorExpensesCard } from "./MotorExpensesCard";
import { MotorExpenseForm } from "./MotorExpenseForm";
import { Zap } from "lucide-react";
import type { MotorExpense } from "@/types/maintenance";
import { toast } from "sonner";

interface Props {
  aircraftId: string;
}

export function CTMMotorExpensesTab({ aircraftId }: Props) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["motor-expenses", aircraftId],
    queryFn: async () => {
      const { data, error } = await fromUntyped("motor_expenses")
        .select("*")
        .eq("id_aeronave", aircraftId)
        .order("data", { ascending: false });
      if (error) throw error;
      return (data || []) as MotorExpense[];
    },
    enabled: !!aircraftId,
  });

  const handleDelete = async (id: string) => {
    const { error } = await fromUntyped("motor_expenses").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao deletar despesa");
      return;
    }
    toast.success("Despesa deletada");
    queryClient.invalidateQueries({ queryKey: ["motor-expenses", aircraftId] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Zap className="h-8 w-8 text-primary animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <MotorExpensesCard
        items={expenses}
        onNew={() => setShowForm(true)}
        onDelete={handleDelete}
      />
      {showForm && (
        <MotorExpenseForm
          aircraftId={aircraftId}
          onCancel={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ["motor-expenses", aircraftId] });
          }}
        />
      )}
    </div>
  );
}
