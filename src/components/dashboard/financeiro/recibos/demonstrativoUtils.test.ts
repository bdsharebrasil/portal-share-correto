// @ts-nocheck
import test from "node:test";
import assert from "node:assert/strict";
import { buildCotistaOptions, normalizeTextForMatching, expandSpecialRateioLine, CotistaOption } from "./demonstrativoUtils";

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
