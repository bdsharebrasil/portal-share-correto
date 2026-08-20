import { convertPdfToImageBlob } from "@/lib/pdfToImage";

type TesseractApi = {
  createWorker: (language: string, oem?: number, options?: { logger?: (message: { status?: string; progress?: number }) => void }) => Promise<{
    recognize: (input: Blob) => Promise<{ data: { text: string; confidence?: number } }>;
    terminate: () => Promise<void>;
  }>;
};

let tesseractPromise: Promise<TesseractApi> | null = null;

const loadTesseract = (): Promise<TesseractApi> => {
  if (typeof window === "undefined") return Promise.reject(new Error("OCR disponível apenas no navegador."));
  if ((window as any).Tesseract) return Promise.resolve((window as any).Tesseract as TesseractApi);
  if (tesseractPromise) return tesseractPromise;
  tesseractPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@7/dist/tesseract.min.js";
    script.async = true;
    script.onload = () => (window as any).Tesseract ? resolve((window as any).Tesseract as TesseractApi) : reject(new Error("OCR não foi carregado."));
    script.onerror = () => reject(new Error("Não foi possível carregar o mecanismo OCR."));
    document.head.appendChild(script);
  });
  return tesseractPromise;
};

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
  const label = labels.join("|");
  const labelPattern = new RegExp(`(?:${label})`, "i");
  const labelMatch = labelPattern.exec(text);
  if (!labelMatch || labelMatch.index < 0) return null;
  const tail = text
    .slice(labelMatch.index + labelMatch[0].length, labelMatch.index + labelMatch[0].length + 120)
    .split("\n", 1)[0];
  const amounts = tail.match(/(?:R\$\s*)?\d{1,3}(?:[. ]\d{3})*(?:,\d{2})|(?:R\$\s*)?\d+(?:,\d{2})/g) ?? [];
  // Em holerites, a coluna Referência aparece antes de Vencimentos/Descontos.
  // O último valor da janela é normalmente o valor monetário efetivo.
  return parseBRL(amounts.at(-1));
};

const firstPositive = (...values: Array<number | null>) => values.find((value) => value != null && value > 0) ?? null;

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

export async function readHolerite(file: File, onProgress?: (value: number) => void): Promise<HoleriteExtraction> {
  const input: Blob = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    ? await convertPdfToImageBlob(file, 2.5)
    : file;

  const tesseract = await loadTesseract();
  const worker = await tesseract.createWorker("por", 1, {
    logger: (message) => {
      if (message.status === "recognizing text" && typeof message.progress === "number") {
        onProgress?.(Math.round(message.progress * 100));
      }
    },
  });

  try {
    const result = await worker.recognize(input);
    const confidence = Number.isFinite(result.data.confidence) ? result.data.confidence : null;
    return parseHoleriteText(result.data.text, confidence);
  } finally {
    await worker.terminate();
  }
}
