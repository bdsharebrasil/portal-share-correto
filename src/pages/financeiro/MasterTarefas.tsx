import { Layout } from "@/components/layout/Layout";
import TarefasKanban from "@/components/tarefas/TarefasKanban";
import { TopMenu } from "@/components/master/TopMenu";
import { ClipboardList } from "lucide-react";

export default function MasterTarefas() {
  return (
    <Layout>
      <div className="space-y-6 pb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <ClipboardList className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tarefas da Equipe</h1>
            <p className="text-sm text-muted-foreground">
              Quadro Kanban com todas as tarefas delegadas
            </p>
          </div>
        </div>
        <TopMenu />
        <TarefasKanban />
      </div>
    </Layout>
  );
}