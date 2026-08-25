import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  type Cotista,
  type RateioRow,
  type VooRow,
  type MembroTripulacao,
  type TERRow,
  type AbastecimentoRow,
  type ContaApagarRow,
  norm,
  isSaida,
  isFixo,
  num,
  cotistaKey,
  resolveCategoria,
} from "../components/dashboard/gestor/FinanceiroCotista/balancoTypes";

export interface ParticipanteBalanco {
  id: string;
  nome: string;
  socio_id: string | null;
  cliente_id: string | null;
  percentual: number;
}

export interface ParticipanteFiltro {
  socio_id?: string | null;
  cliente_id?: string | null;
}

export const keyOfParticipante = (
  socio_id?: string | null,
  cliente_id?: string | null,
  fallbackNome?: string,
) => `${socio_id || cliente_id || fallbackNome || "desconhecido"}`;

interface UseBalancoAeronaveParams {
  aeronaveId: string;
  ano: number;
  selectedMonths: number[];
  participanteFiltro?: ParticipanteFiltro;
}

const valorTotalDespesa = (r: RateioRow) => num(r.valor_total ?? r.valor_total_despesa);

/**
 * O balanço dos cotistas NÃO usa movimentacoes.
 *
 * Fonte financeira oficial do balanço:
 *   rateio_despesas
 *
 * Fonte de fatos operacionais:
 *   lancamentos_diario_bordo
 *
 * abastecimentos / TER / contas_apagar entram apenas como apoio visual do diário.
 */
