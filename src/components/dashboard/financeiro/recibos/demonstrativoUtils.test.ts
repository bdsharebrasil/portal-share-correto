import test from "node:test";
import assert from "node:assert/strict";
import { buildCotistaOptions, normalizeTextForMatching } from "./demonstrativoUtils";

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
