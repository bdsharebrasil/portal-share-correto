import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import type { AirworthinessDirective, ServiceBulletin } from '@/types/maintenance';
import { cn } from '@/lib/utils';

interface ADSBControlCardProps {
  ads: AirworthinessDirective[];
  sbs: ServiceBulletin[];
  onNewAD?: () => void;
  onNewSB?: () => void;
  onDeleteAD?: (id: string) => void;
  onDeleteSB?: (id: string) => void;
}

const statusConfig = {
  pendente: { label: 'Pendente', className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200' },
  em_progresso: { label: 'Em Progresso', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200' },
  concluido: { label: 'Concluído', className: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200' },
};

const ADItem = ({
  ad,
  onDelete,
}: {
  ad: AirworthinessDirective;
  onDelete?: (id: string) => void;
}) => {
  const dueDate = ad.dueDate ? new Date(ad.dueDate).toLocaleDateString('pt-BR') : 'N/A';
  const config = statusConfig[ad.status as keyof typeof statusConfig];

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-4 hover:bg-muted/50 transition-colors">
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-sm">{ad.adNumber}</h4>
          <Badge className={cn('text-xs', config.className)}>
            {config.label}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{ad.title}</p>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span>Emissão: {new Date(ad.issueDate).toLocaleDateString('pt-BR')}</span>
          <span>Vencimento: {dueDate}</span>
        </div>
        {ad.observations && (
          <p className="text-xs bg-muted/50 rounded p-2 mt-2">{ad.observations}</p>
        )}
      </div>

      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20"
          onClick={() => {
            if (window.confirm('Tem certeza?')) {
              onDelete(ad.id);
            }
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

const SBItem = ({
  sb,
  onDelete,
}: {
  sb: ServiceBulletin;
  onDelete?: (id: string) => void;
}) => {
  const dueDate = sb.dueDate ? new Date(sb.dueDate).toLocaleDateString('pt-BR') : 'N/A';
  const config = statusConfig[sb.status as keyof typeof statusConfig];

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-4 hover:bg-muted/50 transition-colors">
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-sm">{sb.sbNumber}</h4>
          <Badge className={cn('text-xs', config.className)}>
            {config.label}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{sb.title}</p>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span>Emissão: {new Date(sb.issueDate).toLocaleDateString('pt-BR')}</span>
          <span>Vencimento: {dueDate}</span>
        </div>
        {sb.observations && (
          <p className="text-xs bg-muted/50 rounded p-2 mt-2">{sb.observations}</p>
        )}
      </div>

      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/20"
          onClick={() => {
            if (window.confirm('Tem certeza?')) {
              onDelete(sb.id);
            }
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

export function ADSBControlCard({
  ads,
  sbs,
  onNewAD,
  onNewSB,
  onDeleteAD,
  onDeleteSB,
}: ADSBControlCardProps) {
  const pendingADs = ads.filter(ad => ad.status === 'pendente');
  const pendingSBs = sbs.filter(sb => sb.status === 'pendente');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Diretrizes e Boletins de Serviço
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="ads" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ads" className="gap-2">
              AD ({ads.length})
              {pendingADs.length > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {pendingADs.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="sbs" className="gap-2">
              SB ({sbs.length})
              {pendingSBs.length > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {pendingSBs.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ads" className="space-y-4">
            {onNewAD && (
              <Button onClick={onNewAD} size="sm" className="gap-2 w-full">
                <Plus className="h-4 w-4" />
                Novo AD
              </Button>
            )}
            {ads.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhuma Diretriz de Aeronavegabilidade registrada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {ads.map(ad => (
                  <ADItem key={ad.id} ad={ad} onDelete={onDeleteAD} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="sbs" className="space-y-4">
            {onNewSB && (
              <Button onClick={onNewSB} size="sm" className="gap-2 w-full">
                <Plus className="h-4 w-4" />
                Novo SB
              </Button>
            )}
            {sbs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhum Boletim de Serviço registrado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sbs.map(sb => (
                  <SBItem key={sb.id} sb={sb} onDelete={onDeleteSB} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
