import test from "node:test";
import assert from "node:assert/strict";
import { filtrarSociosParaRateio, montarLinhasRateio, montarLinhasRateioMultiCliente, resolverClienteParaRateio } from "../solicitacaoPagamentoValidators";

test("divide igualmente o rateio entre todos os sócios quando a seleção é 'todos'", () => {
  const linhas = montarLinhasRateio({
    valorTotal: 75,
    percentualUso: 100,
    socios: [
      { id: "s1", nome: "DEJALMO", percentual_participacao: 33.33 },
      { id: "s2", nome: "GUAVIRA", percentual_participacao: 33.33 },
      { id: "s3", nome: "ARMANDO", percentual_participacao: 33.33 },
    ],
    socioSelecionadoId: null,
  });

  assert.equal(linhas.length, 3);
  assert.deepEqual(linhas.map((linha) => linha.percentual_uso), [33.33, 33.33, 33.33]);
  assert.deepEqual(linhas.map((linha) => linha.valor_rateado), [25, 25, 25]);
  assert.equal(linhas[0].socio_nome, "DEJALMO");
});

test("retorna uma única linha quando um sócio específico é selecionado", () => {
  const linhas = montarLinhasRateio({
    valorTotal: 75,
    percentualUso: 100,
    socios: [
      { id: "s1", nome: "DEJALMO", percentual_participacao: 100 },
      { id: "s2", nome: "GUAVIRA", percentual_participacao: 0 },
    ],
    socioSelecionadoId: "s1",
  });

  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].socio_id, "s1");
  assert.equal(linhas[0].percentual_uso, 100);
  assert.equal(linhas[0].valor_rateado, 75);
});

test("filtra para o único sócio selecionado quando houver um filtro explícito", () => {
  const sociosFiltrados = filtrarSociosParaRateio({
    socios: [
      { id: "s1", nome: "DEJALMO", percentual_participacao: 50 },
      { id: "s2", nome: "GUAVIRA", percentual_participacao: 50 },
    ],
    socioSelecionadoId: "s2",
  });

  assert.deepEqual(sociosFiltrados.map((socio) => socio.id), ["s2"]);
  assert.equal(sociosFiltrados[0].nome, "GUAVIRA");
});

test("preserva valor e percentual ajustados manualmente no rateio", () => {
  const linhas = montarLinhasRateioMultiCliente({
    valorTotal: 1_000,
    linhas: [{
      clienteId: "c1",
      clienteNome: "Cliente 1",
      percentualUsoCliente: 100,
      socios: [
        { id: "s1", nome: "Sócio 1", percentual_participacao: 50 },
        { id: "s2", nome: "Sócio 2", percentual_participacao: 50 },
      ],
      overridesSocio: { s1: 37.25 },
      valorOverridesSocio: { s1: 400 },
    }],
  });

  assert.equal(linhas[0].percentual_uso, 37.25);
  assert.equal(linhas[0].valor_rateado, 400);
});

test("inferencia o cliente a partir do sócio selecionado quando o cliente não foi escolhido", () => {
  const clienteId = resolverClienteParaRateio({
    clienteId: "",
    socioId: "s2",
    clientesDaAeronave: [
      { clienteId: "c1", socios: [{ id: "s1" }] },
      { clienteId: "c2", socios: [{ id: "s2" }] },
    ],
  });

  assert.equal(clienteId, "c2");
});
