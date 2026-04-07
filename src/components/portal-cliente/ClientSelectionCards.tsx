import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plane } from "lucide-react";

interface ClientAircraft {
  id_aeronave: string;
  percentual_sociedade: number;
  aeronave: {
    id: string;
    matricula: string;
    fabricante: string;
    modelo: string;
    ano: string;
  };
}

interface Client {
  id: string;
  razao_social: string;
  status: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  uf?: string;
  financial_contact?: string;
  inscricao_estadual?: string;
  proprietario?: string;
  observations?: string;
  logo_url?: string;
  cotistas_aeronave?: ClientAircraft[];
}

interface ClientSelectionCardsProps {
  clients: Client[];
  onSelectClient: (client: Client, aircraft: ClientAircraft) => void;
  loading: boolean;
  searchQuery?: string;
}

export function ClientSelectionCards({
  clients,
  onSelectClient,
  loading,
  searchQuery = ""
}: ClientSelectionCardsProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Carregando clientes...</div>
      </div>
    );
  }

  let clientsWithAircraft = clients.filter(
    (client) => client.cotistas_aeronave && client.cotistas_aeronave.length > 0
  );

  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    clientsWithAircraft = clientsWithAircraft.filter((client) =>
      client.razao_social.toLowerCase().includes(query) ||
      client.cotistas_aeronave?.some(a =>
        a.aeronave.matricula.toLowerCase().includes(query) ||
        a.aeronave.fabricante.toLowerCase().includes(query) ||
        a.aeronave.modelo.toLowerCase().includes(query)
      )
    );
  }

  if (clientsWithAircraft.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground text-center">
          <p className="mb-2">Nenhum cliente encontrado</p>
          <p className="text-sm">Tente ajustar os filtros ou termos de busca</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media (max-width: 991px) {
          .client-selection-grid {
            box-shadow: 1px 1px 2px 0 rgba(0, 0, 0, 1);
          }
          .client-card-wrapper {
            box-shadow: 1px 1px 0 0 rgba(0, 0, 0, 1);
          }
        }
      `}</style>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 client-selection-grid">
        {clientsWithAircraft.map((client) => (
          <div
            key={client.id}
            className="group relative h-full client-card-wrapper"
          >
            {/* Glass morphism background */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-lg blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <Card className="relative h-full border border-slate-700/40 bg-gradient-to-br from-slate-900/60 via-slate-900/50 to-slate-900/60 dark:from-slate-950/80 dark:via-slate-950/70 dark:to-slate-950/80 backdrop-blur-sm shadow-lg hover:shadow-xl hover:from-slate-900/70 hover:via-slate-900/60 hover:to-slate-900/70 dark:hover:from-slate-950/90 dark:hover:via-slate-950/80 dark:hover:to-slate-950/90 transition-all duration-300 hover:border-slate-600/60 dark:hover:border-slate-700/80">
              <CardContent className="p-4 flex flex-col h-full">
                {/* Header */}
                <div className="mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-foreground truncate">
                      {client.razao_social}
                    </h3>
                  </div>
                </div>

                {/* Aircraft List */}
                <div className="flex-1 mb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Aeronaves ({client.cotistas_aeronave?.length || 0})
                  </p>
                  <div className="space-y-1.5">
                    {client.cotistas_aeronave?.slice(0, 2).map((aircraft, idx) => (
                      <div
                        key={idx}
                        className="group/aircraft p-2 rounded-md bg-slate-800/50 dark:bg-slate-900/60 border border-slate-700/30 dark:border-slate-800/50 hover:bg-slate-800/70 dark:hover:bg-slate-900/80 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-xs text-foreground truncate">
                              {aircraft.aeronave.matricula}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate line-clamp-1">
                              {aircraft.aeronave.fabricante} {aircraft.aeronave.modelo}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-xs bg-primary/30 text-primary/90 px-1.5 py-0 whitespace-nowrap">
                            {aircraft.percentual_sociedade}%
                          </Badge>
                        </div>
                      </div>
                    ))}

                    {(client.cotistas_aeronave?.length || 0) > 2 && (
                      <p className="text-xs text-muted-foreground pt-1 pl-2 italic">
                        +{(client.cotistas_aeronave?.length || 0) - 2} aeronave(s)
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-1.5 pt-3 border-t border-slate-700/30 dark:border-slate-800/50">
                  {client.cotistas_aeronave && client.cotistas_aeronave.length === 1 ? (
                    <Button
                      onClick={() => onSelectClient(client, client.cotistas_aeronave![0])}
                      className="w-full h-7 bg-primary/40 hover:bg-primary/50 backdrop-blur-sm border border-primary/30 hover:border-primary/50 text-white font-semibold text-xs gap-1.5 transition-all duration-300"
                    >
                      <Plane className="h-3 w-3" />
                      Acessar
                    </Button>
                  ) : (
                    client.cotistas_aeronave?.slice(0, 2).map((aircraft, idx) => (
                      <Button
                        key={idx}
                        onClick={() => onSelectClient(client, aircraft)}
                        variant="outline"
                        className="w-full h-7 text-xs border-slate-700/40 dark:border-slate-800/50 hover:border-slate-600 dark:hover:border-slate-700 gap-1"
                      >
                        <Plane className="h-3 w-3" />
                        <span className="truncate">{aircraft.aeronave.matricula}</span>
                      </Button>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </>
  );
}
