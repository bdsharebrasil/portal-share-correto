// @ts-nocheck
import test from "node:test";
import assert from "node:assert/strict";
import { buildCotistaOptions, normalizeTextForMatching, expandSpecialRateioLine, CotistaOption } from "./demonstrativoUtils";
import { montarLinhasRateio, montarLinhasRateioMultiCliente } from "../solicitacaoPagamentoValidators";

test("inclui sócios de clientes com sócios e preserva o cliente pai", () => {
  const clientes = [
    {
      id_clientes: "cliente-1",
      percentual_sociedade: 60,
      clientes: {
        id: "cliente-1",
        razao_social: "Empresa ABC",
        cnpj: "12.345.678/0001-99",
        endereco: "Rua A",
        cidade: "São Paulo",
        uf: "SP",
      },
    },
  ];

  const socios = [
    {
      id: "socio-1",
      nome: "João da Silva",
      cpf: "123.456.789-00",
      cliente_id: "cliente-1",
    },
  ];

  const options = buildCotistaOptions(clientes as Array<Parameters<typeof buildCotistaOptions>[0][number]>, socios as Array<Parameters<typeof buildCotistaOptions>[1][number]>);

  assert.equal(options.length, 2);
  assert.ok(options.some((option) => option.nome === "Empresa ABC"));
  assert.ok(options.some((option) => option.nome === "João da Silva"));
  assert.equal(options.find((option) => option.nome === "João da Silva")?.cliente_id, "cliente-1");
});

test("normaliza nomes para comparação robusta", () => {
  assert.equal(normalizeTextForMatching("João da Silva"), "joao da silva");
  assert.equal(normalizeTextForMatching("JOAO-DA-SILVA"), "joao da silva");
});

test("expande linhas especiais para sócios com rateio igualitário", () => {
  const socios: CotistaOption[] = [
    { id: "s1", cliente_id: "c1", socio_id: "s1", nome: "Socio 1", documento: null, endereco: null, cidade: null, uf: null, percentual: 50 },
    { id: "s2", cliente_id: "c2", socio_id: "s2", nome: "Socio 2", documento: null, endereco: null, cidade: null, uf: null, percentual: 50 },
  ];

  const linha = { data: "01/01/2024", valor: 101.0, cotistaNome: "VOO TRANSLADO" };
  const expanded = expandSpecialRateioLine(linha, socios);

  assert.equal(expanded.length, 2);
  assert.equal(expanded[0].cotistaNome, "Socio 1");
  assert.equal(expanded[1].cotistaNome, "Socio 2");
  assert.equal(expanded[0].valor, 50.5);
  assert.equal(expanded[1].valor, 50.5);
});

test("expande voo de teste com divisao_igual entre clientes", () => {
  const clientes: CotistaOption[] = [
    { id: "c1", cliente_id: "c1", socio_id: null, nome: "Cliente A", documento: null, endereco: null, cidade: null, uf: null, percentual: 50 },
    { id: "c2", cliente_id: "c2", socio_id: null, nome: "Cliente B", documento: null, endereco: null, cidade: null, uf: null, percentual: 50 },
    { id: "c3", cliente_id: "c3", socio_id: null, nome: "Cliente C", documento: null, endereco: null, cidade: null, uf: null, percentual: 50 },
  ];

  const linha = { data: "01/01/2024", valor: 300.0, cotistaNome: "VOO TESTE" };
  const expanded = expandSpecialRateioLine(linha, clientes);

  assert.equal(expanded.length, 3);
  assert.deepEqual(expanded.map((item) => item.cotistaNome), ["Cliente A", "Cliente B", "Cliente C"]);
  assert.equal(expanded[0].valor, 100);
  assert.equal(expanded[1].valor, 100);
  assert.equal(expanded[2].valor, 100);
});

test("rateio de pagamento respeita divisão igual quando a despesa é de voo teste", () => {
  const linhas = montarLinhasRateio({
    valorTotal: 100,
    percentualUso: 100,
    socios: [
      { id: "s1", nome: "Sócio 1", percentual_participacao: 70 },
      { id: "s2", nome: "Sócio 2", percentual_participacao: 30 },
    ],
    socioSelecionadoId: null,
    equalSplit: true,
  });

  assert.deepEqual(linhas.map((linha) => linha.valor_rateado), [50, 50]);
  assert.deepEqual(linhas.map((linha) => linha.percentual_uso), [50, 50]);

  const multiCliente = montarLinhasRateioMultiCliente({
    valorTotal: 300,
    equalSplit: true,
    linhas: [
      {
        clienteId: "c1",
        clienteNome: "Cliente A",
        percentualUsoCliente: 60,
        socios: [
          { id: "s1", nome: "Sócio 1", percentual_participacao: 60 },
          { id: "s2", nome: "Sócio 2", percentual_participacao: 40 },
        ],
      },
      {
        clienteId: "c2",
        clienteNome: "Cliente B",
        percentualUsoCliente: 40,
        socios: [
          { id: "s3", nome: "Sócio 3", percentual_participacao: 50 },
          { id: "s4", nome: "Sócio 4", percentual_participacao: 50 },
        ],
      },
    ],
  });

  assert.deepEqual(multiCliente.map((linha) => linha.valor_rateado).sort((a, b) => a - b), [75, 75, 75, 75]);
  assert.deepEqual(multiCliente.map((linha) => linha.percentual_uso).sort((a, b) => a - b), [25, 25, 25, 25]);
});
