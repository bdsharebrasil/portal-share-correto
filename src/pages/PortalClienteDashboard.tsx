// @ts-nocheck
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DollarSign, Plane, LogOut } from "lucide-react";
import { ClientDataTabs } from "@/components/portal-cliente/ClientDataTabs";

interface ClientSession {
  clientId: string;
  aircraftId: string;
  clientName: string;
  registration: string;
  sharePercentage: number;
}

interface ClientDetails {
  razao_social: string | null;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
}

const PortalClienteDashboard = () => {
  const [session, setSession] = useState<ClientSession | null>(null);
  const [clientDetails, setClientDetails] = useState<ClientDetails | null>(null);
  const [pendingPayments, setPendingPayments] = useState({ count: 0, total_amount: 0 });
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
      aircraftId: parsed.aeronaveId || parsed.aircraftId,
      clientName: parsed.clientName || parsed.companyName,
      registration: parsed.aeronaveInfo?.registration || parsed.registration,
      sharePercentage: parsed.sharePercentage || 0,
    };

    setSession(parsedSession);
    void loadData(parsedSession);
  }, [navigate]);

  const loadData = async (s: ClientSession) => {
    try {
      const { data: clientData } = await supabase
        .from("clientes")
        .select("razao_social, cnpj, email, telefone, endereco, cidade, uf")
        .eq("id", s.clientId)
        .maybeSingle();

      if (clientData) {
        setClientDetails(clientData);
      }

      // Load pending payments
      const { data: bankData } = await supabase
        .from("conciliacoes_bancarias")
        .select("valor, saldo_pendente, status")
        .eq("clientes_id", s.clientId)
        .eq("aeronave_id", s.aircraftId)
        .or("status.is.null,status.in.(pendente,enviado,aberto)");

      const { data: receiptsData } = await supabase
        .from("recibos")
        .select("valor, status")
        .eq("cliente_id", s.clientId)
        .eq("aeronave_id", s.aircraftId)
        .eq("tipo_recibo", "reembolso")
        .or("status.is.null,status.in.(pendente,enviado,aberto)");

      let totalCount = 0;
      let totalAmount = 0;

      if (bankData) {
        totalCount += bankData.length;
        totalAmount += bankData.reduce((sum: number, p: any) => {
          const valor = p.saldo_pendente ?? p.valor ?? 0;
          return sum + Number(valor || 0);
        }, 0);
      }

      if (receiptsData) {
        totalCount += receiptsData.length;
        totalAmount += receiptsData.reduce((sum: number, r: any) => {
          return sum + Math.abs(Number(r.valor || 0));
        }, 0);
      }

      setPendingPayments({ count: totalCount, total_amount: totalAmount });
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
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">
                {clientDetails?.razao_social || session.clientName}
              </h1>
              <p className="text-muted-foreground text-sm md:text-base">
                Aeronave: {session.registration} • {session.sharePercentage}% de participação
              </p>
              {clientDetails && (
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {clientDetails.cnpj && <p>CNPJ: {clientDetails.cnpj}</p>}
                  {(clientDetails.email || clientDetails.telefone) && (
                    <p>
                      {clientDetails.email ? `Email: ${clientDetails.email}` : ""}
                      {clientDetails.email && clientDetails.telefone ? " • " : ""}
                      {clientDetails.telefone ? `Tel: ${clientDetails.telefone}` : ""}
                    </p>
                  )}
                  {clientDetails.endereco && (
                    <p>
                      Endereço: {clientDetails.endereco}
                      {(clientDetails.cidade || clientDetails.uf) &&
                        `, ${clientDetails.cidade || ""}${clientDetails.cidade && clientDetails.uf ? " - " : ""}${clientDetails.uf || ""}`}
                    </p>
                  )}
                </div>
              )}
            </div>

            <Button variant="outline" onClick={handleLogout} className="px-4 py-2">
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-foreground text-lg">
                  <DollarSign className="w-5 h-5 text-primary" />
                  Saldo Devedor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground mb-1">
                  R$ {pendingPayments.total_amount.toFixed(2)}
                </div>
                <p className="text-muted-foreground text-xs">
                  {pendingPayments.count} item(ns) pendente(s)
                </p>
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

          <ClientDataTabs
            clientId={session.clientId}
            clientName={clientDetails?.razao_social || session.clientName}
            aircraftId={session.aircraftId}
            aircraftRegistration={session.registration}
            isAdmin={false}
          />
        </div>
      </div>
    </Layout>
  );
};

export default PortalClienteDashboard;
