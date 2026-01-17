import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Download, Printer } from 'lucide-react';
import type { RAS } from '@/types/maintenance';

interface RASDetailModalProps {
  ras: RAS | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig = {
  pendente: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800' },
  em_andamento: { label: 'Em Andamento', className: 'bg-blue-100 text-blue-800' },
  concluido: { label: 'Concluído', className: 'bg-green-100 text-green-800' },
};

export function RASDetailModal({ ras, open, onOpenChange }: RASDetailModalProps) {
  if (!ras) return null;

  const config = statusConfig[ras.status as keyof typeof statusConfig];
  const date = new Date(ras.date).toLocaleDateString('pt-BR');
  const completionDate = ras.completionDate ? new Date(ras.completionDate).toLocaleDateString('pt-BR') : 'N/A';

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    // TODO: Implement PDF export
    console.log('Exporting to PDF...');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle>RAS #{ras.serviceOrderNumber}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Relatório de Acompanhamento de Serviço
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleExport}
                title="Exportar para PDF"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrint}
                title="Imprimir"
              >
                <Printer className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 print:space-y-4">
          {/* Header Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informações Gerais</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Centro de Manutenção</p>
                <p className="font-semibold">{ras.maintenanceCenter}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tipo de Manutenção</p>
                <p className="font-semibold capitalize">{ras.maintenanceType}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Data</p>
                <p className="font-semibold">{date}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge className={config.className}>{config.label}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Responsible Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Responsável</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Mecânico Responsável</p>
                <p className="font-semibold">{ras.responsibleMechanic}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Data de Conclusão</p>
                <p className="font-semibold">{completionDate}</p>
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Descrição</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-2">Inspeções Realizadas</p>
                <div className="bg-muted/50 rounded p-3 text-sm whitespace-pre-wrap">
                  {ras.description}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Detalhes Técnicos</p>
                <div className="bg-muted/50 rounded p-3 text-sm whitespace-pre-wrap">
                  {ras.inspectionDetails}
                </div>
              </div>
              {ras.observations && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Observações</p>
                  <div className="bg-muted/50 rounded p-3 text-sm whitespace-pre-wrap">
                    {ras.observations}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cost Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Breakdown de Custos</CardTitle>
            </CardHeader>
            <CardContent>
              {ras.costItems && ras.costItems.length > 0 ? (
                <div className="space-y-2">
                  {ras.costItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium">{item.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity}x @ R$ {item.unitValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <p className="font-semibold">
                        R$ {item.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-3 border-t-2 font-bold">
                    <span>Total</span>
                    <span className="text-lg">
                      R$ {ras.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum custo registrado</p>
              )}
            </CardContent>
          </Card>

          {/* Photos */}
          {ras.photos && ras.photos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fotos da Manutenção</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {ras.photos.map((photo) => (
                    <div key={photo.id} className="space-y-2">
                      <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-muted">
                        <img
                          src={photo.url}
                          alt={photo.description || 'Maintenance photo'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {photo.description && (
                        <p className="text-xs text-muted-foreground text-center">
                          {photo.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Motor Hours */}
          {ras.motorHours && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Horas de Motor</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{ras.motorHours} horas</p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
