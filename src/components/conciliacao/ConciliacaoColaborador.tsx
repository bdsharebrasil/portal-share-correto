import { useState, useEffect } from "react";
import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, Clock, User, Mail, Check, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getShortUserId, getIdBadgeColor } from "@/lib/user-id";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { StatusUpdateDialog } from "./StatusUpdateDialog";
import { MonthSelector } from "./MonthSelector";
import { syncBankReconciliationToFinancial } from "@/services/financialSyncClient";

// --- Interfaces ---
interface ColaboradorReconciliation {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: string;
  category: string | null;
  receiver_id?: string | null;
  prazo_pagamento: string | null;
  criado_por?: string;
  user_profiles?: { full_name: string } | null;
}

interface UserProfile {
  id: string;
  full_name: string;
}

// --- Schemas ---
const newReconciliationSchema = z.object({
  date: z.string().min(1, "Data é obrigatória"),
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.string().min(1, "Valor é obrigatório"),
  status: z.enum(["pendente", "enviado", "pago"]),
  receiverId: z.string().min(1, "Colaborador é obrigatório"),
});

type NewReconciliationFormValues = z.infer<typeof newReconciliationSchema>;

export function ConciliacaoColaborador() {
  const [colaboradorData, setColaboradorData] = useState<ColaboradorReconciliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const { toast } = useToast();
  const { roles } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showNewReconciliationForm, setShowNewReconciliationForm] = useState(false);
  const [openStatusDialog, setOpenStatusDialog] = useState(false);
  const [selectedReconciliation, setSelectedReconciliation] = useState<ColaboradorReconciliation | null>(null);

  const canApprovePaid = roles.some(role =>
    ['admin', 'gestor_master', 'financeiro_master'].includes(role)
  );

  useEffect(() => {
    fetchReconciliations();
    loadUsers();
  }, [currentDate]);

  const loadUsers = async () => {
    const { data } = await supabase
      .from("user_profiles")
      .select("id, full_name, employment_status")
      .eq("employment_status", "ativo" as any)
      .order("full_name");

    setUsers((data || []) as any);
  };

  const fetchReconciliations = async () => {
    try {
      setLoading(true);

      const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const { data, error } = await supabase
        .from('bank_reconciliations')
        .select(`
          *,
          user_profiles:receiver_id (full_name)
        `)
        .eq('type', 'colaborador' as any)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) throw error;

      setColaboradorData(data as any);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <div className="space-y-6">
      <MonthSelector
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        isCurrentMonth={true}
      />

      <Card>
        <CardHeader>
          <CardTitle>Conciliação com Colaborador</CardTitle>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Colaborador</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {colaboradorData.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{format(new Date(item.date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>
                    <Badge className={getIdBadgeColor(getShortUserId(item.criado_por || ''))}>
                      {getShortUserId(item.criado_por || '')}
                    </Badge>
                  </TableCell>
                  <TableCell>{item.user_profiles?.full_name}</TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell>{formatCurrency(Number(item.amount))}</TableCell>
                  <TableCell>
                    {item.prazo_pagamento ? 
                      format(new Date(item.prazo_pagamento), 'dd/MM/yyyy') 
                      : "-"
                    }
                  </TableCell>
                  <TableCell>{item.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedReconciliation && (
        <StatusUpdateDialog
          reconciliation={selectedReconciliation}
          open={openStatusDialog}
          onOpenChange={setOpenStatusDialog}
          onUpdate={fetchReconciliations}
        />
      )}
    </div>
  );
}

// --- Editor de Prazo ---
interface PrazoPagamentoEditorProps {
  reconciliation: ColaboradorReconciliation;
  onSave: () => void;
}

function PrazoPagamentoEditor({ reconciliation, onSave }: PrazoPagamentoEditorProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    reconciliation.prazo_pagamento ? new Date(reconciliation.prazo_pagamento) : undefined
  );
  const { toast } = useToast();

  const handleSave = async () => {
    if (!selectedDate) return;

    const dateStr = format(selectedDate, "yyyy-MM-dd");

    const { error } = await supabase
      .from('bank_reconciliations')
      .update({ prazo_pagamento: dateStr } as any)
      .eq('id', reconciliation.id);

    if (error) {
      toast({ title: "Erro", description: "Erro ao atualizar prazo.", variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Prazo atualizado." });
      onSave();
    }
  };

  return (
    <div className="flex gap-2">
      <Input
        type="date"
        value={selectedDate ? format(selectedDate, "yyyy-MM-dd") : ""}
        onChange={(e) =>
          setSelectedDate(e.target.value ? new Date(e.target.value) : undefined)
        }
      />
      <Button size="sm" onClick={handleSave}>
        <Check className="h-4 w-4" />
      </Button>
    </div>
  );
}