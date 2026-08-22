import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Network, Building2, ClipboardList, FileBarChart2, Palmtree } from "lucide-react";
import { ColaboradoresListTab } from "./ColaboradoresListTab";
import { OrgChartEditableTab } from "./OrgChartEditableTab";
import { OrganigramaVisual } from "./OrganigramaVisual";
import { FeriasDecimosTab } from "./FeriasDecimosTab";
import { EstruturaDepartamentosTab } from "./EstruturaDepartamentosTab";
import { ColaboradorExtratoGestor } from "./ColaboradorExtratoGestor";
import { VacationManagement } from "@/components/Ferias/VacationManagement";
import { PageHeader, SectionCard, tabsListClass, tabTriggerClass } from "../ui/Premium";

export function Colaboradores() {
  return (
    <div className="w-full max-w-full min-w-0 space-y-5 overflow-x-hidden">
      <PageHeader icon={Users} title="Colaboradores" subtitle="Prontuário gerencial, aprovações de férias, frequência e histórico financeiro" />
      <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm text-muted-foreground">
        <strong className="text-foreground">Fluxo:</strong> colaborador solicita → Gestor Master aprova ou recusa o período → férias ficam agendadas → Contabilidade apura direitos e documentos → Financeiro registra o pagamento.
      </div>
      <Tabs defaultValue="lista" className="w-full min-w-0 space-y-4">
        <TabsList className={`${tabsListClass} max-w-full overflow-x-auto`}>
          <TabsTrigger value="lista" className={tabTriggerClass}><Users className="h-4 w-4" /> Lista</TabsTrigger>
          <TabsTrigger value="extratos" className={tabTriggerClass}><FileBarChart2 className="h-4 w-4" /> Extrato completo</TabsTrigger>
          <TabsTrigger value="ferias-aprovacoes" className={tabTriggerClass}><ClipboardList className="h-4 w-4" /> Aprovar férias</TabsTrigger>
          <TabsTrigger value="ferias-decimos" className={tabTriggerClass}><Palmtree className="h-4 w-4" /> Férias e 13º</TabsTrigger>
          <TabsTrigger value="organograma-editavel" className={tabTriggerClass}><Network className="h-4 w-4" /> Organograma</TabsTrigger>
          <TabsTrigger value="estrutura" className={tabTriggerClass}><Building2 className="h-4 w-4" /> Estrutura</TabsTrigger>
        </TabsList>
        <TabsContent value="lista" className="min-w-0 focus-visible:outline-none"><ColaboradoresListTab /></TabsContent>
        <TabsContent value="extratos" className="min-w-0 focus-visible:outline-none"><ColaboradorExtratoGestor /></TabsContent>
        <TabsContent value="ferias-aprovacoes" className="min-w-0 focus-visible:outline-none"><VacationManagement /></TabsContent>
        <TabsContent value="ferias-decimos" className="min-w-0 focus-visible:outline-none"><FeriasDecimosTab /></TabsContent>
        <TabsContent value="organograma-editavel" className="min-w-0 focus-visible:outline-none"><OrgChartEditableTab /></TabsContent>
        <TabsContent value="estrutura" className="min-w-0 space-y-4 focus-visible:outline-none"><SectionCard title="Estrutura organizacional" subtitle="Visualização hierárquica dos departamentos" icon={Building2} action={<EstruturaDepartamentosTab triggerOnly />}><OrganigramaVisual /></SectionCard></TabsContent>
      </Tabs>
    </div>
  );
}
