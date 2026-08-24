// @ts-nocheck
import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Upload, Check, X, Calendar, ChevronDown, CalendarRange } from "lucide-react";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import { useUserRole } from "@/hooks/useUserRole";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { parseDateValue } from "@/utils/timeClockDates";

interface TimeEntry {
  id: string;
  user_id: string;
  data_entrada: string;
  entrada_hora: string | null;
  inicio_almoco: string | null;
  fim_almoco: string | null;
  saida_hora: string | null;
  horas_totais: number | null;
  status: string;
  absence_reason: string | null;
  absence_document_path: string | null;
  ausencia_aprovada: boolean | null;
  ausencia_aprovada_por: string | null;
  ausencia_aprovada_em: string | null;
  motivo_rejeicao_ausencia: string | null;
  user_profiles?: {
    full_name: string;
  } | null;
}

interface UserProfile {
  id: string;
  full_name: string;
}

interface TimeEntriesTableProps {
  viewAll?: boolean;
}

export function TimeEntriesTable({ viewAll = false }: TimeEntriesTableProps) {
  const { isAdmin, isGestorMaster } = useUserRole();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);
  const [absenceReason, setAbsenceReason] = useState("");
  const [absenceFile, setAbsenceFile] = useState<File | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [filterMonth, setFilterMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [openCombobox, setOpenCombobox] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    return users.filter(user =>
      user.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, searchQuery]);

  useEffect(() => {
    if (viewAll && (isAdmin || isGestorMaster)) {
      loadUsers();
    }
  }, [viewAll, isAdmin, isGestorMaster]);

  useEffect(() => {
    setLoading(true);
    loadEntries();
  }, [viewAll, filterMonth, selectedUserId, dateRange?.from, dateRange?.to]);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('lancamento_ponto' as any)
        .select('user_id');

      if (error) throw error;

      const userIds = Array.from(
        new Set((data ?? []).map((entry: any) => entry.user_id).filter(Boolean))
      );

      if (userIds.length === 0) {
        setUsers([]);
        return;
      }

      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .in('id', userIds)
        .order('full_name', { ascending: true });

      if (profileError) throw profileError;
      setUsers(profiles as UserProfile[] || []);
    } catch (error: any) {
      console.error('Error loading users:', error);
    }
  };

  const loadEntries = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [year, month] = filterMonth.split('-').map(Number);
      let startDate = startOfMonth(new Date(year, month - 1));
      let endDate = endOfMonth(new Date(year, month - 1));

      if (dateRange?.from) {
        startDate = dateRange.from;
        endDate = dateRange.to ?? dateRange.from;
      }

      let query = supabase
        .from('lancamento_ponto' as any)
        .select('*')
        .gte('data_entrada', format(startDate, 'yyyy-MM-dd'))
        .lte('data_entrada', format(endDate, 'yyyy-MM-dd'))
        .order('data_entrada', { ascending: false });

      if (!viewAll || (!isAdmin && !isGestorMaster)) {
        query = query.eq('user_id', user.id);
      } else if (selectedUserId) {
        query = query.eq('user_id', selectedUserId);
      }

      const { data, error } = await query;

      if (error) throw error;

      let entriesData = data as any || [];

      // Se viewAll e tem múltiplos usuários, buscar os nomes
      if (viewAll && !selectedUserId && entriesData.length > 0) {
        const userIdSet = new Set<string>();
        entriesData.forEach((e: any) => {
          if (e.user_id && typeof e.user_id === 'string') {
            userIdSet.add(e.user_id);
          }
        });
        const userIds = Array.from(userIdSet);
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, full_name')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
        entriesData = entriesData.map((entry: any) => ({
          ...entry,
          user_profiles: {
            full_name: profileMap.get(entry.user_id) || 'Desconhecido'
          }
        }));
      } else if (selectedUserId && entriesData.length > 0) {
        // Se um usuário foi selecionado, buscar seu nome
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id, full_name')
          .eq('id', selectedUserId)
          .single();

        const fullName = profile?.full_name || 'Desconhecido';
        entriesData = entriesData.map((entry: any) => ({
          ...entry,
          user_profiles: {
            full_name: fullName
          }
        }));
      }

      setEntries(entriesData);
    } catch (error: any) {
      console.error('Error loading entries:', error);
      toast.error('Erro ao carregar registros');
    } finally {
      setLoading(false);
    }
  };

  const handleJustifyAbsence = async () => {
    if (!selectedEntry || !absenceReason.trim()) {
      toast.error('Preencha a justificativa');
      return;
    }

    try {
      let documentPath = null;

      if (absenceFile) {
        const filePath = `absence-docs/${selectedEntry.user_id}/${Date.now()}-${absenceFile.nome}`;
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, absenceFile);

        if (uploadError) throw uploadError;
        documentPath = filePath;
      }

      const { error } = await supabase
        .from('lancamento_ponto' as any)
        .update({
          absence_reason: absenceReason,
          absence_document_path: documentPath,
          status: 'falta',
          ausencia_aprovada: null
        })
        .eq('id', selectedEntry.id);

      if (error) throw error;

      toast.success('Justificativa enviada para aprovação');
      setSelectedEntry(null);
      setAbsenceReason("");
      setAbsenceFile(null);
      await loadEntries();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao justificar falta');
    }
  };

  const handleApproveAbsence = async (entryId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('lancamento_ponto' as any)
        .update({
          ausencia_aprovada: true,
          ausencia_aprovada_por: user.id,
          ausencia_aprovada_em: new Date().toISOString()
        })
        .eq('id', entryId);

      if (error) throw error;

      toast.success('Justificativa aprovada');
      await loadEntries();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao aprovar justificativa');
    }
  };

  const handleRejectAbsence = async (entryId: string) => {
    if (!rejectionReason.trim()) {
      toast.error('Informe o motivo da rejeição');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('lancamento_ponto' as any)
        .update({
          ausencia_aprovada: false,
          ausencia_aprovada_por: user.id,
          ausencia_aprovada_em: new Date().toISOString(),
          motivo_rejeicao_ausencia: rejectionReason
        })
        .eq('id', entryId);

      if (error) throw error;

      toast.success('Justificativa rejeitada');
      setRejectionReason("");
      await loadEntries();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao rejeitar justificativa');
    }
  };

  const getStatusBadge = (entry: TimeEntry) => {
    if (entry.status === 'falta' && entry.absence_reason) {
      if (entry.ausencia_aprovada === true) {
        return <Badge className="bg-green-600">Falta Justificada</Badge>;
      } else if (entry.ausencia_aprovada === false) {
        return <Badge className="bg-red-600">Justificativa Rejeitada</Badge>;
      } else {
        return <Badge className="bg-yellow-600">Aguardando Aprovação</Badge>;
      }
    }

    switch (entry.status) {
      case 'concluido':
        return <Badge className="bg-green-600">Concluído</Badge>;
      case 'em_andamento':
        return <Badge className="bg-blue-600">Em Andamento</Badge>;
      case 'falta':
        return <Badge className="bg-red-600">Falta</Badge>;
      default:
        return <Badge>{entry.status}</Badge>;
    }
  };

  if (loading) {
    return <div className="text-center py-4">Carregando...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle>
              {viewAll ? 'Registro de Todos os Colaboradores' : 'Meus Registros de Ponto'}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="month"
                value={filterMonth}
                onChange={(e) => {
                  setDateRange(undefined);
                  setFilterMonth(e.target.value);
                }}
                disabled={!!dateRange?.from}
                className="w-[153px] rounded-[14px] overflow-hidden"
                style={{ padding: "8px 12px 8px 9px", lineHeight: "21px" }}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="rounded-[14px] justify-start font-normal">
                    <CalendarRange className="mr-2 h-4 w-4" />
                    {dateRange?.from
                      ? dateRange.to
                        ? `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`
                        : format(dateRange.from, "dd/MM/yyyy")
                      : "Período personalizado"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[9999]" align="end">
                  <CalendarPicker
                    mode="range"
                    locale={ptBR}
                    numberOfMonths={2}
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    className="pointer-events-auto"
                  />
                  {dateRange?.from && (
                    <div className="flex justify-end border-t border-border p-2">
                      <Button variant="ghost" size="sm" onClick={() => setDateRange(undefined)}>
                        Limpar período
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {viewAll && (isAdmin || isGestorMaster) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="colaborador-select">Selecione o Colaborador</Label>
                {selectedUserId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedUserId("");
                      setSearchQuery("");
                    }}
                  >
                    Limpar seleção
                  </Button>
                )}
              </div>
              <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openCombobox}
                    className="w-full justify-between"
                  >
                    {selectedUserId
                      ? users.find((user) => user.id === selectedUserId)?.full_name
                      : "Selecione um colaborador..."}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Pesquisar colaborador..."
                      value={searchQuery}
                      onValueChange={setSearchQuery}
                    />
                    <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                    <CommandGroup>
                      <CommandList>
                        {filteredUsers.map((user) => (
                          <CommandItem
                            key={user.id}
                            value={user.id}
                            onSelect={(currentValue) => {
                              setSelectedUserId(currentValue === selectedUserId ? "" : currentValue);
                              setOpenCombobox(false);
                              setSearchQuery("");
                            }}
                          >
                            <div
                              className={cn(
                                "mr-2 h-4 w-4 border border-primary rounded",
                                selectedUserId === user.id
                                  ? "bg-primary text-primary-foreground"
                                  : "opacity-50 [&_svg]:invisible"
                              )}
                            >
                              ✓
                            </div>
                            {user.full_name}
                          </CommandItem>
                        ))}
                      </CommandList>
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {viewAll && !selectedUserId ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Selecione um colaborador para visualizar o registro de ponto</p>
          </div>
        ) : (
          <Table>
          <TableHeader>
            <TableRow>
              {viewAll && !selectedUserId && <TableHead>Colaborador</TableHead>}
              <TableHead>Data</TableHead>
              <TableHead>Entrada</TableHead>
              <TableHead>Almoço</TableHead>
              <TableHead>Saída</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                {viewAll && !selectedUserId && (
                  <TableCell>{entry.user_profiles?.full_name || '-'}</TableCell>
                )}
                <TableCell>
                  {format(parseDateValue(entry.data_entrada) ?? new Date(), 'dd/MM/yyyy', { locale: ptBR })}
                </TableCell>
                <TableCell>
                  {entry.entrada_hora ? format(parseDateValue(entry.entrada_hora) ?? new Date(), 'HH:mm') : '-'}
                </TableCell>
                <TableCell>
                  {entry.inicio_almoco && entry.fim_almoco
                    ? `${format(parseDateValue(entry.inicio_almoco) ?? new Date(), 'HH:mm')} - ${format(parseDateValue(entry.fim_almoco) ?? new Date(), 'HH:mm')}`
                    : '-'}
                </TableCell>
                <TableCell>
                  {entry.saida_hora ? format(parseDateValue(entry.saida_hora) ?? new Date(), 'HH:mm') : '-'}
                </TableCell>
                <TableCell>{entry.horas_totais ? `${entry.horas_totais}h` : '-'}</TableCell>
                <TableCell>{getStatusBadge(entry)}</TableCell>
                <TableCell>
                  {!entry.entrada_hora && entry.status !== 'falta' && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedEntry(entry)}
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          Justificar
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Justificar Falta</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>Motivo da Falta</Label>
                            <Textarea
                              value={absenceReason}
                              onChange={(e) => setAbsenceReason(e.target.value)}
                              placeholder="Descreva o motivo da falta..."
                              rows={4}
                            />
                          </div>
                          <div>
                            <Label>Atestado ou Comprovante (opcional)</Label>
                            <Input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={(e) => setAbsenceFile(e.target.files?.[0] || null)}
                            />
                          </div>
                          <Button onClick={handleJustifyAbsence} className="w-full">
                            <Upload className="h-4 w-4 mr-2" />
                            Enviar Justificativa
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                  {entry.absence_reason && (
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">
                        {entry.absence_reason}
                      </div>
                      {entry.absence_document_path && (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          onClick={async () => {
                            const { data } = supabase.storage
                              .from('documents')
                              .getPublicUrl(entry.absence_document_path!);
                            window.open(data.publicUrl, '_blank');
                          }}
                        >
                          Ver Atestado
                        </Button>
                      )}
                      {entry.motivo_rejeicao_ausencia && (
                        <div className="text-xs text-red-600">
                          Motivo da rejeição: {entry.motivo_rejeicao_ausencia}
                        </div>
                      )}
                      {(isAdmin || isGestorMaster) && entry.ausencia_aprovada === null && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApproveAbsence(entry.id)}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            Aprovar
                          </Button>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="destructive">
                                <X className="h-3 w-3 mr-1" />
                                Rejeitar
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Rejeitar Justificativa</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label>Motivo da Rejeição</Label>
                                  <Textarea
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder="Explique o motivo da rejeição..."
                                    rows={3}
                                  />
                                </div>
                                <Button 
                                  onClick={() => handleRejectAbsence(entry.id)} 
                                  className="w-full"
                                  variant="destructive"
                                >
                                  Confirmar Rejeição
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
