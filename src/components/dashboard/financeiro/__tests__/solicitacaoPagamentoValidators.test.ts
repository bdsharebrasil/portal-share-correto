// @ts-nocheck
import test from "node:test";
import assert from "node:assert/strict";

import {
  findExistingFuelReference,
  findExistingReceiptReference,
  findExistingTravelExpenseReference,
  normalizarTipoDespesa,
  normalizarTipoRateio,
  resolverCategoriaMovimentacaoShare,
  resolverFornecedorSolicitacao,
  resolverModoSolicitacaoPadrao,
  resolverPagoPorSolicitacao,
  resolverSubcategoriaSelecionadaParaPayload,
  resolverTipoRateioPadraoParaDespesa,
} from "../solicitacaoPagamentoValidators";

test("normalizarTipoDespesa reconhece combustíveis", () => {
  assert.equal(normalizarTipoDespesa("Combustível"), "COMBUSTIVEIS");
  assert.equal(normalizarTipoDespesa("COMBUSTÍVEL"), "COMBUSTIVEIS");
  assert.equal(normalizarTipoDespesa("combustivel"), "COMBUSTIVEIS");
  assert.equal(normalizarTipoDespesa("Combust. Aviação"), "COMBUSTIVEIS");
});

test("normalizarTipoDespesa reconhece despesas de viagem", () => {
  assert.equal(normalizarTipoDespesa("Despesa de Viagem"), "DESPESAS_DE_VIAGEM");
  assert.equal(normalizarTipoDespesa("DESPESAS_VIAGEM"), "DESPESAS_DE_VIAGEM");
  assert.equal(normalizarTipoDespesa("Despesa Viagem"), "DESPESAS_DE_VIAGEM");
});

test("normalizarTipoDespesa retorna OUTRA para tipos desconhecidos", () => {
  assert.equal(normalizarTipoDespesa("Manutenção"), "OUTRA");
  assert.equal(normalizarTipoDespesa("Consultoria"), "OUTRA");
  assert.equal(normalizarTipoDespesa("Hotel"), "OUTRA");
});

test("normalizarTipoRateio normaliza os tipos de rateio suportados", () => {
  assert.equal(normalizarTipoRateio("FIXO"), "FIXO");
  assert.equal(normalizarTipoRateio("variável por voo"), "VARIAVEL_POR_VOO");
  assert.equal(normalizarTipoRateio("Variável por hora"), "VARIAVEL_POR_HORA");
  assert.equal(normalizarTipoRateio("extra"), "EXTRA");
});

test("normalizarTipoRateio retorna FIXO para valores desconhecidos", () => {
  assert.equal(normalizarTipoRateio(""), "FIXO");
  assert.equal(normalizarTipoRateio("qualquer coisa"), "FIXO");
});

test("resolverTipoRateioPadraoParaDespesa define taxa automática correta", () => {
  assert.equal(resolverTipoRateioPadraoParaDespesa("Combustíveis"), "VARIAVEL_POR_HORA");
  assert.equal(resolverTipoRateioPadraoParaDespesa("COMBUSTÍVEIS"), "VARIAVEL_POR_HORA");
  assert.equal(resolverTipoRateioPadraoParaDespesa("ADM SHARE BRASIL"), "FIXO");
  assert.equal(resolverTipoRateioPadraoParaDespesa("ADM E TRIP SHARE BRASIL"), "FIXO");
  assert.equal(resolverTipoRateioPadraoParaDespesa("Despesas de viagem"), null);
  assert.equal(resolverTipoRateioPadraoParaDespesa("Manutenção"), null);
});

test("resolverModoSolicitacaoPadrao define o modo reembolso quando a solicitação nasce de recibo de reembolso", () => {
  assert.equal(resolverModoSolicitacaoPadrao({ origemReciboReembolso: true }), "REEMBOLSO");
  assert.equal(resolverModoSolicitacaoPadrao({ origemReciboReembolso: false }), null);
  assert.equal(resolverModoSolicitacaoPadrao({ modo: "SHARE" }), "SHARE");
  assert.equal(resolverModoSolicitacaoPadrao({ modo: "REEMBOLSO", origemReciboReembolso: false }), "REEMBOLSO");
});