export function useBalancoAeronave({
  aeronaveId,
  ano,
  selectedMonths,
  participanteFiltro,
}: UseBalancoAeronaveParams) {
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
  const [diarioMeses, setDiarioMeses] = useState<
    Array<{ id: string; ano: number; mes: number; aerodromo_base: string | null; fechado?: boolean | null }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    void supabase.from("expense_configu").select("id, expense_type").then(({ data }) => {
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
        .select(
          "id_clientes, socios_id, percentual_sociedade, clientes(id, razao_social, cnpj, endereco, cidade, uf), socios(id, nome, cpf, endereco)",
        )
        .eq("id_aeronave", aeronaveId);

      const socioIds = Array.from(
        new Set((cotData || []).map((r: any) => r.socios_id).filter(Boolean)),
      );

      let sm: Record<string, any> = {};
      if (socioIds.length > 0) {
        const { data: sociosData } = await supabase
          .from("socios")
          .select("id, nome, cpf, endereco")
          .in("id", socioIds);
        (sociosData || []).forEach((s: any) => {
          sm[s.id] = s;
        });
      }

      setSociosMap(sm);

      const { data: cliData } = await supabase
        .from("clientes")
        .select("id, razao_social, cnpj, endereco, cidade, uf");
      const cm: Record<string, any> = {};
      (cliData || []).forEach((c: any) => {
        cm[c.id] = c;
      });
      setClientesMap(cm);

      setCotistas(
        (cotData || []).map((r: any) => {
          const socio = sm[r.socios_id];
          const cliente = r.clientes;
          return {
            id: cotistaKey(r.id_clientes, r.socios_id),
            cliente_id: r.id_clientes ?? null,
            socio_id: r.socios_id ?? null,
            nome: socio?.nome || cliente?.razao_social || "Cotista",
            percentual: num(r.percentual_sociedade),
            documento: socio?.cpf || cliente?.cnpj || "",
          } as Cotista;
        }),
      );
    };

    const fetchRateios = async () => {
      const inicio = `${ano}-01-01`;
      const fim = `${ano}-12-31`;
      const { data } = await supabase
        .from("rateio_despesas")
        .select("*")
        .eq("aeronave_id", aeronaveId)
        .or(
          `and(data_pagamento.gte.${inicio},data_pagamento.lte.${fim}),and(data_pagamento.is.null,data_vencimento.gte.${inicio},data_vencimento.lte.${fim})`,
        );

      const normalized = (data || []).map((row: any) => ({
        ...row,
        valor_total_despesa: row.valor_total ?? row.valor_total_despesa ?? null,
      }));
      setRateios(normalized as RateioRow[]);
    };

    const fetchVoos = async () => {
      const { data } = await supabase
        .from("lancamentos_diario_bordo")
        .select(
          "id, data_registro, tempo_total, tempo_voo, horas_diurnas, horas_noturnas, tempo_ifr, clientes_id, socios_id, socios_nome, aerodromo_partida, aerodromo_chegada, trecho, natureza_voo, pousos_total, emprestimo, cliente_tomador_emprestimo_id, socio_tomador_emprestimo_id, pic_canac, sic_canac, sic_name, distancia_nm, consumo_combustivel_voo, litros_combustivel_inicio_voo, preco_combustivel_litro, abastecido",
        )
        .eq("aeronave_id", aeronaveId)
        .gte("data_registro", `${ano}-01-01`)
        .lte("data_registro", `${ano}-12-31`)
        .order("data_registro", { ascending: true });
      setVoos((data || []) as VooRow[]);
    };

    const fetchMembros = async () => {
      const { data } = await supabase.from("membros_tripulacao").select("id, canac, nome_completo");
      const m: Record<string, MembroTripulacao> = {};
      (data || []).forEach((mt: any) => {
        m[mt.id] = mt as MembroTripulacao;
      });
      setMembrosMap(m);
    };

    const fetchTERs = async () => {
      const { data } = await supabase
        .from("travel_expense_reports")
        .select("id, numero_relatorio, data_inicio, data_fim, rota, status, aeronave_id, total_valor, pago_em")
        .eq("aeronave_id", aeronaveId)
        .gte("data_inicio", `${ano}-01-01`)
        .lte("data_inicio", `${ano}-12-31`);
      setTers((data || []) as TERRow[]);
    };

    const fetchAbastecimentos = async () => {
      const { data } = await supabase
        .from("abastecimentos")
        .select("id, logbook_entry_id, data, trecho, litros, valor_total, valor_unitario, status")
        .eq("aeronave_id", aeronaveId)
        .gte("data", `${ano}-01-01`)
        .lte("data", `${ano}-12-31`);
      setAbastecimentos((data || []) as AbastecimentoRow[]);
    };

    const fetchContasApagar = async (matricula: string) => {
      if (!matricula) {
        setContasApagar([]);
        return;
      }
      const { data } = await supabase
        .from("contas_apagar")
        .select(
          "id, reference_type, reference_id, categoria, descricao, valor, status, data_vencimento, data_pagamento, aeronave_registro, competencia_decea, competencia_infraero",
        )
        .eq("aeronave_registro", matricula)
        .gte("data_vencimento", `${ano}-01-01`)
        .lte("data_vencimento", `${ano}-12-31`);
      setContasApagar((data || []) as ContaApagarRow[]);
    };

    const fetchDiarioMes = async () => {
      const { data } = await supabase
        .from("diario_mes")
        .select("id, ano, mes, aerodromo_base, fechado")
        .eq("aeronave_id", aeronaveId)
        .eq("ano", ano);
      setDiarioMeses((data || []) as any);
    };

    const doAll = async () => {
      await fetchCotistas();
      const aeroRes = await supabase.from("aeronave").select("id, matricula").eq("id", aeronaveId).maybeSingle();
      const matricula = aeroRes.data?.matricula || "";
      await Promise.all([
        fetchRateios(),
        fetchVoos(),
        fetchMembros(),
        fetchTERs(),
        fetchAbastecimentos(),
        fetchContasApagar(matricula),
        fetchDiarioMes(),
      ]);
    };

    void doAll().finally(() => setLoading(false));

    const channel = supabase
      .channel(`balanco-aeronave-${aeronaveId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rateio_despesas", filter: `aeronave_id=eq.${aeronaveId}` },
        () => void doAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lancamentos_diario_bordo", filter: `aeronave_id=eq.${aeronaveId}` },
        () => void doAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "abastecimentos", filter: `aeronave_id=eq.${aeronaveId}` },
        () => void doAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "diario_mes", filter: `aeronave_id=eq.${aeronaveId}` },
        () => void doAll(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
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

  const participanteFiltroKey = participanteFiltro
    ? keyOfParticipante(participanteFiltro.socio_id || null, participanteFiltro.cliente_id || null)
    : null;

  const participantesTodos = useMemo(() => {
    const map = new Map<string, ParticipanteBalanco>();
    cotistas.forEach((c) => {
      const key = keyOfParticipante(c.socio_id, c.cliente_id, c.nome);
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          nome: c.nome,
          socio_id: c.socio_id,
          cliente_id: c.cliente_id,
          percentual: c.percentual,
        });
      }
    });
    return Array.from(map.values());
  }, [cotistas]);

  const participantes = useMemo(
    () =>
      participanteFiltroKey
        ? participantesTodos.filter((p) => p.id === participanteFiltroKey)
        : participantesTodos,
    [participantesTodos, participanteFiltroKey],
  );

  const findParticipante = (socioId?: string | null, clienteId?: string | null) => {
    if (socioId) {
      const bySocio = participantesTodos.find((p) => p.socio_id === socioId);
      if (bySocio) return bySocio;
    }
    if (clienteId) {
      const byUniqueClient = participantesTodos.filter((p) => p.cliente_id === clienteId);
      if (byUniqueClient.length === 1) return byUniqueClient[0];
    }
    return null;
  };

  const normalizePayer = (value?: string | null) => norm(value);

  const findPayerParticipant = (r: RateioRow) => {
    if (r.pago_por) {
      const payer = normalizePayer(r.pago_por);
      const byName = participantesTodos.find((p) => normalizePayer(p.nome) === payer);
      if (byName) return byName;
      const byContains = participantesTodos.find(
        (p) => payer.includes(normalizePayer(p.nome)) || normalizePayer(p.nome).includes(payer),
      );
      if (byContains) return byContains;
    }

    if (r.pago_diretamente && r.socio_id) {
      return participantesTodos.find((p) => p.socio_id === r.socio_id) || null;
    }

    return null;
  };

  const rateioValor = (r: RateioRow) => {
    const rateado = num(r.valor_rateado);
    if (rateado > 0) return rateado;
    const pct = num(r.percentual_uso ?? r.percentual_sociedade);
    const total = valorTotalDespesa(r);
    if (pct > 0) return total * (pct / 100);
    return 0;
  };

  const rateiosPeriodo = useMemo(
    () => rateios.filter((r) => inSelected(dateOf(r))),
    [rateios, ano, selectedSet],
  );

  /**
   * Uma despesa pode possuir várias linhas de rateio.
   * Para custo total da aeronave contamos o total da despesa UMA vez.
   * Para custo por cotista contamos o valor_rateado de cada linha.
   */
  const despesasPeriodo = useMemo(() => {
    const groups = new Map<string, RateioRow[]>();
    rateiosPeriodo.forEach((r) => {
      const key = r.despesa_id || r.id;
      const arr = groups.get(key) || [];
      arr.push(r);
      groups.set(key, arr);
    });

    return Array.from(groups.values()).map((rows) => {
      const representative = rows.find((r) => isSaida(r.fluxo)) || rows[0];
      const total = Math.max(...rows.map((r) => valorTotalDespesa(r)), 0);
      const allocated = rows.reduce((sum, r) => sum + rateioValor(r), 0);
      const hasExplicitAllocation = rows.some(
        (r) => num(r.valor_rateado) > 0 || num(r.percentual_uso ?? r.percentual_sociedade) > 0,
      );

      return {
        ...representative,
        valor_total_despesa: total,
        _rateio_total: total,
        _rateio_atribuido: allocated,
        _rateio_tem_rateio_explicito: hasExplicitAllocation,
      } as RateioRow & {
        _rateio_total: number;
        _rateio_atribuido: number;
        _rateio_tem_rateio_explicito: boolean;
      };
    });
  }, [rateiosPeriodo]);

  const despesasPeriodoFiltrado = useMemo(() => {
    if (!participanteFiltroKey) return despesasPeriodo;
    return rateiosPeriodo
      .filter((r) => {
        const p = findParticipante(r.socio_id, r.cliente_id);
        return p?.id === participanteFiltroKey && isSaida(r.fluxo);
      })
      .map((r) => ({ ...r, valor_total_despesa: rateioValor(r) }));
  }, [despesasPeriodo, rateiosPeriodo, participanteFiltroKey]);

  const {
    custoFixo,
    custoVarHora,
    custoVarVoo,
    custoExtra,
    custoVariavel,
    custoTotal,
    entradasPeriodo,
    custoAtribuidoCotistas,
    custoNaoAtribuido,
  } = useMemo(() => {
    let fx = 0;
    let vh = 0;
    let vv = 0;
    let ex = 0;
    let entradas = 0;
    let atribuido = 0;
    let naoAtribuido = 0;

    despesasPeriodo.forEach((d: any) => {
      if (!isSaida(d.fluxo)) return;
      const total = num(d._rateio_total);
      const assigned = num(d._rateio_atribuido);
      const uniqueFallback =
        !d._rateio_tem_rateio_explicito && findParticipante(d.socio_id, d.cliente_id) &&
        despesasPeriodo.filter((x: any) => x.despesa_id === d.despesa_id).length === 0
          ? total
          : assigned;

      const attributed = Math.min(total, uniqueFallback || assigned);
      atribuido += attributed;
      naoAtribuido += Math.max(total - attributed, 0);

      const t = norm(d.tipo_rateio);
      if (t === "fixo" || isFixo(d.periodicidade)) fx += total;
      else if (t === "variavel_por_hora") vh += total;
      else if (t === "extra") ex += total;
      else if (t === "variavel_por_voo") vv += total;
      else vv += total;
    });

    rateiosPeriodo.forEach((r) => {
      if (isSaida(r.fluxo)) return;
      const amount =
        num(r.valor_pago_real) ||
        num(r.valor_rateado) ||
        valorTotalDespesa(r);
      entradas += amount;
    });

    const variavel = vh + vv;
    return {
      custoFixo: fx,
      custoVarHora: vh,
      custoVarVoo: vv,
      custoExtra: ex,
      custoVariavel: variavel,
      custoTotal: fx + variavel + ex,
      entradasPeriodo: entradas,
      custoAtribuidoCotistas: atribuido,
      custoNaoAtribuido: naoAtribuido,
    };
  }, [despesasPeriodo, rateiosPeriodo]);

  const voosPeriodo = useMemo(
    () => voos.filter((v) => inSelected(v.data_registro)),
    [voos, ano, selectedSet],
  );

  const vooPertenceAoParticipante = (v: VooRow, participant: ParticipanteBalanco) => {
    if (v.socios_id) return v.socios_id === participant.socio_id;
    if (v.clientes_id) {
      const unique = participantesTodos.filter((p) => p.cliente_id === v.clientes_id);
      return unique.length === 1 && unique[0].id === participant.id;
    }
    return false;
  };

  const voosPeriodoFiltrado = useMemo(() => {
    if (!participanteFiltroKey) return voosPeriodo;
    const participant = participantesTodos.find((p) => p.id === participanteFiltroKey);
    return participant ? voosPeriodo.filter((v) => vooPertenceAoParticipante(v, participant)) : [];
  }, [voosPeriodo, participanteFiltroKey, participantesTodos]);

  const horasPeriodo = useMemo(
    () => voosPeriodoFiltrado.reduce((s, v) => s + (num(v.tempo_total) || num(v.tempo_voo)), 0),
    [voosPeriodoFiltrado],
  );

  const totalPousos = useMemo(
    () => voosPeriodoFiltrado.reduce((s, v) => s + num(v.pousos_total), 0),
    [voosPeriodoFiltrado],
  );

  const custoMedioHora = horasPeriodo > 0 ? custoVariavel / horasPeriodo : 0;
  const custoMedioHoraTotal = horasPeriodo > 0 ? custoTotal / horasPeriodo : 0;

  const linhasPeriodo = useMemo(() => {
    const debito = new Map<string, number>();
    const credito = new Map<string, number>();
    const depositado = new Map<string, number>();
    const horas = new Map<string, number>();
    const pousos = new Map<string, number>();

    participantes.forEach((p) => {
      debito.set(p.id, 0);
      credito.set(p.id, 0);
      depositado.set(p.id, 0);
      horas.set(p.id, 0);
      pousos.set(p.id, 0);
    });

    const participantSet = new Set(participantes.map((p) => p.id));

    rateiosPeriodo.forEach((r) => {
      if (isSaida(r.fluxo)) {
        const beneficiary = findParticipante(r.socio_id, r.cliente_id);
        const amount = rateioValor(r);

        if (beneficiary && participantSet.has(beneficiary.id)) {
          debito.set(beneficiary.id, (debito.get(beneficiary.id) || 0) + amount);
        }

        const payer = findPayerParticipant(r);
        const paid = num(r.valor_pago_real);
        if (payer && participantSet.has(payer.id) && paid > 0) {
          credito.set(payer.id, (credito.get(payer.id) || 0) + paid);
        }
      } else {
        const payer = findPayerParticipant(r) || findParticipante(r.socio_id, r.cliente_id);
        const amount = num(r.valor_pago_real) || num(r.valor_rateado) || valorTotalDespesa(r);
        if (payer && participantSet.has(payer.id)) {
          depositado.set(payer.id, (depositado.get(payer.id) || 0) + amount);
        }
      }
    });

    const addVoo = (v: VooRow, p: ParticipanteBalanco) => {
      if (!participantSet.has(p.id)) return;
      horas.set(p.id, (horas.get(p.id) || 0) + (num(v.tempo_total) || num(v.tempo_voo)));
      pousos.set(p.id, (pousos.get(p.id) || 0) + num(v.pousos_total));
    };

    voosPeriodo.forEach((v) => {
      participantes.forEach((p) => {
        if (vooPertenceAoParticipante(v, p)) addVoo(v, p);
      });
    });

    return participantes.map((p) => {
      const deb = debito.get(p.id) || 0;
      const paid = credito.get(p.id) || 0;
      const dep = depositado.get(p.id) || 0;
      const saldo = dep + paid - deb;
      const pctPago = deb > 0 ? ((dep + paid) / deb) * 100 : dep + paid > 0 ? 100 : 0;
      return {
        ...p,
        debito: deb,
        credito: paid,
        depositado: dep,
        saldo,
        horas: horas.get(p.id) || 0,
        pousos: pousos.get(p.id) || 0,
        pctPago,
      };
    });
  }, [rateiosPeriodo, participantes, participantesTodos, voosPeriodo]);

  const entradasPorCotista = useMemo(() => {
    return linhasPeriodo
      .map((l) => ({ ...l, valor: l.depositado }))
      .filter((l) => l.valor > 0.005)
      .sort((a, b) => b.valor - a.valor);
  }, [linhasPeriodo]);

  const monthlyBreakdown = useMemo(() => {
    return [...selectedMonths].sort((a, b) => a - b).map((mes) => {
      const inMonth = (d?: string | null) => {
        if (!d) return false;
        const dt = new Date(d + (d.length <= 10 ? "T00:00:00" : ""));
        return dt.getFullYear() === ano && dt.getMonth() + 1 === mes;
      };

      let custo = 0;
      let horas = 0;
      let pousos = 0;
      let voosCount = 0;

      if (!participanteFiltroKey) {
        const groups = new Map<string, RateioRow[]>();
        rateios.forEach((r) => {
          if (!inMonth(dateOf(r)) || !isSaida(r.fluxo)) return;
          const key = r.despesa_id || r.id;
          const arr = groups.get(key) || [];
          arr.push(r);
          groups.set(key, arr);
        });
        groups.forEach((rows) => {
          custo += Math.max(...rows.map((r) => valorTotalDespesa(r)), 0);
        });
      } else {
        rateios.forEach((r) => {
          if (!inMonth(dateOf(r)) || !isSaida(r.fluxo)) return;
          const p = findParticipante(r.socio_id, r.cliente_id);
          if (p?.id === participanteFiltroKey) custo += rateioValor(r);
        });
      }

      voos.forEach((v) => {
        if (!inMonth(v.data_registro)) return;
        if (participanteFiltroKey) {
          const p = participantesTodos.find((x) => x.id === participanteFiltroKey);
          if (!p || !vooPertenceAoParticipante(v, p)) return;
        }
        horas += num(v.tempo_total) || num(v.tempo_voo);
        pousos += num(v.pousos_total);
        voosCount += 1;
      });

      return {
        mes,
        custo,
        horas,
        pousos,
        voos: voosCount,
        custoHora: horas > 0 ? custo / horas : 0,
      };
    });
  }, [rateios, voos, ano, selectedMonths, participanteFiltroKey, participantesTodos]);

  const serieMensal = useMemo(() => {
    const pontos = Array.from({ length: 12 }, (_, i) => ({
      key: `${ano}-${String(i + 1).padStart(2, "0")}`,
      custo: 0,
      horas: 0,
      voos: 0,
      pousos: 0,
    }));

    const groups = new Map<string, RateioRow[]>();
    rateios.forEach((r) => {
      const d = dateOf(r);
      if (!d || !isSaida(r.fluxo)) return;
      const dt = new Date(d);
      if (dt.getFullYear() !== ano) return;
      if (participanteFiltroKey) {
        const p = findParticipante(r.socio_id, r.cliente_id);
        if (p?.id !== participanteFiltroKey) return;
      }
      const key = r.despesa_id || r.id;
      const arr = groups.get(key) || [];
      arr.push(r);
      groups.set(key, arr);
    });

    groups.forEach((rows) => {
      const d = dateOf(rows[0]);
      if (!d) return;
      const monthIndex = new Date(d).getMonth();
      pontos[monthIndex].custo += participanteFiltroKey
        ? rows.reduce((s, r) => s + rateioValor(r), 0)
        : Math.max(...rows.map((r) => valorTotalDespesa(r)), 0);
    });

    voos.forEach((v) => {
      const dt = new Date(v.data_registro);
      if (dt.getFullYear() !== ano) return;
      if (participanteFiltroKey) {
        const p = participantesTodos.find((x) => x.id === participanteFiltroKey);
        if (!p || !vooPertenceAoParticipante(v, p)) return;
      }
      pontos[dt.getMonth()].horas += num(v.tempo_total) || num(v.tempo_voo);
      pontos[dt.getMonth()].voos += 1;
      pontos[dt.getMonth()].pousos += num(v.pousos_total);
    });

    return pontos;
  }, [rateios, voos, ano, participanteFiltroKey, participantesTodos]);

  const composicaoPeriodo = useMemo(() => {
    return despesasPeriodo
      .filter((r) => isSaida(r.fluxo))
      .reduce((acc: Array<{ nome: string; total: number; count: number }>, r: any) => {
        const nome = catNameOf(r);
        const existing = acc.find((x) => x.nome === nome);
        if (existing) {
          existing.total += num(r._rateio_total);
          existing.count += 1;
        } else {
          acc.push({ nome, total: num(r._rateio_total), count: 1 });
        }
        return acc;
      }, [])
      .sort((a, b) => b.total - a.total);
  }, [despesasPeriodo, catMap]);

  const composicaoPorSocio = useMemo(() => {
    const acc = new Map<string, { fixo: number; variavel: number; extra: number; entradas: number }>();
    participantes.forEach((p) => acc.set(p.id, { fixo: 0, variavel: 0, extra: 0, entradas: 0 }));

    rateiosPeriodo.forEach((r) => {
      const beneficiary = findParticipante(r.socio_id, r.cliente_id);
      if (!beneficiary || !acc.has(beneficiary.id)) return;

      const entry = acc.get(beneficiary.id)!;
      if (!isSaida(r.fluxo)) {
        const payer = findPayerParticipant(r) || beneficiary;
        if (payer.id === beneficiary.id) {
          entry.entradas += num(r.valor_pago_real) || num(r.valor_rateado) || valorTotalDespesa(r);
        }
        return;
      }

      const value = rateioValor(r);
      const t = norm(r.tipo_rateio);
      if (t === "fixo" || isFixo(r.periodicidade)) entry.fixo += value;
      else if (t === "extra") entry.extra += value;
      else entry.variavel += value;
    });

    return participantes.map((p) => {
      const e = acc.get(p.id)!;
      return { ...p, ...e, total: e.fixo + e.variavel + e.extra };
    });
  }, [rateiosPeriodo, participantes]);

  const categoriasPorSocio = useMemo(() => {
    const acc = new Map<string, Map<string, { total: number; count: number }>>();
    participantes.forEach((p) => acc.set(p.id, new Map()));

    rateiosPeriodo.forEach((r) => {
      if (!isSaida(r.fluxo)) return;
      const beneficiary = findParticipante(r.socio_id, r.cliente_id);
      if (!beneficiary) return;
      const categoryMap = acc.get(beneficiary.id);
      if (!categoryMap) return;

      const nome = catNameOf(r);
      const current = categoryMap.get(nome) || { total: 0, count: 0 };
      current.total += rateioValor(r);
      current.count += 1;
      categoryMap.set(nome, current);
    });

    return participantes.map((p) => ({
      ...p,
      categorias: Array.from((acc.get(p.id) || new Map()).entries())
        .map(([nome, value]) => ({ nome, ...value }))
        .sort((a, b) => b.total - a.total),
    }));
  }, [rateiosPeriodo, participantes, catMap]);

  const diarioPorSocio = useMemo(() => {
    const map = new Map<string, {
      nome: string;
      socio_id: string | null;
      cliente_id: string | null;
      horas: number;
      pousos: number;
      voos: number;
      noturnas: number;
      ifr: number;
      voosList: VooRow[];
    }>();

    participantes.forEach((p) =>
      map.set(p.id, {
        nome: p.nome,
        socio_id: p.socio_id,
        cliente_id: p.cliente_id,
        horas: 0,
        pousos: 0,
        voos: 0,
        noturnas: 0,
        ifr: 0,
        voosList: [],
      }),
    );

    voosPeriodo.forEach((v) => {
      participantes.forEach((p) => {
        if (!vooPertenceAoParticipante(v, p)) return;
        const current = map.get(p.id);
        if (!current) return;
        current.horas += num(v.tempo_total) || num(v.tempo_voo);
        current.pousos += num(v.pousos_total);
        current.voos += 1;
        current.noturnas += num(v.horas_noturnas);
        current.ifr += num(v.tempo_ifr);
        current.voosList.push(v);
      });
    });

    return Array.from(map.values())
      .filter((d) => d.voosList.length > 0)
      .sort((a, b) => b.horas - a.horas);
  }, [voosPeriodo, participantes, participantesTodos]);

  const evolucaoPorSocio = useMemo(() => {
    const map = new Map<string, {
      nome: string;
      serie: { key: string; horas: number; pousos: number; voos: number }[];
    }>();

    participantes.forEach((p) =>
      map.set(p.id, {
        nome: p.nome,
        serie: Array.from({ length: 12 }, (_, i) => ({
          key: `${ano}-${String(i + 1).padStart(2, "0")}`,
          horas: 0,
          pousos: 0,
          voos: 0,
        })),
      }),
    );

    voos.forEach((v) => {
      const dt = new Date(v.data_registro);
      if (dt.getFullYear() !== ano) return;
      participantes.forEach((p) => {
        if (!vooPertenceAoParticipante(v, p)) return;
        const entry = map.get(p.id);
        if (!entry) return;
        entry.serie[dt.getMonth()].horas += num(v.tempo_total) || num(v.tempo_voo);
        entry.serie[dt.getMonth()].pousos += num(v.pousos_total);
        entry.serie[dt.getMonth()].voos += 1;
      });
    });

    return Array.from(map.entries())
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => {
        const ta = a.serie.reduce((s, p) => s + p.horas, 0);
        const tb = b.serie.reduce((s, p) => s + p.horas, 0);
        return tb - ta;
      });
  }, [voos, ano, participantes, participantesTodos]);

  const abastByVoo = useMemo(() => {
    const map = new Map<string, AbastecimentoRow>();
    abastecimentos.forEach((a) => {
      if (a.logbook_entry_id) map.set(a.logbook_entry_id, a);
    });
    return map;
  }, [abastecimentos]);

  const terByDate = useMemo(() => {
    return ters.map((t) => ({
      ...t,
      _start: t.data_inicio ? new Date(t.data_inicio + "T00:00:00").getTime() : 0,
      _end: t.data_fim ? new Date(t.data_fim + "T23:59:59").getTime() : 0,
    }));
  }, [ters]);

  const voosEnriquecidos = useMemo(() => {
    type EnrichedVoo = {
      picName: string;
      horas: number;
      pousos: number;
      distanciaNm: number;
      distanciaKm: number;
      combustivelLitros: number;
      consumoMedio: number;
      terNumero: string | null;
      terStatus: string | null;
      terPago: boolean;
      hasDecea: boolean;
      hasAnac: boolean;
      hasPouso: boolean;
      hasHangar: boolean;
      hasAbastecimento: boolean;
      allPaid: boolean;
      debito: number;
      credito: number;
      totalCost: number;
      despesasItems: { label: string; valor: number; pago: boolean }[];
    };

    const map = new Map<string, EnrichedVoo>();
    const voosPorMes = new Map<string, number>();
    voosPeriodo.forEach((v) => {
      const mes = v.data_registro.slice(0, 7);
      voosPorMes.set(mes, (voosPorMes.get(mes) || 0) + 1);
    });

    const contasPorMes = new Map<string, ContaApagarRow[]>();
    contasApagar.forEach((c) => {
      const mes = c.data_vencimento?.slice(0, 7);
      if (!mes) return;
      const arr = contasPorMes.get(mes) || [];
      arr.push(c);
      contasPorMes.set(mes, arr);
    });

    voosPeriodo.forEach((v) => {
      const horas = num(v.tempo_total) || num(v.tempo_voo);
      const pousos = num(v.pousos_total);
      const distanciaNm = num(v.distancia_nm);
      const mes = v.data_registro.slice(0, 7);
      const vooCount = Math.max(voosPorMes.get(mes) || 1, 1);
      const abast = abastByVoo.get(v.id);
      const combustivelLitros = abast ? num(abast.litros) : 0;
      const combustivelValor = abast ? num(abast.valor_total) : 0;
      const ter = terByDate.find((t) => {
        const dt = new Date(v.data_registro + "T00:00:00").getTime();
        return dt >= t._start && dt <= t._end;
      }) || null;
      const contasDoMes = contasPorMes.get(mes) || [];
      const taxasDoMes = contasDoMes.filter((c) => {
        const cat = norm(c.categoria);
        return cat.includes("decea") || cat.includes("anac") || cat.includes("taxa") || cat.includes("pouso") || cat.includes("navegacao") || cat.includes("aeroportuar");
      });
      const hangarDoMes = contasDoMes.filter((c) => norm(c.categoria).includes("hangar"));
      const allocTaxa = taxasDoMes.reduce((s, c) => s + num(c.valor), 0) / vooCount;
      const allocHangar = hangarDoMes.reduce((s, c) => s + num(c.valor), 0) / vooCount;
      const despesasItems: { label: string; valor: number; pago: boolean }[] = [];

      if (combustivelValor > 0) {
        despesasItems.push({
          label: combustivelLitros > 0 ? `Combustível (${combustivelLitros.toFixed(0)} L)` : "Combustível",
          valor: combustivelValor,
          pago: !abast || norm(abast.status).startsWith("pago"),
        });
      }
      if (ter && num(ter.total_valor) > 0) {
        despesasItems.push({
          label: `Relatório ${ter.numero_relatorio || ""}`.trim(),
          valor: num(ter.total_valor),
          pago: norm(ter.status) === "finalizado" || !!ter.pago_em,
        });
      }
      if (allocTaxa > 0) {
        despesasItems.push({
          label: "Tarifas (DECEA/ANAC/Pouso)",
          valor: allocTaxa,
          pago: taxasDoMes.every((c) => norm(c.status).startsWith("paga") || !!c.data_pagamento),
        });
      }
      if (allocHangar > 0) {
        despesasItems.push({
          label: "Hangar",
          valor: allocHangar,
          pago: hangarDoMes.every((c) => norm(c.status).startsWith("paga") || !!c.data_pagamento),
        });
      }

      const totalCost = despesasItems.reduce((s, d) => s + d.valor, 0);
      let debito = 0;
      let credito = 0;
      rateiosPeriodo.forEach((r) => {
        if (!abast || (r as any).abastecimento_id !== abast.id) return;
        const value = rateioValor(r);
        if (isSaida(r.fluxo)) debito += value;
        else credito += num(r.valor_pago_real) || value;
      });

      if (debito === 0) debito = totalCost;

      const allPaid = despesasItems.every((d) => d.pago);
      const picName = v.pic_canac ? (membrosMap[v.pic_canac]?.nome_completo || "—") : "—";

      map.set(v.id, {
        picName,
        horas,
        pousos,
        distanciaNm,
        distanciaKm: distanciaNm * 1.852,
        combustivelLitros,
        consumoMedio: num(v.consumo_combustivel_voo) || (horas > 0 && combustivelLitros > 0 ? combustivelLitros / horas : 0),
        terNumero: ter?.numero_relatorio || null,
        terStatus: ter?.status || null,
        terPago: !!ter && (norm(ter.status) === "finalizado" || !!ter.pago_em),
        hasDecea: taxasDoMes.some((c) => norm(c.categoria).includes("decea") || norm(c.categoria).includes("navegacao")),
        hasAnac: taxasDoMes.some((c) => norm(c.categoria).includes("anac")),
        hasPouso: taxasDoMes.some((c) => norm(c.categoria).includes("pouso") || norm(c.categoria).includes("taxa") || norm(c.categoria).includes("aeroportuar")),
        hasHangar: hangarDoMes.length > 0,
        hasAbastecimento: !!abast || v.abastecido === true,
        allPaid,
        debito,
        credito,
        totalCost,
        despesasItems,
      });
    });

    return map;
  }, [voosPeriodo, membrosMap, abastByVoo, terByDate, contasApagar, rateiosPeriodo]);

  const diarioMesMap = useMemo(() => {
    const map = new Map<string, string | null>();
    diarioMeses.forEach((d) => {
      map.set(`${d.ano}-${String(d.mes).padStart(2, "0")}`, d.aerodromo_base || null);
    });
    return map;
  }, [diarioMeses]);

  return {
    loading,
    refresh,
    cotistas,
    sociosMap,
    clientesMap,
    catMap,
    membrosMap,
    custoFixo,
    custoVarHora,
    custoVarVoo,
    custoExtra,
    custoVariavel,
    custoTotal,
    entradasPeriodo,
    custoAtribuidoCotistas,
    custoNaoAtribuido,
    horasPeriodo,
    custoMedioHora,
    custoMedioHoraTotal,
    totalPousos,
    participantes,
    linhasPeriodo,
    entradasPorCotista,
    monthlyBreakdown,
    serieMensal,
    composicaoPeriodo,
    diarioPorSocio,
    evolucaoPorSocio,
    composicaoPorSocio,
    categoriasPorSocio,
    voosEnriquecidos,
    rateiosPeriodo,
    voosPeriodo,
    diarioMeses,
    diarioMesMap,
    resolveSocioName,
    resolveVooSocioName,
    catNameOf,
  };
}
