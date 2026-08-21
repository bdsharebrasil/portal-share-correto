import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  ArrowLeft,
  FileSignature,
  Printer,
  Plus,
  Trash2,
  RefreshCw,
  FolderPlus,
  FolderOpen,
  Save,
  ChevronDown,
  ChevronUp,
  Plane,
  UserRound,
  MapPin,
  CalendarDays,
  Clock3,
  ReceiptText,
  Percent,
  Sparkles,
  Check,
  Copy,
  Settings2,
  FileText,
  WalletCards,
  Eye,
  Layers3,
  CircleCheck,
} from "lucide-react";

import {
  Item,
  PropostaSalva,
  PropostaPasta,
  usePropostas,
} from "@/hooks/usePropostas";

const uid = () => Math.random().toString(36).slice(2, 9);

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v || 0);

const gerarNumero = () =>
  `SHR-${new Date().getFullYear()}${String(
    new Date().getMonth() + 1
  ).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;

const formatarData = (value: string) => {
  if (!value) return "—";

  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const parseValor = (value: string) => {
  if (!value) return 0;

  const normalized = value
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  return Number(normalized) || 0;
};

const SectionHeader = ({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
}) => (
  <div className="flex items-start gap-3">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-400/15 bg-cyan-400/[0.07]">
      <Icon className="h-4 w-4 text-cyan-300" />
    </div>

    <div className="min-w-0">
      <h2 className="text-sm font-semibold tracking-tight text-foreground">
        {title}
      </h2>

      {description && (
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  </div>
);

const FieldLabel = ({
  children,
  optional = false,
}: {
  children: React.ReactNode;
  optional?: boolean;
}) => (
  <Label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
    {children}
    {optional && (
      <span className="normal-case tracking-normal text-muted-foreground">
        opcional
      </span>
    )}
  </Label>
);

const PanelCard = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={[
      "rounded-2xl border border-white/[0.07]",
      "bg-background/35",
      "shadow-[0_12px_40px_rgba(0,0,0,0.12)]",
      className,
    ].join(" ")}
  >
    {children}
  </div>
);

export default function CriarProposta() {
  const navigate = useNavigate();

  const [cliente, setCliente] = useState("");
  const [aeronave, setAeronave] = useState("");
  const [base, setBase] = useState("");
  const [data, setData] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [validade, setValidade] = useState("15");
  const [numero, setNumero] = useState(gerarNumero());

  const [marca, setMarca] = useState("SHARE BRASIL");

  const [abertura, setAbertura] = useState(
    "Apresentamos a seguir a proposta de gerenciamento de cota de aeronave, elaborada de forma personalizada para atender às necessidades operacionais e administrativas da sua operação."
  );

  const [fechamento, setFechamento] = useState(
    "Nossos serviços contemplam a gestão integral da aeronave, incluindo acompanhamento técnico, controle financeiro, apoio operacional e relatórios gerenciais periódicos."
  );

  const [mostrarVantagens, setMostrarVantagens] = useState(true);

  const [vantagens, setVantagens] = useState(
    "Equipe especializada em aviação executiva\nTransparência total nos custos e rateios\nPortal do cliente com acesso em tempo real\nRedução de custos operacionais comprovada"
  );

  const [itens, setItens] = useState<Item[]>([
    {
      id: uid(),
      nome: "Gerenciamento SHARE",
      valor: "",
    },
  ]);

  const [semNota, setSemNota] = useState(false);
  const [desconto, setDesconto] = useState("0");

  const [nomePasta, setNomePasta] = useState("");
  const [pastaSelecionada, setPastaSelecionada] = useState("");

  const [mensagemSalvar, setMensagemSalvar] = useState<string | null>(
    null
  );

  const [secaoPastasAberta, setSecaoPastasAberta] = useState(false);
  const [secaoConteudoAberta, setSecaoConteudoAberta] = useState(true);
  const [secaoInvestimentoAberta, setSecaoInvestimentoAberta] =
    useState(true);

  const {
    pastas,
    criarPasta,
    salvarProposta: salvarPropostaMutation,
  } = usePropostas();

  const subtotal = useMemo(
    () =>
      itens.reduce(
        (s, i) => s + parseValor(i.valor),
        0
      ),
    [itens]
  );

  const percentualDesconto = parseFloat(
    desconto.replace(",", ".")
  ) || 0;

  const valorDesconto =
    (subtotal * percentualDesconto) / 100;

  const total = Math.max(
    subtotal - valorDesconto,
    0
  );

  const quantidadeItens = itens.filter(
    (item) => item.nome.trim()
  ).length;

  const vantagensLista = vantagens
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  const updateItem = (
    id: string,
    patch: Partial<Item>
  ) => {
    setItens((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, ...patch }
          : item
      )
    );
  };

  const carregarProposta = (
    proposta: PropostaSalva
  ) => {
    setCliente(proposta.cliente);
    setAeronave(proposta.aeronave);
    setBase(proposta.base);
    setData(proposta.data);
    setValidade(proposta.validade);
    setNumero(proposta.numero);
    setMarca(proposta.marca);
    setAbertura(proposta.abertura);
    setFechamento(proposta.fechamento);
    setMostrarVantagens(proposta.mostrarVantagens);
    setVantagens(proposta.vantagens);
    setItens(proposta.itens);
    setSemNota(proposta.semNota);
    setDesconto(proposta.desconto);

    setMensagemSalvar(
      `Proposta "${proposta.nome}" carregada.`
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const salvarProposta = async () => {
    setMensagemSalvar(null);

    const nomeFinalPasta =
      nomePasta.trim();

    const titulo =
      cliente.trim() ||
      "Cliente sem nome";

    const proposta: PropostaSalva = {
      id: uid(),
      nome: titulo,
      numero,
      cliente,
      aeronave,
      base,
      data,
      validade,
      marca,
      abertura,
      fechamento,
      mostrarVantagens,
      vantagens,
      itens,
      semNota,
      desconto,
      criadoEm: new Date().toISOString(),
    };

    if (
      !nomeFinalPasta &&
      !pastaSelecionada
    ) {
      setMensagemSalvar(
        "Selecione uma pasta existente ou informe o nome de uma nova pasta."
      );
      setSecaoPastasAberta(true);
      return;
    }

    let pastaDestinoId =
      pastaSelecionada;

    let pastaDestinoNome =
      nomeFinalPasta;

    if (nomeFinalPasta) {
      const pastaExistente =
        pastas.find(
          (p) =>
            p.nome.toLowerCase() ===
            nomeFinalPasta.toLowerCase()
        );

      if (pastaExistente) {
        pastaDestinoId =
          pastaExistente.id;

        pastaDestinoNome =
          pastaExistente.nome;
      } else {
        try {
          const pasta =
            await criarPasta.mutateAsync(
              nomeFinalPasta
            );

          pastaDestinoId =
            pasta.id;

          pastaDestinoNome =
            pasta.nome;
        } catch {
          setMensagemSalvar(
            "Não foi possível criar a pasta. Verifique o nome e tente novamente."
          );
          return;
        }
      }
    }

    if (!pastaDestinoId) {
      setMensagemSalvar(
        "Não foi possível determinar a pasta de destino."
      );
      return;
    }

    try {
      await salvarPropostaMutation.mutateAsync(
        {
          pastaId: pastaDestinoId,
          proposta,
        }
      );

      setPastaSelecionada(
        pastaDestinoId
      );

      setNomePasta("");

      setMensagemSalvar(
        `Proposta salva em "${pastaDestinoNome}".`
      );
    } catch {
      setMensagemSalvar(
        "Erro ao salvar proposta no banco de dados."
      );
    }
  };

  const gerarNovaProposta = () => {
    setNumero(gerarNumero());
    setMensagemSalvar(null);
  };

  return (
    <Layout>
      <div className="min-h-screen w-full bg-[radial-gradient(circle_at_top_right,rgba(8,145,178,0.08),transparent_28%),radial-gradient(circle_at_top_left,rgba(148,163,184,0.04),transparent_25%)]">
        <div className="mx-auto w-full max-w-[1550px] px-4 pb-12 pt-4 sm:px-6 lg:px-8">

          {/* =========================================================
              HEADER DO WORKSPACE
          ========================================================= */}
          <div className="mb-6 print:hidden">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

              <div className="flex min-w-0 items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(-1)}
                  className="h-10 w-10 shrink-0 rounded-xl border border-white/[0.07] bg-white/[0.02] text-muted-foreground hover:bg-white/[0.06] hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>

                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-400/15 to-cyan-400/[0.03] shadow-[0_0_30px_rgba(34,211,238,0.08)]">
                  <FileSignature className="h-5 w-5 text-cyan-300" />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                      Criar proposta
                    </h1>

                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Em edição
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                    Crie uma proposta comercial premium para gerenciamento de cota de aeronave.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="hidden items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 lg:flex">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />

                  <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                    Proposta
                  </span>

                  <span className="font-mono text-xs font-semibold text-muted-foreground">
                    {numero}
                  </span>
                </div>

                <Button
                  variant="outline"
                  onClick={() => window.print()}
                  className="h-10 gap-2 rounded-xl border-white/[0.08] bg-white/[0.02] px-4 text-xs font-medium text-foreground shadow-none transition-all hover:border-cyan-400/20 hover:bg-cyan-400/[0.06] hover:text-cyan-200"
                >
                  <Printer className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    Exportar / PDF
                  </span>
                  <span className="sm:hidden">
                    PDF
                  </span>
                </Button>

                <Button
                  onClick={salvarProposta}
                  disabled={
                    salvarPropostaMutation.isPending ||
                    criarPasta.isPending
                  }
                  className="h-10 gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400 px-4 text-xs font-semibold text-slate-950 shadow-[0_8px_24px_rgba(34,211,238,0.15)] transition-all hover:bg-cyan-300 hover:shadow-[0_10px_30px_rgba(34,211,238,0.22)]"
                >
                  {salvarPropostaMutation.isPending ||
                  criarPasta.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}

                  {salvarPropostaMutation.isPending
                    ? "Salvando..."
                    : "Salvar proposta"}
                </Button>
              </div>
            </div>
          </div>

          {/* =========================================================
              GRID PRINCIPAL
          ========================================================= */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[410px_minmax(0,1fr)]">

            {/* =======================================================
                PAINEL DE EDIÇÃO
            ======================================================= */}
            <aside className="space-y-4 print:hidden">

              {/* IDENTIFICAÇÃO */}
              <PanelCard className="overflow-hidden">
                <div className="border-b border-white/[0.06] px-5 py-4">
                  <SectionHeader
                    icon={UserRound}
                    title="Identificação"
                    description="Dados principais da proposta e do cliente."
                  />
                </div>

                <div className="space-y-4 p-5">
                  <div>
                    <FieldLabel>
                      Cliente / cotista
                    </FieldLabel>

                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                      <Input
                        value={cliente}
                        onChange={(e) =>
                          setCliente(
                            e.target.value
                          )
                        }
                        placeholder="Nome do cliente"
                        className="h-11 rounded-xl border-white/[0.08] bg-white/[0.025] pl-10 text-sm text-white placeholder:text-muted-foreground focus:border-cyan-400/30 focus:ring-cyan-400/10"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <FieldLabel>
                        Aeronave
                      </FieldLabel>

                      <div className="relative">
                        <Plane className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                        <Input
                          value={aeronave}
                          onChange={(e) =>
                            setAeronave(
                              e.target.value
                            )
                          }
                          placeholder="Modelo"
                          className="h-11 rounded-xl border-white/[0.08] bg-white/[0.025] pl-10 text-sm text-white placeholder:text-muted-foreground focus:border-cyan-400/30 focus:ring-cyan-400/10"
                        />
                      </div>
                    </div>

                    <div>
                      <FieldLabel>
                        Base / cidade
                      </FieldLabel>

                      <div className="relative">
                        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                        <Input
                          value={base}
                          onChange={(e) =>
                            setBase(
                              e.target.value
                            )
                          }
                          placeholder="São Paulo"
                          className="h-11 rounded-xl border-white/[0.08] bg-white/[0.025] pl-10 text-sm text-white placeholder:text-muted-foreground focus:border-cyan-400/30 focus:ring-cyan-400/10"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <FieldLabel>
                        Data
                      </FieldLabel>

                      <div className="relative">
                        <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                        <Input
                          type="date"
                          value={data}
                          onChange={(e) =>
                            setData(
                              e.target.value
                            )
                          }
                          className="h-11 rounded-xl border-white/[0.08] bg-white/[0.025] pl-10 text-sm text-white focus:border-cyan-400/30 focus:ring-cyan-400/10"
                        />
                      </div>
                    </div>

                    <div>
                      <FieldLabel>
                        Validade
                      </FieldLabel>

                      <div className="relative">
                        <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                        <Input
                          type="number"
                          min="1"
                          value={validade}
                          onChange={(e) =>
                            setValidade(
                              e.target.value
                            )
                          }
                          className="h-11 rounded-xl border-white/[0.08] bg-white/[0.025] pl-10 pr-14 text-sm text-white focus:border-cyan-400/30 focus:ring-cyan-400/10"
                        />

                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-wider text-muted-foreground">
                          dias
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <FieldLabel>
                      Número da proposta
                    </FieldLabel>

                    <div className="flex gap-2">
                      <div className="relative min-w-0 flex-1">
                        <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                        <Input
                          value={numero}
                          onChange={(e) =>
                            setNumero(
                              e.target.value
                            )
                          }
                          className="h-11 rounded-xl border-white/[0.08] bg-white/[0.025] pl-10 font-mono text-xs text-white focus:border-cyan-400/30 focus:ring-cyan-400/10"
                        />
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={
                          gerarNovaProposta
                        }
                        title="Gerar novo número"
                        className="h-11 w-11 shrink-0 rounded-xl border-white/[0.08] bg-white/[0.025] text-muted-foreground hover:border-cyan-400/20 hover:bg-cyan-400/[0.05] hover:text-cyan-300"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </PanelCard>

              {/* INVESTIMENTO */}
              <PanelCard className="overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setSecaoInvestimentoAberta(
                      !secaoInvestimentoAberta
                    )
                  }
                  className="flex w-full items-center justify-between border-b border-white/[0.06] px-5 py-4 text-left"
                >
                  <SectionHeader
                    icon={WalletCards}
                    title="Investimento"
                    description={`${quantidadeItens} item(ns) na proposta`}
                  />

                  {secaoInvestimentoAberta ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {secaoInvestimentoAberta && (
                  <div className="p-5">
                    <div className="space-y-2">
                      {itens.map(
                        (item, index) => (
                          <div
                            key={item.id}
                            className="group rounded-xl border border-white/[0.06] bg-white/[0.018] p-3 transition-all hover:border-white/[0.1] hover:bg-white/[0.025]"
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                Item {String(
                                  index + 1
                                ).padStart(
                                  2,
                                  "0"
                                )}
                              </span>

                              {itens.length >
                                1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setItens(
                                      (prev) =>
                                        prev.filter(
                                          (i) =>
                                            i.id !==
                                            item.id
                                        )
                                    )
                                  }
                                  className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-red-400/10 hover:text-red-300 group-hover:opacity-100"
                                  title="Remover item"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-[minmax(0,1fr)_115px] gap-2">
                              <Input
                                value={
                                  item.nome
                                }
                                onChange={(e) =>
                                  updateItem(
                                    item.id,
                                    {
                                      nome: e
                                        .target
                                        .value,
                                    }
                                  )
                                }
                                placeholder="Descrição do serviço"
                                className="h-10 rounded-lg border-white/[0.07] bg-black/10 text-xs text-white placeholder:text-muted-foreground focus:border-cyan-400/30 focus:ring-cyan-400/10"
                              />

                              <Input
                                value={
                                  item.valor
                                }
                                onChange={(e) =>
                                  updateItem(
                                    item.id,
                                    {
                                      valor: e
                                        .target
                                        .value,
                                    }
                                  )
                                }
                                placeholder="0,00"
                                inputMode="decimal"
                                className="h-10 rounded-lg border-white/[0.07] bg-black/10 text-right font-mono text-xs text-white placeholder:text-muted-foreground focus:border-cyan-400/30 focus:ring-cyan-400/10"
                              />
                            </div>
                          </div>
                        )
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setItens(
                          (prev) => [
                            ...prev,
                            {
                              id: uid(),
                              nome: "",
                              valor: "",
                            },
                          ]
                        )
                      }
                      className="mt-3 h-10 w-full gap-2 rounded-xl border-dashed border-white/[0.1] bg-transparent text-xs text-muted-foreground hover:border-cyan-400/25 hover:bg-cyan-400/[0.04] hover:text-cyan-300"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar item
                    </Button>

                    {/* RESUMO */}
                    <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/15 p-4">
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Subtotal</span>
                          <span className="font-mono text-muted-foreground">
                            {brl(
                              subtotal
                            )}
                          </span>
                        </div>

                        {valorDesconto >
                          0 && (
                          <div className="flex justify-between text-emerald-400">
                            <span>
                              Desconto ({percentualDesconto}%)
                            </span>
                            <span className="font-mono">
                              -{" "}
                              {brl(
                                valorDesconto
                              )}
                            </span>
                          </div>
                        )}

                        <div className="my-2 h-px bg-white/[0.06]" />

                        <div className="flex items-end justify-between">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                            Total mensal
                          </span>

                          <span className="font-mono text-lg font-semibold tracking-tight text-cyan-300">
                            {brl(total)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-3">
                        <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
                          <Percent className="h-3 w-3" />
                          <span className="text-[10px] uppercase tracking-wider">
                            Desconto
                          </span>
                        </div>

                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={desconto}
                          onChange={(e) =>
                            setDesconto(
                              e.target.value
                            )
                          }
                          className="h-8 border-0 bg-transparent p-0 font-mono text-sm text-white shadow-none focus-visible:ring-0"
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.018] p-3">
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Recibo
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            Sem nota fiscal
                          </p>
                        </div>

                        <Switch
                          checked={
                            semNota
                          }
                          onCheckedChange={
                            setSemNota
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </PanelCard>

              {/* CONTEÚDO */}
              <PanelCard className="overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setSecaoConteudoAberta(
                      !secaoConteudoAberta
                    )
                  }
                  className="flex w-full items-center justify-between border-b border-white/[0.06] px-5 py-4 text-left"
                >
                  <SectionHeader
                    icon={Sparkles}
                    title="Conteúdo da proposta"
                    description="Textos e identidade comercial."
                  />

                  {secaoConteudoAberta ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {secaoConteudoAberta && (
                  <div className="space-y-4 p-5">
                    <div>
                      <FieldLabel>
                        Marca / empresa
                      </FieldLabel>

                      <Input
                        value={marca}
                        onChange={(e) =>
                          setMarca(
                            e.target.value
                          )
                        }
                        className="h-11 rounded-xl border-white/[0.08] bg-white/[0.025] text-sm font-medium text-white focus:border-cyan-400/30 focus:ring-cyan-400/10"
                      />
                    </div>

                    <div>
                      <FieldLabel>
                        Texto de abertura
                      </FieldLabel>

                      <Textarea
                        rows={5}
                        value={abertura}
                        onChange={(e) =>
                          setAbertura(
                            e.target.value
                          )
                        }
                        className="resize-none rounded-xl border-white/[0.08] bg-white/[0.025] text-xs leading-relaxed text-white placeholder:text-muted-foreground focus:border-cyan-400/30 focus:ring-cyan-400/10"
                      />
                    </div>

                    <div>
                      <FieldLabel>
                        Serviços inclusos
                      </FieldLabel>

                      <Textarea
                        rows={5}
                        value={fechamento}
                        onChange={(e) =>
                          setFechamento(
                            e.target.value
                          )
                        }
                        className="resize-none rounded-xl border-white/[0.08] bg-white/[0.025] text-xs leading-relaxed text-white placeholder:text-muted-foreground focus:border-cyan-400/30 focus:ring-cyan-400/10"
                      />
                    </div>

                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-3.5">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-medium text-foreground">
                            Mostrar vantagens
                          </p>

                          <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                            Inclui uma seção de diferenciais na proposta.
                          </p>
                        </div>

                        <Switch
                          checked={
                            mostrarVantagens
                          }
                          onCheckedChange={
                            setMostrarVantagens
                          }
                        />
                      </div>

                      {mostrarVantagens && (
                        <Textarea
                          rows={5}
                          value={vantagens}
                          onChange={(e) =>
                            setVantagens(
                              e.target.value
                            )
                          }
                          placeholder="Uma vantagem por linha"
                          className="mt-3 resize-none rounded-xl border-white/[0.07] bg-black/10 text-xs leading-relaxed text-white placeholder:text-muted-foreground focus:border-cyan-400/30 focus:ring-cyan-400/10"
                        />
                      )}
                    </div>
                  </div>
                )}
              </PanelCard>

              {/* PASTAS */}
              <PanelCard className="overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setSecaoPastasAberta(
                      !secaoPastasAberta
                    )
                  }
                  className="flex w-full items-center justify-between border-b border-white/[0.06] px-5 py-4 text-left"
                >
                  <SectionHeader
                    icon={FolderOpen}
                    title="Organização"
                    description={
                      pastas.length
                        ? `${pastas.length} pasta(s) disponível(is)`
                        : "Organize suas propostas por pasta."
                    }
                  />

                  {secaoPastasAberta ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {secaoPastasAberta && (
                  <div className="space-y-4 p-5">
                    <div>
                      <FieldLabel>
                        Criar nova pasta
                      </FieldLabel>

                      <div className="flex gap-2">
                        <div className="relative min-w-0 flex-1">
                          <FolderPlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                          <Input
                            value={
                              nomePasta
                            }
                            onChange={(e) =>
                              setNomePasta(
                                e.target
                                  .value
                              )
                            }
                            placeholder="Ex.: Propostas 2026"
                            className="h-11 rounded-xl border-white/[0.08] bg-white/[0.025] pl-10 text-xs text-white placeholder:text-muted-foreground focus:border-cyan-400/30 focus:ring-cyan-400/10"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <FieldLabel>
                        Ou selecionar existente
                      </FieldLabel>

                      <select
                        value={
                          pastaSelecionada
                        }
                        onChange={(e) =>
                          setPastaSelecionada(
                            e.target
                              .value
                          )
                        }
                        className="h-11 w-full rounded-xl border border-white/[0.08] bg-background px-3 text-xs text-foreground outline-none transition-colors focus:border-cyan-400/30"
                      >
                        <option value="">
                          Selecionar pasta
                        </option>

                        {pastas.map(
                          (pasta) => (
                            <option
                              key={
                                pasta.id
                              }
                              value={
                                pasta.id
                              }
                            >
                              {pasta.nome}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <Button
                      onClick={
                        salvarProposta
                      }
                      disabled={
                        salvarPropostaMutation.isPending ||
                        criarPasta.isPending
                      }
                      className="h-11 w-full gap-2 rounded-xl bg-cyan-400 text-xs font-semibold text-slate-950 hover:bg-cyan-300"
                    >
                      <Save className="h-4 w-4" />
                      Salvar nesta pasta
                    </Button>

                    {mensagemSalvar && (
                      <div
                        className={[
                          "flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[11px] leading-relaxed",
                          mensagemSalvar
                            .toLowerCase()
                            .includes(
                              "erro"
                            ) ||
                          mensagemSalvar
                            .toLowerCase()
                            .includes(
                              "selecione"
                            )
                            ? "border-amber-400/15 bg-amber-400/[0.05] text-amber-300"
                            : "border-emerald-400/15 bg-emerald-400/[0.05] text-emerald-300",
                        ].join(" ")}
                      >
                        {mensagemSalvar
                          .toLowerCase()
                          .includes(
                            "erro"
                          ) ? (
                          <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
                        ) : (
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        )}

                        <span>
                          {mensagemSalvar}
                        </span>
                      </div>
                    )}

                    {pastas.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                            Pastas salvas
                          </span>

                          <Layers3 className="h-3.5 w-3.5 text-slate-700" />
                        </div>

                        {pastas.map(
                          (pasta) => (
                            <div
                              key={
                                pasta.id
                              }
                              className={[
                                "rounded-xl border p-3 transition-all",
                                pastaSelecionada ===
                                pasta.id
                                  ? "border-cyan-400/20 bg-cyan-400/[0.05]"
                                  : "border-white/[0.06] bg-white/[0.015] hover:border-white/[0.1]",
                              ].join(
                                " "
                              )}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-2.5">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card">
                                    <FolderOpen className="h-3.5 w-3.5 text-cyan-300" />
                                  </div>

                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-medium text-foreground">
                                      {
                                        pasta.nome
                                      }
                                    </p>

                                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                                      {
                                        pasta
                                          .propostas
                                          .length
                                      }{" "}
                                      proposta(s)
                                    </p>
                                  </div>
                                </div>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setPastaSelecionada(
                                      pasta.id
                                    )
                                  }
                                  className="h-8 shrink-0 rounded-lg px-2.5 text-[10px] text-cyan-300 hover:bg-cyan-400/[0.07]"
                                >
                                  {pastaSelecionada ===
                                  pasta.id
                                    ? "Selecionada"
                                    : "Selecionar"}
                                </Button>
                              </div>

                              {pasta.propostas
                                .length >
                                0 && (
                                <div className="mt-3 space-y-1.5 border-t border-white/[0.05] pt-3">
                                  {pasta.propostas
                                    .slice(
                                      0,
                                      3
                                    )
                                    .map(
                                      (
                                        proposta
                                      ) => (
                                        <div
                                          key={
                                            proposta.id
                                          }
                                          className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.04] bg-black/10 px-2.5 py-2"
                                        >
                                          <div className="min-w-0">
                                            <p className="truncate text-[11px] text-muted-foreground">
                                              {proposta.nome ||
                                                proposta.cliente ||
                                                "Proposta"}
                                            </p>

                                            <p className="mt-0.5 font-mono text-[9px] text-muted-foreground">
                                              {
                                                proposta.numero
                                              }
                                            </p>
                                          </div>

                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                              carregarProposta(
                                                proposta
                                              )
                                            }
                                            className="h-7 shrink-0 rounded-md px-2 text-[9px] text-muted-foreground hover:bg-white/[0.05] hover:text-white"
                                          >
                                            Carregar
                                          </Button>
                                        </div>
                                      )
                                    )}
                                </div>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )}
              </PanelCard>
            </aside>

            {/* =======================================================
                ÁREA DE PREVIEW
            ======================================================= */}
            <main className="min-w-0">
              <div className="mb-3 flex items-center justify-between print:hidden">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />

                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Pré-visualização
                  </span>
                </div>

                <span className="text-[10px] text-muted-foreground">
                  Visualização do documento final
                </span>
              </div>

              <div className="flex justify-center overflow-x-auto rounded-2xl border border-white/[0.05] bg-[#080c12] p-2 shadow-[0_20px_80px_rgba(0,0,0,0.25)] sm:p-5 lg:p-8 print:block print:border-0 print:bg-white print:p-0 print:shadow-none">
                <div
                  id="proposta-print"
                  className="w-full max-w-[820px] overflow-hidden bg-[#fbfaf7] text-[#202630] shadow-[0_30px_80px_rgba(0,0,0,0.35)] print:max-w-none print:shadow-none"
                >

                  {/* =================================================
                      CAPA / HEADER DO DOCUMENTO
                  ================================================== */}
                  <div className="relative overflow-hidden bg-[#0a111d] px-7 py-9 text-white sm:px-12 sm:py-12">

                    {/* decoração */}
                    <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full border border-[#d7bd7a]/10" />
                    <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full border border-[#d7bd7a]/10" />

                    <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#d7bd7a]/50 to-transparent" />

                    <div className="relative">
                      <div className="flex items-start justify-between gap-6">

                        <div>
                          <div className="text-xl font-semibold tracking-[0.14em] text-white sm:text-2xl">
                            {marca ||
                              "SHARE BRASIL"}
                          </div>

                          <div className="mt-1.5 text-[9px] font-medium uppercase tracking-[0.28em] text-[#d7bd7a] sm:text-[10px]">
                            Gestão & aviação executiva
                          </div>
                        </div>

                        <div className="rounded-lg border border-[#d7bd7a]/25 bg-[#d7bd7a]/[0.05] px-3 py-2 text-right">
                          <div className="text-[8px] uppercase tracking-[0.16em] text-[#d7bd7a]/70">
                            Proposta
                          </div>

                          <div className="mt-0.5 font-mono text-[10px] font-semibold tracking-wide text-[#ead8a5]">
                            {numero}
                          </div>
                        </div>
                      </div>

                      <div className="mt-14 max-w-[620px]">
                        <div className="mb-4 flex items-center gap-3">
                          <span className="h-px w-8 bg-[#d7bd7a]" />

                          <span className="text-[9px] font-medium uppercase tracking-[0.25em] text-[#d7bd7a]">
                            Proposta comercial
                          </span>
                        </div>

                        <h2 className="text-3xl font-light leading-tight tracking-tight text-white sm:text-4xl">
                          Gestão de cota
                          <span className="block font-semibold">
                            de aeronave
                          </span>
                        </h2>

                        <p className="mt-5 max-w-[560px] text-xs leading-relaxed text-white/55 sm:text-[13px]">
                          Uma solução completa para uma operação de aviação executiva eficiente, transparente e cuidadosamente administrada.
                        </p>
                      </div>

                      <div className="mt-12 grid grid-cols-1 gap-4 border-t border-white/[0.08] pt-5 sm:grid-cols-3">
                        <div>
                          <div className="mb-1 text-[8px] uppercase tracking-[0.16em] text-white/35">
                            Cliente
                          </div>

                          <div className="truncate text-xs font-medium text-white">
                            {cliente ||
                              "Cliente"}
                          </div>
                        </div>

                        <div>
                          <div className="mb-1 text-[8px] uppercase tracking-[0.16em] text-white/35">
                            Aeronave
                          </div>

                          <div className="truncate text-xs font-medium text-white">
                            {aeronave ||
                              "Aeronave"}
                          </div>
                        </div>

                        <div>
                          <div className="mb-1 text-[8px] uppercase tracking-[0.16em] text-white/35">
                            Base
                          </div>

                          <div className="truncate text-xs font-medium text-white">
                            {base ||
                              "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* =================================================
                      CONTEÚDO
                  ================================================== */}
                  <div className="px-7 py-8 sm:px-12 sm:py-10">

                    {/* METADADOS */}
                    <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-xl border border-[#e6e0d3] bg-white px-3.5 py-3">
                        <div className="mb-1.5 flex items-center gap-1.5 text-[#8d8a81]">
                          <CalendarDays className="h-3 w-3" />
                          <span className="text-[8px] uppercase tracking-[0.12em]">
                            Emissão
                          </span>
                        </div>

                        <div className="text-[11px] font-semibold text-[#242b35]">
                          {formatarData(
                            data
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-[#e6e0d3] bg-white px-3.5 py-3">
                        <div className="mb-1.5 flex items-center gap-1.5 text-[#8d8a81]">
                          <Clock3 className="h-3 w-3" />
                          <span className="text-[8px] uppercase tracking-[0.12em]">
                            Validade
                          </span>
                        </div>

                        <div className="text-[11px] font-semibold text-[#242b35]">
                          {validade} dias
                        </div>
                      </div>

                      <div className="rounded-xl border border-[#e6e0d3] bg-white px-3.5 py-3">
                        <div className="mb-1.5 flex items-center gap-1.5 text-[#8d8a81]">
                          <Plane className="h-3 w-3" />
                          <span className="text-[8px] uppercase tracking-[0.12em]">
                            Aeronave
                          </span>
                        </div>

                        <div className="truncate text-[11px] font-semibold text-[#242b35]">
                          {aeronave ||
                            "Não informada"}
                        </div>
                      </div>

                      <div className="rounded-xl border border-[#e6e0d3] bg-white px-3.5 py-3">
                        <div className="mb-1.5 flex items-center gap-1.5 text-[#8d8a81]">
                          <FileText className="h-3 w-3" />
                          <span className="text-[8px] uppercase tracking-[0.12em]">
                            Referência
                          </span>
                        </div>

                        <div className="truncate font-mono text-[10px] font-semibold text-[#242b35]">
                          {numero}
                        </div>
                      </div>
                    </div>

                    {/* ABERTURA */}
                    <section>
                      <div className="mb-3 flex items-center gap-3">
                        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#ad9253]">
                          01
                        </span>

                        <span className="h-px w-6 bg-[#d2bd88]" />

                        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#7b786f]">
                          Apresentação
                        </span>
                      </div>

                      <p className="text-[12.5px] leading-[1.9] text-[#4c5159] sm:text-[13px]">
                        {abertura}
                      </p>
                    </section>

                    {/* SEPARADOR */}
                    <div className="my-9 flex items-center gap-3">
                      <div className="h-px flex-1 bg-[#e3ddd0]" />
                      <div className="h-1.5 w-1.5 rotate-45 bg-[#c7a85f]" />
                      <div className="h-px flex-1 bg-[#e3ddd0]" />
                    </div>

                    {/* INVESTIMENTO */}
                    <section>
                      <div className="mb-5 flex items-end justify-between gap-4">
                        <div>
                          <div className="mb-2 flex items-center gap-3">
                            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#ad9253]">
                              02
                            </span>

                            <span className="h-px w-6 bg-[#d2bd88]" />
                          </div>

                          <h3 className="text-lg font-semibold tracking-tight text-[#18202b]">
                            Investimento
                          </h3>

                          <p className="mt-1 text-[10px] text-[#85827a]">
                            Estrutura mensal de gerenciamento
                          </p>
                        </div>

                        <div className="hidden rounded-lg bg-[#f4f0e6] px-3 py-2 text-right sm:block">
                          <div className="text-[8px] uppercase tracking-[0.12em] text-[#928d80]">
                            Total mensal
                          </div>

                          <div className="mt-0.5 font-mono text-sm font-bold text-[#18202b]">
                            {brl(total)}
                          </div>
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-xl border border-[#e0dacd] bg-white">
                        <div className="grid grid-cols-[1fr_auto] border-b border-[#e6e0d5] bg-[#f7f4ed] px-4 py-2.5">
                          <span className="text-[8px] font-semibold uppercase tracking-[0.15em] text-[#8b877d]">
                            Descrição
                          </span>

                          <span className="text-[8px] font-semibold uppercase tracking-[0.15em] text-[#8b877d]">
                            Valor
                          </span>
                        </div>

                        {itens
                          .filter(
                            (item) =>
                              item.nome.trim()
                          )
                          .map(
                            (
                              item,
                              index
                            ) => (
                              <div
                                key={
                                  item.id
                                }
                                className="grid grid-cols-[1fr_auto] items-center border-b border-[#eee9df] px-4 py-3.5 last:border-b-0"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f3eee2] text-[8px] font-semibold text-[#a78c52]">
                                    {String(
                                      index +
                                        1
                                    ).padStart(
                                      2,
                                      "0"
                                    )}
                                  </span>

                                  <span className="text-[11.5px] font-medium text-[#343a44]">
                                    {item.nome}
                                  </span>
                                </div>

                                <span className="font-mono text-[11.5px] font-semibold text-[#202833]">
                                  {brl(
                                    parseValor(
                                      item.valor
                                    )
                                  )}
                                </span>
                              </div>
                            )
                          )}

                        {valorDesconto >
                          0 && (
                          <div className="grid grid-cols-[1fr_auto] items-center border-t border-[#eee9df] bg-[#f5faf6] px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Check className="h-3.5 w-3.5 text-[#477657]" />

                              <span className="text-[10.5px] font-medium text-[#477657]">
                                Desconto de{" "}
                                {percentualDesconto}%
                                {semNota
                                  ? " · sem nota fiscal, com recibo"
                                  : ""}
                              </span>
                            </div>

                            <span className="font-mono text-[11px] font-semibold text-[#477657]">
                              -{" "}
                              {brl(
                                valorDesconto
                              )}
                            </span>
                          </div>
                        )}

                        <div className="grid grid-cols-[1fr_auto] items-center bg-[#101722] px-4 py-4">
                          <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/60">
                            Total mensal
                          </span>

                          <span className="font-mono text-lg font-bold text-[#e5cc8d]">
                            {brl(total)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between px-1">
                        <span className="text-[9px] text-[#99958c]">
                          {quantidadeItens} item(ns) incluído(s)
                        </span>

                        {semNota && (
                          <span className="flex items-center gap-1.5 text-[9px] font-medium text-[#55745e]">
                            <ReceiptText className="h-3 w-3" />
                            Operação com recibo
                          </span>
                        )}
                      </div>
                    </section>

                    {/* SEPARADOR */}
                    <div className="my-9 flex items-center gap-3">
                      <div className="h-px flex-1 bg-[#e3ddd0]" />
                      <div className="h-1.5 w-1.5 rotate-45 bg-[#c7a85f]" />
                      <div className="h-px flex-1 bg-[#e3ddd0]" />
                    </div>

                    {/* SERVIÇOS */}
                    <section>
                      <div className="mb-3 flex items-center gap-3">
                        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#ad9253]">
                          03
                        </span>

                        <span className="h-px w-6 bg-[#d2bd88]" />

                        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#7b786f]">
                          Serviços inclusos
                        </span>
                      </div>

                      <div className="rounded-xl border border-[#e5dfd3] bg-[#f9f7f2] p-5">
                        <p className="text-[12px] leading-[1.9] text-[#4d525a]">
                          {fechamento}
                        </p>
                      </div>
                    </section>

                    {/* VANTAGENS */}
                    {mostrarVantagens &&
                      vantagensLista.length >
                        0 && (
                        <>
                          <div className="my-9 flex items-center gap-3">
                            <div className="h-px flex-1 bg-[#e3ddd0]" />
                            <div className="h-1.5 w-1.5 rotate-45 bg-[#c7a85f]" />
                            <div className="h-px flex-1 bg-[#e3ddd0]" />
                          </div>

                          <section>
                            <div className="mb-4 flex items-center gap-3">
                              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#ad9253]">
                                04
                              </span>

                              <span className="h-px w-6 bg-[#d2bd88]" />

                              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#7b786f]">
                                Diferenciais
                              </span>
                            </div>

                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              {vantagensLista.map(
                                (
                                  vantagem,
                                  index
                                ) => (
                                  <div
                                    key={
                                      index
                                    }
                                    className="flex items-start gap-3 rounded-xl border border-[#e5dfd3] bg-white px-4 py-3"
                                  >
                                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f3eee2]">
                                      <Check className="h-3 w-3 text-[#a18449]" />
                                    </div>

                                    <span className="text-[10.5px] leading-relaxed text-[#4b515a]">
                                      {
                                        vantagem
                                      }
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          </section>
                        </>
                      )}

                    {/* ENCERRAMENTO */}
                    <div className="mt-10 rounded-xl bg-[#101722] px-5 py-5 sm:px-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="text-[8px] uppercase tracking-[0.18em] text-[#d7bd7a]">
                            Condições da proposta
                          </div>

                          <div className="mt-1 text-[11px] leading-relaxed text-white/55">
                            Validade de{" "}
                            <span className="font-semibold text-white/80">
                              {validade} dias
                            </span>{" "}
                            a partir da data de emissão.
                          </div>
                        </div>

                        <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-left sm:text-right">
                          <div className="text-[8px] uppercase tracking-[0.15em] text-white/35">
                            Data de emissão
                          </div>

                          <div className="mt-0.5 text-[10px] font-medium text-white/75">
                            {formatarData(
                              data
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* FOOTER */}
                    <div className="mt-8 flex flex-col gap-3 border-t border-[#e3ddd0] pt-5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-[11px] font-semibold tracking-wide text-[#202833]">
                          {marca ||
                            "SHARE BRASIL"}
                        </div>

                        <div className="mt-1 text-[8px] uppercase tracking-[0.14em] text-[#9b978d]">
                          Gestão de aviação executiva
                        </div>
                      </div>

                      <div className="text-left sm:text-right">
                        <div className="font-mono text-[8px] text-[#aaa59a]">
                          {numero}
                        </div>

                        <div className="mt-1 text-[8px] text-[#aaa59a]">
                          Documento comercial
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>

      {/* =============================================================
          ESTILOS ESPECÍFICOS DE IMPRESSÃO
      ============================================================= */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }

          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          #root {
            background: white !important;
          }

          #proposta-print {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            box-shadow: none !important;
          }

          .print\\:hidden {
            display: none !important;
          }
        }

        input[type="date"]::-webkit-calendar-picker-indicator {
          opacity: 0.35;
          cursor: pointer;
        }

        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          opacity: 0.35;
        }

        select option {
          background: #0f172a;
          color: #e2e8f0;
        }
      `}</style>
    </Layout>
  );
}