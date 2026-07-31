import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const PROMPT = `Você é um extrator de dados de demonstrativos de tarifas aeronáuticas brasileiros
(INFRAERO, DECEA e tarifas de pouso). Leia a imagem e devolva EXCLUSIVAMENTE um JSON válido,
sem markdown, sem comentários, no formato:

{
  "numero_documento": string|null,
  "competencia": string|null,          // "MM/AAAA" quando houver
  "data_faturamento": string|null,     // "DD/MM/AAAA"
  "aeronave_matricula": string|null,   // ex: "PR-ABC"
  "cliente_nome": string|null,
  "valor_total": number|null,          // ponto como separador decimal
  "itens": [
    { "data": "DD/MM/AAAA", "hora": string|null, "operacao": string|null,
      "matricula": string|null, "valor": number }
  ]
}

Regras:
- Converta valores brasileiros ("1.234,56") para número (1234.56).
- Todas as datas no formato DD/MM/AAAA.
- Inclua TODAS as linhas de operação encontradas, na ordem em que aparecem.
- Se um campo não existir, use null. "itens" nunca pode ser null (use []).`;

function normalizeBase64(input: string): string {
  let b64 = (input || "").trim();
  // remove data URL prefix se vier junto
  const m = b64.match(/^data:[^;]+;base64,(.*)$/s);
  if (m) b64 = m[1];
  // remove quebras de linha / espaços que quebram o decode do gateway
  b64 = b64.replace(/\s/g, "");
  // normaliza base64url
  b64 = b64.replace(/-/g, "+").replace(/_/g, "/");
  // corrige padding
  const pad = b64.length % 4;
  if (pad === 2) b64 += "==";
  else if (pad === 3) b64 += "=";
  else if (pad === 1) b64 = b64.slice(0, -1);
  return b64;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return json({ error: "Não autenticado" }, 401);

    const body = await req.json().catch(() => ({}));
    const rawBase64: string = body?.imageBase64 || body?.image || "";
    const mimeType: string = body?.mimeType || "image/png";
    const tipo: string = body?.tipo || "INFRAERO";

    if (!rawBase64 || rawBase64.length < 100) {
      return json({ error: "Imagem inválida ou não enviada" }, 400);
    }
    const imageBase64 = normalizeBase64(rawBase64);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: `Tipo do demonstrativo: ${tipo}. Extraia os dados.` },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            ],
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const detail = await aiRes.text();
      console.error(`AI Gateway erro: ${aiRes.status} ${detail}`);
      if (aiRes.status === 429) return json({ error: "Limite de requisições atingido. Tente novamente em instantes." }, 429);
      if (aiRes.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
      return json({ error: "Falha na leitura por IA", status: aiRes.status, details: detail }, 502);
    }

    const aiJson = await aiRes.json();
    const content: string = aiJson?.choices?.[0]?.message?.content ?? "";
    const cleaned = content.replace(/```json/gi, "").replace(/```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) {
      console.error("Resposta da IA sem JSON:", cleaned.slice(0, 500));
      return json({ error: "Não foi possível interpretar o demonstrativo" }, 422);
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    } catch (e) {
      console.error("JSON inválido da IA:", cleaned.slice(0, 500));
      return json({ error: "Resposta da IA em formato inválido" }, 422);
    }

    const itens = Array.isArray(parsed.itens) ? parsed.itens : [];

    return json({
      tipo,
      numero_documento: parsed.numero_documento ?? null,
      competencia: parsed.competencia ?? null,
      data_faturamento: parsed.data_faturamento ?? null,
      aeronave_matricula: parsed.aeronave_matricula ?? null,
      cliente_nome: parsed.cliente_nome ?? null,
      valor_total: typeof parsed.valor_total === "number" ? parsed.valor_total : null,
      itens: itens.map((i: Record<string, unknown>) => ({
        data: String(i?.data ?? ""),
        hora: i?.hora ?? null,
        operacao: i?.operacao ?? null,
        matricula: i?.matricula ?? null,
        valor: Number(i?.valor ?? 0) || 0,
      })),
    });
  } catch (e) {
    console.error("Erro inesperado:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
