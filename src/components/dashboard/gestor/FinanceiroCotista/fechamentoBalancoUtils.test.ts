import test from "node:test";
import assert from "node:assert/strict";
import { findCotistaIdForRecord, resolveCategoriaLabel } from "./fechamentoBalancoUtils";

test("resolveCategoriaLabel retorna o nome legível quando há mapeamento para o UUID", () => {
  const categoriasPorId = new Map<string, string>([["uuid-123", "Combustível"]]);

  assert.equal(resolveCategoriaLabel("uuid-123", categoriasPorId), "Combustível");
});

test("resolveCategoriaLabel preserva o texto quando não há mapeamento", () => {
  assert.equal(resolveCategoriaLabel("Manutenção", new Map()), "Manutenção");
});

test("resolveCategoriaLabel retorna traço para valor vazio", () => {
  assert.equal(resolveCategoriaLabel(null, new Map()), "—");
});

test("findCotistaIdForRecord encontra o cotista usando aliases de cliente/sócio", () => {
  const cotistas = [{ id: "cotista-1", clienteId: "cliente-10" }];
  const record = { clientes_id: "cliente-10" };

  assert.equal(findCotistaIdForRecord(cotistas, record), "cotista-1");
});
