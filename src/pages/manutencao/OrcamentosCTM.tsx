import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { CTMBudgetManagement } from "@/components/ctm";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface Aircraft {
  id: string;
  registration: string;
  model: string;
}

export default function OrcamentosCTM() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [aircraft, setAircraft] = useState<Aircraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const aircraftId = searchParams.get("aircraftId");
  const budgetId = searchParams.get("budgetId");

  useEffect(() => {
    if (budgetId) {
      loadBudgetPdf(budgetId);
    } else if (!aircraftId) {
      toast.error("ID da aeronave não encontrado");
      navigate("/manutencao/ctm");
      return;
    } else {
      loadAircraft();
    }
  }, [aircraftId, budgetId]);

  const loadBudgetPdf = async (budgetId: string) => {
    try {
      setLoading(true);
      setPdfLoading(true);
      const { data: budgetData, error } = await (supabase as any)
        .from("ctm_budgets")
        .select('*, aircraft:aeronave(matricula)')
        .eq("id", budgetId)
        .single();

      if (error) throw error;

      if (budgetData) {
        setAircraft({
          id: budgetData.aeronave_id,
          registration: budgetData.aeronave?.matricula || "N/A",
          model: ""
        });

        if (budgetData.budget_details?.pdf_file_path) {
          const { data: signedUrl, error: urlError } = await supabase.storage
            .from("documentos")
            .createSignedUrl(budgetData.budget_details.pdf_file_path, 3600);

          if (!urlError && signedUrl) {
            setPdfUrl(signedUrl.signedUrl);
          }
        }
      }
    } catch (error: any) {
      console.error("Error loading budget PDF:", error);
      toast.error("Erro ao carregar orçamento");
      navigate("/manutencao/ctm");
    } finally {
      setPdfLoading(false);
      setLoading(false);
    }
  };

  const loadAircraft = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('aeronave')
        .select('id, matricula, modelo')
        .eq("id", aircraftId)
        .single();

      if (error) throw error;
      setAircraft(data);
    } catch (error: any) {
      console.error("Error loading aircraft:", error);
      toast.error("Erro ao carregar aeronave");
      navigate("/manutencao/ctm");
    } finally {
      setLoading(false);
    }
  };

  if (loading || pdfLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[600px]">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </Layout>
    );
  }

  if (!aircraft) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[600px]">
          <p className="text-muted-foreground mb-4">Dados não encontrados</p>
          <Button onClick={() => navigate("/manutencao/ctm")}>Voltar</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex-1 p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/manutencao/ctm")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Orçamentos para Manutenção</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gestão de orçamentos para {aeronave.matricula} ({aeronave.modelo})
              </p>
            </div>
          </div>
        </div>

        {/* PDF Viewer for Budget Review */}
        {budgetId && pdfUrl && (
          <Card className="bg-gradient-card border-border p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Visualizar PDF do Orçamento</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(pdfUrl, "_blank")}
                >
                  Abrir em Nova Aba
                </Button>
              </div>
              {pdfLoading ? (
                <div className="flex items-center justify-center h-[70vh] bg-muted rounded-lg">
                  <p className="text-muted-foreground">Carregando PDF...</p>
                </div>
              ) : (
                <iframe
                  src={pdfUrl}
                  className="w-full h-[70vh] border rounded-lg"
                  title="PDF Orçamento"
                />
              )}
            </div>
          </Card>
        )}

        {/* Budget Management Component */}
        {!budgetId && aircraftId && (
          <Card className="bg-gradient-card border-border p-6">
            <CTMBudgetManagement
              aircraftId={aircraftId}
              aircraftRegistration={aeronave.matricula}
            />
          </Card>
        )}
      </div>
    </Layout>
  );
}
