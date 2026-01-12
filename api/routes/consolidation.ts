import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

const router: Router = Router();

// ============================================================================
// POST /consolidacao/consolidar-rateio
// Consolida um rateio para histórico quando foi pago/conciliado
// ============================================================================
router.post('/consolidacao/consolidar-rateio', async (req: Request, res: Response) => {
  try {
    const {
      lancamento_rateio_id,
      bank_transaction_id,
      bank_reconciliation_id,
      horas_voadas
    } = req.body;

    if (!lancamento_rateio_id || !bank_reconciliation_id) {
      return res.status(400).json({
        error: 'Missing required fields: lancamento_rateio_id, bank_reconciliation_id'
      });
    }

    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Chamar função SQL de consolidação
    const { data, error } = await supabase.rpc('consolidar_rateio_historico', {
      p_lancamento_rateio_id: lancamento_rateio_id,
      p_bank_transaction_id: bank_transaction_id,
      p_bank_reconciliation_id: bank_reconciliation_id,
      p_horas_voadas: horas_voadas || 0,
      p_consolidado_por: user.user.id
    });

    if (error) {
      console.error('[Consolidation API] RPC error:', error);
      return res.status(500).json({
        error: 'Failed to consolidate rateio',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    res.status(201).json({
      data: { historico_id: data },
      message: 'Rateio consolidado com sucesso',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Consolidation API] Exception:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: 'Failed to consolidate rateio',
      details: process.env.NODE_ENV === 'development' ? errorMsg : undefined
    });
  }
});

// ============================================================================
// POST /consolidacao/consolidar-horas-mensais
// Consolida horas mensais de um cliente em uma aeronave
// ============================================================================
router.post('/consolidacao/consolidar-horas-mensais', async (req: Request, res: Response) => {
  try {
    const {
      cliente_id,
      aeronave_id,
      ano,
      mes,
      horas_voadas
    } = req.body;

    if (!cliente_id || !aeronave_id || !ano || !mes || horas_voadas === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: cliente_id, aeronave_id, ano, mes, horas_voadas'
      });
    }

    if (ano < 2000 || ano > 2100) {
      return res.status(400).json({ error: 'Invalid year' });
    }

    if (mes < 1 || mes > 12) {
      return res.status(400).json({ error: 'Invalid month (must be 1-12)' });
    }

    // Chamar função SQL de consolidação de horas
    const { data, error } = await supabase.rpc('consolidar_horas_mensais', {
      p_cliente_id: cliente_id,
      p_aeronave_id: aeronave_id,
      p_ano: ano,
      p_mes: mes,
      p_horas_voadas: horas_voadas
    });

    if (error) {
      console.error('[Consolidation Hours API] RPC error:', error);
      return res.status(500).json({
        error: 'Failed to consolidate hours',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    res.status(201).json({
      data: { id: data },
      message: 'Horas consolidadas com sucesso',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Consolidation Hours API] Exception:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: 'Failed to consolidate hours',
      details: process.env.NODE_ENV === 'development' ? errorMsg : undefined
    });
  }
});

// ============================================================================
// GET /consolidacao/extrato-cliente/:cliente_id
// Obtém extrato completo consolidado de um cliente
// ============================================================================
router.get('/consolidacao/extrato-cliente/:cliente_id', async (req: Request, res: Response) => {
  try {
    const { cliente_id } = req.params;
    const { data_inicio, data_fim } = req.query;

    if (!cliente_id) {
      return res.status(400).json({ error: 'Missing cliente_id' });
    }

    // First try the consolidated history table
    let query = supabase
      .from('historico_rateio_consolidado')
      .select('*')
      .eq('cliente_id', cliente_id)
      .order('data_competencia', { ascending: false });

    if (data_inicio) {
      query = query.gte('data_competencia', data_inicio as string);
    }

    if (data_fim) {
      query = query.lte('data_competencia', data_fim as string);
    }

    const { data: consolidatedData, error: consolidatedError } = await query;

    // If we have consolidated data, return it
    if (!consolidatedError && consolidatedData && consolidatedData.length > 0) {
      return res.json({
        data: consolidatedData,
        count: consolidatedData.length,
        timestamp: new Date().toISOString()
      });
    }

    // Fallback: Query bank_reconciliations directly
    let fallbackQuery = supabase
      .from('bank_reconciliations')
      .select(`
        id,
        date,
        description,
        amount,
        status,
        category,
        type,
        percentual,
        aircraft:aircraft_id(id, registration),
        categorias_movimentacao:categoria_movimentacao_id(id, nome, grupo_categoria)
      `)
      .eq('client_id', cliente_id)
      .order('date', { ascending: false });

    if (data_inicio) {
      fallbackQuery = fallbackQuery.gte('date', data_inicio as string);
    }

    if (data_fim) {
      fallbackQuery = fallbackQuery.lte('date', data_fim as string);
    }

    const { data: fallbackData, error: fallbackError } = await fallbackQuery;

    if (fallbackError) {
      console.error('[Extrato API] Fallback error:', fallbackError.message);
      return res.json({
        data: [],
        count: 0,
        timestamp: new Date().toISOString()
      });
    }

    // Transform fallback data to match expected format
    const transformedData = (fallbackData || []).map((item: any) => ({
      id: item.id,
      data_competencia: item.date,
      descricao: item.description,
      valor_total_lancamento: item.amount,
      valor_rateado: item.amount * (parseFloat(item.percentual || '100') / 100),
      valor_pago: item.status === 'conciliado' || item.status === 'pago' ? item.amount : 0,
      saldo_devedor: item.status === 'pendente' ? item.amount : 0,
      status_pagamento: item.status === 'conciliado' || item.status === 'pago' ? 'Pago' : 'Pendente',
      aeronave_registro: item.aircraft?.registration || '-',
      categoria_nome: item.categorias_movimentacao?.nome || item.category || '-',
      categoria_grupo: item.categorias_movimentacao?.grupo_categoria || item.category || '-',
      tipo_rateio: 'percentual',
      percentual_uso: parseFloat(item.percentual || '100'),
      horas_voadas: 0
    }));

    res.json({
      data: transformedData,
      count: transformedData.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Extrato API] Exception:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: 'Failed to fetch extrato',
      details: process.env.NODE_ENV === 'development' ? errorMsg : undefined
    });
  }
});

// ============================================================================
// GET /consolidacao/resumo-mensal-cliente/:cliente_id
// Obtém resumo mensal de custos (para gráfico)
// ============================================================================
router.get('/consolidacao/resumo-mensal-cliente/:cliente_id', async (req: Request, res: Response) => {
  try {
    const { cliente_id } = req.params;
    const { ano, mes } = req.query;

    if (!cliente_id || !ano || !mes) {
      return res.status(400).json({
        error: 'Missing required params: cliente_id, ano, mes'
      });
    }

    const { data, error } = await supabase
      .from('v_resumo_mensal_cliente')
      .select('*')
      .eq('cliente_id', cliente_id)
      .eq('ano', parseInt(ano as string))
      .eq('mes', parseInt(mes as string));

    if (error) {
      console.warn('[Resumo Mensal API] Warning:', error.message);
      // Return empty data if view doesn't exist
      return res.json({
        data: [],
        summary: {
          total_gasto: 0,
          total_horas: 0,
          num_categorias: 0
        },
        timestamp: new Date().toISOString()
      });
    }

    // Calcular totais
    const totalGasto = data?.reduce((sum, item) => sum + (parseFloat(item.total_categoria) || 0), 0) || 0;
    const totalHoras = data?.reduce((sum, item) => sum + (parseFloat(item.total_horas_cliente) || 0), 0) || 0;

    res.json({
      data,
      summary: {
        total_gasto: totalGasto,
        total_horas: totalHoras,
        num_categorias: data?.length || 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Resumo Mensal API] Exception:', error);
    // Return empty data even on exception
    res.json({
      data: [],
      summary: {
        total_gasto: 0,
        total_horas: 0,
        num_categorias: 0
      },
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// GET /consolidacao/comparativo-uso/:aeronave_id
// Compara horas entre clientes de uma aeronave
// ============================================================================
router.get('/consolidacao/comparativo-uso/:aeronave_id', async (req: Request, res: Response) => {
  try {
    const { aeronave_id } = req.params;
    const { ano, mes } = req.query;

    if (!aeronave_id || !ano || !mes) {
      return res.status(400).json({
        error: 'Missing required params: aeronave_id, ano, mes'
      });
    }

    const anoNum = parseInt(ano as string);
    const mesNum = parseInt(mes as string);
    
    // Build date range for the month
    const startDate = `${anoNum}-${String(mesNum).padStart(2, '0')}-01`;
    const endDate = mesNum === 12 
      ? `${anoNum + 1}-01-01` 
      : `${anoNum}-${String(mesNum + 1).padStart(2, '0')}-01`;

    // Query logbook_entries directly with aggregation
    const { data: entries, error: entriesError } = await supabase
      .from('logbook_entries')
      .select(`
        client_id,
        total_time,
        clients:client_id(id, company_name, proprietario)
      `)
      .eq('aircraft_id', aeronave_id)
      .gte('entry_date', startDate)
      .lt('entry_date', endDate)
      .not('client_id', 'is', null);

    if (entriesError) {
      console.error('[Comparativo Uso API] Query error:', entriesError.message);
      return res.json({
        data: [],
        summary: { total_clientes: 0, total_horas: 0 },
        timestamp: new Date().toISOString()
      });
    }

    // Group by client and calculate totals
    const clientMap = new Map<string, { 
      cliente_id: string; 
      cliente_nome: string; 
      horas_voadas: number 
    }>();
    
    let totalHoras = 0;
    
    (entries || []).forEach((entry: any) => {
      const clientId = entry.client_id;
      const horas = parseFloat(entry.total_time) || 0;
      totalHoras += horas;
      
      if (clientMap.has(clientId)) {
        clientMap.get(clientId)!.horas_voadas += horas;
      } else {
        const clienteNome = entry.clients?.company_name || entry.clients?.proprietario || 'Cliente não identificado';
        clientMap.set(clientId, {
          cliente_id: clientId,
          cliente_nome: clienteNome,
          horas_voadas: horas
        });
      }
    });

    // Convert to array with percentages and ranking
    const data = Array.from(clientMap.values())
      .map(item => ({
        ...item,
        aeronave_id,
        ano: anoNum,
        mes: mesNum,
        horas_totais_aeronave: totalHoras,
        percentual_uso: totalHoras > 0 ? (item.horas_voadas / totalHoras) * 100 : 0,
        validado: true,
        fonte_diario_bordo: true,
        fonte_portal_cliente: false
      }))
      .sort((a, b) => b.horas_voadas - a.horas_voadas)
      .map((item, index) => ({
        ...item,
        ranking: index + 1,
        total_clientes: clientMap.size
      }));

    res.json({
      data,
      summary: {
        total_clientes: clientMap.size,
        total_horas: totalHoras
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Comparativo Uso API] Exception:', error);
    res.json({
      data: [],
      summary: {
        total_clientes: 0,
        total_horas: 0
      },
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// GET /consolidacao/pendencias-cliente/:cliente_id
// Obtém pendências de pagamento do cliente
// ============================================================================
router.get('/consolidacao/pendencias-cliente/:cliente_id', async (req: Request, res: Response) => {
  try {
    const { cliente_id } = req.params;

    const defaultPendencias = {
      cliente_id,
      total_lancamentos_pendentes: 0,
      total_pendente: 0,
      dias_pendente: 0
    };

    const { data, error } = await supabase
      .from('v_pendencias_cliente')
      .select('*')
      .eq('cliente_id', cliente_id)
      .single();

    if (error) {
      console.warn('[Pendencias API] Warning:', error.message);
      // Return default values if view doesn't exist or no rows
      return res.json({
        data: defaultPendencias,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      data: data || defaultPendencias,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Pendencias API] Exception:', error);
    // Return default values even on exception
    res.json({
      data: {
        cliente_id: req.params.cliente_id,
        total_lancamentos_pendentes: 0,
        total_pendente: 0,
        dias_pendente: 0
      },
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// GET /consolidacao/analise-anual/:cliente_id
// Análise anual de custos por categoria
// ============================================================================
router.get('/consolidacao/analise-anual/:cliente_id', async (req: Request, res: Response) => {
  try {
    const { cliente_id } = req.params;
    const { ano } = req.query;

    let query = supabase
      .from('v_analise_anual_cliente')
      .select('*')
      .eq('cliente_id', cliente_id);

    if (ano) {
      query = query.eq('ano', parseInt(ano as string));
    }

    const { data, error } = await query.order('ano', { ascending: false });

    if (error) {
      console.warn('[Analise Anual API] Warning:', error.message);
      // Return empty data if view doesn't exist
      return res.json({
        data: [],
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Analise Anual API] Exception:', error);
    // Return empty data even on exception
    res.json({
      data: [],
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// GET /consolidacao/status-conciliacao
// Status geral das conciliações
// ============================================================================
router.get('/consolidacao/status-conciliacao', async (req: Request, res: Response) => {
  try {
    const defaultStatus = {
      pendentes: 0,
      conciliadas: 0,
      consolidadas: 0,
      total: 0,
      valor_pendente: 0,
      valor_conciliado: 0,
      valor_consolidado: 0
    };

    const { data, error } = await supabase
      .from('v_conciliacao_status')
      .select('*')
      .single();

    // Return default values if view doesn't exist or no rows found
    if (error) {
      console.warn('[Status Conciliacao API] Warning:', error.message);
      return res.json({
        data: defaultStatus,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      data: data || defaultStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Status Conciliacao API] Exception:', error);
    // Return default values even on exception
    res.json({
      data: {
        pendentes: 0,
        conciliadas: 0,
        consolidadas: 0,
        total: 0,
        valor_pendente: 0,
        valor_conciliado: 0,
        valor_consolidado: 0
      },
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// GET /consolidacao/reembolsos-pendentes
// Reembolsos que foram pagos mas não recebidos
// ============================================================================
router.get('/consolidacao/reembolsos-pendentes', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('v_reembolsos_pendentes')
      .select('*')
      .order('data_pagamento', { ascending: true });

    if (error) {
      console.warn('[Reembolsos API] Warning:', error.message);
      // Return empty data if view doesn't exist
      return res.json({
        data: [],
        summary: {
          total_reembolsos: 0,
          count: 0
        },
        timestamp: new Date().toISOString()
      });
    }

    const totalReembolsos = data?.reduce((sum, item) => sum + (parseFloat(item.valor_rateado) || 0), 0) || 0;

    res.json({
      data,
      summary: {
        total_reembolsos: totalReembolsos,
        count: data?.length || 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Reembolsos API] Exception:', error);
    // Return empty data even on exception
    res.json({
      data: [],
      summary: {
        total_reembolsos: 0,
        count: 0
      },
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
