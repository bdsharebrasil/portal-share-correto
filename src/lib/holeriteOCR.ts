import { supabase } from "@/integrations/supabase/client";

export interface HoleriteExtraction {
  rawText: string;
  salarioBruto: number | null;
  salarioLiquido: number | null;
  descontoInss: number | null;
  descontoIrrf: number | null;
  outrosDescontos: number | null;
  totalDescontos: number | null;
  confidence: number | null;
}

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00a0/g, " ")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

const parseBRL = (value: string | undefined): number | null => {
  if (!value) return null;
  const cleaned = value.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return null;
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
};

const amountAfterLabel = (text: string, labels: string[]): number | null => {
  const labelPattern = new RegExp(`(?:${labels.join("|")})`, "i");
  const labelMatch = labelPattern.exec(text);
  if (!labelMatch || labelMatch.index < 0) return null;
  const tail = text
    .slice(labelMatch.index + labelMatch[0].length, labelMatch.index + labelMatch[0].length + 120)
    .split("\n", 1)[0];
  const amounts = tail.match(/(?:R\$\s*)?\d{1,3}(?:[. ]\d{3})*(?:,\d{2})|(?:R\$\s*)?\d+(?:,\d{2})/g) ?? [];
  return parseBRL(amounts.at(-1));
};

const firstPositive = (...values: Array<number | null>) => values.find((value) => value != null && value > 0) ?? null;

/** Parser de apoio para texto retornado pelo Gemini ou para testes unitários. */
export function parseHoleriteText(rawText: string, confidence: number | null = null): HoleriteExtraction {
  const text = normalizeText(rawText);
  const descontoInss = amountAfterLabel(text, ["INSS"]);
  const descontoIrrf = amountAfterLabel(text, ["IRRF", "Imposto de Renda"]);
  const totalDescontos = amountAfterLabel(text, ["Total de Descontos", "Total dos Descontos"]);
  const salarioLiquido = amountAfterLabel(text, ["Valor Liquido", "Liquido a Receber", "Liquido"]);
  const salarioBruto = firstPositive(
    amountAfterLabel(text, ["Total de Vencimentos", "Total dos Vencimentos"]),
    amountAfterLabel(text, ["Salario Base", "Salario Bruto"]),
    totalDescontos != null && salarioLiquido != null ? salarioLiquido + totalDescontos : null,
  );
  const descontosConhecidos = (descontoInss ?? 0) + (descontoIrrf ?? 0);
  const outrosDescontos = totalDescontos != null && totalDescontos > descontosConhecidos
    ? totalDescontos - descontosConhecidos
    : null;

  return {
    rawText,
    salarioBruto,
    salarioLiquido,
    descontoInss,
    descontoIrrf,
    outrosDescontos,
    totalDescontos,
    confidence,
  };
}

const fileToBase64 = async (file: File): Promise<string> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

export async function readHolerite(file: File, onProgress?: (value: number) => void): Promise<HoleriteExtraction> {
  onProgress?.(5);
  const fileBase64 = await fileToBase64(file);
  onProgress?.(20);

  const { data, error } = await supabase.functions.invoke("holerite-ocr", {
    body: {
      fileBase64,
      mimeType: file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/png"),
    },
  });

  if (error) {
    let detail = error.message || "Não foi possível ler o holerite com o Gemini.";
    try {
      const context = await (error as any).context?.json?.();
      if (context?.error) detail = context.error;
    } catch {
      // Mantém a mensagem original quando a resposta não for JSON.
    }
    throw new Error(detail);
  }

  onProgress?.(100);
  if (!data || typeof data !== "object") throw new Error("O Gemini não retornou dados válidos para este holerite.");
  return {
    rawText: String((data as any).rawText || ""),
    salarioBruto: typeof (data as any).salarioBruto === "number" ? (data as any).salarioBruto : null,
    salarioLiquido: typeof (data as any).salarioLiquido === "number" ? (data as any).salarioLiquido : null,
    descontoInss: typeof (data as any).descontoInss === "number" ? (data as any).descontoInss : null,
    descontoIrrf: typeof (data as any).descontoIrrf === "number" ? (data as any).descontoIrrf : null,
    outrosDescontos: typeof (data as any).outrosDescontos === "number" ? (data as any).outrosDescontos : null,
    totalDescontos: typeof (data as any).totalDescontos === "number" ? (data as any).totalDescontos : null,
    confidence: typeof (data as any).confidence === "number" ? (data as any).confidence : null,
  };
}
