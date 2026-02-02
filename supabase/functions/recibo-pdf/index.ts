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
          font-family: 'Arial', sans-serif; 
          background: white; 
          padding: 40px;
          color: #333;
        }
        .receipt { 
          max-width: 900px; 
          margin: 0 auto; 
          background: white;
        }
        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 30px;
          border-bottom: 2px solid #333;
          padding-bottom: 20px;
        }
        .logo-section {
          display: flex;
          align-items: center;
          gap: 15px;
        }
        .logo {
          width: 80px;
          height: 80px;
        }
        .company-info {
          font-weight: bold;
          font-size: 18px;
        }
        .receipt-title {
          text-align: center;
          font-size: 24px;
          font-weight: bold;
          color: #333;
        }
        .receipt-number-box {
          text-align: right;
          font-size: 12px;
          color: #666;
        }
        .amount-box {
          border: 2px solid #333;
          padding: 15px;
          text-align: center;
          margin: 20px 0;
          background: #f9f9f9;
        }
        .amount {
          font-size: 28px;
          font-weight: bold;
          color: #333;
        }
        .content-section {
          margin: 20px 0;
        }
        .section-title {
          font-weight: bold;
          font-size: 12px;
          background: #f0f0f0;
          padding: 8px 10px;
          margin-bottom: 10px;
          text-transform: uppercase;
        }
        .section-content {
          font-size: 12px;
          line-height: 1.6;
          padding: 0 10px;
          margin-bottom: 15px;
        }
        .two-column {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin: 20px 0;
        }
        .date-section {
          margin: 20px 0;
          text-align: center;
        }
        .date-section p {
          font-size: 13px;
          margin: 5px 0;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          border-top: 2px solid #333;
          padding-top: 20px;
        }
        .footer-logo {
          width: 60px;
          height: 60px;
          margin-bottom: 10px;
          display: inline-block;
        }
        .footer-text {
          font-size: 11px;
          font-weight: bold;
          color: #666;
        }
        .signature-section {
          margin-top: 40px;
          text-align: center;
        }
        .signature-line {
          border-top: 1px solid #333;
          width: 300px;
          margin: 20px auto 5px;
        }
        .signature-name {
          font-size: 12px;
          margin-top: 10px;
        }
      </style>
    </head>
    <body>
      <div class="receipt">
        <!-- Header com Logo e Título -->
        <div class="header-top">
          <div class="logo-section">
            <img src="/logoshare.png" alt="Logo" class="logo" style="max-width: 80px;">
            <div class="company-info">RECIBO</div>
          </div>
          <div class="receipt-title">RECIBO</div>
          <div class="receipt-number-box">
            <strong>NÚMERO DO RECIBO</strong><br>
            ${data.receipt_number}
          </div>
        </div>

        <!-- Valor em Destaque -->
        <div class="amount-box">
          <div class="amount">${formatCurrency(data.amount)}</div>
        </div>

        <!-- Seção Emissor (Share Brasil) -->
        <div class="content-section">
          <div class="section-title">Emissor</div>
          <div class="section-content">
            <strong>SHARE BRASIL SERVIÇOS AERONÁUTICOS</strong><br>
            CNPJ: 01.234.567/0001-89<br>
            (65) 99818-0312<br>
            AV. PRESIDENTE ARTHUR BERNARDES, 1437<br>
            VÁRZEA GRANDE/MT - CEP 78125-100
          </div>
        </div>

        <!-- Seção Pagador -->
        <div class="content-section">
          <div class="section-title">Pagador</div>
          <div class="section-content">
            <strong>${data.payer_name}</strong><br>
            ${data.payer_document ? `CPF/CNPJ: ${data.payer_document}<br>` : ''}
            ${data.payer_address ? `${data.payer_address}<br>` : ''}
            ${data.payer_city || data.payer_uf ? `${data.payer_city || ''}${data.payer_city && data.payer_uf ? ' - ' : ''}${data.payer_uf || ''}<br>` : ''}
          </div>
        </div>

        <!-- Descrição do Serviço -->
        <div class="content-section">
          <div class="section-title">Descrição do Serviço</div>
          <div class="section-content">
            ${data.service_description}
            <br><em>Obs.: Este documento somerá em validade após a efetiva quitação do valor indicado, mediante comprovação do pagamento.</em>
          </div>
        </div>

        <!-- Data -->
        <div class="date-section">
          <p><strong>${formatDateExtended(data.issue_date)}</strong></p>
        </div>

        <!-- Assinatura -->
        <div class="signature-section">
          <div class="signature-line"></div>
          <div class="signature-name">SHARE BRASIL SERVIÇOS AERONÁUTICOS</div>
        </div>

        <!-- Rodapé com Logo -->
        <div class="footer">
          <img src="/logoshare.png" alt="Logo" class="footer-logo" style="max-width: 60px;">
          <div class="footer-text">SHARE BRASIL SERVIÇOS AERONÁUTICOS</div>
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

    // Usar uma API externa para converter HTML para PDF (htmltopdf.com ou similar)
    // Ou usar a biblioteca de conversão disponível
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Tentar usar puppeteer/chromium via API externa ou salvar como HTML
    // Por enquanto, vamos retornar o HTML que será convertido em PDF no cliente via html2pdf
    const fileName = `recibos/${receiptData.id}_${Date.now()}.html`;
    
    const htmlBlob = new Blob([html], { type: "text/html" });
    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(fileName, htmlBlob, {
        contentType: "text/html",
        upsert: true,
      });

    if (uploadError) {
      console.error("Erro ao fazer upload:", uploadError);
      throw uploadError;
    }

    const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(fileName);

    // Retornar dados para conversão em PDF no cliente
    return new Response(
      JSON.stringify({ 
        success: true, 
        url: urlData.publicUrl,
        html: html,
        receiptNumber: receiptData.receipt_number
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
