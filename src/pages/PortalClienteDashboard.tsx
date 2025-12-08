import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Download, DollarSign, Plane, LogOut } from "lucide-react";
import { ClientDataTabs } from "@/components/portal-cliente/ClientDataTabs";

interface ClientSession {
  clientId: string;
  aircraftId: string;
  clientName: string;
  registration: string;
  sharePercentage: number;
}

const PortalClienteDashboard = () => {
  const [session, setSession] = useState<ClientSession | null>(null);
  const [pendingPayments, setPendingPayments] = useState({ count: 0, total_amount: 0 });
  const [files, setFiles] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const sessionData = localStorage.getItem("clientPortalSession");
    if (!sessionData) {
      navigate("/portal-cliente");
      return;
    }

    const parsed = JSON.parse(sessionData);
    const parsedSession: ClientSession = {
      clientId: parsed.clientId,
      aircraftId: parsed.aircraftId,
      clientName: parsed.clientName || parsed.companyName,
      registration: parsed.aircraftInfo?.registration || parsed.registration,
      sharePercentage: parsed.sharePercentage || 0
    };
    setSession(parsedSession);
    void loadData(parsedSession);
  }, []);

  const loadData = async (s: ClientSession) => {
    try {
      // Load pending payments
      const { data: paymentsData } = await supabase
        .from("bank_reconciliations")
        .select("amount")
        .eq("client_id", s.clientId)
        .eq("status", "pendente") as any;

      if (paymentsData) {
        setPendingPayments({
          count: paymentsData.length,
          total_amount: paymentsData.reduce((sum: number, p: any) => sum + (p.amount || 0), 0)
        });
      }

      // Load files
      const { data: filesData } = await supabase
        .from("client_portal_files")
        .select("*")
        .eq("client_id", s.clientId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (filesData) {
        setFiles(filesData);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("clientPortalSession");
    navigate("/portal-cliente");
    toast.success("Logout realizado com sucesso");
  };

  if (!session) return null;

  return (
    <Layout>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-6 space-y-6">
          <div className="flex justify-between items-start bg-card border border-border rounded-lg p-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">{session.clientName}</h1>
              <p className="text-muted-foreground text-sm md:text-base">Aeronave: {session.registration} • {session.sharePercentage}% de participação</p>
            </div>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="px-4 py-2"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-foreground text-lg">
                <DollarSign className="w-5 h-5 text-primary" />
                Pagamentos Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground mb-1">R$ {pendingPayments.total_amount.toFixed(2)}</div>
              <p className="text-muted-foreground text-xs">{pendingPayments.count} pagamento(s) pendente(s)</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-foreground text-lg">
                <Plane className="w-5 h-5 text-primary" />
                Aeronave
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground mb-1">{session.registration}</div>
              <p className="text-muted-foreground text-xs">Em operação</p>
            </CardContent>
          </Card>
        </div>

        {/* Client Data Tabs */}
        <ClientDataTabs
          clientId={session.clientId}
          aircraftId={session.aircraftId}
          isAdmin={false}
        />
        </div>
      </div>
    </Layout>
  );
};

export default PortalClienteDashboard;
