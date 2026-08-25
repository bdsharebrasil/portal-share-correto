import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { getSelectedTravelAllocation } from "./travelReportSelection";

describe("travel report selection", () => {
  test("does not auto-abate when no report is selected", () => {
    const reports = [
      { id: "r1", saldo: 120, numero_relatorio: "REL-001" },
      { id: "r2", saldo: 80, numero_relatorio: "REL-002" },
    ];

    const result = getSelectedTravelAllocation(reports, "", 100);

    assert.deepEqual(result.alocacoes, []);
    assert.equal(result.reason, "Selecione o relatório de viagem para confirmar o abatimento.");
  });

  test("allocates only the selected report when the user picks one", () => {
    const reports = [
      { id: "r1", saldo: 120, numero_relatorio: "REL-001" },
      { id: "r2", saldo: 80, numero_relatorio: "REL-002" },
    ];

    const result = getSelectedTravelAllocation(reports, "r2", 100);

    assert.equal(result.selected?.id, "r2");
    assert.equal(result.alocacoes.length, 1);
    assert.equal(result.alocacoes[0].alocado, 80);
    assert.equal(result.totalAlocado, 80);
    assert.equal(result.sobra, 20);
  });
});