test("resolverPagoPorSolicitacao usa o nome esperado conforme o tipo de rateio", () => {
  assert.equal(resolverPagoPorSolicitacao({ socioNome: "Ana", clienteNome: "Cliente A", rateadoParaTodosSocios: false }), "Ana");
  assert.equal(resolverPagoPorSolicitacao({ socioNome: "Ana", clienteNome: "Cliente A", rateadoParaTodosSocios: true }), "Cliente A");
  assert.equal(resolverPagoPorSolicitacao({ socioNome: "DEJALMO", clienteNome: "DGA ADMINISTRADORA DE BENS SPE LTDA", socioCount: 1 }), "DEJALMO");
  assert.equal(resolverPagoPorSolicitacao({ socioNome: "DEJALMO", clienteNome: "DGA ADMINISTRADORA DE BENS SPE LTDA", socioCount: 2 }), "DGA ADMINISTRADORA DE BENS SPE LTDA");
});

test("resolverFornecedorSolicitacao força o fornecedor SHARE BRASIL para despesas de viagem", () => {
  assert.equal(resolverFornecedorSolicitacao({ isViagemMode: true, fornecedorNome: "Fornecedor X" }), "SHARE BRASIL");
  assert.equal(resolverFornecedorSolicitacao({ isViagemMode: false, fornecedorNome: "Fornecedor X" }), "Fornecedor X");
});

test("resolverCategoriaMovimentacaoShare usa subcategoria e grupo reembolsável para despesa do caixa Share", () => {
  assert.deepEqual(resolverCategoriaMovimentacaoShare({ nomeCategoria: "SEGUROS", subcategoria: "SEGURO CASCO", reembolsavel: true }), {
    nome: "SEGURO CASCO",
    grupo_categoria: "DESPESAS REEMBOLSÁVEIS",
    reembolsavel: true,
    tipo: "despesa",
  });
  assert.deepEqual(resolverCategoriaMovimentacaoShare({ nomeCategoria: "SEGUROS", reembolsavel: false }), {
    nome: "SEGUROS",
    grupo_categoria: "DESPESAS",
    reembolsavel: false,
    tipo: "despesa",
  });
});

test("resolverSubcategoriaSelecionadaParaPayload preserva valor válido", () => {
  assert.equal(resolverSubcategoriaSelecionadaParaPayload({ subcategoriaSelecionada: "Hotel" }), "Hotel");
  assert.equal(resolverSubcategoriaSelecionadaParaPayload({ subcategoriaSelecionada: "TARIFA DE NAVEGAÇÃO AEREA - DECEA", subcategoria1: "TARIFA INFRAERO", subcategoria2: "TARIFA DE NAVEGAÇÃO AEREA - DECEA" }), "TARIFA DE NAVEGAÇÃO AEREA - DECEA");
  assert.equal(resolverSubcategoriaSelecionadaParaPayload({ subcategoriaSelecionada: "   " }), null);
});

test("findExistingFuelReference encontra correspondências fortes e médias", () => {
  const mockAbastecimentos = [
    { id: "abast-1", id_clientes: "client-1", valor_total: 1250.0, data: "2024-01-15", nf: "12345" },
    { id: "abast-2", id_clientes: "client-1", valor_total: 850.5, data: "2024-01-20", nf: "12346" },
    { id: "abast-3", id_clientes: "client-2", valor_total: 1250.0, data: "2024-01-15", nf: "12347" },
  ];

  assert.equal(findExistingFuelReference({ clienteId: "client-1", valor: 1250.0, data: "2024-01-15", numeroNf: "" }, mockAbastecimentos)?.id, "abast-1");
  assert.equal(findExistingFuelReference({ clienteId: "client-1", valor: 850.5, data: undefined, numeroNf: "12346" }, mockAbastecimentos)?.id, "abast-2");
  assert.equal(findExistingFuelReference({ clienteId: "client-1", valor: 1250.0, data: undefined, numeroNf: "" }, mockAbastecimentos)?.id, "abast-1");
  assert.equal(findExistingFuelReference({ clienteId: "client-99", valor: 1250.0, data: "2024-01-15", numeroNf: "" }, mockAbastecimentos), null);
});

test("findExistingTravelExpenseReference e ReceiptReference detectam repetições", () => {
  const mockTravel = [{ id: "travel-1", clientes_id: "client-1", total_valor: 5000, despesas: [{ description: "Hotel" }], pago_em: "2024-01-20" }];
  const mockReceipt = [{ id: "rec-1", cliente_id: "client-1", valor_total: 2500, numero_recibo: "R-2024-001", numero: "R-2024-001" }];

  assert.equal(findExistingTravelExpenseReference({ clienteId: "client-1", valor: 5000, descricao: "Hotel" }, mockTravel)?.id, "travel-1");
  assert.equal(findExistingReceiptReference({ clienteId: "client-1", valor: 2500, numeroRecibo: "R-2024-001" }, mockReceipt)?.id, "rec-1");
});

