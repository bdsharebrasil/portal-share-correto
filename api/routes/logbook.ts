import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

const router: Router = Router();

// POST /logbook - Create new logbook entry with validation
router.post('/logbook', async (req: Request, res: Response) => {
  try {
    const {
      total_time,      // Tempo de bloco (acionamento ao corte)
      time,            // Tempo de voo (decolagem ao pouso)
      night_time,      // Tempo noturno
      entry_date,
      departure_aerodrome,
      arrival_aerodrome,
      ac_time,
      cor_time,
      dep_time,
      pou_time,
      pic_canac,
      sic_canac,
      client_id,
      aircraft_id,
      pousos,
      fuel_added,
      distance_nm,
      flight_nature,
      ifr_time,
      observations,
    } = req.body;

    // ============ VALIDAÇÃO DE TEMPOS ============
    
    // Tempo total (bloco) deve ser positivo
    if (total_time <= 0) {
      return res.status(400).json({ 
        error: 'Tempo total inválido',
        message: 'O tempo de bloco (acionamento ao corte) deve ser maior que 0'
      });
    }

    // Tempo de voo deve ser positivo
    if (time <= 0) {
      return res.status(400).json({ 
        error: 'Tempo de voo inválido',
        message: 'O tempo de voo (decolagem ao pouso) deve ser maior que 0'
      });
    }

    // Tempo de voo não pode ser maior que tempo de bloco
    if (time > total_time) {
      return res.status(400).json({ 
        error: 'Tempo de voo maior que o bloco',
        message: 'O tempo de voo não pode ser maior que o tempo de bloco'
      });
    }

    // Tempo noturno não pode ser maior que tempo de voo
    if (night_time > time) {
      return res.status(400).json({ 
        error: 'Tempo noturno maior que o tempo de voo',
        message: 'O tempo noturno não pode ser maior que o tempo de voo'
      });
    }

    // Tempo diurno não pode ser negativo
    if (time - night_time < 0) {
      return res.status(400).json({ 
        error: 'Tempo diurno negativo',
        message: 'O tempo diurno não pode ser negativo'
      });
    }

    // ============ VALIDAÇÃO DE CAMPOS OBRIGATÓRIOS ============

    if (!pic_canac) {
      return res.status(400).json({ 
        error: 'Comandante não informado',
        message: 'O campo PIC (Comandante) é obrigatório'
      });
    }

    if (!departure_aerodrome || !arrival_aerodrome) {
      return res.status(400).json({ 
        error: 'Aerodromo não informado',
        message: 'Os aerodromes de origem e destino são obrigatórios'
      });
    }

    if (!client_id) {
      return res.status(400).json({ 
        error: 'Cliente não informado',
        message: 'O cliente é obrigatório'
      });
    }

    if (!entry_date) {
      return res.status(400).json({ 
        error: 'Data não informada',
        message: 'A data da operação é obrigatória'
      });
    }

    // ============ INSERÇÃO NO BANCO DE DADOS ============

    const { data, error } = await supabase
      .from('logbook_entries')
      .insert([
        {
          entry_date,
          departure_aerodrome,
          arrival_aerodrome,
          ac_time,
          cor_time,
          dep_time,
          pou_time,
          pic_canac,
          sic_canac: sic_canac || null,
          client_id,
          aircraft_id: aircraft_id || null,
          total_time,
          time,
          night_time,
          pousos: pousos || 1,
          fuel_added: fuel_added || 0,
          distance_nm: distance_nm || 0,
          flight_nature: flight_nature || 'PV',
          ifr_time: ifr_time || 0,
          observations: observations || '',
          confirmed: false,
          created_at: new Date().toISOString(),
        }
      ])
      .select();

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ 
        error: 'Erro ao salvar no banco de dados',
        message: error.message 
      });
    }

    // ============ SUCESSO ============

    return res.status(201).json({
      success: true,
      message: 'Voo registrado com sucesso',
      data: data?.[0] || null
    });

  } catch (err) {
    console.error('Unexpected error:', err);
    return res.status(500).json({ 
      error: 'Erro inesperado do servidor',
      message: err instanceof Error ? err.message : 'Erro desconhecido'
    });
  }
});

// GET /logbook - List logbook entries
router.get('/logbook', async (req: Request, res: Response) => {
  try {
    const { aircraft_id, month, year } = req.query;

    let query = supabase.from('logbook_entries').select('*');

    if (aircraft_id) {
      query = query.eq('aircraft_id', aircraft_id);
    }

    if (month && year) {
      const startDate = new Date(Number(year), Number(month) - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];
      query = query.gte('entry_date', startDate).lte('entry_date', endDate);
    }

    const { data, error } = await query.order('entry_date', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Erro ao buscar registros' });
    }

    return res.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    });

  } catch (err) {
    console.error('Unexpected error:', err);
    return res.status(500).json({ error: 'Erro ao buscar registros' });
  }
});

// GET /logbook/:id - Get single logbook entry
router.get('/logbook/:id', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('logbook_entries')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Registro não encontrado' });
    }

    return res.json({
      success: true,
      data
    });

  } catch (err) {
    console.error('Unexpected error:', err);
    return res.status(500).json({ error: 'Erro ao buscar registro' });
  }
});

export default router;
