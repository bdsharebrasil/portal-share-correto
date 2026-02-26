import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ProgressBar } from "./ProgressBar";
import { TrendingUp, Target, Calendar, Pencil } from "lucide-react";

interface PerformanceMetric {
  label: string;
  current: number;
  target: number;
  variant: "primary" | "success" | "warning" | "destructive";
}

// default metrics used when there is no stored configuration
const defaultMetrics: PerformanceMetric[] = [
  { label: "Receitas vs Meta", current: 85000, target: 100000, variant: "primary" },
  { label: "Redução de Custos", current: 72, target: 100, variant: "success" },
  { label: "Novos Clientes", current: 8, target: 10, variant: "warning" },
  { label: "Projetos Concluídos", current: 12, target: 15, variant: "primary" },
];


export function MonthlyPerformance() {
  const currentMonth = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  // load metrics from localStorage or default
  const [metrics, setMetrics] = useState<PerformanceMetric[]>(() => {
    try {
      const stored = localStorage.getItem('monthlyPerformanceMetrics');
      if (stored) return JSON.parse(stored);
    } catch {}
    return defaultMetrics;
  });

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editedMetrics, setEditedMetrics] = useState<PerformanceMetric[]>(metrics);

  const openEdit = () => {
    setEditedMetrics(metrics.map(m => ({ ...m }))); // clone
    setEditDialogOpen(true);
  };

  const saveEdits = () => {
    setMetrics(editedMetrics);
    try {
      localStorage.setItem('monthlyPerformanceMetrics', JSON.stringify(editedMetrics));
    } catch {}
    setEditDialogOpen(false);
  };

  return (
    <>
      <Card className="border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-foreground">
                  Performance Mensal
                </CardTitle>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {currentMonth}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 text-success text-sm font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              +15%
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {metrics.map((metric, index) => (
            <ProgressBar
              key={index}
              label={metric.label}
              value={metric.current}
              max={metric.target}
              variant={metric.variant}
              size="md"
            />
          ))}
        </CardContent>
      </Card>
      <div className="mt-2 text-right">
        <Button size="sm" onClick={openEdit} className="gap-1">
          <Pencil className="h-4 w-4" />
          Editar metas
        </Button>
      </div>

      {/* Edit dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Metas da Performance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editedMetrics.map((m, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                <div>
                  <Label>{m.label}</Label>
                </div>
                <div>
                  <Label>Atual</Label>
                  <Input
                    type="number"
                    value={m.current}
                    onChange={e => {
                      const v = parseFloat(e.target.value) || 0;
                      setEditedMetrics(prev => {
                        const copy = [...prev];
                        copy[idx].current = v;
                        return copy;
                      });
                    }}
                  />
                </div>
                <div>
                  <Label>Meta</Label>
                  <Input
                    type="number"
                    value={m.target}
                    onChange={e => {
                      const v = parseFloat(e.target.value) || 0;
                      setEditedMetrics(prev => {
                        const copy = [...prev];
                        copy[idx].target = v;
                        return copy;
                      });
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveEdits}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
