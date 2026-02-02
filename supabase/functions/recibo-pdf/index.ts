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
  const logoUrl = "https://cdn.jsdelivr.net/gh/your-repo/logo.share.png"; // Substituir com URL correta

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Recibo ${data.receipt_number}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body {
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: 'Arial', sans-serif;
          background: white;
          color: #333;
          line-height: 1.4;
        }
        .receipt {
          width: 210mm;
          height: 297mm;
          margin: 0 auto;
          background: white;
          padding: 25px 30px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        /* ===== HEADER ===== */
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #333;
          gap: 20px;
        }

        .logo-section {
          flex: 0 0 80px;
        }

        .logo {
          width: 80px;
          height: 80px;
          object-fit: contain;
          background: white;
        }

        .header-center {
          flex: 1;
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .header-title {
          font-size: 32px;
          font-weight: bold;
          letter-spacing: 3px;
          color: #000;
        }

        .header-right {
          flex: 0 0 auto;
          text-align: right;
          font-size: 11px;
        }

        .receipt-number-label {
          font-weight: bold;
          margin-bottom: 5px;
          text-transform: uppercase;
          font-size: 9px;
        }

        .receipt-number {
          font-weight: bold;
          font-size: 14px;
          border: 1px solid #333;
          padding: 8px 12px;
          display: inline-block;
          background: #fff;
        }

        /* ===== VALOR EM DESTAQUE ===== */
        .amount-box {
          border: 2px solid #333;
          padding: 20px 15px;
          text-align: right;
          margin: 25px 0;
          background: #f5f5f5;
        }

        .amount {
          font-size: 36px;
          font-weight: bold;
          color: #333;
        }

        /* ===== SEÇÕES DE CONTEÚDO ===== */
        .two-column {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          margin: 25px 0;
        }

        .content-section {
          margin: 0;
        }

        .section-title {
          font-weight: bold;
          font-size: 11px;
          background: #e8e8e8;
          padding: 7px 10px;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .section-content {
          font-size: 11px;
          line-height: 1.7;
          padding: 0;
        }

        .section-content strong {
          display: block;
          margin-bottom: 4px;
          font-weight: bold;
        }

        .section-content br {
          display: block;
          content: "";
          margin: 2px 0;
        }

        /* ===== DESCRIÇÃO DO SERVIÇO (FULLWIDTH) ===== */
        .description-section {
          margin: 20px 0;
          width: 100%;
        }

        .description-content {
          font-size: 11px;
          line-height: 1.6;
          padding: 0;
        }

        .description-note {
          font-size: 10px;
          color: #555;
          margin-top: 8px;
          font-style: italic;
        }

        /* ===== DATA ===== */
        .date-section {
          text-align: center;
          margin: 25px 0;
          font-size: 12px;
          padding: 10px 0;
        }

        /* ===== ASSINATURA ===== */
        .signature-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          text-align: center;
          margin: 20px 0;
        }

        .signature-line {
          border-top: 1px solid #333;
          width: 200px;
          margin: 0 auto 8px;
        }

        .signature-name {
          font-size: 11px;
          font-weight: bold;
        }

        /* ===== RODAPÉ ===== */
        .footer {
          border-top: 2px solid #333;
          padding-top: 20px;
          text-align: center;
          margin-top: auto;
        }

        .footer-text {
          font-size: 11px;
          font-weight: bold;
          color: #333;
        }
      </style>
    </head>
    <body>
      <div class="receipt">
        <!-- HEADER -->
        <div class="header">
          <div class="logo-section">
            <img src="${logoUrl}" alt="Logo" class="logo" style="max-width: 80px; max-height: 80px;">
          </div>
          <div class="header-center">
            <div class="header-title">RECIBO</div>
          </div>
          <div class="header-right">
            <div class="receipt-number-label">NÚMERO DO RECIBO</div>
            <div class="receipt-number">${data.receipt_number}</div>
          </div>
        </div>

        <!-- VALOR EM DESTAQUE -->
        <div class="amount-box">
          <div class="amount">${formatCurrency(data.amount)}</div>
        </div>

        <!-- EMISSOR E PAGADOR (2 COLUNAS) -->
        <div class="two-column">
          <!-- Seção Emissor -->
          <div class="content-section">
            <div class="section-title">Emissor</div>
            <div class="section-content">
              <strong>SHARE BRASIL SERVIÇOS AERONÁUTICOS</strong>
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
              <strong>${data.payer_name}</strong>
              ${data.payer_document ? `CPF/CNPJ: ${data.payer_document}<br>` : ''}
              ${data.payer_address ? `${data.payer_address}<br>` : ''}
              ${data.payer_city || data.payer_uf ? `${data.payer_city || ''}${data.payer_city && data.payer_uf ? ' - ' : ''}${data.payer_uf || ''}` : ''}
            </div>
          </div>
        </div>

        <!-- DESCRIÇÃO DO SERVIÇO -->
        <div class="description-section">
          <div class="section-title">Descrição do Serviço</div>
          <div class="description-content">
            ${data.service_description}
            <div class="description-note">
              Obs.: Este documento somará em validade após a efetiva quitação do valor indicado, mediante comprovação do pagamento.
            </div>
          </div>
        </div>

        <!-- DATA -->
        <div class="date-section">
          <strong>${formatDateExtended(data.issue_date)}</strong>
        </div>

        <!-- ASSINATURA -->
        <div class="signature-section">
          <div class="signature-line"></div>
          <div class="signature-name">SHARE BRASIL SERVIÇOS AERONÁUTICOS</div>
        </div>

        <!-- RODAPÉ -->
        <div class="footer">
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
