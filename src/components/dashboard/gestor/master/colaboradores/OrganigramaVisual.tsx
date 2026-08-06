import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Building2 } from "lucide-react";

interface Departamento {
  id: string;
  nome: string;
  descricao: string | null;
  cor: string | null;
  departamento_pai_id: string | null;
}

interface Colaborador {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface ColaboradorDepartamento {
  id: string;
  colaborador_id: string;
  departamento_id: string;
  cargo: string | null;
  colaborador?: Colaborador;
}

interface OrgNode {
  depto: Departamento;
  children: OrgNode[];
}

export function OrganigramaVisual() {
  const { data: departamentos = [] } = useQuery({
    queryKey: ["departamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departamentos")
        .select("*")
        .order("nome");

      if (error) throw error;
      return data as Departamento[];
    },
  });

  const { data: membros = [] } = useQuery({
    queryKey: ["colaborador-departamento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaborador_departamento")
        .select("id, colaborador_id, departamento_id, cargo");

      if (error) throw error;

      const colaboradorIds = data.map((m: any) => m.colaborador_id);
      const { data: colaboradoresData } = await supabase
        .from("user_profiles")
        .select("id, full_name, avatar_url")
        .in("id", colaboradorIds);

      return (data as ColaboradorDepartamento[]).map((m) => ({
        ...m,
        colaborador: colaboradoresData?.find((c) => c.id === m.colaborador_id) ?? undefined,
      }));
    },
  });

  // Construir árvore hierárquica
  const buildTree = (): OrgNode[] => {
    const deptoMap = new Map<string, OrgNode>();

    // Criar nós para todos os departamentos
    departamentos.forEach((depto) => {
      deptoMap.set(depto.id, { depto, children: [] });
    });

    // Conectar parent-child
    const roots: OrgNode[] = [];
    departamentos.forEach((depto) => {
      const node = deptoMap.get(depto.id)!;
      if (depto.departamento_pai_id) {
        const parent = deptoMap.get(depto.departamento_pai_id);
        if (parent) {
          parent.children.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const tree = buildTree();

  const getMembrosDoDepto = (deptId: string) => {
    return membros.filter((m) => m.departamento_id === deptId);
  };

  const DepartamentoNode = ({ node, level = 0 }: { node: OrgNode; level?: number }) => {
    const hasChildren = node.children.length > 0;
    const backgroundColor = node.depto.cor || "#3b82f6";

    return (
      <div className="flex flex-col items-center">
        {/* Box do Departamento */}
        <div
          className="px-4 py-2 rounded-full text-white font-bold text-sm whitespace-nowrap shadow-lg min-w-max"
          style={{ backgroundColor }}
        >
          {node.depto.nome}
        </div>

        <div className="mt-3 w-full max-w-xs">
          {getMembrosDoDepto(node.depto.id).map((membro) => (
            <div
              key={membro.id}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2 mt-2"
            >
              <div className="h-8 w-8 rounded-full bg-slate-800 text-xs font-bold text-white flex items-center justify-center">
                {membro.colaborador ? membro.colaborador.full_name.slice(0, 2).toUpperCase() : "?"}
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-white truncate">
                  {membro.colaborador?.full_name || "Colaborador"}
                </p>
                {membro.cargo && (
                  <p className="text-[11px] text-slate-300 truncate">{membro.cargo}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Se tem filhos, mostra linha conectora e filhos */}
        {hasChildren && (
          <div className="flex flex-col items-center mt-6">
            {/* Linha vertical para baixo */}
            <div className="w-0.5 h-8 bg-gray-400"></div>

            {/* Linha horizontal conectando os filhos */}
            <div className="flex items-start">
              <div className="h-0.5 bg-gray-400" style={{ width: `${(node.children.length - 1) * 120}px` }}></div>

              <div className="flex gap-24">
                {node.children.map((child, idx) => (
                  <div key={child.depto.id} className="flex flex-col items-center relative">
                    {/* Linha vertical conectando a linha horizontal ao departamento */}
                    <div className="w-0.5 h-8 bg-gray-400 absolute -top-8"></div>

                    {/* Renderiza o departamento filho recursivamente */}
                    <div className="mt-0">
                      <DepartamentoNode node={child} level={level + 1} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Se não tem departamentos, mostra mensagem
  if (departamentos.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
        <p className="text-muted-foreground">Nenhum departamento cadastrado</p>
        <p className="text-sm text-muted-foreground mt-2">
          Crie departamentos para visualizar o organograma
        </p>
      </Card>
    );
  }

  return (
    <div className="w-full overflow-x-auto bg-white/5 rounded-lg p-8">
      <div className="flex flex-col items-center gap-8">
        {/* Empresa no topo */}
        <div
          className="px-6 py-3 rounded-full text-white font-bold text-base shadow-lg"
          style={{ backgroundColor: "#1e40af" }}
        >
          Share Brasil
        </div>

        {/* Linha conectora da empresa */}
        {tree.length > 0 && (
          <div className="flex flex-col items-center">
            <div className="w-0.5 h-8 bg-gray-400"></div>
          </div>
        )}

        {/* Raízes da árvore (departamentos principais) */}
        {tree.length > 0 && (
          <div>
            {tree.length === 1 ? (
              // Se tem apenas 1 raiz, centraliza
              <DepartamentoNode node={tree[0]} />
            ) : (
              // Se tem múltiplas raízes, coloca lado a lado
              <div className="flex gap-32 items-start">
                {tree.map((root) => (
                  <div key={root.depto.id} className="flex flex-col items-center">
                    <DepartamentoNode node={root} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
