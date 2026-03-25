import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Clock, CheckCircle2, DollarSign, FileText, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Approval {
  id: string;
  type: "ctm_budget" | "oas_budget" | "ctm_order";
  title: string;
  supplier?: string;
  aircraft?: string;
  total?: number;
  date: string;
  status: string;
  description?: string;
}

export default function AprovacoesorOrcamentos() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "ctm_budget" | "oas_budget" | "ctm_order">("all");
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [selectedApprovalForPdf, setSelectedApprovalForPdf] = useState<Approval | null>(null);

  const { data: approvals = [], isLoading } = useQuery({
    queryKey: ["manager-approvals", filterType],
    queryFn: async () => {
      const results: Approval[] = [];

      // Buscar orçamentos CTM pendentes
      const { data: ctmBudgets } = await (supabase as any)
        .from("ctm_budgets")
        .select("*, aircraft:aircraft_id(registration)")
        .in("status", ["submitted"])
        .order("submitted_at", { ascending: false });

      if (ctmBudgets) {
        results.push(
          ...ctmBudgets.map((b: any) => ({
            id: b.id,
            type: "ctm_budget" as const,
            title: `Orçamento CTM: ${b.description?.substring(0, 50) || b.supplier_name || ""}`,
            supplier: b.supplier_name,
            aircraft: b.aircraft?.registration,
            total: b.total_value,
            date: b.submitted_at || b.created_at,
            status: "pendente_aprovacao",
            description: b.notes,
          }))
        );
      }

      // Buscar orçamentos OAS pendentes
      const { data: oasBudgets } = await (supabase as any)
        .from("oas_budgets")
        .select("*, service_order:ctm_service_orders(numero, aircraft:aircraft(registration))")
        .eq("status", "pendente_aprovacao")
        .order("submitted_at", { ascending: false });

      if (oasBudgets) {
        results.push(
          ...oasBudgets.map((b: any) => ({
            id: b.id,
            type: "oas_budget" as const,
            title: `Orçamento OAS #${b.service_order?.numero}: ${b.descricao?.substring(0, 40) || ""}`,
            supplier: b.fornecedor_nome,
            aircraft: b.service_order?.aircraft?.registration,
            total: b.valor_total,
            date: b.submitted_at || b.created_at,
            status: "pendente_aprovacao",
          }))
        );
      }

      // Buscar ordens de serviço CTM pendentes
      const { data: ctmOrders } = await supabase
        .from("ctm_service_orders")
        .select("*, aircraft(registration)")
        .eq("approval_status", "pending_approval")
        .order("submitted_for_approval_at", { ascending: false });

      if (ctmOrders) {
        results.push(
          ...ctmOrders.map((o: any) => ({
            id: o.id,
            type: "ctm_order" as const,
            title: `OAS #${o.numero} - ${(o.aircraft as any)?.registration || "N/A"}`,
            aircraft: (o.aircraft as any)?.registration,
            total: o.total_geral,
            date: o.submitted_for_approval_at || o.data_entrada,
            status: "pendente_aprovacao",
            description: o.objetivo,
          }))
        );
      }

      return results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },
  });

  const filteredApprovals = approvals.filter((item) => {
    const matchesType = filterType === "all" || item.type === filterType;
    const matchesSearch = 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.supplier?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (item.aircraft?.toLowerCase() || "").includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  const handleApprove = async (approval: Approval) => {
    if (approval.type === "ctm_order") {
      navigate(`/manutencao/ctm?serviceOrderId=${approval.id}`);
    } else if (approval.type === "ctm_budget") {
      // Try to load and display PDF first
      try {
        setPdfLoading(true);
        setSelectedApprovalForPdf(approval);
        const { data: budgetData } = await (supabase as any)
          .from("ctm_budgets")
          .select("budget_details")
          .eq("id", approval.id)
          .single();

        if (budgetData?.budget_details?.pdf_file_path) {
          const { data: signedUrl } = await supabase.storage
            .from("documents")
            .createSignedUrl(budgetData.budget_details.pdf_file_path, 3600);

          if (signedUrl) {
            setPdfUrl(signedUrl.signedUrl);
            setPdfModalOpen(true);
            return;
          }
        }

        // If no PDF available, navigate directly
        navigate(`/manutencao/orcamentos?budgetId=${approval.id}`);
      } catch (error) {
        console.error("Error loading PDF:", error);
        navigate(`/manutencao/orcamentos?budgetId=${approval.id}`);
      } finally {
        setPdfLoading(false);
      }
    } else if (approval.type === "oas_budget") {
      navigate(`/manutencao/orcamentos?oasBudgetId=${approval.id}`);
    }
  };

  const handleContinueReview = () => {
    if (selectedApprovalForPdf?.type === "ctm_budget") {
      navigate(`/manutencao/orcamentos?budgetId=${selectedApprovalForPdf.id}`);
      setPdfModalOpen(false);
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "ctm_budget":
        return "Orçamento CTM";
      case "oas_budget":
        return "Orçamento OAS";
      case "ctm_order":
        return "OAS";
      default:
        return "Orçamento";
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "ctm_budget":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "oas_budget":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "ctm_order":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  };

  return (
    <Layout>
      <main className="flex-1 p-6 space-y-6">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-foreground hover:text-primary transition-colors group w-fit"
        >
          <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm">Voltar</span>
        </button>

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Aprovações de Orçamentos</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Visualize e aprove todos os orçamentos e ordens de serviço pendentes
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card/50 backdrop-blur-sm border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Pendentes</p>
                  <p className="text-2xl font-bold text-warning">{approvals.length}</p>
                </div>
                <Clock className="h-8 w-8 text-warning" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Valor Total</p>
                  <p className="text-2xl font-bold text-primary">
                    R$ {approvals
                      .reduce((sum, item) => sum + (item.total || 0), 0)
                      .toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Mais Antigo</p>
                  <p className="text-2xl font-bold text-foreground">
                    {approvals.length > 0
                      ? format(new Date(approvals[approvals.length - 1].date), "dd/MM", { locale: ptBR })
                      : "-"}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-foreground/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Input
            placeholder="Pesquisar por orçamento, fornecedor ou aeronave..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
          <div className="flex gap-2">
            {(["all", "ctm_budget", "oas_budget", "ctm_order"] as const).map((type) => (
              <Button
                key={type}
                variant={filterType === type ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType(type)}
                className="whitespace-nowrap"
              >
                {type === "all" ? "Todos" : getTypeLabel(type)}
              </Button>
            ))}
          </div>
        </div>

        {/* Approvals List */}
        <Card className="bg-card/50 backdrop-blur-sm border-border">
          <CardHeader>
            <CardTitle>
              {isLoading ? "Carregando..." : `${filteredApprovals.length} aprovações pendentes`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando aprovações...</div>
            ) : filteredApprovals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {approvals.length === 0
                  ? "Nenhuma aprovação pendente"
                  : "Nenhuma aprovação encontrada com os filtros selecionados"}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredApprovals.map((approval) => (
                  <div
                    key={`${approval.type}-${approval.id}`}
                    className="p-4 bg-background/50 rounded-lg border border-border/50 hover:border-primary/50 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <h3 className="font-medium text-foreground break-words">{approval.title}</h3>
                          <Badge className={getTypeBadgeColor(approval.type)}>
                            {getTypeLabel(approval.type)}
                          </Badge>
                        </div>
                        {approval.supplier && (
                          <p className="text-sm text-muted-foreground">Fornecedor: {approval.supplier}</p>
                        )}
                        {approval.aircraft && (
                          <p className="text-sm text-muted-foreground">Aeronave: {approval.aircraft}</p>
                        )}
                        {approval.description && (
                          <p className="text-sm text-muted-foreground mt-1">{approval.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {format(new Date(approval.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {approval.total && (
                          <p className="font-semibold text-primary">
                            R$ {approval.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </p>
                        )}
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleApprove(approval)}
                          className="gap-1"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Revisar
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* PDF Viewer Modal */}
      <Dialog open={pdfModalOpen} onOpenChange={setPdfModalOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh]">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Visualizar Orçamento PDF
            </DialogTitle>
            <button
              onClick={() => setPdfModalOpen(false)}
              className="p-1 rounded hover:bg-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {pdfLoading ? (
              <div className="flex items-center justify-center h-[70vh]">
                <p className="text-muted-foreground">Carregando PDF...</p>
              </div>
            ) : pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="w-full h-[70vh] border rounded-lg"
                title="PDF Orçamento"
              />
            ) : (
              <div className="flex items-center justify-center h-[70vh]">
                <p className="text-muted-foreground">Nenhum PDF disponível</p>
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-4">
            {pdfUrl && (
              <Button
                variant="outline"
                onClick={() => window.open(pdfUrl, "_blank")}
              >
                Abrir em Nova Aba
              </Button>
            )}
            <Button
              variant="default"
              onClick={handleContinueReview}
              className="flex-1"
            >
              Continuar Revisão
            </Button>
            <Button
              variant="outline"
              onClick={() => setPdfModalOpen(false)}
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
