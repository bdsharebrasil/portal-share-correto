import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED_LAYERS = new Set([
  "clouds_new",
  "precipitation_new",
  "pressure_new",
  "wind_new",
  "temp_new",
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function numberParam(value: string | null, name: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Parâmetro inválido: ${name}`);
  return parsed;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const apiKey = Deno.env.get("OPENWEATHER_API_KEY");
  if (!apiKey) return json({ error: "OPENWEATHER_API_KEY não configurada no Supabase." }, 503);

  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") || "tile";

    if (mode === "tile") {
      const layer = url.searchParams.get("layer") || "wind_new";
      if (!ALLOWED_LAYERS.has(layer)) return json({ error: "Camada meteorológica não permitida." }, 400);
      const z = numberParam(url.searchParams.get("z"), "z");
      const x = numberParam(url.searchParams.get("x"), "x");
      const y = numberParam(url.searchParams.get("y"), "y");
      if (![z, x, y].every(Number.isInteger) || z < 0 || z > 18) return json({ error: "Tile inválido." }, 400);

      const response = await fetch(`https://tile.openweathermap.org/map/${layer}/${z}/${x}/${y}.png?appid=${encodeURIComponent(apiKey)}`);
      if (!response.ok) return json({ error: `OpenWeather tile: ${response.status}` }, response.status);
      return new Response(response.body, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": response.headers.get("content-type") || "image/png",
          "Cache-Control": "public, max-age=300, s-maxage=600",
        },
      });
    }

    if (mode === "point") {
      const lat = numberParam(url.searchParams.get("lat"), "lat");
      const lon = numberParam(url.searchParams.get("lon"), "lon");
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return json({ error: "Coordenadas inválidas." }, 400);
      const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${encodeURIComponent(apiKey)}&units=metric&lang=pt_br`);
      const body = await response.json();
      return json(body, response.status);
    }

    return json({ error: "Modo não suportado." }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Erro ao consultar meteorologia." }, 500);
  }
});
