import L from 'leaflet';

const SUPABASE_URL = 'https://jilmlmdgeyzubylncpjy.supabase.co';
export const OPENWEATHER_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/openweather-map`;

export type OpenWeatherLayer = 'clouds_new' | 'precipitation_new' | 'pressure_new' | 'wind_new' | 'temp_new';

export function openWeatherTileUrl(layer: OpenWeatherLayer, cacheKey?: string) {
  const suffix = cacheKey ? `&v=${encodeURIComponent(cacheKey)}` : '';
  return `${OPENWEATHER_FUNCTION_URL}?mode=tile&layer=${layer}&z={z}&x={x}&y={y}${suffix}`;
}

export interface OpenWeatherPoint {
  name?: string;
  main?: { temp?: number; feels_like?: number; pressure?: number; humidity?: number; visibility?: number };
  wind?: { speed?: number; deg?: number; gust?: number };
  weather?: Array<{ description?: string; icon?: string }>;
  clouds?: { all?: number };
  rain?: { '1h'?: number };
  snow?: { '1h'?: number };
  dt?: number;
}

export async function fetchOpenWeatherPointDirect(lat: number, lon: number): Promise<OpenWeatherPoint> {
  const cacheBust = Date.now();
  const response = await fetch(
    `${OPENWEATHER_FUNCTION_URL}?mode=point&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&_=${cacheBust}`,
    { cache: 'no-store' },
  );
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error || 'Não foi possível consultar a meteorologia.');
  return body;
}

type WindVector = { lat: number; lon: number; u: number; v: number; speed: number };

const GRID_COLS = 4;
const GRID_ROWS = 4;
const PARTICLE_COUNT = 650;
const REFRESH_MS = 2 * 60 * 1000;
const FETCH_MOVE_DEBOUNCE_MS = 650;

class AnimatedOpenWeatherWindLayer extends L.Layer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private mapInstance: L.Map | null = null;
  private animationFrame = 0;
  private refreshTimer = 0;
  private moveTimer = 0;
  private refreshId = 0;
  private particles: Array<{ x: number; y: number; age: number; maxAge: number }> = [];
  private field: WindVector[] = [];
  private fieldBounds: { south: number; west: number; north: number; east: number } | null = null;

  onAdd(map: L.Map) {
    this.mapInstance = map;
    this.ensurePane();
    const canvas = L.DomUtil.create('canvas', 'openweather-wind-animated') as HTMLCanvasElement;
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '455';
    map.getPane('weatherAnimated')?.appendChild(canvas);
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    this.resetParticles();
    map.on('moveend zoomend resize', this.handleMapChange, this);
    void this.refreshField();
    this.refreshTimer = window.setInterval(() => void this.refreshField(), REFRESH_MS);
    this.animationFrame = requestAnimationFrame(this.animate);
  }

  onRemove(map: L.Map) {
    map.off('moveend zoomend resize', this.handleMapChange, this);
    window.clearTimeout(this.moveTimer);
    window.clearInterval(this.refreshTimer);
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
    this.canvas?.remove();
    this.canvas = null;
    this.ctx = null;
    this.mapInstance = null;
    this.field = [];
    this.fieldBounds = null;
  }

  private ensurePane() {
    if (!this.mapInstance || this.mapInstance.getPane('weatherAnimated')) return;
    this.mapInstance.createPane('weatherAnimated');
    const pane = this.mapInstance.getPane('weatherAnimated');
    if (pane) pane.style.zIndex = '455';
  }

  private handleMapChange = () => {
    this.resize();
    window.clearTimeout(this.moveTimer);
    this.moveTimer = window.setTimeout(() => void this.refreshField(), FETCH_MOVE_DEBOUNCE_MS);
  };

  private resize() {
    if (!this.canvas || !this.ctx || !this.mapInstance) return;
    const size = this.mapInstance.getSize();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(size.x * dpr));
    this.canvas.height = Math.max(1, Math.round(size.y * dpr));
    this.canvas.style.width = `${size.x}px`;
    this.canvas.style.height = `${size.y}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.resetParticles();
  }

  private resetParticles() {
    if (!this.mapInstance) return;
    const size = this.mapInstance.getSize();
    this.particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * Math.max(1, size.x),
      y: Math.random() * Math.max(1, size.y),
      age: Math.random() * 100,
      maxAge: 55 + Math.random() * 110,
    }));
  }

  private async refreshField() {
    const map = this.mapInstance;
    if (!map) return;
    const requestId = ++this.refreshId;
    const bounds = map.getBounds();
    const south = Math.max(-85, bounds.getSouth());
    const north = Math.min(85, bounds.getNorth());
    const west = Math.max(-180, bounds.getWest());
    const east = Math.min(180, bounds.getEast());
    const points: Array<{ lat: number; lon: number }> = [];

    for (let row = 0; row < GRID_ROWS; row += 1) {
      const latRatio = row / Math.max(1, GRID_ROWS - 1);
      const lat = south + (north - south) * latRatio;
      for (let col = 0; col < GRID_COLS; col += 1) {
        const lonRatio = col / Math.max(1, GRID_COLS - 1);
        points.push({ lat, lon: west + (east - west) * lonRatio });
      }
    }

    try {
      const results = await Promise.all(points.map(async ({ lat, lon }) => {
        const point = await fetchOpenWeatherPointDirect(lat, lon);
        const speed = Math.max(0, Number(point.wind?.speed ?? 0));
        const fromDegrees = Number(point.wind?.deg ?? 0);
        const toRadians = (((fromDegrees + 180) % 360) * Math.PI) / 180;
        return {
          lat,
          lon,
          speed,
          u: Math.sin(toRadians) * speed,
          v: Math.cos(toRadians) * speed,
        } satisfies WindVector;
      }));

      if (requestId !== this.refreshId || !this.mapInstance) return;
      this.field = results;
      this.fieldBounds = { south, west, north, east };
    } catch (error) {
      console.warn('[OpenWeather] Falha ao atualizar campo de vento animado.', error);
    }
  }

  private sampleWind(lat: number, lon: number) {
    if (!this.field.length) return { u: 0, v: 0, speed: 0 };
    let totalWeight = 0;
    let u = 0;
    let v = 0;
    let speed = 0;
    for (const item of this.field) {
      const dx = (lon - item.lon) * Math.cos(((lat + item.lat) * 0.5 * Math.PI) / 180);
      const dy = lat - item.lat;
      const distance2 = dx * dx + dy * dy;
      const weight = 1 / Math.max(distance2, 0.000001);
      totalWeight += weight;
      u += item.u * weight;
      v += item.v * weight;
      speed += item.speed * weight;
    }
    return { u: u / totalWeight, v: v / totalWeight, speed: speed / totalWeight };
  }

  private respawnParticle(particle: { x: number; y: number; age: number; maxAge: number }, size: L.Point) {
    particle.x = Math.random() * Math.max(1, size.x);
    particle.y = Math.random() * Math.max(1, size.y);
    particle.age = 0;
    particle.maxAge = 55 + Math.random() * 110;
  }

  private animate = () => {
    const map = this.mapInstance;
    const ctx = this.ctx;
    if (!map || !ctx) return;
    const size = map.getSize();

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.fillRect(0, 0, size.x, size.y);
    ctx.restore();

    if (this.field.length) {
      ctx.lineCap = 'round';
      ctx.lineWidth = 1.2;
      for (const particle of this.particles) {
        if (particle.age > particle.maxAge || particle.x < -20 || particle.y < -20 || particle.x > size.x + 20 || particle.y > size.y + 20) {
          this.respawnParticle(particle, size);
          continue;
        }

        const previousX = particle.x;
        const previousY = particle.y;
        const point = map.containerPointToLatLng(L.point(particle.x, particle.y));
        const wind = this.sampleWind(point.lat, point.lng);
        const speedFactor = Math.min(3.2, Math.max(0.25, wind.speed * 0.14));
        particle.x += wind.u * speedFactor;
        particle.y -= wind.v * speedFactor;
        particle.age += 1;

        const alpha = Math.max(0, 1 - particle.age / particle.maxAge) * Math.min(1, wind.speed / 2.5);
        ctx.strokeStyle = `rgba(125, 211, 252, ${0.16 + alpha * 0.76})`;
        ctx.beginPath();
        ctx.moveTo(previousX, previousY);
        ctx.lineTo(particle.x, particle.y);
        ctx.stroke();
      }
    }

    this.animationFrame = requestAnimationFrame(this.animate);
  };
}

const originalTileLayer = L.tileLayer;
const patchKey = '__shareAnimatedWindPatched';

if (!(L as any)[patchKey]) {
  (L as any).tileLayer = ((url: string, options?: L.TileLayerOptions) => {
    if (url.includes('mode=tile') && url.includes('layer=wind_new')) {
      return new AnimatedOpenWeatherWindLayer() as unknown as L.TileLayer;
    }
    return originalTileLayer(url, options);
  }) as typeof L.tileLayer;
  (L as any)[patchKey] = true;
}
