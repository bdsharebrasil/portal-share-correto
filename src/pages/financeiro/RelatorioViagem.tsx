import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Eye, FileText, Edit, AlertCircle, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { downloadPDF, previewPDFForPrint } from '@/lib/travelReportPDF';
import type { TravelReport as PDFTravelReport, TravelExpense } from '@/lib/travelReportPDF';
import { draftStorage } from '@/lib/travelReportDraft';
import type { TravelReportDraft } from '@/lib/travelReportDraft';
import { calculateReportTotals, extractPayerTotals, getValidExpenses } from '@/lib/travelReportUtils';
import { PartnerSelectModal } from '@/components/diario/PartnerSelectModal';
import { ReceiptViewer } from '@/components/financeiro/ReceiptViewer';
import { TravelReportForm } from '@/components/travel/TravelReportForm';

const REPORT_STATUSES = ['Rascunho', 'Finalizado', 'Enviado'];

interface Expense {
  category: string;
  description: string;
  amount: number;
  paid_by: string;
  receipt_url?: string;
  id?: string;
}

interface TravelReport {
  id?: string;
  report_number: string;
  client_id: string;
  client: string;
  client_partner?: string | null;
  aircraft_id: string;
  aircraft_registration: string;
  crew_member_id: string;
  crew_member_name: string;
  crew_member_name_2: string;
  route: string;
  start_date: string;
  end_date: string;
  days_count: number;
  observations: string;
  expenses: Expense[];
  total_amount: number;
  total_fuel: number;
  total_lodging: number;
  total_food: number;
  total_transport: number;
  total_other: number;
  total_crew: number;
  total_crew1: number;
  total_crew2: number;
  total_client: number;
  total_sharebrasil: number;
  pdf_url?: string;
  status: 'Rascunho' | 'Finalizado' | 'Enviado';
}

