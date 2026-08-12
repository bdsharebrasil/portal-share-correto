import { supabase } from "@/integrations/supabase/client";

interface Empresa {
  razao_social?: string | null;
  logo_url?: string | null;
  telefone?: string | null;
  email?: string | null;
  site?: string | null;
}

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  try {
    return new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");
  } catch {
    return String(d);
  }
};

const fmtMoney = (v: unknown) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TIPO_LABELS: Record<string, string> = {
  corretiva: "CORRETIVA",
  preventiva: "PREVENTIVA",
  programada: "PROGRAMADA",
  revisao_geral: "REVISÃO GERAL",
  inspecao_50h: "50 HORAS",
  inspecao_100h: "100 HORAS",
  inspecao_anual: "INSPEÇÃO ANUAL",
};

/**
 * Gera o Relatório de Acompanhamento de Serviço (RAS) em layout A4,
 * seguindo o modelo oficial: cabeçalho com logo, tabela de identificação,
 * bloco de descrição das inspeções, tabelas de serviços/peças e
 * páginas de fotos com legenda.
 */
export async function gerarRelatorioRAS(
  ras: any,
  fotos: any[],
  aeronave?: { matricula?: string | null; modelo?: string | null } | null,
) {
  let empresa: Empresa = {};
  try {
    const { data } = await supabase.from("configuracao_empresa").select("*").limit(1).maybeSingle();
    if (data) empresa = data as any as Empresa;
  } catch {
    /* segue sem dados da empresa */
  }

  const itens = ras.ctm_ras_itens || [];
  const servicos = itens.filter((i: any) => i.item_tipo === "trabalho" || i.item_tipo === "service");
  const pecas = itens.filter((i: any) => i.item_tipo === "peca" || i.item_tipo === "part");
  const tipo = TIPO_LABELS[ras.tipo_manutencao] || String(ras.tipo_manutencao || "MANUTENÇÃO").toUpperCase();

  const periodo =
    ras.data_entrada && ras.data_saida
      ? `${fmtDate(ras.data_entrada)} A ${fmtDate(ras.data_saida)}`
      : fmtDate(ras.data_entrada);

  const logo = empresa.logo_url
    ? `<img class="logo" src="${esc(empresa.logo_url)}" alt="${esc(empresa.razao_social || "Logo")}" />`
    : `<div class="logo-text">${esc(empresa.razao_social || "SHARE BRASIL")}</div>`;

  const rodape = `
    <div class="rodape">
      ${empresa.telefone ? `<div>TEL: ${esc(empresa.telefone)}</div>` : ""}
      ${empresa.email ? `<div>EMAIL: ${esc(empresa.email).toUpperCase()}</div>` : ""}
      ${empresa.site ? `<div>${esc(empresa.site).toUpperCase()}</div>` : ""}
    </div>`;

  const cabecalho = `<div class="cabecalho">${logo}</div>`;

  const linhasFotos = fotos.length
    ? chunk(fotos, 2)
        .map(
          (par) => `
      <div class="fotos-linha">
        ${par
          .map(
            (f: any) => `
          <figure class="foto">
            <img src="${esc(f.url_foto)}" alt="${esc(f.legenda || "Foto RAS")}" />
            ${f.legenda ? `<figcaption>${esc(f.legenda)}</figcaption>` : ""}
          </figure>`,
          )
          .join("")}
      </div>`,
        )
        .join("")
    : "";

  const tabelaServicos = servicos.length
    ? `
    <div class="faixa">SERVIÇOS EXECUTADOS (MÃO DE OBRA)</div>
    <table class="tabela">
      <thead>
        <tr><th>Descrição</th><th>Fornecedor</th><th>Período</th><th class="num">Qtd</th><th class="num">Unit.</th><th class="num">Total</th></tr>
      </thead>
      <tbody>
        ${servicos
          .map(
            (s: any) => `<tr>
              <td>${esc(s.descricao)}</td>
              <td>${esc(s.fornecedor || "—")}</td>
              <td>${esc(s.periodo || "—")}</td>
              <td class="num">${esc(s.quantidade || 1)}</td>
              <td class="num">${fmtMoney(s.valor_unitario)}</td>
              <td class="num b">${fmtMoney(s.valor_total)}</td>
            </tr>`,
          )
          .join("")}
      </tbody>
    </table>`
    : "";

  const tabelaPecas = pecas.length
    ? `
    <div class="faixa">PEÇAS APLICADAS</div>
    <table class="tabela">
      <thead>
        <tr><th>Descrição</th><th>P/N</th><th>S/N</th><th>Fornecedor</th><th>NF</th><th class="num">Qtd</th><th class="num">Total</th></tr>
      </thead>
      <tbody>
        ${pecas
          .map(
            (p: any) => `<tr>
              <td>${esc(p.descricao)}</td>
              <td>${esc(p.numero_peca || "—")}</td>
              <td>${esc(p.numero_serie || "—")}</td>
              <td>${esc(p.fornecedor || "—")}</td>
              <td>${esc(p.numero_fatura || "—")}</td>
              <td class="num">${esc(p.quantidade || 1)}</td>
              <td class="num b">${fmtMoney(p.valor_total)}</td>
            </tr>`,
          )
          .join("")}
      </tbody>
    </table>`
    : "";

  const totais = `
    <table class="tabela totais">
      <tbody>
        <tr><td>Mão de obra</td><td class="num">${fmtMoney(ras.total_trabalho)}</td></tr>
        <tr><td>Peças</td><td class="num">${fmtMoney(ras.total_pecas)}</td></tr>
        <tr class="total-geral"><td>TOTAL GERAL</td><td class="num">${fmtMoney(ras.total_geral)}</td></tr>
      </tbody>
    </table>`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>RAS ${esc(ras.numero)} - ${esc(aeronave?.matricula || "")}</title>
<style>
  @page { size: A4; margin: 14mm 14mm 18mm 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Calibri, "Segoe UI", Arial, sans-serif; color: #111; font-size: 11pt; }
  .pagina { position: relative; padding-bottom: 6mm; page-break-after: always; }
  .pagina:last-child { page-break-after: auto; }
  .cabecalho { display: flex; align-items: center; margin-bottom: 10mm; }
  .logo { height: 22mm; object-fit: contain; }
  .logo-text { font-size: 20pt; font-weight: 700; color: #1e3a5f; letter-spacing: .5px; }
  h1 { font-size: 15pt; text-align: center; margin: 0 0 8mm; font-weight: 700; }
  .faixa { background: #d9dde8; border: 1px solid #7f8ba3; text-align: center; font-weight: 700;
           font-size: 10.5pt; padding: 2mm; margin: 6mm 0 0; }
  table.ident { width: 100%; border-collapse: collapse; }
  table.ident td { border: 1px solid #7f8ba3; padding: 1.6mm 2.5mm; font-size: 10pt; width: 50%; }
  table.ident td span { font-weight: 700; }
  .bloco-texto { border: 1px solid #333; padding: 5mm; margin-top: 5mm; min-height: 40mm;
                 white-space: pre-wrap; line-height: 1.5; text-align: justify; font-size: 10.5pt; }
  table.tabela { width: 100%; border-collapse: collapse; margin-top: 3mm; font-size: 9pt; }
  table.tabela th { background: #d9dde8; border: 1px solid #7f8ba3; padding: 1.5mm 2mm; text-align: left; }
  table.tabela td { border: 1px solid #9aa4b8; padding: 1.5mm 2mm; }
  table.tabela .num { text-align: right; white-space: nowrap; }
  table.tabela .b { font-weight: 700; }
  table.totais { width: 70mm; margin-left: auto; margin-top: 4mm; }
  table.totais .total-geral td { background: #d9dde8; font-weight: 700; }
  .fotos-linha { display: flex; gap: 8mm; justify-content: center; margin-bottom: 8mm; page-break-inside: avoid; }
  .foto { margin: 0; width: 78mm; }
  .foto img { width: 100%; height: 82mm; object-fit: cover; border: 1px solid #333; display: block; }
  .foto figcaption { font-size: 9pt; text-align: center; margin-top: 2mm; color: #333; }
  .rodape { text-align: right; font-size: 8pt; color: #6b7280; letter-spacing: .5px; margin-top: 8mm; }
  .assinatura { margin-top: 18mm; display: flex; gap: 12mm; justify-content: space-between; }
  .assinatura div { flex: 1; border-top: 1px solid #333; padding-top: 2mm; text-align: center; font-size: 9pt; }
  @media print { .no-print { display: none; } }
  .no-print { position: fixed; top: 8px; right: 8px; }
  .no-print button { padding: 8px 14px; font-size: 13px; border-radius: 8px; border: 0;
                     background: #1e3a5f; color: #fff; cursor: pointer; }
</style>
</head>
<body>
<div class="no-print"><button onclick="window.print()">Imprimir / Salvar PDF</button></div>

<div class="pagina">
  ${cabecalho}
  <h1>RELATÓRIO DE ACOMPANHAMENTO DE SERVIÇO - RAS</h1>
  <div class="faixa" style="margin-top:0">RELATÓRIO DE ACOMPANHAMENTO DE SERVIÇO – R.A.S ${esc(ras.numero ? `Nº ${ras.numero}` : "")}</div>
  <table class="ident">
    <tr>
      <td><span>Aeronave:</span> ${esc(aeronave?.modelo || "—")}</td>
      <td><span>Centro de Manutenção:</span> ${esc(ras.oficina_nome || "—")}</td>
    </tr>
    <tr>
      <td><span>Matrícula:</span> ${esc(aeronave?.matricula || "—")}</td>
      <td><span>Tipo de Manutenção:</span> ${esc(tipo)}</td>
    </tr>
    <tr>
      <td><span>Período Manutenção:</span> ${esc(periodo)}</td>
      <td><span>Resp. pelo acompanhamento:</span> ${esc(ras.mecanico_responsavel || "—")}</td>
    </tr>
    <tr>
      <td><span>Horas Célula (Entrada):</span> ${ras.horas_celula_entrada ? `${esc(ras.horas_celula_entrada)}h` : "—"}</td>
      <td><span>N° O.S Oficina:</span> ${esc(ras.oas_numero || "—")}</td>
    </tr>
  </table>

  <div class="faixa">DESCRIÇÃO DAS INSPEÇÕES REALIZADAS</div>
  <div class="bloco-texto">${esc(ras.descricao || ras.objetivo || "—")}</div>
  ${rodape}
</div>

${
  linhasFotos
    ? `<div class="pagina">
        ${cabecalho}
        <div class="faixa" style="margin-top:0">REGISTRO FOTOGRÁFICO</div>
        <div style="margin-top:8mm">${linhasFotos}</div>
        ${rodape}
      </div>`
    : ""
}

${
  tabelaServicos || tabelaPecas
    ? `<div class="pagina">
        ${cabecalho}
        <div class="faixa" style="margin-top:0">SERVIÇOS E PEÇAS</div>
        ${tabelaServicos}
        ${tabelaPecas}
        ${totais}
        <div class="assinatura">
          <div>Resp. pelo acompanhamento${ras.mecanico_responsavel ? `<br/>${esc(ras.mecanico_responsavel)}` : ""}</div>
          <div>Centro de Manutenção${ras.oficina_nome ? `<br/>${esc(ras.oficina_nome)}` : ""}</div>
        </div>
        ${rodape}
      </div>`
    : ""
}
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  return true;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
