import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  type Cotista, type RateioRow, type VooRow,
  type MembroTripulacao, type TERRow, type AbastecimentoRow, type ContaApagarRow,
  norm, isSaida, isFixo, num, cotistaKey, resolveCategoria,
} from "../components/dashboard/gestor/FinanceiroCotista/balancoTypes";

export interface ParticipanteBalanco {
  id: string;
  nome: string;
  socio_id: string | null;
  cliente_id: string | null;
  percentual: number;
}

// Quando informado, todo o hook passa a enxergar SÓ este participante —
// usado pela visão do cliente. Deixe undefined para a visão interna (todos os cotistas).
export interface ParticipanteFiltro {
  socio_id?: string | null;
  cliente_id?: string | null;
}

// Chave estável para agrupar por sócio/cliente, independente da tabela cotistas_aeronave
export const keyOfParticipante = (socio_id?: string | null, cliente_id?: string | null, fallbackNome?: string) =>
  `${socio_id || cliente_id || fallbackNome || "desconhecido"}`;

interface UseBalancoAeronaveParams {
  aeronaveId: string;
  ano: number;
  selectedMonths: number[];
  participanteFiltro?: ParticipanteFiltro;
}

export function useBalancoAeronave({ aeronaveId, ano, selectedMonths, participanteFiltro }: UseBalancoAeronaveParams) {
  const [cotistas, setCotistas] = useState<Cotista[]>([]);
  const [sociosMap, setSociosMap] = useState<Record<string, any>>({});
  const [clientesMap, setClientesMap] = useState<Record<string, any>>({});
  const [rateios, setRateios] = useState<RateioRow[]>([]);
  const [voos, setVoos] = useState<VooRow[]>([]);
  const [catMap, setCatMap] = useState<Map<string, string>>(new Map());
  const [membrosMap, setMembrosMap] = useState<Record<string, MembroTripulacao>>({});
  const [ters, setTers] = useState<TERRow[]>([]);
  const [abastecimentos, setAbastecimentos] = useState<AbastecimentoRow[]>([]);
  const [contasApagar, setContasApagar] = useState<ContaApagarRow[]>([]);
  const [diarioMeses, setDiarioMeses] = useState<Array<{ id: string; ano: number; mes: number; aerodromo_base: string | null; fechado?: boolean | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const refresh = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    supabase.from("expense_configu").select("id, expense_type").then(({ data }) => {
      const m = new Map<string, string>();
      (data || []).forEach((c: any) => m.set(c.id, (c.expense_type || "").trim()));
      setCatMap(m);
    });
  }, []);

  useEffect(() => {
    if (!aeronaveId) return;
    setLoading(true);

    const fetchCotistas = async () => {
      const { data: cotData } = await supabase
        .from("cotistas_aeronave")
        .select("id_clientes, socios_id, percentual_sociedade, clientes(id, razao_social, cnpj, endereco, cidade, uf), socios(id, nome, cpf, endereco)")
        .eq("id_aeronave", aeronaveId);
      const socioIds = Array.from(new Set((cotData || []).map((r: any) => r.socios_id).filter(Boolean)));
      let sm: Record<string, any> = {};
      if (socioIds.length > 0) {
        const { data: sociosData } = await supabase.from("socios").select("id, nome, cpf, endereco").in("id", socioIds);
        (sociosData || []).forEach((s: any) => { sm[s.id] = s; });
      }
      setSociosMap(sm);
      const { data: cliData } = await supabase.from("clientes").select("id, razao_social, cnpj, endereco, cidade, uf");
      const cm: Record<string, any> = {};
      (cliData || []).forEach((c: any) => { cm[c.id] = c; });
      setClientesMap(cm);
      setCotistas((cotData || []).map((r: any) => {
        const socio = sm[r.socios_id];
        const cliente = r.clientes;
        return {
          id: cotistaKey(r.id_clientes, r.socios_id),
          cliente_id: r.id_clientes ?? null,
          socio_id: r.socios_id ?? null,
          nome: socio?.nome || cliente?.razao_social || "Cotista",
          percentual: num(r.percentual_sociedade),
          documento: socio?.cpf || cliente?.cnpj || "",
        };
      }));
    };
    const fetchRateios = async () => {
      const inicio = `${ano}-01-01`;
      const fim = `${ano}-12-31`;
      const { data } = await supabase.from("rateio_despesas").select("*").eq("aeronave_id", aeronaveId)
        .or(`and(data_pagamento.gte.${inicio},data_pagamento.lte.${fim}),and(data_pagamento.is.null,data_vencimento.gte.${inicio},data_vencimento.lte.${fim})`);
      const normalizedRateios = (data || []).map((row: any) => ({
        ...row,
        valor_total_despesa: row.valor_total ?? row.valor_total_despesa ?? null,
      }));
      setRateios(normalizedRateios as unknown as RateioRow[]);
    };
    const fetchVoos = async () => {
      const { data } = await supabase
        .from("lancamentos_diario_bordo")
        .select("id, data_registro, tempo_total, tempo_voo, horas_diurnas, horas_noturnas, tempo_ifr, clientes_id, socios_id, socios_nome, aerodromo_partida, aerodromo_chegada, trecho, natureza_voo, pousos_total, emprestimo, cliente_tomador_emprestimo_id, socio_tomador_emprestimo_id, pic_canac, sic_canac, sic_name, distancia_nm, consumo_combustivel_voo, litros_combustivel_inicio_voo, preco_combustivel_litro, abastecido")
        .eq("aeronave_id", aeronaveId)
        .gte("data_registro", `${ano}-01-01`)
        .lte("data_registro", `${ano}-12-31`)
        .order("data_registro", { ascending: true });
      setVoos((data || []) as unknown as VooRow[]);
    };
    const fetchMembros = async () => {
      const { data } = await supabase.from("membros_tripulacao").select("id, canac, nome_completo");
      const m: Record<string, MembroTripulacao> = {};
      (data || []).forEach((mt: any) => { m[mt.id] = mt as MembroTripulacao; });
      setMembrosMap(m);
    };
    const fetchTERs = async () => {
      const { data } = await supabase.from("travel_expense_reports")
        .select("id, numero_relatorio, data_inicio, data_fim, rota, status, aeronave_id, total_valor, pago_em")
        .eq("aeronave_id", aeronaveId)
        .gte("data_inicio", `${ano}-01-01`)
        .lte("data_fim", `${ano}-12-31`);
      setTers((data || []) as unknown as TERRow[]);
    };
    const fetchAbastecimentos = async () => {
      const { data } = await supabase.from("abastecimentos")
        .select("id, logbook_entry_id, data, trecho, litros, valor_total, valor_unitario, status")
        .eq("aeronave_id", aeronaveId)
        .gte("data", `${ano}-01-01`)
        .lte("data", `${ano}-12-31`);
      setAbastecimentos((data || []) as unknown as AbastecimentoRow[]);
    };
    const fetchContasApagar = async (matricula: string) => {
      if (!matricula) { setContasApagar([]); return; }
      const { data } = await supabase.from("contas_apagar")
        .select("id, reference_type, reference_id, categoria, descricao, valor, status, data_vencimento, data_pagamento, aeronave_registro, competencia_decea, competencia_infraero")
        .eq("aeronave_registro", matricula)
        .gte("data_vencimento", `${ano}-01-01`)
        .lte("data_vencimento", `${ano}-12-31`) as any;
      setContasApagar((data || []) as unknown as ContaApagarRow[]);
    };
    const fetchDiarioMes = async () => {
      const { data } = await supabase.from("diario_mes")
        .select("id, ano, mes, aerodromo_base, fechado")
        .eq("aeronave_id", aeronaveId)
        .eq("ano", ano);
      setDiarioMeses((data || []) as any);
    };
    const doAll = async () => {
      await fetchCotistas();
      const aeroRes = await supabase.from("aeronave").select("id, matricula").eq("id", aeronaveId).maybeSingle();
      const mat: string = aeroRes.data?.matricula || "";
      await Promise.all([fetchRateios(), fetchVoos(), fetchMembros(), fetchTERs(), fetchAbastecimentos(), fetchContasApagar(mat), fetchDiarioMes()]);
    };
    doAll().finally(() => setLoading(false));

    const channel = supabase
      .channel(`balanco-aeronave-${aeronaveId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rateio_despesas", filter: `aeronave_id=eq.${aeronaveId}` }, () => { void doAll(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "lancamentos_diario_bordo", filter: `aeronave_id=eq.${aeronaveId}` }, () => { void doAll(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "abastecimentos", filter: `aeronave_id=eq.${aeronaveId}` }, () => { void doAll(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "diario_mes", filter: `aeronave_id=eq.${aeronaveId}` }, () => { void doAll(); })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [aeronaveId, ano, reloadKey]);

  const selectedSet = useMemo(() => new Set(selectedMonths), [selectedMonths]);
  const inSelected = (d?: string | null) => {
    if (!d) return false;
    const dt = new Date(d + (d.length <= 10 ? "T00:00:00" : ""));
    return dt.getFullYear() === ano && selectedSet.has(dt.getMonth() + 1);
  };
  const dateOf = (r: RateioRow) => r.data_pagamento || r.data_vencimento || r.data_emissao;

  const resolveSocioName = (r: RateioRow): string => {
    if (r.socio_id && sociosMap[r.socio_id]?.nome) return sociosMap[r.socio_id].nome;
    if (r.socios_nome) return r.socios_nome;
    if (r.cliente_id && clientesMap[r.cliente_id]?.razao_social) return clientesMap[r.cliente_id].razao_social;
    return r.clientes_nome || "—";
  };
  const resolveVooSocioName = (v: VooRow): string => {
    if (v.socios_id && sociosMap[v.socios_id]?.nome) return sociosMap[v.socios_id].nome;
    if (v.socios_nome) return v.socios_nome;
    if (v.clientes_id && clientesMap[v.clientes_id]?.razao_social) return clientesMap[v.clientes_id].razao_social;
    return v.natureza_voo || "—";
  };
  const catNameOf = (r: RateioRow) => resolveCategoria(r.categoria_custo, catMap);

  // NOVO: filtro de participante único (visão do cliente)
  const participanteFiltroKey = participanteFiltro
    ? keyOfParticipante(participanteFiltro.socio_id || null, participanteFiltro.cliente_id || null)
    : null;
  const matchFiltro = (socio_id: string | null, cliente_id: string | null) => {
    if (!participanteFiltroKey) return true;
    return keyOfParticipante(socio_id, cliente_id) === participanteFiltroKey;
  };

  const despesasPeriodo = useMemo(() => {
    const map = new Map<string, RateioRow>();
    rateios.forEach((r) => {
      if (!inSelected(dateOf(r))) return;
      const k = r.despesa_id || r.id;
      if (!map.has(k)) map.set(k, r);
    });
    return Array.from(map.values());
  }, [rateios, ano, selectedSet]);

  // Despesas do período já restritas ao participante filtrado (uso da visão do cliente:
  // totais de custo/entradas mostrados na tela já são só os dela, não da aeronave toda)
  const despesasPeriodoFiltrado = useMemo(
    () => participanteFiltroKey
      ? despesasPeriodo.filter((r) => matchFiltro(r.socio_id || null, r.cliente_id || null))
      : despesasPeriodo,
    [despesasPeriodo, participanteFiltroKey]
  );

  const rateiosPeriodo = useMemo(() => rateios.filter((r) => inSelected(dateOf(r))), [rateios, ano, selectedSet]);

  const {
    custoFixo, custoVarHora, custoVarVoo, custoExtra, custoVariavel, custoTotal, entradasPeriodo,
  } = useMemo(() => {
    let fx = 0, vh = 0, vv = 0, ex = 0, ent = 0;
    despesasPeriodoFiltrado.forEach((d) => {
      const val = num(d.valor_total_despesa);
      if (!isSaida(d.fluxo)) { ent += val; return; }
      const t = norm(d.tipo_rateio);
      if (t === "fixo") fx += val;
      else if (t === "variavel_por_hora") vh += val;
      else if (t === "variavel_por_voo") vv += val;
      else if (t === "extra") ex += val;
      else if (isFixo(d.periodicidade)) fx += val;
      else vv += val;
    });
    const variavel = vh + vv;
    return { custoFixo: fx, custoVarHora: vh, custoVarVoo: vv, custoExtra: ex, custoVariavel: variavel, custoTotal: fx + variavel + ex, entradasPeriodo: ent };
  }, [despesasPeriodoFiltrado]);

  const voosPeriodo = useMemo(() => voos.filter((v) => inSelected(v.data_registro)), [voos, ano, selectedSet]);
  const voosPeriodoFiltrado = useMemo(
    () => participanteFiltroKey ? voosPeriodo.filter((v) => matchFiltro(v.socios_id || null, v.clientes_id || null)) : voosPeriodo,
    [voosPeriodo, participanteFiltroKey]
  );

  // Totais agregados da aeronave (não por sócio): cada voo conta 1x, sem duplicar
  // mesmo quando o lançamento é "compartilhado" entre vários sócios de um cliente.
  const horasPeriodo = useMemo(() => voosPeriodoFiltrado.reduce((s, v) => s + (num(v.tempo_total) || num(v.tempo_voo)), 0), [voosPeriodoFiltrado]);
  const custoMedioHora = horasPeriodo > 0 ? custoVariavel / horasPeriodo : 0;
  const custoMedioHoraTotal = horasPeriodo > 0 ? custoTotal / horasPeriodo : 0;
  const totalPousos = useMemo(() => voosPeriodoFiltrado.reduce((s, v) => s + num(v.pousos_total), 0), [voosPeriodoFiltrado]);

  // Participantes = exatamente os sócios cadastrados em cotistas_aeronave (fonte da verdade).
  // Não "descobrimos" participantes a partir de voos/rateios — isso é o que causava o card
  // fantasma quando um lançamento só tinha cliente_id, sem sócio específico vinculado.
  const participantesTodos = useMemo(() => {
    const map = new Map<string, ParticipanteBalanco>();
    cotistas.forEach((c) => {
      const key = keyOfParticipante(c.socio_id, c.cliente_id, c.nome);
      if (map.has(key)) return;
      map.set(key, { id: key, nome: c.nome, socio_id: c.socio_id, cliente_id: c.cliente_id, percentual: c.percentual });
    });
    return Array.from(map.values());
  }, [cotistas]);

  const participantes = useMemo(
    () => participanteFiltroKey ? participantesTodos.filter((p) => p.id === participanteFiltroKey) : participantesTodos,
    [participantesTodos, participanteFiltroKey]
  );

  // Agrupa os sócios cadastrados por cliente_id, para saber entre quantos ratear
  // um lançamento (de despesa) que só tem cliente_id, sem sócio vinculado.
  const sociosPorCliente = useMemo(() => {
    const m = new Map<string, ParticipanteBalanco[]>();
    participantesTodos.forEach((p) => {
      if (!p.cliente_id) return;
      const arr = m.get(p.cliente_id) || [];
      arr.push(p);
      m.set(p.cliente_id, arr);
    });
    return m;
  }, [participantesTodos]);

  // ---- DESPESAS (dinheiro): dividido entre os sócios do cliente quando não há sócio vinculado ----
  // lançamento com socio_id preenchido -> pertence 100% a esse sócio.
  // lançamento só com cliente_id -> rateado em partes iguais entre os sócios cadastrados desse cliente.
  const resolveKeysWeighted = (socio_id: string | null, cliente_id: string | null): { key: string; weight: number }[] => {
    if (socio_id) return [{ key: socio_id, weight: 1 }];
    if (cliente_id) {
      const socios = sociosPorCliente.get(cliente_id) || [];
      if (socios.length > 0) {
        const weight = 1 / socios.length;
        return socios.map((s) => ({ key: s.id, weight }));
      }
      return [{ key: cliente_id, weight: 1 }];
    }
    return [];
  };

  // ---- VOOS: horas/pousos NÃO são custo, são fato do voo. Quando o lançamento só tem
  // cliente_id, o voo conta INTEIRO (sem fracionar) para cada sócio cadastrado desse cliente. ----
  const resolveKeysForVoo = (socio_id: string | null, cliente_id: string | null): string[] => {
    if (socio_id) return [socio_id];
    if (cliente_id) {
      const socios = sociosPorCliente.get(cliente_id) || [];
      if (socios.length > 0) return socios.map((s) => s.id);
      return [cliente_id];
    }
    return [];
  };

  const linhasPeriodo = useMemo(() => {
    const debito = new Map<string, number>();
    const credito = new Map<string, number>();
    const horas = new Map<string, number>();
    const pousos = new Map<string, number>();
    participantes.forEach((c) => { debito.set(c.id, 0); credito.set(c.id, 0); horas.set(c.id, 0); pousos.set(c.id, 0); });

    rateiosPeriodo.forEach((r) => {
      if (!isSaida(r.fluxo)) return;
      if (!r.socio_id && !r.cliente_id) return;
      const rateado = num(r.valor_rateado);
      const pct = num(r.percentual_uso ?? r.percentual_sociedade);
      const total = num(r.valor_total_despesa);
      const base = rateado > 0 ? rateado : pct > 0 ? total * (pct / 100) : 0;
      const pago = num(r.valor_pago_real);
      resolveKeysWeighted(r.socio_id || null, r.cliente_id || null).forEach(({ key: k, weight }) => {
        if (!debito.has(k)) return;
        debito.set(k, (debito.get(k) || 0) + base * weight);
        if (pago > 0) credito.set(k, (credito.get(k) || 0) + pago * weight);
      });
    });

    voosPeriodo.forEach((v) => {
      if (!v.socios_id && !v.clientes_id) return;
      const h = num(v.tempo_total) || num(v.tempo_voo);
      const p = num(v.pousos_total);
      resolveKeysForVoo(v.socios_id || null, v.clientes_id || null).forEach((k) => {
        if (!horas.has(k)) return;
        horas.set(k, (horas.get(k) || 0) + h); // valor cheio, sem fracionar
        pousos.set(k, (pousos.get(k) || 0) + p); // valor cheio, sem fracionar
      });
    });

    return participantes.map((c) => {
      const deb = debito.get(c.id) || 0;
      const cre = credito.get(c.id) || 0;
      const saldo = cre - deb;
      const pctPago = deb > 0 ? (cre / deb) * 100 : cre > 0 ? 100 : 0;
      return { ...c, debito: deb, credito: cre, saldo, horas: horas.get(c.id) || 0, pousos: pousos.get(c.id) || 0, pctPago };
    });
  }, [rateiosPeriodo, voosPeriodo, participantes, sociosPorCliente]);

  const entradasPorCotista = useMemo(() => {
    const map = new Map<string, number>();
    participantes.forEach((c) => map.set(c.id, 0));
    rateiosPeriodo.forEach((r) => {
      if (isSaida(r.fluxo)) return;
      if (!r.socio_id && !r.cliente_id) return;
      const rateado = num(r.valor_rateado);
      const pct = num(r.percentual_uso ?? r.percentual_sociedade);
      const total = num(r.valor_total_despesa);
      const base = rateado > 0 ? rateado : pct > 0 ? total * (pct / 100) : total;
      resolveKeysWeighted(r.socio_id || null, r.cliente_id || null).forEach(({ key: k, weight }) => {
        if (!map.has(k)) return;
        map.set(k, (map.get(k) || 0) + base * weight);
      });
    });
    return participantes.map((c) => ({ ...c, valor: map.get(c.id) || 0 })).filter((c) => c.valor > 0.005).sort((a, b) => b.valor - a.valor);
  }, [rateiosPeriodo, participantes, sociosPorCliente]);

  // Comparativo mensal — quando há filtro de participante, mostra só o custo/horas dela;
  // sem filtro (visão interna), mostra o total da aeronave.
  const monthlyBreakdown = useMemo(() => {
    return [...selectedMonths].sort((a, b) => a - b).map((m) => {
      const inM = (d?: string | null) => {
        if (!d) return false;
        const dt = new Date(d + (d.length <= 10 ? "T00:00:00" : ""));
        return dt.getFullYear() === ano && dt.getMonth() + 1 === m;
      };
      const vistos = new Set<string>();
      let custo = 0, horas = 0, pousos = 0, voosCount = 0;
      rateios.forEach((r) => {
        if (!inM(dateOf(r)) || !isSaida(r.fluxo)) return;
        if (!matchFiltro(r.socio_id || null, r.cliente_id || null)) return;
        const k = r.despesa_id || r.id;
        if (vistos.has(k)) return;
        vistos.add(k);
        custo += num(r.valor_total_despesa);
      });
      voos.forEach((v) => {
        if (!inM(v.data_registro)) return;
        if (!matchFiltro(v.socios_id || null, v.clientes_id || null)) return;
        horas += num(v.tempo_total) || num(v.tempo_voo);
        pousos += num(v.pousos_total);
        voosCount++;
      });
      return { mes: m, custo, horas, pousos, voos: voosCount, custoHora: horas > 0 ? custo / horas : 0 };
    });
  }, [rateios, voos, ano, selectedMonths, participanteFiltroKey]);

  const serieMensal = useMemo(() => {
    const pontos = Array.from({ length: 12 }, (_, i) => ({ key: `${ano}-${String(i + 1).padStart(2, "0")}`, custo: 0, horas: 0, voos: 0, pousos: 0 }));
    const vistos = new Set<string>();
    rateios.forEach((r) => {
      const d = dateOf(r);
      if (!d) return;
      const dt = new Date(d);
      if (dt.getFullYear() !== ano || !isSaida(r.fluxo)) return;
      if (!matchFiltro(r.socio_id || null, r.cliente_id || null)) return;
      const k = r.despesa_id || r.id;
      if (vistos.has(k)) return;
      vistos.add(k);
      pontos[dt.getMonth()].custo += num(r.valor_total_despesa);
    });
    voos.forEach((v) => {
      const dt = new Date(v.data_registro);
      if (dt.getFullYear() !== ano) return;
      if (!matchFiltro(v.socios_id || null, v.clientes_id || null)) return;
      pontos[dt.getMonth()].horas += num(v.tempo_total) || num(v.tempo_voo);
      pontos[dt.getMonth()].voos += 1;
      pontos[dt.getMonth()].pousos += num(v.pousos_total);
    });
    return pontos;
  }, [rateios, voos, ano, participanteFiltroKey]);

  const composicaoPeriodo = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    despesasPeriodoFiltrado.forEach((r) => {
      if (!isSaida(r.fluxo)) return;
      const nome = catNameOf(r);
      const cur = map.get(nome) || { total: 0, count: 0 };
      cur.total += num(r.valor_total_despesa);
      cur.count += 1;
      map.set(nome, cur);
    });
    return Array.from(map.entries()).map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.total - a.total);
  }, [despesasPeriodoFiltrado, catMap]);

  // Espelho diário por sócio: voo conta INTEIRO (horas, pousos, contagem) para cada
  // sócio vinculado ao cliente do lançamento — não é despesa, não se rateia.
  const diarioPorSocio = useMemo(() => {
    const map = new Map<string, { nome: string; socio_id: string | null; cliente_id: string | null; horas: number; pousos: number; voos: number; noturnas: number; ifr: number; voosList: VooRow[] }>();
    participantes.forEach((c) => map.set(c.id, { nome: c.nome, socio_id: c.socio_id, cliente_id: c.cliente_id, horas: 0, pousos: 0, voos: 0, noturnas: 0, ifr: 0, voosList: [] }));
    voosPeriodo.forEach((v) => {
      if (!matchFiltro(v.socios_id || null, v.clientes_id || null)) return;
      resolveKeysForVoo(v.socios_id || null, v.clientes_id || null).forEach((k) => {
        const cur = map.get(k);
        if (!cur) return;
        cur.horas += num(v.tempo_total) || num(v.tempo_voo);
        cur.pousos += num(v.pousos_total);
        cur.voos += 1;
        cur.noturnas += num(v.horas_noturnas);
        cur.ifr += num(v.tempo_ifr);
        cur.voosList.push(v);
      });
    });
    return Array.from(map.values()).filter((d) => d.voosList.length > 0).sort((a, b) => b.horas - a.horas);
  }, [voosPeriodo, participantes, sociosPorCliente, participanteFiltroKey]);

  const evolucaoPorSocio = useMemo(() => {
    const map = new Map<string, { nome: string; serie: { key: string; horas: number; pousos: number; voos: number }[] }>();
    participantes.forEach((c) => map.set(c.id, { nome: c.nome, serie: Array.from({ length: 12 }, (_, i) => ({ key: `${ano}-${String(i + 1).padStart(2, "0")}`, horas: 0, pousos: 0, voos: 0 })) }));
    voos.forEach((v) => {
      const dt = new Date(v.data_registro);
      if (dt.getFullYear() !== ano) return;
      if (!matchFiltro(v.socios_id || null, v.clientes_id || null)) return;
      resolveKeysForVoo(v.socios_id || null, v.clientes_id || null).forEach((k) => {
        const entry = map.get(k);
        if (!entry) return;
        entry.serie[dt.getMonth()].horas += num(v.tempo_total) || num(v.tempo_voo);
        entry.serie[dt.getMonth()].pousos += num(v.pousos_total);
        entry.serie[dt.getMonth()].voos += 1;
      });
    });
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v })).sort((a, b) => {
      const ta = a.serie.reduce((s, p) => s + p.horas, 0);
      const tb = b.serie.reduce((s, p) => s + p.horas, 0);
      return tb - ta;
    });
  }, [voos, ano, participantes, sociosPorCliente, participanteFiltroKey]);

  // Já usa `participantes`, que respeita o filtro
  const composicaoPorSocio = useMemo(() => {
    const acc = new Map<string, { fixo: number; variavel: number; extra: number; entradas: number }>();
    participantes.forEach((c) => acc.set(c.id, { fixo: 0, variavel: 0, extra: 0, entradas: 0 }));
    rateiosPeriodo.forEach((r) => {
      if (!r.socio_id && !r.cliente_id) return;
      const rateado = num(r.valor_rateado);
      const pct = num(r.percentual_uso ?? r.percentual_sociedade);
      const total = num(r.valor_total_despesa);
      const base = rateado > 0 ? rateado : pct > 0 ? total * (pct / 100) : total;
      const t = norm(r.tipo_rateio);
      resolveKeysWeighted(r.socio_id || null, r.cliente_id || null).forEach(({ key: k, weight }) => {
        const entry = acc.get(k);
        if (!entry) return;
        const val = base * weight;
        if (!isSaida(r.fluxo)) { entry.entradas += val; return; }
        if (t === "fixo") entry.fixo += val;
        else if (t === "extra") entry.extra += val;
        else if (isFixo(r.periodicidade)) entry.fixo += val;
        else entry.variavel += val;
      });
    });
    return participantes.map((c) => {
      const e = acc.get(c.id)!;
      return { ...c, ...e, total: e.fixo + e.variavel + e.extra };
    });
  }, [rateiosPeriodo, participantes, sociosPorCliente]);

  const categoriasPorSocio = useMemo(() => {
    const acc = new Map<string, Map<string, { total: number; count: number }>>();
    participantes.forEach((c) => acc.set(c.id, new Map()));
    rateiosPeriodo.forEach((r) => {
      if (!isSaida(r.fluxo)) return;
      if (!r.socio_id && !r.cliente_id) return;
      const nome = resolveCategoria(r.categoria_custo, catMap);
      const rateado = num(r.valor_rateado);
      const pct = num(r.percentual_uso ?? r.percentual_sociedade);
      const total = num(r.valor_total_despesa);
      const base = rateado > 0 ? rateado : pct > 0 ? total * (pct / 100) : total;
      resolveKeysWeighted(r.socio_id || null, r.cliente_id || null).forEach(({ key: k, weight }) => {
        const m = acc.get(k);
        if (!m) return;
        const cur = m.get(nome) || { total: 0, count: 0 };
        cur.total += base * weight;
        cur.count += 1;
        m.set(nome, cur);
      });
    });
    return participantes.map((c) => ({
      ...c,
      categorias: Array.from((acc.get(c.id) || new Map()).entries()).map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.total - a.total),
    }));
  }, [rateiosPeriodo, participantes, catMap, sociosPorCliente]);

  // Detalhe por voo (combustível, TER, tarifas, hangar) — usado no espelho do diário.
  // Não é filtrado por participante pois é indexado por voo, não por sócio; ao usar na
  // visão do cliente, cruze com diarioPorSocio (já filtrado) para pegar só os voos dela.
  const abastByVoo = useMemo(() => {
    const m = new Map<string, AbastecimentoRow>();
    abastecimentos.forEach((a) => { if (a.logbook_entry_id) m.set(a.logbook_entry_id, a); });
    return m;
  }, [abastecimentos]);

  const terByDate = useMemo(() => {
    return ters.map((t) => ({
      ...t,
      _start: t.data_inicio ? new Date(t.data_inicio + "T00:00:00").getTime() : 0,
      _end: t.data_fim ? new Date(t.data_fim + "T23:59:59").getTime() : 0,
    }));
  }, [ters]);

  const contasByTER = useMemo(() => {
    const m = new Map<string, ContaApagarRow[]>();
    contasApagar.forEach((c) => {
      if (c.reference_type === "travel_expense_report" && c.reference_id) {
        const arr = m.get(c.reference_id) || [];
        arr.push(c);
        m.set(c.reference_id, arr);
      }
    });
    return m;
  }, [contasApagar]);

  const voosEnriquecidos = useMemo(() => {
    type EnrichedVoo = {
      picName: string; horas: number; pousos: number; distanciaNm: number; distanciaKm: number;
      combustivelLitros: number; consumoMedio: number; terNumero: string | null; terStatus: string | null; terPago: boolean;
      hasDecea: boolean; hasAnac: boolean; hasPouso: boolean; hasHangar: boolean; hasAbastecimento: boolean;
      allPaid: boolean; debito: number; credito: number; totalCost: number;
      despesasItems: { label: string; valor: number; pago: boolean }[];
    };
    const m = new Map<string, EnrichedVoo>();
    const voosPorMes = new Map<string, number>();
    voosPeriodo.forEach((v) => {
      const mes = v.data_registro.slice(0, 7);
      voosPorMes.set(mes, (voosPorMes.get(mes) || 0) + 1);
    });
    const taxasPorMes = new Map<string, ContaApagarRow[]>();
    const hangarPorMes = new Map<string, ContaApagarRow[]>();
    contasApagar.forEach((c) => {
      const d = c.data_vencimento ? c.data_vencimento.slice(0, 7) : null;
      if (!d) return;
      const cat = norm(c.categoria);
      if (cat.includes("decea") || cat.includes("anac") || cat.includes("taxa") || cat.includes("navegacao") || cat.includes("aeroportuar") || cat.includes("pouso")) {
        const arr = taxasPorMes.get(d) || []; arr.push(c); taxasPorMes.set(d, arr);
      } else if (cat.includes("hangar")) {
        const arr = hangarPorMes.get(d) || []; arr.push(c); hangarPorMes.set(d, arr);
      }
    });

    voosPeriodo.forEach((v) => {
      const picName = v.pic_canac ? (membrosMap[v.pic_canac]?.nome_completo || "—") : "—";
      const horas = num(v.tempo_total) || num(v.tempo_voo);
      const pousos = num(v.pousos_total);
      const distNm = num(v.distancia_nm);
      const distKm = distNm * 1.852;
      const mes = v.data_registro.slice(0, 7);
      const vooCount = Math.max(voosPorMes.get(mes) || 1, 1);
      const abast = abastByVoo.get(v.id);
      const combustLitros = abast ? num(abast.litros) : 0;
      const combustValor = abast ? num(abast.valor_total) : 0;
      const hasAbast = !!abast || v.abastecido === true;
      const abastPago = abast ? norm(abast.status).startsWith("pago") : true;
      const consumoRegistrado = num(v.consumo_combustivel_voo);
      const consumoMedio = consumoRegistrado > 0 ? consumoRegistrado : (horas > 0 && combustLitros > 0 ? combustLitros / horas : 0);
      const ter = terByDate.find((t) => {
        const dt = new Date(v.data_registro + "T00:00:00").getTime();
        return dt >= t._start && dt <= t._end;
      }) || null;
      const terPago = ter ? (norm(ter.status) === "finalizado" || !!ter.pago_em) : false;
      const taxasDoMes = taxasPorMes.get(mes) || [];
      const hangarDoMes = hangarPorMes.get(mes) || [];
      const allocTaxa = taxasDoMes.reduce((s, c) => s + num(c.valor), 0) / vooCount;
      const allocHangar = hangarDoMes.reduce((s, c) => s + num(c.valor), 0) / vooCount;
      const taxasPaid = taxasDoMes.every((c) => norm(c.status).startsWith("paga") || !!c.data_pagamento);
      const hangarPaid = hangarDoMes.every((c) => norm(c.status).startsWith("paga") || !!c.data_pagamento);
      const hasDecea = taxasDoMes.some((c) => norm(c.categoria).includes("decea") || norm(c.categoria).includes("navegacao"));
      const hasAnac = taxasDoMes.some((c) => norm(c.categoria).includes("anac"));
      const hasPouso = taxasDoMes.some((c) => norm(c.categoria).includes("pouso") || norm(c.categoria).includes("taxa") || norm(c.categoria).includes("aeroportuar"));
      const hasHangar = hangarDoMes.length > 0;
      const despesasItems: { label: string; valor: number; pago: boolean }[] = [];
      if (combustValor > 0) despesasItems.push({ label: combustLitros > 0 ? `Combustível (${combustLitros.toFixed(0)} L)` : "Combustível", valor: combustValor, pago: abastPago });
      if (ter && num(ter.total_valor) > 0) despesasItems.push({ label: `Relatório ${ter.numero_relatorio || ""}`.trim(), valor: num(ter.total_valor), pago: terPago });
      if (allocTaxa > 0) despesasItems.push({ label: "Tarifas (DECEA/ANAC/Pouso)", valor: allocTaxa, pago: taxasPaid });
      if (allocHangar > 0) despesasItems.push({ label: "Hangar", valor: allocHangar, pago: hangarPaid });
      const totalCost = despesasItems.reduce((s, d) => s + d.valor, 0);
      let debito = 0, credito = 0;
      rateiosPeriodo.forEach((r) => {
        const linkedAbast = abast && (r as any).abastecimento_id === abast.id;
        if (!linkedAbast) return;
        const val = num(r.valor_rateado) || num(r.valor_total_despesa);
        if (isSaida(r.fluxo)) debito += val; else credito += val;
      });
      if (debito === 0) debito = totalCost;
      const allPaid = despesasItems.every((d) => d.pago);
      m.set(v.id, {
        picName, horas, pousos, distanciaNm: distNm, distanciaKm: distKm, combustivelLitros: combustLitros, consumoMedio,
        terNumero: ter?.numero_relatorio || null, terStatus: ter?.status || null, terPago,
        hasDecea, hasAnac, hasPouso, hasHangar, hasAbastecimento: hasAbast, allPaid, debito, credito, totalCost, despesasItems,
      });
    });
    return m;
  }, [voosPeriodo, membrosMap, abastByVoo, terByDate, contasApagar, rateiosPeriodo]);

  // map mês (YYYY-MM) -> aerodromo_base
  const diarioMesMap = useMemo(() => {
    const m = new Map<string, string | null>();
    diarioMeses.forEach((d) => {
      const key = `${String(d.ano)}-${String(d.mes).padStart(2, "0")}`;
      m.set(key, d.aerodromo_base || null);
    });
    return m;
  }, [diarioMeses]);

  return {
    loading,
    refresh,
    cotistas, sociosMap, clientesMap, catMap, membrosMap,
    custoFixo, custoVarHora, custoVarVoo, custoExtra, custoVariavel, custoTotal, entradasPeriodo,
    horasPeriodo, custoMedioHora, custoMedioHoraTotal, totalPousos,
    participantes, linhasPeriodo, entradasPorCotista,
    monthlyBreakdown, serieMensal, composicaoPeriodo,
    diarioPorSocio, evolucaoPorSocio, composicaoPorSocio, categoriasPorSocio,
    voosEnriquecidos, rateiosPeriodo, voosPeriodo,
    diarioMeses, diarioMesMap,
    resolveSocioName, resolveVooSocioName, catNameOf,
  };
}