export default function RelatorioViagem() {
  const [reports, setReports] = useState<TravelReport[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [currentReport, setCurrentReport] = useState<TravelReport | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeStatusFilter, setActiveStatusFilter] = useState<'Todos' | TravelReport['status']>('Todos');
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [clientPartners, setClientPartners] = useState<{id?: string; name: string; cpf?: string; index: number}[]>([]);
  const [receiptViewerOpen, setReceiptViewerOpen] = useState(false);
  const [receiptViewerUrl, setReceiptViewerUrl] = useState<string>('');

  const fetchClientPartners = async (clientId: string) => {
    const { data, error } = await supabase
      .from('client_partners')
      .select('id, name, cpf')
      .eq('client_id', clientId)
      .order('name');
    if (error || !data || data.length === 0) {
      setClientPartners([]);
      return [];
    }
    const partners = data.map((p: any, i: number) => ({ id: p.id, name: p.name, cpf: p.cpf || undefined, index: i }));
    setClientPartners(partners);
    return partners;
  };

  useEffect(() => {
    loadReports();
    checkForSavedDraft();
  }, []);

  // Auto-salvamento de rascunho a cada 30 segundos
  useEffect(() => {
    if (!isCreating || !currentReport) return;

    const autoSaveInterval = setInterval(() => {
      if (currentReport && !isEditing) {
        draftStorage.saveDraft(currentReport as TravelReportDraft);
      }
    }, 30000);

    return () => clearInterval(autoSaveInterval);
  }, [currentReport, isCreating, isEditing]);

  const checkForSavedDraft = () => {
    const hasDraft = draftStorage.hasDraft();
    setHasSavedDraft(hasDraft);
  };

  const loadSavedDraft = () => {
    const draft = draftStorage.getDraft();
    if (draft) {
      setCurrentReport(draft as TravelReport);
      setIsCreating(true);
      setIsEditing(false);
      toast.success('✓ Rascunho restaurado com sucesso!');
    }
  };

  const discardDraft = () => {
    draftStorage.clearDraft();
    setHasSavedDraft(false);
    toast.info('Rascunho descartado');
  };

  const loadReports = async () => {
    const { data, error } = await supabase
      .from('travel_expense_reports')
      .select(`
        *,
        client_id_rel:client_id(company_name),
        partner_id_rel:client_partner(name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('❌ Erro ao carregar relatórios');
      return;
    }

    const reportsWithDefaults = (data || []).map((r: any) => {
      const expenses = (() => {
        try {
          if (typeof r.expenses === 'string') {
            return JSON.parse(r.expenses);
          }
          return r.expenses || [];
        } catch {
          return [];
        }
      })();

      // Determinar o nome do cliente: se tem client_partner, usar nome do partner; senão usar nome do cliente
      const clientName = r.client_partner && r.partner_id_rel?.name
        ? r.partner_id_rel.name
        : r.client_id_rel?.company_name || '';

      return {
        ...r,
        client: clientName,
        expenses: expenses,
        status: r.status || 'Rascunho'
      };
    });
    setReports(reportsWithDefaults as TravelReport[]);
  };

  const loadReportDetails = async (reportId: string) => {
    const { data: reportData, error: reportError } = await supabase
      .from('travel_expense_reports')
      .select(`
        *,
        client_id_rel:client_id(company_name),
        partner_id_rel:client_partner(name)
      `)
      .eq('id', reportId)
      .single();

    if (reportError || !reportData) throw reportError;

    // Converte para any para contornar a tipagem estrita do Supabase que não reconheceu o client_partner
    const rData = reportData as any;

    const expenses = (() => {
      try {
        if (typeof rData.expenses === 'string') {
          return JSON.parse(rData.expenses);
        }
        return rData.expenses || [];
      } catch {
        return [];
      }
    })();

    // Lendo do 'rData' (que é any) para evitar o erro do client_partner
    const clientName = rData.client_partner && rData.partner_id_rel?.name
      ? rData.partner_id_rel.name
      : rData.client_id_rel?.company_name || '';

    return {
      ...rData,
      client: clientName,
      expenses: expenses as Expense[],
      status: rData.status || 'Rascunho'
    } as TravelReport;
  };

  const generateReportNumber = async (clientName: string): Promise<string> => {
    if (!clientName || clientName.trim() === '') {
      return `REL-XXX-0001/${new Date().getFullYear().toString().slice(-2)}`;
    }

    const year = new Date().getFullYear();
    const yearShort = year.toString().slice(-2);

    const getClientInitials = (name: string): string => {
      const words = name.trim().split(/\s+/);
      return words
        .map(w => w.charAt(0).toUpperCase())
        .join('')
        .substring(0, 3)
        .padEnd(3, 'X');
    };

    const clientInitials = getClientInitials(clientName);

    const { data: existingReports } = await supabase
      .from('travel_expense_reports')
      .select('report_number')
      .ilike('report_number', `REL-${clientInitials}-%`)
      .order('created_at', { ascending: false })
      .limit(1);

    let nextNumber = 1;
    if (existingReports && existingReports.length > 0) {
      const lastNumber = existingReports[0].report_number;
      const match = lastNumber.match(/REL-[A-Z]{3}-(\d+)/);
      if (match && match[1]) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    return `REL-${clientInitials}-${String(nextNumber).padStart(3, '0')}/${yearShort}`;
  };

  const createNewReport = () => {
    const newReport: TravelReport = {
      report_number: `REL-XXX-0001/${new Date().getFullYear().toString().slice(-2)}`,
      client_id: '',
      client: '',
      aircraft_id: '',
      aircraft_registration: '',
      crew_member_id: '',
      crew_member_name: '',
      crew_member_name_2: '',
      route: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
      days_count: 1,
      observations: '',
      expenses: [{ category: '', description: '', amount: 0, paid_by: '' }],
      total_amount: 0,
      total_fuel: 0,
      total_lodging: 0,
      total_food: 0,
      total_transport: 0,
      total_other: 0,
      total_crew: 0,
      total_crew1: 0,
      total_crew2: 0,
      total_client: 0,
      total_sharebrasil: 0,
      status: 'Rascunho',
    };
    setCurrentReport(newReport);
    draftStorage.saveDraft(newReport as TravelReportDraft);
    setIsCreating(true);
    setIsEditing(false);
  };

  const editReport = async (reportId: string) => {
    try {
      const reportDetails = await loadReportDetails(reportId);
      setCurrentReport(reportDetails);
      setIsCreating(true);
      setIsEditing(true);
    } catch (error) {
      console.error('Erro ao carregar relatório para edição:', error);
      toast.error('❌ Não foi possível carregar os detalhes do relatório.');
    }
  };

  const deleteReport = async (reportId?: string) => {
    if (!reportId || !window.confirm('⚠ Tem certeza que deseja excluir este relatório e todas as suas despesas? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      await supabase.from('expense_items').delete().eq('report_id', reportId);

      const { error } = await supabase
        .from('travel_expense_reports')
        .delete()
        .eq('id', reportId);

      if (error) throw error;

      toast.success('✓ Relatório excluído com sucesso!');
      loadReports();
    } catch (error) {
      console.error('Erro ao excluir relatório:', error);
      toast.error('❌ Erro ao excluir o relatório.');
    }
  };

  const saveReport = async (newStatus: TravelReport['status'], reportToSave?: TravelReport) => {
    const reportData = reportToSave || currentReport;
    if (!reportData) return;

    if (isEditing && reportData.status !== 'Rascunho') {
      toast.error('⚠️ Não é possível editar relatórios que já foram finalizados. Apenas rascunhos podem ser editados.');
      return;
    }

    setIsSaving(true);
    const isUpdate = !!reportData.id;

    try {
      const validExpenses = getValidExpenses(reportData.expenses);

      let reportNumber = reportData.report_number;
      if (!isUpdate && (reportNumber.includes('XXX') || reportNumber.startsWith('R-'))) {
        reportNumber = await generateReportNumber(reportData.client);
      }

      // SEMPRE recalcular todos os totais a partir das despesas para garantir precisão
      const recalculatedTotals = calculateReportTotals(validExpenses);
      const totalAmount = recalculatedTotals.total_amount;
      const days = reportData.days_count;

      const reportDataToSave = {
        report_number: reportNumber,
        client_id: reportData.client_id || null,
        aircraft_id: reportData.aircraft_id || null,
        aircraft_registration: reportData.aircraft_registration,
        crew_member_id: reportData.crew_member_id || null,
        crew_member_name: reportData.crew_member_name,
        crew_member_name_2: reportData.crew_member_name_2 || null,
        route: reportData.route,
        start_date: reportData.start_date,
        end_date: reportData.end_date,
        days_count: days,
        observations: reportData.observations || null,
        expenses: JSON.stringify(validExpenses),
        total_amount: totalAmount,
        total_fuel: recalculatedTotals.total_fuel,
        total_lodging: recalculatedTotals.total_lodging,
        total_food: recalculatedTotals.total_food,
        total_transport: recalculatedTotals.total_transport,
        total_other: recalculatedTotals.total_other,
        total_crew: recalculatedTotals.total_crew,
        total_client: recalculatedTotals.total_client,
        total_sharebrasil: recalculatedTotals.total_sharebrasil,
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      let savedReport;

      if (isUpdate) {
        const { data, error } = await supabase
          .from('travel_expense_reports')
          .update(reportDataToSave)
          .eq('id', reportData.id)
          .select()
          .single();
        if (error) throw error;
        savedReport = data;
      } else {
        const { data, error } = await supabase
          .from('travel_expense_reports')
          .insert([reportDataToSave])
          .select()
          .single();
        if (error) throw error;
        savedReport = data;
      }

      // Salvar anexos das despesas na tabela travel_report_attachments
      try {
        // Se for atualização, remover attachments antigos primeiro
        if (isUpdate) {
          const { error: deleteError } = await supabase
            .from('travel_report_attachments')
            .delete()
            .eq('travel_report_id', savedReport.id);

          if (deleteError) {
            console.warn('Aviso ao remover attachments antigos:', deleteError);
          }
        }

        const attachmentsToInsert = validExpenses
          .map((expense, index) => {
            if (!expense.receipt_url) return null;

            // Extrair informações do arquivo da URL
            const urlParts = expense.receipt_url.split('/');
            const fileName = urlParts[urlParts.length - 1] || 'comprovante';
            const filePath = `receipts/${fileName}`;

            // Detectar tipo de arquivo
            let fileType = 'application/octet-stream';
            if (expense.receipt_url.includes('.pdf')) fileType = 'application/pdf';
            else if (expense.receipt_url.includes('.jpg') || expense.receipt_url.includes('.jpeg')) fileType = 'image/jpeg';
            else if (expense.receipt_url.includes('.png')) fileType = 'image/png';
            else if (expense.receipt_url.includes('.gif')) fileType = 'image/gif';
            else if (expense.receipt_url.includes('.webp')) fileType = 'image/webp';

            return {
              travel_report_id: savedReport.id,
              expense_index: index,
              file_name: fileName,
              file_path: filePath,
              file_url: expense.receipt_url,
              file_type: fileType,
              file_size: null,
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null);

        if (attachmentsToInsert.length > 0) {
          console.log(`📎 Preparando para salvar ${attachmentsToInsert.length} anexo(s) na tabela...`);
          console.log('Dados dos anexos:', attachmentsToInsert);

          const { error: attachmentError, data: insertedData } = await supabase
            .from('travel_report_attachments')
            .insert(attachmentsToInsert)
            .select();

          if (attachmentError) {
            console.error('❌ Erro ao salvar attachments na tabela travel_report_attachments:', attachmentError);
            console.error('Detalhes do erro:', {
              message: attachmentError.message,
              details: attachmentError.details,
              hint: attachmentError.hint,
              code: attachmentError.code
            });
            toast.warning('⚠️ Relatório salvo, mas houve erro ao registrar os comprovantes. Verifique as permissões do banco de dados.');
          } else {
            console.log(`✅ ${insertedData?.length || attachmentsToInsert.length} comprovante(s) registrado(s) com sucesso!`);
            if (insertedData) {
              console.log('Anexos salvos:', insertedData);
            }
            toast.success(`✓ ${attachmentsToInsert.length} comprovante(s) associado(s) ao relatório`);
          }
        } else {
          console.log('ℹ️ Nenhum comprovante com URL foi encontrado para registrar');
        }
      } catch (attachmentError: any) {
        console.error('❌ Erro ao processar attachments:', attachmentError);
        console.error('Stack trace:', attachmentError.stack);
        toast.warning('⚠️ Erro ao registrar os comprovantes do relatório. Verifique o console para mais detalhes.');
      }

      // Criar conciliações bancárias quando o relatório for finalizado
      if (newStatus === 'Finalizado' || newStatus === 'Enviado') {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const today = new Date().toISOString().split('T')[0];
          const reconciliationsToInsert: any[] = [];

          // Recalcular totais a partir das despesas
          const payerTotals = extractPayerTotals(validExpenses);
          const totalCrew1 = payerTotals.totalCrew1;
          const totalCrew2 = payerTotals.totalCrew2;
          const totalSharebrasil = payerTotals.totalSharebrasil;

          // Valor que o cliente deve = ShareBrasil + Tripulantes (tudo que não foi pago pelo cliente)
          const totalClientOwes = totalSharebrasil + totalCrew1 + totalCrew2;

          console.log('Totais para conciliação:', {
            total_amount: recalculatedTotals.total_amount,
            total_client: recalculatedTotals.total_client,
            total_sharebrasil: totalSharebrasil,
            totalCrew1,
            totalCrew2,
            totalClientOwes
          });

          // 1. Criar conciliação para CLIENTE (valor que Share+Tripulantes pagaram)
          if (totalClientOwes > 0 && reportData.client_id) {
            const { data: existingClientPayment } = await supabase
              .from('bank_reconciliations')
              .select('id')
              .eq('reference_id', savedReport.id)
              .eq('type', 'cliente')
              .maybeSingle();

            if (!existingClientPayment) {
              reconciliationsToInsert.push({
                type: 'cliente',
                client_id: reportData.client_id,
                aircraft_id: reportData.aircraft_id || null,
                amount: totalClientOwes,
                status: 'pendente',
                category: 'relatório_viagem',
                description: `RELATORIO DE VIAGEM - ${savedReport.report_number} - A RECEBER DO CLIENTE`,
                date: today,
                created_by: user.id,
                reference_id: savedReport.id,
                reference_type: 'travel_report'
              });
            }
          }

          // 2. Criar conciliação para TRIPULANTE 1 (valor que ele pagou e precisa ser reembolsado)
          if (totalCrew1 > 0 && reportData.crew_member_id) {
            // Buscar o user_id do crew_member para usar como receiver_id
            const { data: crewMember } = await supabase
              .from('crew_members')
              .select('user_id')
              .eq('id', reportData.crew_member_id)
              .maybeSingle();

            const receiverId = crewMember?.user_id || null;

            const { data: existingCrewPayment } = await supabase
              .from('bank_reconciliations')
              .select('id')
              .eq('reference_id', savedReport.id)
              .eq('type', 'colaborador')
              .ilike('description', '%TRIPULANTE 1%')
              .maybeSingle();

            if (!existingCrewPayment) {
              reconciliationsToInsert.push({
                type: 'colaborador',
                receiver_id: receiverId,
                aircraft_id: reportData.aircraft_id || null,
                amount: totalCrew1,
                status: 'pendente',
                category: 'relatório_viagem',
                description: `RELATORIO DE VIAGEM - ${savedReport.report_number} - REEMBOLSO TRIPULANTE 1 (${reportData.crew_member_name.toUpperCase()})`,
                date: today,
                created_by: user.id,
                reference_id: savedReport.id,
                reference_type: 'travel_report'
              });
            }
          }

          // 3. Criar conciliação para TRIPULANTE 2 (se houver)
          if (totalCrew2 > 0 && reportData.crew_member_name_2) {
            // Buscar o crew_member pelo nome e depois pegar o user_id
            const { data: secondCrew } = await supabase
              .from('crew_members')
              .select('id, user_id')
              .eq('full_name', reportData.crew_member_name_2)
              .maybeSingle();

            const receiverId = secondCrew?.user_id || null;

            const { data: existingCrewPayment2 } = await supabase
              .from('bank_reconciliations')
              .select('id')
              .eq('reference_id', savedReport.id)
              .eq('type', 'colaborador')
              .ilike('description', '%TRIPULANTE 2%')
              .maybeSingle();

            if (!existingCrewPayment2) {
              reconciliationsToInsert.push({
                type: 'colaborador',
                receiver_id: receiverId,
                aircraft_id: reportData.aircraft_id || null,
                amount: totalCrew2,
                status: 'pendente',
                category: 'relatório_viagem',
                description: `RELATORIO DE VIAGEM - ${savedReport.report_number} - REEMBOLSO TRIPULANTE 2 (${reportData.crew_member_name_2.toUpperCase()})`,
                date: today,
                created_by: user.id,
                reference_id: savedReport.id,
                reference_type: 'travel_report'
              });
            }
          }

          // Inserir todas as conciliações
          if (reconciliationsToInsert.length > 0) {
            console.log('Inserindo conciliações:', reconciliationsToInsert);
            const { error: paymentError } = await supabase
              .from('bank_reconciliations')
              .insert(reconciliationsToInsert);

            if (paymentError) {
              console.error('Erro ao registrar conciliações:', paymentError);
              toast.warning('⚠️ Relatório salvo, mas houve erro ao criar conciliações bancárias');
            }
          }

          // Gerar e salvar PDF se o relatório foi finalizado ou enviado
          if (newStatus === 'Finalizado' || newStatus === 'Enviado') {
            try {
              console.log('📄 Gerando PDF para o relatório...');
              const pdfData: PDFTravelReport = {
                numero: savedReport.report_number,
                cliente_nome: reportData.client,
                aeronave: reportData.aircraft_registration,
                tripulante: reportData.crew_member_name,
                tripulante2: reportData.crew_member_name_2,
                trecho: reportData.route,
                destino: reportData.route,
                data_inicio: reportData.start_date,
                data_fim: reportData.end_date,
                observacoes: reportData.observations,
                despesas: validExpenses.map(e => ({
                  categoria: e.category,
                  descricao: e.description,
                  valor: e.amount,
                  pago_por: e.paid_by,
                  data: (e as any).expense_date || '',
                  comprovante_url: e.receipt_url
                })) as TravelExpense[],
                total_combustivel: recalculatedTotals.total_fuel,
                total_hospedagem: recalculatedTotals.total_lodging,
                total_alimentacao: recalculatedTotals.total_food,
                total_transporte: recalculatedTotals.total_transport,
                total_outros: recalculatedTotals.total_other,
                total_tripulante: recalculatedTotals.total_crew,
                total_tripulante1: recalculatedTotals.total_crew1,
                total_tripulante2: recalculatedTotals.total_crew2,
                total_cliente: recalculatedTotals.total_client,
                total_sharebrasil: recalculatedTotals.total_sharebrasil,
                valor_total: recalculatedTotals.total_amount
              };

              // Usar a função generatePDF para gerar o blob
              const { generatePDF } = await import('@/lib/travelReportPDF');
              const pdfBlob = await generatePDF(pdfData);

              // Upload do PDF no storage
              const pdfFileName = `${savedReport.report_number.replace(/\//g, '-')}-${Date.now()}.pdf`;
              const pdfPath = `reports/${pdfFileName}`;

              const { error: pdfUploadError } = await supabase.storage
                .from('travel-reports')
                .upload(pdfPath, pdfBlob, { contentType: 'application/pdf' });

              if (pdfUploadError) {
                console.error('Erro ao fazer upload do PDF:', pdfUploadError);
                toast.warning('⚠️ Relatório salvo, mas houve erro ao salvar o PDF');
              } else {
                // Obter URL pública do PDF
                const { data: { publicUrl: pdfUrl } } = supabase.storage
                  .from('travel-reports')
                  .getPublicUrl(pdfPath);

                // Atualizar o campo pdf_url no banco
                const { error: updateError } = await supabase
                  .from('travel_expense_reports')
                  .update({ pdf_url: pdfUrl })
                  .eq('id', savedReport.id);

                if (updateError) {
                  console.error('Erro ao atualizar pdf_url:', updateError);
                  toast.warning('⚠️ PDF gerado mas erro ao salvar URL no banco');
                } else {
                  console.log('✅ PDF salvo com sucesso:', pdfUrl);
                }
              }
            } catch (pdfError: any) {
              console.error('Erro ao gerar/salvar PDF:', pdfError);
              toast.warning(`⚠️ Erro ao gerar PDF: ${pdfError?.message || 'Tente novamente'}`);
            }
          }
        }
      }

      const messageStatus = newStatus === 'Rascunho' ? 'Rascunho' : newStatus === 'Finalizado' ? 'Finalizado' : 'Enviado';
      toast.success(isUpdate ? `✓ Relatório atualizado para: ${messageStatus}` : `✓ Relatório criado com status: ${messageStatus}`);
      draftStorage.clearDraft();
      setHasSavedDraft(false);
      setIsCreating(false);
      setCurrentReport(null);
      loadReports();
    } catch (error: any) {
      console.error('Erro ao salvar relatório:', error);
      console.error('Detalhes do erro:', {
        message: error.message,
        status: error.status,
        statusText: error.statusText,
        code: error.code,
        details: error.details,
        hint: error.hint,
        fullError: error
      });

      const errorMessage = error.message || 'Erro desconhecido';
      const errorDetails = error.details || error.hint || '';
      const fullErrorMsg = errorDetails ? `${errorMessage} - ${errorDetails}` : errorMessage;

      toast.error(`❌ Erro ao salvar: ${fullErrorMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredReports = useMemo(() => {
    if (activeStatusFilter === 'Todos') {
      return reports;
    }
    return reports.filter(report => report.status === activeStatusFilter);
  }, [reports, activeStatusFilter]);

  const statusCounts = useMemo(() => {
    const counts = { 'Todos': reports.length };
    REPORT_STATUSES.forEach(status => {
      counts[status as TravelReport['status']] = reports.filter(r => r.status === status).length;
    });
    return counts;
  }, [reports]);

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {!isCreating ? (
          <>
            {hasSavedDraft && (
              <Card className="border-amber-200/50 bg-gradient-to-r from-amber-50 to-orange-50 shadow-md rounded-xl">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-amber-100/50">
                        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 animate-pulse" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-amber-900 text-base">Rascunho salvo automaticamente</h3>
                        <p className="text-sm text-amber-700/80 mt-1 leading-relaxed">Você tem um relatório anterior em rascunho. Deseja continuar editando?</p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="sm" variant="ghost" onClick={discardDraft} className="text-amber-600 hover:bg-amber-100/50 hover:text-amber-700 rounded-lg transition-all duration-200">
                        Descartar
                      </Button>
                      <Button size="sm" onClick={loadSavedDraft} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]">
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Restaurar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="shadow-md rounded-xl border-border/50">
              <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-6">
                <div>
                  <CardTitle className="text-2xl font-bold text-foreground">Histórico de Relatórios</CardTitle>
                  {reports.length === 0 && <p className="text-sm text-muted-foreground mt-2 leading-relaxed">Carregando relatórios...</p>}
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                  <Button onClick={createNewReport} className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] w-full md:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Relatório
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                <div className="flex flex-wrap gap-3 mb-6">
                  {['Todos', ...REPORT_STATUSES].map(status => {
                    const isActive = activeStatusFilter === status;
                    const statusColors = {
                      'Todos': { bg: 'bg-slate-100', text: 'text-slate-700', activeBg: 'bg-slate-200', activeText: 'text-slate-900' },
                      'Rascunho': { bg: 'bg-amber-100/50', text: 'text-amber-700', activeBg: 'bg-amber-200', activeText: 'text-amber-900' },
                      'Finalizado': { bg: 'bg-blue-100/50', text: 'text-blue-700', activeBg: 'bg-blue-200', activeText: 'text-blue-900' },
                      'Enviado': { bg: 'bg-green-100/50', text: 'text-green-700', activeBg: 'bg-green-200', activeText: 'text-green-900' }
                    };
                    const colors = statusColors[status as keyof typeof statusColors] || statusColors['Todos'];

                    return (
                      <Button
                        key={status}
                        onClick={() => setActiveStatusFilter(status as 'Todos' | TravelReport['status'])}
                        className={cn(
                          'rounded-full px-4 py-2 h-auto transition-all duration-200 font-medium text-sm flex items-center gap-2',
                          isActive
                            ? `${colors.activeBg} ${colors.activeText} ring-2 ring-offset-2 ${colors.text.replace('text-', 'ring-')}`
                            : `${colors.bg} ${colors.text} hover:${colors.activeBg.replace('bg-', 'hover:bg-')} active:scale-[0.98]`
                        )}
                      >
                        <span>{status}</span>
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ring-current ring-opacity-30',
                          isActive ? 'bg-current/20' : 'bg-current/10'
                        )}>
                          {status === 'Todos' ? statusCounts.Todos : statusCounts[status as TravelReport['status']]}
                        </span>
                      </Button>
                    );
                  })}
                </div>

                {filteredReports.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
                    <p className="text-center text-muted-foreground font-medium">Nenhum relatório encontrado</p>
                    <p className="text-center text-muted-foreground text-sm">na pasta {activeStatusFilter}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredReports.map((report) => {
                      const statusColors = {
                        'Rascunho': 'border-l-4 border-l-amber-400',
                        'Finalizado': 'border-l-4 border-l-blue-400',
                        'Enviado': 'border-l-4 border-l-green-400'
                      };
                      const statusBadgeColors = {
                        'Rascunho': 'bg-amber-100/80 text-amber-800 ring-amber-200',
                        'Finalizado': 'bg-blue-100/80 text-blue-800 ring-blue-200',
                        'Enviado': 'bg-green-100/80 text-green-800 ring-green-200'
                      };

                      return (
                        <div
                          key={report.id}
                          className={cn(
                            "flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 rounded-xl bg-card border border-border/50 shadow-sm hover:shadow-md transition-all duration-200 hover:border-border group",
                            statusColors[report.status]
                          )}
                        >
                          <div className="mb-3 sm:mb-0 min-w-[240px] flex-1">
                            <div className="flex items-start gap-3 mb-2">
                              <FileText className="h-5 w-5 text-muted-foreground/60 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="font-semibold text-foreground text-base">
                                  {report.report_number}
                                </p>
                                <span className={cn(
                                  "inline-block text-xs font-bold px-3 py-1 rounded-full ring-1 mt-1",
                                  statusBadgeColors[report.status]
                                )}>
                                  {report.status}
                                </span>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground font-medium">
                              {report.client}
                              <span className="text-xs text-muted-foreground/70 ml-1">
                                ({report.aircraft_registration})
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground/70 mt-1">
                              {format(new Date(report.start_date), "dd MMM", { locale: ptBR })} a {format(new Date(report.end_date), "dd MMM yyyy", { locale: ptBR })}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground/70 font-medium">Total</p>
                              <p className="font-bold text-lg text-green-600 font-mono">
                                R$ {report.total_amount.toFixed(2).replace('.', ',')}
                              </p>
                            </div>
                            <div className="flex gap-1 ml-auto sm:ml-0">
                              {report.status === 'Rascunho' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => editReport(report.id!)}
                                  title="Editar Relatório"
                                  className="rounded-lg transition-all duration-200 hover:bg-primary/10 hover:text-primary"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    const reportWithDetails = await loadReportDetails(report.id!);

                                    // IMPORTANTE: Recalcular os totais a partir das despesas
                                    // Isto garante que mesmo se o relatório foi salvo com totais errados,
                                    // a visualização mostrará os valores CORRETOS
                                    const correctedTotals = calculateReportTotals(reportWithDetails.expenses || []);

                                    const pdfReport: PDFTravelReport = {
                                      numero: reportWithDetails.report_number,
                                      cliente_nome: reportWithDetails.client,
                                      aeronave: reportWithDetails.aircraft_registration,
                                      tripulante: reportWithDetails.crew_member_name,
                                      tripulante2: reportWithDetails.crew_member_name_2,
                                      trecho: reportWithDetails.route,
                                      destino: reportWithDetails.route,
                                      data_inicio: reportWithDetails.start_date,
                                      data_fim: reportWithDetails.end_date,
                                      observacoes: reportWithDetails.observations,
                                      despesas: (reportWithDetails.expenses || []).map(e => ({
                                        categoria: e.category,
                                        descricao: e.description,
                                        valor: e.amount,
                                        pago_por: e.paid_by,
                                        data: (e as any).expense_date || '',
                                        comprovante_url: e.receipt_url
                                      })) as TravelExpense[],
                                      total_combustivel: correctedTotals.total_fuel,
                                      total_hospedagem: correctedTotals.total_lodging,
                                      total_alimentacao: correctedTotals.total_food,
                                      total_transporte: correctedTotals.total_transport,
                                      total_outros: correctedTotals.total_other,
                                      total_tripulante: correctedTotals.total_crew,
                                      total_tripulante1: correctedTotals.total_crew1,
                                      total_tripulante2: correctedTotals.total_crew2,
                                      total_cliente: correctedTotals.total_client,
                                      total_sharebrasil: correctedTotals.total_sharebrasil,
                                      valor_total: correctedTotals.total_amount
                                    };
                                    const { data: { user } } = await supabase.auth.getUser();
                                    let userName = 'Usuário';
                                    if (user?.id) {
                                      const { data: profile } = await supabase
                                        .from('user_profiles')
                                        .select('full_name')
                                        .eq('id', user.id)
                                        .single();
                                      if (profile?.full_name) userName = profile.full_name;
                                    }
                                    await previewPDFForPrint(pdfReport, userName);
                                  } catch (error) {
                                    console.error('Erro ao visualizar PDF:', error);
                                    toast.error('Erro ao visualizar relatório');
                                  }
                                }}
                                title="Visualizar Relatório"
                                className="rounded-lg transition-all duration-200 hover:bg-primary/10 hover:text-primary"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteReport(report.id)}
                                title="Excluir Relatório"
                                className="rounded-lg transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : currentReport && (
          <>
            <TravelReportForm
              report={currentReport}
              onSave={async (report, status) => {
                setCurrentReport(report);
                await saveReport(status, report);
              }}
              onCancel={() => {
                if (draftStorage.hasDraft()) {
                  if (window.confirm('Deseja descartar as alterações não salvas?')) {
                    draftStorage.clearDraft();
                    setHasSavedDraft(false);
                    setIsCreating(false);
                  }
                } else {
                  setIsCreating(false);
                }
              }}
              onAutoSave={(report) => {
                if (!isEditing) {
                  draftStorage.saveDraft(report);
                }
              }}
              showPartnerModal={() => setShowPartnerModal(true)}
              onReceiptView={(url) => {
                setReceiptViewerUrl(url);
                setReceiptViewerOpen(true);
              }}
            />
          </>
        )}
      </div>
      <PartnerSelectModal
        open={showPartnerModal}
        onOpenChange={setShowPartnerModal}
        clientName={currentReport?.client || ''}
        partners={clientPartners}
        selectedPartner={currentReport?.client || null}
        onSelectPartner={(partner) => {
          setCurrentReport(prev => prev ? { ...prev, client_partner: partner.id, client: partner.name } : null);
          if (currentReport && !isEditing) {
            draftStorage.saveDraft({ ...currentReport, client_partner: partner.id, client: partner.name } as TravelReportDraft);
          }
        }}
      />
      <ReceiptViewer
        open={receiptViewerOpen}
        onOpenChange={setReceiptViewerOpen}
        url={receiptViewerUrl}
        title="Comprovante Anexado"
      />
    </Layout>
  );
}
