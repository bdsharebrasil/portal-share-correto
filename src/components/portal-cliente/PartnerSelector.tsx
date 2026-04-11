// @ts-nocheck
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { User, Users, Percent, ChevronRight, ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export interface PartnerInfo {
  id?: string;
  index: number;
  nome: string;
  name?: string;
  cpf?: string;
  percentage: number;
}

interface PartnerSelectorProps {
  clientId: string;
  clientName: string;
  onSelectPartner: (partner: PartnerInfo | null) => void;
  onBack: () => void;
}

export function PartnerSelector({
  clientId,
  clientName,
  onSelectPartner,
  onBack
}: PartnerSelectorProps) {
  const [partners, setPartners] = useState<PartnerInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPartners();
  }, [clientId]);

  const loadPartners = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('socios_cliente')
        .select('id, nome, cpf, percentual_participacao')
        .eq('cliente_id', clientId)
        .order('criado_em');

      if (error) {
        console.error('Erro ao buscar sócios:', error);
        setPartners([]);
        return;
      }

      const partnersList: PartnerInfo[] = (data || []).map((partner, index) => ({
        id: partner.id,
        index: index + 1,
        nome: partner.nome,
        name: partner.nome,
        cpf: partner.cpf || undefined,
        percentage: partner.percentual_participacao || 33.33
      }));

      setPartners(partnersList);

      if (partnersList.length === 0) {
        onSelectPartner(null);
      }
    } catch (error) {
      console.error('Erro ao carregar sócios:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="icon" onClick={onBack} className="h-10 w-10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">Selecione seu Perfil</h1>
            <p className="text-muted-foreground text-base mt-2">Escolha o sócio para acessar os dados</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (partners.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6 mb-8">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="outline" size="icon" onClick={onBack} className="h-10 w-10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">Selecione seu Perfil</h1>
          <p className="text-muted-foreground text-base mt-2">
            Escolha o sócio para acessar os dados e despesas específicas em <span className="font-semibold text-foreground">{clientName}</span>
          </p>
        </div>
      </div>

      <div className="flex justify-center mb-8">
        <Button onClick={() => onSelectPartner(null)} variant="secondary" size="lg" className="gap-2">
          Ver Dados Consolidados (Todos os Sócios)
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {partners.map((partner) => (
          <Card
            key={partner.index}
            className="border border-white/10 bg-slate-800/30 backdrop-blur-sm cursor-pointer hover:bg-slate-800/50 transition-all hover:border-emerald-500/50"
            onClick={() => onSelectPartner(partner)}
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-emerald-500/20">
                  <User className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-semibold text-foreground truncate">
                    {partner.nome}
                  </p>
                  {partner.cpf && (
                    <p className="text-xs text-muted-foreground">CPF: {partner.cpf}</p>
                  )}
                </div>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Percent className="h-4 w-4" />
                  Participação
                </div>
                <Badge className="bg-emerald-500 text-white">
                  {partner.percentage.toFixed(2)}%
                </Badge>
              </div>

              <div className="pt-2 border-t border-white/10">
                <p className="text-xs text-muted-foreground mb-2">
                  Clique para acessar seus dados e despesas específicas
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between hover:bg-emerald-500/20"
                  onClick={() => onSelectPartner(partner)}
                >
                  Acessar Portal
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        <Card
          className="border border-white/10 bg-slate-800/30 backdrop-blur-sm cursor-pointer hover:bg-slate-800/50 transition-all hover:border-blue-500/50"
          onClick={() => onSelectPartner(null)}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-500/20">
                <Users className="h-5 w-5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-semibold text-foreground">Consolidado</p>
                <p className="text-xs text-muted-foreground">Ver dados de todos os sócios</p>
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Percent className="h-4 w-4" />
                Visão
              </div>
              <Badge variant="secondary">100%</Badge>
            </div>

            <div className="pt-2 border-t border-white/10">
              <p className="text-xs text-muted-foreground mb-2">
                Acesse uma visão consolidada com todos os dados e despesas da empresa
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between hover:bg-blue-500/20"
                onClick={() => onSelectPartner(null)}
              >
                Acessar Consolidado
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
