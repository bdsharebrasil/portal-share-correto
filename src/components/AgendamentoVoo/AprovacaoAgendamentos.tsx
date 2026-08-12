import { Layout } from "@/components/layout/Layout";
import { FluxoAgendamentoVoo } from "@/components/AgendamentoVoo/FluxoAgendamentoVoo";

export default function AprovacaoAgendamentos() {
  return (
    <Layout>
      <div className="p-6">
        <FluxoAgendamentoVoo />
      </div>
    </Layout>
  );
}
