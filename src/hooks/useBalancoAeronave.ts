import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  type Cotista, type RateioRow, type VooRow,
  type MembroTripulacao, type TERRow, type AbastecimentoRow, type ContaApagarRow,
  norm, isSaida, isFixo, num, cotistaKey, resolveCategoria,
} from "./balancoTypes";

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
  const [loading, setLoading] = useState(true);

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
        .select("id_clientes, socios_id, percentual_sociedade, clientes(id, razao_social, cnpj, endereco, cidade, uf), socios(id, nome, cpf, endereco, cidade, uf)")
        .eq("id_aeronave", aeronaveId);
      const socioIds = Array.from(new Set((cotData || []).map((r: any) => r.socios_id).filter(Boolean)));
      let sm: Record<string, any> = {};
      if (socioIds.length > 0) {
        const { data: sociosData } = await supabase.from("socios").select("id, nome, cpf, endereco, cidade, uf").in("id", socioIds);
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
      setRateios((data || []) as unknown as RateioRow[]);
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
    const doAll = async () => {
      await fetchCotistas();
      const aeroRes = await supabase.from("aeronave").select("id, matricula").eq("id", aeronaveId).maybeSingle();
      const mat: string = aeroRes.data?.matricula || "";
      await Promise.all([fetchRateios(), fetchVoos(), fetchMembros(), fetchTERs(), fetchAbastecimentos(), fetchContasApagar(mat)]);
    };
    doAll().finally(() => setLoading(false));
  }, [aeronaveId, ano]);

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

  const horasPeriodo = useMemo(() => voosPeriodoFiltrado.reduce((s, v) => s + (num(v.tempo_total) || num(v.tempo_voo)), 0), [voosPeriodoFiltrado]);
  const custoMedioHora = horasPeriodo > 0 ? custoVariavel / horasPeriodo : 0;
  const custoMedioHoraTotal = horasPeriodo > 0 ? custoTotal / horasPeriodo : 0;
  const totalPousos = useMemo(() => voosPeriodoFiltrado.reduce((s, v) => s + num(v.pousos_total), 0), [voosPeriodoFiltrado]);

  const participantesTodos = useMemo(() => {
    const map = new Map<string, ParticipanteBalanco>();
    const upsert = (socio_id: string | null, cliente_id: string | null, nome: string) => {
      const key = keyOfParticipante(socio_id, cliente_id, nome);
      if (map.has(key)) return;
      const cadastro = cotistas.find((c) => (socio_id && c.socio_id === socio_id) || (cliente_id && c.cliente_id === cliente_id));
      map.set(key, { id: key, nome: cadastro?.nome || nome || "Cotista", socio_id, cliente_id, percentual: cadastro?.percentual ?? 0 });
    };
    rateiosPeriodo.forEach((r) => { if (!r.socio_id && !r.cliente_id) return; upsert(r.socio_id || null, r.cliente_id || null, resolveSocioName(r)); });
    voosPeriodo.forEach((v) => { if (!v.socios_id && !v.clientes_id) return; upsert(v.socios_id || null, v.clientes_id || null, resolveVooSocioName(v)); });
    return Array.from(map.values());
  }, [rateiosPeriodo, voosPeriodo, cotistas, sociosMap, clientesMap]);

  const participantes = useMemo(
    () => participanteFiltroKey ? participantesTodos.filter((p) => p.id === participanteFiltroKey) : participantesTodos,
    [participantesTodos, participanteFiltroKey]
  );

  const linhasPeriodo = useMemo(() => {
    const debito = new Map<string, number>();
    const credito = new Map<string, number>();
    const horas = new Map<string, number>();
    const pousos = new Map<string, number>();
    participantes.forEach((c) => { debito.set(c.id, 0); credito.set(c.id, 0); horas.set(c.id, 0); pousos.set(c.id, 0); });
    rateiosPeriodo.forEach((r) => {
      if (!isSaida(r.fluxo)) return;
      if (!r.socio_id && !r.cliente_id) return;
      const k = keyOfParticipante(r.socio_id || null, r.cliente_id || null, resolveSocioName(r));
      if (!debito.has(k)) return;
      const rateado = num(r.valor_rateado);
      const pct = num(r.percentual_uso ?? r.percentual_sociedade);
      const total = num(r.valor_total_despesa);
      const base = rateado > 0 ? rateado : pct > 0 ? total * (pct / 100) : 0;
      debito.set(k, (debito.get(k) || 0) + base);
      const pago = num(r.valor_pago_real);
      if (pago > 0) credito.set(k, (credito.get(k) || 0) + pago);
    });
    voosPeriodo.forEach((v) => {
      if (!v.socios_id && !v.clientes_id) return;
      const k = keyOfParticipante(v.socios_id || null, v.clientes_id || null, resolveVooSocioName(v));
      if (!horas.has(k)) return;
      horas.set(k, (horas.get(k) || 0) + (num(v.tempo_total) || num(v.tempo_voo)));
      pousos.set(k, (pousos.get(k) || 0) + num(v.pousos_total));
    });
    return participantes.map((c) => {
      const deb = debito.get(c.id) || 0;
      const cre = credito.get(c.id) || 0;
      const saldo = cre - deb;
      const pctPago = deb > 0 ? (cre / deb) * 100 : cre > 0 ? 100 : 0;
      return { ...c, debito: deb, credito: cre, saldo, horas: horas.get(c.id) || 0, pousos: pousos.get(c.id) || 0, pctPago };
    });
  }, [rateiosPeriodo, voosPeriodo, participantes]);

  const entradasPorCotista = useMemo(() => {
    const map = new Map<string, number>();
    participantes.forEach((c) => map.set(c.id, 0));
    rateiosPeriodo.forEach((r) => {
      if (isSaida(r.fluxo)) return;
      if (!r.socio_id && !r.cliente_id) return;
      const k = keyOfParticipante(r.socio_id || null, r.cliente_id || null, resolveSocioName(r));
      if (!map.has(k)) return;
      const rateado = num(r.valor_rateado);
      const pct = num(r.percentual_uso ?? r.percentual_sociedade);
      const total = num(r.valor_total_despesa);
      const base = rateado > 0 ? rateado : pct > 0 ? total * (pct / 100) : total;
      map.set(k, (map.get(k) || 0) + base);
    });
    return participantes.map((c) => ({ ...c, valor: map.get(c.id) || 0 })).filter((c) => c.valor > 0.005).sort((a, b) => b.valor - a.valor);
  }, [rateiosPeriodo, participantes]);

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

  const diarioPorSocio = useMemo(() => {
    const map = new Map<string, { nome: string; socio_id: string | null; cliente_id: string | null; horas: number; pousos: number; voos: number; noturnas: number; ifr: number; voosList: VooRow[] }>();
    voosPeriodo.forEach((v) => {
      if (!matchFiltro(v.socios_id || null, v.clientes_id || null)) return;
      const nome = resolveVooSocioName(v);
      const sid = v.socios_id || null;
      const cid = v.clientes_id || null;
      const key = `${sid || cid || nome}`;
      const cur = map.get(key) || { nome, socio_id: sid, cliente_id: cid, horas: 0, pousos: 0, voos: 0, noturnas: 0, ifr: 0, voosList: [] as VooRow[] };
      cur.horas += num(v.tempo_total) || num(v.tempo_voo);
      cur.pousos += num(v.pousos_total);
      cur.voos += 1;
      cur.noturnas += num(v.horas_noturnas);
      cur.ifr += num(v.tempo_ifr);
      cur.voosList.push(v);
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.horas - a.horas);
  }, [voosPeriodo, sociosMap, clientesMap, participanteFiltroKey]);

  const evolucaoPorSocio = useMemo(() => {
    const map = new Map<string, { nome: string; serie: { key: string; horas: number; pousos: number; voos: number }[] }>();
    voos.forEach((v) => {
      const dt = new Date(v.data_registro);
      if (dt.getFullYear() !== ano) return;
      if (!matchFiltro(v.socios_id || null, v.clientes_id || null)) return;
      const nome = resolveVooSocioName(v);
      const sid = v.socios_id || null;
      const cid = v.clientes_id || null;
      const key = `${sid || cid || nome}`;
      if (!map.has(key)) {
        map.set(key, { nome, serie: Array.from({ length: 12 }, (_, i) => ({ key: `${ano}-${String(i + 1).padStart(2, "0")}`, horas: 0, pousos: 0, voos: 0 })) });
      }
      const entry = map.get(key)!;
      entry.serie[dt.getMonth()].horas += num(v.tempo_total) || num(v.tempo_voo);
      entry.serie[dt.getMonth()].pousos += num(v.pousos_total);
      entry.serie[dt.getMonth()].voos += 1;
    });
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v })).sort((a, b) => {
      const ta = a.serie.reduce((s, p) => s + p.horas, 0);
      const tb = b.serie.reduce((s, p) => s + p.horas, 0);
      return tb - ta;
    });
  }, [voos, ano, sociosMap, clientesMap, participanteFiltroKey]);

  // Já usa `participantes`, que respeita o filtro — nenhuma checagem extra necessária
  const composicaoPorSocio = useMemo(() => {
    return participantes.map((c) => {
      let fixo = 0, variavel = 0, extra = 0, entradas = 0;
      rateiosPeriodo.forEach((r) => {
        if (!r.socio_id && !r.cliente_id) return;
        if (keyOfParticipante(r.socio_id || null, r.cliente_id || null, resolveSocioName(r)) !== c.id) return;
        const rateado = num(r.valor_rateado);
        const pct = num(r.percentual_uso ?? r.percentual_sociedade);
        const total = num(r.valor_total_despesa);
        const base = rateado > 0 ? rateado : pct > 0 ? total * (pct / 100) : total;
        if (!isSaida(r.fluxo)) { entradas += base; return; }
        const t = norm(r.tipo_rateio);
        if (t === "fixo") fixo += base;
        else if (t === "extra") extra += base;
        else if (isFixo(r.periodicidade)) fixo += base;
        else variavel += base;
      });
      return { ...c, fixo, variavel, extra, entradas, total: fixo + variavel + extra };
    });
  }, [rateiosPeriodo, participantes]);

  const categoriasPorSocio = useMemo(() => {
    return participantes.map((c) => {
      const map = new Map<string, { total: number; count: number }>();
      rateiosPeriodo.forEach((r) => {
        if (!isSaida(r.fluxo)) return;
        if (!r.socio_id && !r.cliente_id) return;
        if (keyOfParticipante(r.socio_id || null, r.cliente_id || null, resolveSocioName(r)) !== c.id) return;
        const nome = resolveCategoria(r.categoria_custo, catMap);
        const rateado = num(r.valor_rateado);
        const pct = num(r.percentual_uso ?? r.percentual_sociedade);
        const total = num(r.valor_total_despesa);
        const base = rateado > 0 ? rateado : pct > 0 ? total * (pct / 100) : total;
        const cur = map.get(nome) || { total: 0, count: 0 };
        cur.total += base;
        cur.count += 1;
        map.set(nome, cur);
      });
      return { ...c, categorias: Array.from(map.entries()).map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.total - a.total) };
    });
  }, [rateiosPeriodo, participantes, catMap]);

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

  return {
    loading,
    cotistas, sociosMap, clientesMap, catMap, membrosMap,
    custoFixo, custoVarHora, custoVarVoo, custoExtra, custoVariavel, custoTotal, entradasPeriodo,
    horasPeriodo, custoMedioHora, custoMedioHoraTotal, totalPousos,
    participantes, linhasPeriodo, entradasPorCotista,
    monthlyBreakdown, serieMensal, composicaoPeriodo,
    diarioPorSocio, evolucaoPorSocio, composicaoPorSocio, categoriasPorSocio,
    voosEnriquecidos, rateiosPeriodo, voosPeriodo,
    resolveSocioName, resolveVooSocioName, catNameOf,
  };
}