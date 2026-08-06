import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, FileSignature, Printer, Plus, Trash2, RefreshCw, FolderPlus, FolderOpen, Save } from "lucide-react";
import { Item, PropostaSalva, PropostaPasta, usePropostas } from "@/hooks/usePropostas";

const uid = () => Math.random().toString(36).slice(2, 9);

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const gerarNumero = () =>
  `SHR-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;

export default function CriarProposta() {
  const navigate = useNavigate();
  const [cliente, setCliente] = useState("");
  const [aeronave, setAeronave] = useState("");
  const [base, setBase] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
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
    { id: uid(), nome: "Gerenciamento SHARE", valor: "" },
  ]);

  const [semNota, setSemNota] = useState(false);
  const [desconto, setDesconto] = useState("0");
  const [nomePasta, setNomePasta] = useState("");
  const [pastaSelecionada, setPastaSelecionada] = useState("");
  const [mensagemSalvar, setMensagemSalvar] = useState<string | null>(null);

  const { pastas, criarPasta, salvarProposta: salvarPropostaMutation } = usePropostas();

  const subtotal = useMemo(
    () => itens.reduce((s, i) => s + (parseFloat(i.valor.replace(",", ".")) || 0), 0),
    [itens]
  );
  const valorDesconto = (subtotal * (parseFloat(desconto) || 0)) / 100;
  const total = subtotal - valorDesconto;

  const updateItem = (id: string, patch: Partial<Item>) =>
    setItens((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const carregarProposta = (proposta: PropostaSalva) => {
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
    setMensagemSalvar(`Proposta carregada de ${proposta.nome}.`);
  };

  const salvarProposta = async () => {
    const nomeFinalPasta = nomePasta.trim();
    const titulo = cliente.trim() || "Cliente sem nome";
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

    if (!nomeFinalPasta && !pastaSelecionada) {
      setMensagemSalvar("Selecione ou crie uma pasta antes de salvar a proposta.");
      return;
    }

    let pastaDestinoId = pastaSelecionada;
    let pastaDestinoNome = nomeFinalPasta;

    if (nomeFinalPasta) {
      const pastaExistente = pastas.find((p) => p.nome.toLowerCase() === nomeFinalPasta.toLowerCase());
      if (pastaExistente) {
        pastaDestinoId = pastaExistente.id;
        pastaDestinoNome = pastaExistente.nome;
      } else {
        try {
          const pasta = await criarPasta.mutateAsync(nomeFinalPasta);
          pastaDestinoId = pasta.id;
          pastaDestinoNome = pasta.nome;
        } catch {
          setMensagemSalvar("Erro ao criar pasta. Verifique o nome e tente novamente.");
          return;
        }
      }
    }

    if (!pastaDestinoId) {
      setMensagemSalvar("Não foi possível determinar a pasta de destino.");
      return;
    }

    try {
      await salvarPropostaMutation.mutateAsync({ pastaId: pastaDestinoId, proposta });
      setPastaSelecionada(pastaDestinoId);
      setNomePasta("");
      setMensagemSalvar(`Proposta salva em "${pastaDestinoNome}".`);
    } catch {
      setMensagemSalvar("Erro ao salvar proposta no banco de dados.");
    }
  };

  return (
    <Layout>
      <div className="w-full max-w-[1400px] mx-auto px-4 space-y-6 pb-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-400/30">
              <FileSignature className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Criar Proposta</h1>
              <p className="text-sm text-muted-foreground">Proposta de cota de aeronave</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              className="gap-2 border-slate-700 bg-slate-900/50 text-slate-200 hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <Button
              onClick={() => window.print()}
              className="gap-2 bg-cyan-500/15 text-cyan-300 border border-cyan-400/40 hover:bg-cyan-500/25"
            >
              <Printer className="h-4 w-4" /> Exportar / Imprimir PDF
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          {/* Formulário */}
          <div className="space-y-5 print:hidden rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
            <div className="space-y-3">
              <div>
                <Label>Cliente / cotista</Label>
                <Input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nome do cliente" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Aeronave</Label>
                  <Input value={aeronave} onChange={(e) => setAeronave(e.target.value)} placeholder="Modelo" />
                </div>
                <div>
                  <Label>Base / cidade</Label>
                  <Input value={base} onChange={(e) => setBase(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data</Label>
                  <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
                </div>
                <div>
                  <Label>Validade (dias)</Label>
                  <Input type="number" value={validade} onChange={(e) => setValidade(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Nº da proposta</Label>
                <div className="flex gap-2">
                  <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
                  <Button variant="outline" size="icon" onClick={() => setNumero(gerarNumero())}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-700/40 bg-slate-950/30 p-3 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <FolderPlus className="h-4 w-4 text-cyan-400" />
                Salvar proposta em pasta
              </div>
              <Input
                value={nomePasta}
                onChange={(e) => setNomePasta(e.target.value)}
                placeholder="Nome da nova pasta"
              />
              <select
                value={pastaSelecionada}
                onChange={(e) => setPastaSelecionada(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">Selecionar pasta existente</option>
                {pastas.map((pasta) => (
                  <option key={pasta.id} value={pasta.id}>
                    {pasta.nome}
                  </option>
                ))}
              </select>
              <Button onClick={salvarProposta} className="w-full gap-2 bg-cyan-500/15 text-cyan-300 border border-cyan-400/40 hover:bg-cyan-500/25">
                <Save className="h-4 w-4" /> Salvar proposta
              </Button>
              {mensagemSalvar && <p className="text-xs text-cyan-300">{mensagemSalvar}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Itens da proposta</Label>
              {itens.map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_110px_36px] gap-2 items-center">
                  <Input
                    value={item.nome}
                    onChange={(e) => updateItem(item.id, { nome: e.target.value })}
                    placeholder="Descrição"
                  />
                  <Input
                    value={item.valor}
                    onChange={(e) => updateItem(item.id, { valor: e.target.value })}
                    placeholder="0,00"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setItens((p) => p.filter((i) => i.id !== item.id))}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setItens((p) => [...p, { id: uid(), nome: "", valor: "" }])}
              >
                <Plus className="h-4 w-4" /> Adicionar item
              </Button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="cursor-pointer">Opção sem nota fiscal (recibo)</Label>
                <Switch checked={semNota} onCheckedChange={setSemNota} />
              </div>
              <div>
                <Label>Desconto (%)</Label>
                <Input type="number" value={desconto} onChange={(e) => setDesconto(e.target.value)} />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-slate-700/40 bg-slate-950/30 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <FolderOpen className="h-4 w-4 text-cyan-400" />
                Pastas salvas
              </div>
              {pastas.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhuma pasta criada ainda.</p>
              ) : (
                <div className="space-y-2">
                  {pastas.map((pasta) => (
                    <div key={pasta.id} className="rounded-lg border border-slate-700/50 bg-slate-900/60 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-100">{pasta.nome}</p>
                          <p className="text-xs text-slate-400">{pasta.propostas.length} proposta(s)</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-cyan-300"
                          onClick={() => setPastaSelecionada(pasta.id)}
                        >
                          Selecionar
                        </Button>
                      </div>
                      <div className="mt-2 space-y-2">
                        {pasta.propostas.slice(0, 3).map((proposta) => (
                          <div key={proposta.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-700/40 bg-slate-950/40 px-2 py-2">
                            <div>
                              <p className="text-sm text-slate-200">{proposta.nome || proposta.cliente || "Proposta"}</p>
                              <p className="text-[11px] text-slate-400">{proposta.numero}</p>
                            </div>
                            <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => carregarProposta(proposta)}>
                              Carregar
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <Label>Marca / empresa</Label>
                <Input value={marca} onChange={(e) => setMarca(e.target.value)} />
              </div>
              <div>
                <Label>Texto de abertura</Label>
                <Textarea rows={4} value={abertura} onChange={(e) => setAbertura(e.target.value)} />
              </div>
              <div>
                <Label>Texto de fechamento</Label>
                <Textarea rows={4} value={fechamento} onChange={(e) => setFechamento(e.target.value)} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Incluir vantagens</Label>
                <Switch checked={mostrarVantagens} onCheckedChange={setMostrarVantagens} />
              </div>
              {mostrarVantagens && (
                <Textarea rows={4} value={vantagens} onChange={(e) => setVantagens(e.target.value)} />
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="flex justify-center overflow-x-auto">
            <div id="proposta-print" className="w-full max-w-[760px] bg-[#FBF8F2] text-[#232833] shadow-2xl">
              <div className="relative px-10 py-9 bg-gradient-to-br from-[#0B1220] to-[#131B2E] text-[#FBF8F2]">
                <div className="absolute top-6 right-8 border border-[#E7CD8B]/50 rounded px-2.5 py-1 text-[10px] tracking-wider text-[#E7CD8B] font-mono">
                  {numero}
                </div>
                <div className="text-3xl font-bold tracking-wide">{marca}</div>
                <div className="text-[11px] tracking-[0.14em] uppercase text-[#E7CD8B] mt-1">
                  Proposta de cota de aeronave
                </div>
                <div className="mt-6 text-xl font-semibold">
                  {cliente || "Cliente"}
                  <small className="block text-[12.5px] font-normal text-[#FBF8F2]/70 mt-1">
                    {aeronave || "Aeronave"} {base ? `• ${base}` : ""}
                  </small>
                </div>
              </div>

              <div className="px-10 py-8">
                <p className="text-[13.5px] leading-relaxed mb-3">{abertura}</p>

                <div className="h-1.5 my-6 opacity-60 bg-[repeating-linear-gradient(90deg,#C9A34E_0_2px,transparent_2px_10px)]" />

                <h3 className="text-[15px] font-semibold text-[#0B1220] mb-3 flex items-center gap-2">
                  <span className="w-[7px] h-[7px] rounded-full bg-[#C9A34E]" /> Investimento
                </h3>
                <table className="w-full border-collapse mb-2">
                  <tbody>
                    {itens
                      .filter((i) => i.nome)
                      .map((i) => (
                        <tr key={i.id}>
                          <td className="text-[13.5px] py-2 border-b border-[#DED5BC]">{i.nome}</td>
                          <td className="text-right font-mono font-semibold text-[#0B1220] py-2 border-b border-[#DED5BC] whitespace-nowrap">
                            {brl(parseFloat(i.valor.replace(",", ".")) || 0)}
                          </td>
                        </tr>
                      ))}
                    {valorDesconto > 0 && (
                      <tr>
                        <td className="text-[12.5px] italic text-[#3E6B54] py-2 border-b border-[#DED5BC]">
                          Desconto ({desconto}%) {semNota ? "— sem nota fiscal, com recibo" : ""}
                        </td>
                        <td className="text-right font-mono font-semibold text-[#3E6B54] py-2 border-b border-[#DED5BC]">
                          -{brl(valorDesconto)}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td className="pt-3 border-t-2 border-[#0B1220] font-bold text-[15px]">TOTAL MENSAL</td>
                      <td className="pt-3 border-t-2 border-[#0B1220] text-right font-mono font-bold text-[16.5px] text-[#0B1220]">
                        {brl(total)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="h-1.5 my-6 opacity-60 bg-[repeating-linear-gradient(90deg,#C9A34E_0_2px,transparent_2px_10px)]" />

                <h3 className="text-[15px] font-semibold text-[#0B1220] mb-3 flex items-center gap-2">
                  <span className="w-[7px] h-[7px] rounded-full bg-[#C9A34E]" /> Serviços inclusos
                </h3>
                <p className="text-[13px] leading-relaxed">{fechamento}</p>

                {mostrarVantagens && vantagens.trim() && (
                  <>
                    <h3 className="text-[15px] font-semibold text-[#0B1220] mt-6 mb-3 flex items-center gap-2">
                      <span className="w-[7px] h-[7px] rounded-full bg-[#C9A34E]" /> Vantagens
                    </h3>
                    <ul className="space-y-1">
                      {vantagens
                        .split("\n")
                        .filter(Boolean)
                        .map((v, idx) => (
                          <li key={idx} className="text-[13px] pl-4 relative leading-relaxed">
                            <span className="absolute left-0 text-[#C9A34E]">✦</span>
                            {v}
                          </li>
                        ))}
                    </ul>
                  </>
                )}

                <div className="mt-8 pt-4 border-t border-[#DED5BC] flex justify-between items-end text-[12.5px] text-[#6B7280]">
                  <div className="font-semibold text-[#232833]">
                    Validade: {validade} dias a partir de{" "}
                    {data ? new Date(data + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                  </div>
                  <div className="text-right">{marca}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
