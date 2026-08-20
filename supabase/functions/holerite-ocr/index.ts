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

const PROMPT = `Você é um especialista em leitura de holerites brasileiros. Analise o documento enviado e devolva EXCLUSIVAMENTE um JSON válido, sem markdown, comentários ou texto fora do JSON, exatamente neste formato:
{
  "salario_bruto": number|null,
  "salario_liquido": number|null,
  "desconto_inss": number|null,
  "desconto_irrf": number|null,
  "total_descontos": number|null,
  "outros_descontos": number|null,
  "raw_text": string,
  "confidence": number|null
}

Regras:
- Leia imagens e PDFs, inclusive holerites digitalizados.
- Converta valores brasileiros como "5.000,00" para 5000.00.
- "salario_bruto" deve ser o total de vencimentos ou salário base bruto, nunca o líquido.
- "salario_liquido" deve ser o valor líquido a receber.
- Para INSS e IRRF, use o valor efetivamente descontado, não a alíquota ou a base de cálculo.
- "total_descontos" deve ser o total de descontos quando estiver explícito.
- "outros_descontos" é a diferença entre o total de descontos e INSS + IRRF quando houver total confiável; caso contrário use null.
- "raw_text" deve conter o texto legível relevante do documento, sem inventar informações.
- "confidence" deve ser um número de 0 a 100 refletindo a confiança geral na leitura.
- Quando um campo não existir ou não puder ser identificado com segurança, use null.`;

function normalizeBase64(input: string): string {
  let b64 = (input || "").trim();
  const match = b64.match(/^data:[^;]+;base64,(.*)$/s);
  if (match) b64 = match[1];
  return b64.replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
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
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return json({ error: "Não autenticado" }, 401);

    const body = await req.json().catch(() => ({}));
    const imageBase64 = normalizeBase64(String(body?.fileBase64 || body?.imageBase64 || body?.image || ""));
    const mimeType = String(body?.mimeType || "application/pdf");
    if (!imageBase64 || imageBase64.length < 100) return json({ error: "Arquivo inválido ou não enviado" }, 400);

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) return json({ error: "GEMINI_API_KEY não configurada no Supabase" }, 500);

    const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";
    const aiRes = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: PROMPT }] },
        contents: [{
          role: "user",
          parts: [
            { text: "Extraia os campos deste holerite e retorne somente o JSON solicitado." },
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
          ],
        }],
        generationConfig: { response_mime_type: "application/json", temperature: 0 },
      }),
    });

    if (!aiRes.ok) {
      const detail = await aiRes.text();
      console.error(`Gemini holerite erro: ${aiRes.status} ${detail}`);
      if (aiRes.status === 429) return json({ error: "Limite de requisições atingido. Tente novamente em instantes." }, 429);
      if (aiRes.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
      return json({ error: "Falha na leitura do holerite por IA", status: aiRes.status }, 502);
    }

    const aiJson = await aiRes.json();
    const content = aiJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("JSON inválido retornado pelo Gemini:", content.slice(0, 500));
      return json({ error: "Resposta do Gemini em formato inválido" }, 422);
    }

    return json({
      rawText: typeof parsed.raw_text === "string" ? parsed.raw_text : "",
      salarioBruto: numberOrNull(parsed.salario_bruto),
      salarioLiquido: numberOrNull(parsed.salario_liquido),
      descontoInss: numberOrNull(parsed.desconto_inss),
      descontoIrrf: numberOrNull(parsed.desconto_irrf),
      outrosDescontos: numberOrNull(parsed.outros_descontos),
      totalDescontos: numberOrNull(parsed.total_descontos),
      confidence: numberOrNull(parsed.confidence),
    });
  } catch (error) {
    console.error("Erro inesperado no OCR de holerite:", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
