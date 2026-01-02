import { Router, Request, Response } from 'express';
import { supabase, queryWithJoin } from './lib/supabase';
import { cacheMiddleware } from './middleware/cacheMiddleware';
import {
  calculateDistanceNM,
  calculateNightTime,
  getSolarTimes,
  parseDMSCoordinate,
} from './lib/flight-calculations';
import logbookRouter from './routes/logbook';
import consolidationRouter from './routes/consolidation';

const router: Router = Router();

// ============= LOGBOOK ROUTES =============
router.use(logbookRouter);

// ============= CONSOLIDATION & RATEIO ROUTES =============
router.use(consolidationRouter);

// ============= USERS ROUTES =============

// GET all users (cached - 10 min)
router.get(
  '/users',
  cacheMiddleware({ ttl: 10 * 60 * 1000, key: 'users:all' }),
  async (req: Request, res: Response) => {
    try {
      const users = await queryWithJoin('users', '*');
      res.json({ data: users, timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }
);

// GET user by ID (cached - 10 min)
router.get(
  '/users/:id',
  cacheMiddleware({ 
    ttl: 10 * 60 * 1000, 
    key: (req) => `users:${req.params.id}` 
  }),
  async (req: Request, res: Response) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', req.params.id)
        .single();

      if (error) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ data, timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  }
);

// GET user profile with related data (cached - 10 min)
router.get(
  '/users/:id/profile',
  cacheMiddleware({ 
    ttl: 10 * 60 * 1000, 
    key: (req) => `users:${req.params.id}:profile` 
  }),
  async (req: Request, res: Response) => {
    try {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', req.params.id)
        .single();

      if (userError) {
        return res.status(404).json({ error: 'User not found' });
      }

      let relatedData = {};

      if (user.role === 'pilot' || user.role === 'crew') {
        const { data: licenses } = await supabase
          .from('crew_licenses')
          .select('*')
          .eq('crew_id', req.params.id);
        relatedData = { ...relatedData, licenses };
      }

      if (user.role === 'admin' || user.role === 'manager') {
        const { data: permissions } = await supabase
          .from('role_permissions')
          .select('*')
          .eq('role_id', user.role);
        relatedData = { ...relatedData, permissions };
      }

      res.json({ 
        data: { ...user, ...relatedData }, 
        timestamp: new Date().toISOString() 
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch user profile' });
    }
  }
);

// ============= FLIGHTS ROUTES =============

// GET flights with filters - NO CACHE (real-time)
router.get('/flights', async (req: Request, res: Response) => {
  try {
    const { status, date, aircraft_id } = req.query;

    let query = supabase
      .from('flight_schedules')
      .select(`
        *,
        aircraft:aircraft_id(registration, model),
        crew_members:crew_member_id(full_name, license),
        clients:client_id(company_name)
      `);

    if (status) {
      query = query.eq('status', status as string);
    }

    if (date) {
      query = query.eq('flight_date', date as string);
    }

    if (aircraft_id) {
      query = query.eq('aircraft_id', aircraft_id as string);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch flights' });
    }

    res.json({ 
      data, 
      timestamp: new Date().toISOString(),
      cached: false 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch flights' });
  }
});

// GET flight by ID with aggregated data - Short cache (2 min)
router.get(
  '/flights/:id',
  cacheMiddleware({ 
    ttl: 2 * 60 * 1000, 
    key: (req) => `flights:${req.params.id}` 
  }),
  async (req: Request, res: Response) => {
    try {
      const { data: flight, error } = await supabase
        .from('flight_schedules')
        .select(`
          *,
          aircraft:aircraft_id(registration, model, max_range),
          crew_members:crew_member_id(full_name, license, flight_hours),
          clients:client_id(company_name, contact_person),
          flight_plans(*)
        `)
        .eq('id', req.params.id)
        .single();

      if (error) {
        return res.status(404).json({ error: 'Flight not found' });
      }

      const { data: weather } = await supabase
        .from('flight_weather')
        .select('*')
        .eq('flight_id', req.params.id)
        .single();

      res.json({ 
        data: { ...flight, weather }, 
        timestamp: new Date().toISOString(),
        cached: res.get('X-Cache') === 'HIT'
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch flight details' });
    }
  }
);

// GET active flights - Real-time, NO CACHE
router.get('/flights/active/now', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('flight_schedules')
      .select(`
        *,
        aircraft:aircraft_id(registration, model),
        crew_members:crew_member_id(full_name)
      `)
      .eq('status', 'em_voo')
      .order('flight_date', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch active flights' });
    }

    res.json({ 
      data, 
      timestamp: new Date().toISOString(),
      cached: false,
      realtime: true
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch active flights' });
  }
});

// ============= CLIENTS ROUTES =============

// GET all clients (cached - 15 min)
router.get(
  '/clients',
  cacheMiddleware({ ttl: 15 * 60 * 1000, key: 'clients:all' }),
  async (req: Request, res: Response) => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('company_name', { ascending: true });

      if (error) {
        return res.status(500).json({ error: 'Failed to fetch clients' });
      }

      res.json({ 
        data, 
        timestamp: new Date().toISOString(),
        cached: res.get('X-Cache') === 'HIT'
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch clients' });
    }
  }
);

// GET client by ID with related flights (cached - 15 min)
router.get(
  '/clients/:id',
  cacheMiddleware({ 
    ttl: 15 * 60 * 1000, 
    key: (req) => `clients:${req.params.id}` 
  }),
  async (req: Request, res: Response) => {
    try {
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select(`
          *,
          flight_schedules(
            id,
            flight_date,
            origin,
            destination,
            status
          )
        `)
        .eq('id', req.params.id)
        .single();

      if (clientError) {
        return res.status(404).json({ error: 'Client not found' });
      }

      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount, category')
        .eq('client_id', req.params.id);

      const totalExpenses = expenses?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0;

      res.json({ 
        data: { 
          ...client, 
          totalExpenses,
          flightCount: client.flight_schedules?.length || 0 
        }, 
        timestamp: new Date().toISOString(),
        cached: res.get('X-Cache') === 'HIT'
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch client details' });
    }
  }
);

// GET client contracts (cached - 1 day)
router.get(
  '/clients/:id/contracts',
  cacheMiddleware({ 
    ttl: 24 * 60 * 60 * 1000, 
    key: (req) => `clients:${req.params.id}:contracts` 
  }),
  async (req: Request, res: Response) => {
    try {
      const { data, error } = await supabase
        .from('client_contracts')
        .select('*')
        .eq('client_id', req.params.id)
        .order('start_date', { ascending: false });

      if (error) {
        return res.status(500).json({ error: 'Failed to fetch contracts' });
      }

      res.json({ 
        data, 
        timestamp: new Date().toISOString(),
        cached: res.get('X-Cache') === 'HIT'
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch contracts' });
    }
  }
);

// ============= AIRCRAFT ROUTES =============

// GET all aircraft (cached - 20 min)
router.get(
  '/aircraft',
  cacheMiddleware({ ttl: 20 * 60 * 1000, key: 'aircraft:all' }),
  async (req: Request, res: Response) => {
    try {
      const { data, error } = await supabase
        .from('aircraft')
        .select('*')
        .order('registration', { ascending: true });

      if (error) {
        console.error('[Aircraft API] Supabase error:', error);
        return res.status(500).json({
          error: 'Failed to fetch aircraft',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }

      res.json({
        data,
        timestamp: new Date().toISOString(),
        cached: res.get('X-Cache') === 'HIT'
      });
    } catch (error) {
      console.error('[Aircraft API] Exception:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({
        error: 'Failed to fetch aircraft',
        details: process.env.NODE_ENV === 'development' ? errorMsg : undefined
      });
    }
  }
);

// GET aircraft by ID with maintenance and utilization (cached - 10 min)
router.get(
  '/aircraft/:id',
  cacheMiddleware({ 
    ttl: 10 * 60 * 1000, 
    key: (req) => `aircraft:${req.params.id}` 
  }),
  async (req: Request, res: Response) => {
    try {
      const { data: aircraft, error: aircraftError } = await supabase
        .from('aircraft')
        .select('*')
        .eq('id', req.params.id)
        .single();

      if (aircraftError) {
        return res.status(404).json({ error: 'Aircraft not found' });
      }

      const { data: maintenance } = await supabase
        .from('maintenance_logs')
        .select('*')
        .eq('aircraft_id', req.params.id)
        .order('date', { ascending: false })
        .limit(10);

      const { data: flights } = await supabase
        .from('flight_schedules')
        .select('estimated_duration')
        .eq('aircraft_id', req.params.id)
        .eq('status', 'completado');

      const totalFlightHours = flights?.reduce((sum, flight) => {
        const duration = flight.estimated_duration;
        if (typeof duration === 'string') {
          const [hours, minutes] = duration.split(':').map(Number);
          return sum + hours + minutes / 60;
        }
        return sum;
      }, 0) || 0;

      res.json({ 
        data: { 
          ...aircraft, 
          maintenance,
          totalFlightHours: Math.round(totalFlightHours * 100) / 100,
          flightCount: flights?.length || 0
        }, 
        timestamp: new Date().toISOString(),
        cached: res.get('X-Cache') === 'HIT'
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch aircraft details' });
    }
  }
);

// GET aircraft availability (cached - 5 min)
router.get(
  '/aircraft/:id/availability',
  cacheMiddleware({ 
    ttl: 5 * 60 * 1000, 
    key: (req) => `aircraft:${req.params.id}:availability` 
  }),
  async (req: Request, res: Response) => {
    try {
      const { data, error } = await supabase
        .from('flight_schedules')
        .select('flight_date, status')
        .eq('aircraft_id', req.params.id)
        .gte('flight_date', new Date().toISOString().split('T')[0]);

      if (error) {
        return res.status(500).json({ error: 'Failed to fetch availability' });
      }

      const availability = {
        available: true,
        nextFlight: null as any,
        upcomingFlights: (data || []).length
      };

      if (data && data.length > 0) {
        const activeFlights = data.filter(f => f.status === 'confirmado' || f.status === 'em_voo');
        availability.nextFlight = activeFlights[0]?.flight_date || null;
        availability.available = !data.some(f => f.status === 'em_voo');
      }

      res.json({ 
        data: availability, 
        timestamp: new Date().toISOString(),
        cached: res.get('X-Cache') === 'HIT'
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch availability' });
    }
  }
);

// ============= AERODROMES ROUTES =============

// GET all aerodromes (cached - 24 hours)
router.get(
  '/aerodromes',
  cacheMiddleware({ ttl: 24 * 60 * 60 * 1000, key: 'aerodromes:all' }),
  async (req: Request, res: Response) => {
    try {
      const { data, error } = await supabase
        .from('aerodromes')
        .select('id, designativo, name, coordenadas')
        .order('designativo', { ascending: true });

      if (error) {
        return res.status(500).json({ error: 'Failed to fetch aerodromes' });
      }

      res.json({
        data,
        timestamp: new Date().toISOString(),
        cached: res.get('X-Cache') === 'HIT'
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch aerodromes' });
    }
  }
);

// GET aerodromes with complete data (cached - 24 hours)
router.get(
  '/aerodromes/details',
  cacheMiddleware({ ttl: 24 * 60 * 60 * 1000, key: 'aerodromes:details' }),
  async (req: Request, res: Response) => {
    try {
      const { data, error } = await supabase
        .from('aerodromes')
        .select('*')
        .order('designativo', { ascending: true });

      if (error) {
        return res.status(500).json({ error: 'Failed to fetch aerodromes details' });
      }

      res.json({
        data,
        timestamp: new Date().toISOString(),
        cached: res.get('X-Cache') === 'HIT'
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch aerodromes details' });
    }
  }
);

// GET aerodrome by ICAO code (cached - 24 hours)
router.get(
  '/aerodromes/:icao',
  cacheMiddleware({
    ttl: 24 * 60 * 60 * 1000,
    key: (req) => `aerodrome:${req.params.icao}`
  }),
  async (req: Request, res: Response) => {
    try {
      const { icao } = req.params;
      const { data, error } = await supabase
        .from('aerodromes')
        .select('*')
        .eq('designativo', icao.toUpperCase())
        .single();

      if (error) {
        return res.status(404).json({ error: 'Aerodrome not found' });
      }

      res.json({
        data,
        timestamp: new Date().toISOString(),
        cached: res.get('X-Cache') === 'HIT'
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch aerodrome' });
    }
  }
);

// ============= CATEGORIES ROUTES =============

// GET all financial categories (cached - 12 hours)
router.get(
  '/categories',
  cacheMiddleware({ ttl: 12 * 60 * 60 * 1000, key: 'categories:all' }),
  async (req: Request, res: Response) => {
    try {
      const { data, error } = await supabase
        .from('categorias_movimentacao')
        .select('id, nome, tipo, grupo_categoria, descricao, ativo, reembolsavel, icone, cor')
        .eq('ativo', true)
        .order('nome', { ascending: true });

      if (error) {
        return res.status(500).json({ error: 'Failed to fetch categories' });
      }

      res.json({
        data,
        timestamp: new Date().toISOString(),
        cached: res.get('X-Cache') === 'HIT'
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  }
);

// GET unique categories grouped by type (cached - 12 hours)
router.get(
  '/categories/unique-by-type',
  cacheMiddleware({ ttl: 12 * 60 * 60 * 1000, key: 'categories:unique' }),
  async (req: Request, res: Response) => {
    try {
      const { data, error } = await supabase
        .from('categorias_movimentacao')
        .select('id, nome, tipo')
        .eq('ativo', true)
        .order('nome', { ascending: true });

      if (error) {
        return res.status(500).json({ error: 'Failed to fetch categories' });
      }

      const grouped = (data || []).reduce((acc: any, cat: any) => {
        if (!acc[cat.tipo]) {
          acc[cat.tipo] = [];
        }
        acc[cat.tipo].push(cat);
        return acc;
      }, {});

      res.json({
        data: grouped,
        timestamp: new Date().toISOString(),
        cached: res.get('X-Cache') === 'HIT'
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  }
);

// ============= MAINTENANCE ROUTES =============

// POST new maintenance record
router.post('/maintenance', async (req: Request, res: Response) => {
  try {
    const { tipo, data_programada, mecanico, etapa, aeronave_id, oficina, observacoes, custo_estimado } = req.body;

    if (!tipo || !data_programada) {
      return res.status(400).json({
        error: 'Missing required fields: tipo, data_programada'
      });
    }

    const { data, error } = await supabase
      .from('manutencoes')
      .insert([
        {
          aeronave_id: aeronave_id || null,
          tipo,
          data_programada,
          mecanico: mecanico || 'Sistema',
          etapa: etapa || 'aguardando',
          oficina: oficina || null,
          observacoes: observacoes || null,
          custo_estimado: custo_estimado || null
        }
      ])
      .select();

    if (error) {
      console.error('[Maintenance API] Supabase error:', error);
      return res.status(500).json({
        error: 'Failed to create maintenance record',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    res.status(201).json({
      data: data?.[0] || null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Maintenance API] Exception:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: 'Failed to create maintenance record',
      details: process.env.NODE_ENV === 'development' ? errorMsg : undefined
    });
  }
});

// PUT update maintenance record
router.put('/maintenance/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tipo, data_programada, mecanico, etapa, aeronave_id, oficina, observacoes, custo_estimado } = req.body;

    if (!tipo || !data_programada) {
      return res.status(400).json({
        error: 'Missing required fields: tipo, data_programada'
      });
    }

    const { data, error } = await supabase
      .from('manutencoes')
      .update({
        aeronave_id: aeronave_id || null,
        tipo,
        data_programada,
        mecanico,
        etapa,
        oficina: oficina || null,
        observacoes: observacoes || null,
        custo_estimado: custo_estimado || null
      })
      .eq('id', id)
      .select();

    if (error) {
      console.error('[Maintenance API] Supabase error:', error);
      return res.status(500).json({
        error: 'Failed to update maintenance record',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    res.json({
      data: data?.[0] || null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Maintenance API] Exception:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: 'Failed to update maintenance record',
      details: process.env.NODE_ENV === 'development' ? errorMsg : undefined
    });
  }
});

// ============= FLIGHT DOCUMENTS ROUTES =============

// POST new flight document
router.post('/flight-documents', async (req: Request, res: Response) => {
  try {
    const { aircraft_id, name, document_type, expiry_date, file_path } = req.body;

    if (!aircraft_id || !name || !expiry_date) {
      return res.status(400).json({
        error: 'Missing required fields: aircraft_id, name, expiry_date'
      });
    }

    const { data, error } = await supabase
      .from('flight_documents')
      .insert([
        {
          aircraft_id,
          name,
          document_type: document_type || null,
          expiry_date,
          file_path: file_path || 'placeholder'
        }
      ])
      .select();

    if (error) {
      console.error('[Flight Documents API] Supabase error:', error);
      return res.status(500).json({
        error: 'Failed to create flight document',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    res.status(201).json({
      data: data?.[0] || null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Flight Documents API] Exception:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: 'Failed to create flight document',
      details: process.env.NODE_ENV === 'development' ? errorMsg : undefined
    });
  }
});

// ============= FLIGHT CALCULATIONS ROUTES =============

/**
 * POST /api/flight-calculations
 * Processa os cálculos finais do trecho de voo
 * Suporta busca por ICAO ou coordenadas manuais
 *
 * Body esperado:
 * {
 *   departureIcao: string (ex: "SBGR")
 *   arrivalIcao?: string (ex: "SBBR")
 *   arrivalManual?: { lat: number, lng: number, nome: string }
 *   flightDate: string (YYYY-MM-DD)
 *   landingTime: string (HH:MM)
 * }
 */
router.post('/flight-calculations', async (req: Request, res: Response) => {
  try {
    const {
      departureIcao,
      arrivalIcao,
      arrivalManual,
      flightDate,
      landingTime,
    } = req.body;

    // Validações básicas
    if (!departureIcao || !flightDate || !landingTime) {
      return res.status(400).json({
        error: 'Missing required fields: departureIcao, flightDate, landingTime',
      });
    }

    if (!arrivalIcao && !arrivalManual) {
      return res.status(400).json({
        error: 'Must provide either arrivalIcao or arrivalManual coordinates',
      });
    }

    // Validar formato da data (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(flightDate)) {
      return res.status(400).json({
        error: 'Invalid date format. Use YYYY-MM-DD',
      });
    }

    // Validar formato do horário (HH:MM)
    if (!/^\d{2}:\d{2}$/.test(landingTime)) {
      return res.status(400).json({
        error: 'Invalid time format. Use HH:MM',
      });
    }

    // Buscar aeródromo de partida
    const { data: departureData, error: departureError } = await supabase
      .from('aerodromes')
      .select('*')
      .eq('designativo', departureIcao.toUpperCase())
      .single();

    if (departureError) {
      return res.status(404).json({
        error: `Departure aerodrome not found: ${departureIcao}`,
      });
    }

    // Parse coordenadas de partida
    const departureParsed = parseDMSCoordinate(departureData.coordenadas);
    if (!departureParsed) {
      return res.status(400).json({
        error: 'Invalid departure aerodrome coordinates',
      });
    }

    let arrivalLat: number;
    let arrivalLng: number;
    let arrivalName: string;

    // Se for manual, usa as coordenadas diretas
    if (arrivalManual) {
      if (!arrivalManual.lat || !arrivalManual.lng) {
        return res.status(400).json({
          error: 'Manual arrival must include lat and lng',
        });
      }
      arrivalLat = arrivalManual.lat;
      arrivalLng = arrivalManual.lng;
      arrivalName = arrivalManual.nome || 'Manual Location';
    } else {
      // Se for ICAO, busca no banco
      const { data: arrivalData, error: arrivalError } = await supabase
        .from('aerodromes')
        .select('*')
        .eq('designativo', arrivalIcao!.toUpperCase())
        .single();

      if (arrivalError) {
        return res.status(404).json({
          error: `Arrival aerodrome not found: ${arrivalIcao}`,
        });
      }

      const arrivalParsed = parseDMSCoordinate(arrivalData.coordenadas);
      if (!arrivalParsed) {
        return res.status(400).json({
          error: 'Invalid arrival aerodrome coordinates',
        });
      }

      arrivalLat = arrivalParsed.lat;
      arrivalLng = arrivalParsed.lng;
      arrivalName = arrivalData.name || arrivalData.designativo;
    }

    // Calcular distância
    const distance = calculateDistanceNM(
      departureParsed.lat,
      departureParsed.lng,
      arrivalLat,
      arrivalLng
    );

    // Calcular tempo noturno
    const nightTime = calculateNightTime(flightDate, landingTime, arrivalLat, arrivalLng);

    // Obter tempos solares
    const solarTimes = getSolarTimes(flightDate, arrivalLat, arrivalLng);

    // Verificar se o pouso é noturno (após dusk)
    const [landingHours, landingMinutes] = landingTime.split(':').map(Number);
    const landingTotalMinutes = landingHours * 60 + landingMinutes;
    const isNightFlightAtLanding = landingTotalMinutes > solarTimes.duskMinutes;

    res.json({
      data: {
        distance: {
          nm: distance,
          km: Math.round(distance * 1.852 * 100) / 100,
        },
        nightTime: {
          hours: Math.floor(nightTime),
          minutes: Math.round((nightTime % 1) * 60),
          decimal: nightTime,
        },
        solarTimes: {
          sunrise: {
            time: `${String(Math.floor(solarTimes.sunriseMinutes / 60)).padStart(2, '0')}:${String(solarTimes.sunriseMinutes % 60).padStart(2, '0')}`,
            minutes: solarTimes.sunriseMinutes,
          },
          sunset: {
            time: `${String(Math.floor(solarTimes.sunsetMinutes / 60)).padStart(2, '0')}:${String(solarTimes.sunsetMinutes % 60).padStart(2, '0')}`,
            minutes: solarTimes.sunsetMinutes,
          },
          dawn: {
            time: `${String(Math.floor(solarTimes.dawnMinutes / 60)).padStart(2, '0')}:${String(solarTimes.dawnMinutes % 60).padStart(2, '0')}`,
            minutes: solarTimes.dawnMinutes,
          },
          dusk: {
            time: `${String(Math.floor(solarTimes.duskMinutes / 60)).padStart(2, '0')}:${String(solarTimes.duskMinutes % 60).padStart(2, '0')}`,
            minutes: solarTimes.duskMinutes,
          },
        },
        flight: {
          departure: {
            icao: departureIcao.toUpperCase(),
            name: departureData.name,
          },
          arrival: {
            icao: arrivalIcao ? arrivalIcao.toUpperCase() : 'MANUAL',
            name: arrivalName,
          },
          date: flightDate,
          landingTime: landingTime,
          isNightFlightAtLanding: isNightFlightAtLanding,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Flight Calculations API] Exception:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: 'Failed to calculate flight metrics',
      details: process.env.NODE_ENV === 'development' ? errorMsg : undefined,
    });
  }
});

// ============= WEATHER/METAR ROUTES =============

// GET METAR data for a given airport (cached - 10 min)
router.get(
  '/weather/metar',
  cacheMiddleware({
    ttl: 10 * 60 * 1000,
    key: (req) => `metar:${(req.query.icao as string)?.toUpperCase() || 'unknown'}`
  }),
  async (req: Request, res: Response) => {
    try {
      const { icao } = req.query;

      if (!icao || typeof icao !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid icao parameter' });
      }

      const response = await fetch(
        `https://aviationweather.gov/api/data/metar?ids=${icao.toUpperCase()}&format=json`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'ShareBrasil-Aviation-App/1.0',
          },
          signal: AbortSignal.timeout(10000), // 10 second timeout
        }
      );

      if (!response.ok) {
        console.error(`METAR API error: HTTP ${response.status} for ${icao}`);
        return res.status(response.status).json({
          error: `METAR API returned ${response.status}`,
          icao: icao.toUpperCase()
        });
      }

      const data = await response.json();

      if (!Array.isArray(data) || data.length === 0) {
        return res.status(404).json({
          error: 'METAR not found',
          icao: icao.toUpperCase()
        });
      }

      res.json({
        data: data[0],
        icao: icao.toUpperCase(),
        timestamp: new Date().toISOString(),
        cached: res.get('X-Cache') === 'HIT'
      });
    } catch (error) {
      console.error('[METAR API] Exception:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({
        error: 'Failed to fetch METAR data',
        details: process.env.NODE_ENV === 'development' ? errorMsg : undefined,
      });
    }
  }
);

export default router;
