import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ReceiptData {
  id: string;
  receipt_number: string;
  payer_name: string;
  payer_document: string;
  payer_address?: string;
  payer_city?: string;
  payer_uf?: string;
  amount: number;
  service_description: string;
  receipt_type: "pagamento" | "reembolso";
  issue_date: string;
  max_payment_date?: string;
  payment_method?: string;
  boleto_url?: string;
  nf_url?: string;
  numero_documento?: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(dateString: string): string {
  try {
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
  } catch {
    return dateString;
  }
}

function formatDateExtended(dateString: string): string {
  try {
    const [year, month, day] = dateString.split("-");
    const meses = [
      "janeiro", "fevereiro", "março", "abril", "maio", "junho",
      "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
    ];
    const monthIndex = parseInt(month) - 1;
    return `${day} de ${meses[monthIndex]} de ${year}`;
  } catch {
    return dateString;
  }
}

function numberToWords(num: number): string {
  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const especiais = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  if (num === 0) return "zero reais";
  if (num === 100) return "cem reais";

  const inteiro = Math.floor(num);
  const centavos = Math.round((num - inteiro) * 100);

  let resultado = "";

  if (inteiro > 0) {
    if (inteiro >= 1000) {
      const milhares = Math.floor(inteiro / 1000);
      resultado += milhares === 1 ? "mil" : `${unidades[milhares]} mil`;
      const resto = inteiro % 1000;
      if (resto > 0) resultado += " ";
    }

    const resto = inteiro % 1000;
    if (resto > 0) {
      if (resto >= 100) {
        resultado += centenas[Math.floor(resto / 100)];
        const dezenaUnidade = resto % 100;
        if (dezenaUnidade > 0) resultado += " e ";
      }

      const dezenaUnidade = resto % 100;
      if (dezenaUnidade >= 10 && dezenaUnidade < 20) {
        resultado += especiais[dezenaUnidade - 10];
      } else {
        if (dezenaUnidade >= 20) {
          resultado += dezenas[Math.floor(dezenaUnidade / 10)];
          if (dezenaUnidade % 10 > 0) resultado += " e ";
        }
        if (dezenaUnidade % 10 > 0 || (dezenaUnidade < 10 && dezenaUnidade > 0)) {
          resultado += unidades[dezenaUnidade % 10 || dezenaUnidade];
        }
      }
    }

    resultado += inteiro === 1 ? " real" : " reais";
  }

  if (centavos > 0) {
    if (inteiro > 0) resultado += " e ";
    if (centavos >= 10 && centavos < 20) {
      resultado += especiais[centavos - 10];
    } else {
      if (centavos >= 20) {
        resultado += dezenas[Math.floor(centavos / 10)];
        if (centavos % 10 > 0) resultado += " e ";
      }
      if (centavos % 10 > 0 || centavos < 10) {
        resultado += unidades[centavos % 10 || centavos];
      }
    }
    resultado += centavos === 1 ? " centavo" : " centavos";
  }

  return resultado;
}

function generateReceiptHTML(data: ReceiptData): string {
  const isReembolso = data.receipt_type === "reembolso";
  const valorExtenso = numberToWords(data.amount);
  
  // Construir texto do card de reembolso com prazo e número do documento
  let reembolsoCardText = "RECIBO EMITIDO ANTECIPADAMENTE A TÍTULO DE SOLICITAÇÃO DE REEMBOLSO";
  
  if (data.numero_documento) {
    reembolsoCardText += `<br><strong>Documento: ${data.numero_documento}</strong>`;
  }
  
  if (data.max_payment_date) {
    reembolsoCardText += `<br><strong>Prazo máximo de quitação: ${formatDate(data.max_payment_date)}</strong>`;
  }

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Recibo ${data.receipt_number}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          background: #f5f5f5; 
          padding: 20px;
        }
        .receipt { 
          max-width: 800px; 
          margin: 0 auto; 
          background: white; 
          border: 2px solid #333;
          padding: 40px;
        }
        .header { 
          text-align: center; 
          border-bottom: 2px solid #333; 
          padding-bottom: 20px; 
          margin-bottom: 30px; 
        }
        .header h1 { 
          font-size: 28px; 
          color: #1a365d; 
          margin-bottom: 10px;
        }
        .receipt-number { 
          font-size: 18px; 
          color: #666; 
          font-weight: bold;
        }
        .amount-section { 
          background: #f0f4f8; 
          padding: 20px; 
          border-radius: 8px; 
          margin-bottom: 30px;
          text-align: center;
        }
        .amount { 
          font-size: 36px; 
          font-weight: bold; 
          color: #2d3748;
        }
        .amount-words { 
          font-size: 14px; 
          color: #666; 
          margin-top: 5px;
          font-style: italic;
        }
        .info-section { 
          margin-bottom: 25px; 
        }
        .info-section h3 { 
          font-size: 14px; 
          color: #666; 
          text-transform: uppercase; 
          margin-bottom: 8px;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 5px;
        }
        .info-section p { 
          font-size: 16px; 
          color: #2d3748; 
          line-height: 1.6;
        }
        .reembolso-card {
          background: #fff3cd;
          border: 2px solid #ffc107;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 25px;
          text-align: center;
        }
        .reembolso-card p {
          color: #856404;
          font-weight: bold;
          font-size: 14px;
          line-height: 1.8;
        }
        .signature-section { 
          margin-top: 60px; 
          text-align: center; 
        }
        .signature-line { 
          border-top: 1px solid #333; 
          width: 300px; 
          margin: 0 auto 10px;
        }
        .footer { 
          margin-top: 40px; 
          text-align: center; 
          font-size: 12px; 
          color: #999;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        @media print {
          body { background: white; padding: 0; }
          .receipt { border: none; }
        }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="header">
          <h1>RECIBO DE ${isReembolso ? "REEMBOLSO" : "PAGAMENTO"}</h1>
          <div class="receipt-number">Nº ${data.receipt_number}</div>
        </div>

        ${isReembolso ? `
        <div class="reembolso-card">
          <p>${reembolsoCardText}</p>
        </div>
        ` : ''}

        <div class="amount-section">
          <div class="amount">${formatCurrency(data.amount)}</div>
          <div class="amount-words">(${valorExtenso})</div>
        </div>

        <div class="info-section">
          <h3>Pagador</h3>
          <p>
            <strong>${data.payer_name}</strong><br>
            ${data.payer_document ? `CPF/CNPJ: ${data.payer_document}<br>` : ''}
            ${data.payer_address ? `${data.payer_address}<br>` : ''}
            ${data.payer_city || data.payer_uf ? `${data.payer_city || ''}${data.payer_city && data.payer_uf ? ' - ' : ''}${data.payer_uf || ''}` : ''}
          </p>
        </div>

        <div class="info-section">
          <h3>Referente a</h3>
          <p>${data.service_description}</p>
        </div>

        <div class="grid-2">
          <div class="info-section">
            <h3>Data de Emissão</h3>
            <p>${formatDateExtended(data.issue_date)}</p>
          </div>
          ${data.max_payment_date ? `
          <div class="info-section">
            <h3>Prazo Máximo de Quitação</h3>
            <p>${formatDateExtended(data.max_payment_date)}</p>
          </div>
          ` : ''}
        </div>

        ${data.payment_method ? `
        <div class="info-section">
          <h3>Forma de Pagamento</h3>
          <p>${data.payment_method}</p>
        </div>
        ` : ''}

        <div class="signature-section">
          <div class="signature-line"></div>
          <p>Assinatura do Recebedor</p>
        </div>

        <div class="footer">
          <p>Documento gerado eletronicamente em ${formatDateExtended(new Date().toISOString().split('T')[0])}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { receiptData } = await req.json();

    if (!receiptData) {
      throw new Error("Dados do recibo não fornecidos");
    }

    const html = generateReceiptHTML(receiptData);

    // Para uma implementação completa, você precisaria de um serviço de geração de PDF
    // Por enquanto, retornamos o HTML que pode ser convertido em PDF no cliente
    // ou usar um serviço externo como Puppeteer, html-pdf, etc.

    // Aqui estamos simulando a geração - em produção, integrar com serviço de PDF
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Salvar HTML como arquivo temporário (em produção, converter para PDF)
    const fileName = `recibos/${receiptData.id}_${Date.now()}.html`;
    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(fileName, html, {
        contentType: "text/html",
        upsert: true,
      });

    if (uploadError) {
      console.error("Erro ao fazer upload:", uploadError);
      throw uploadError;
    }

    const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(fileName);

    return new Response(
      JSON.stringify({ 
        success: true, 
        url: urlData.publicUrl,
        html: html 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro na função recibo-pdf:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro desconhecido" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
