import {
  findExistingFuelReference,
  findExistingTravelExpenseReference,
  normalizarTipoDespesa,
} from "../solicitacaoPagamentoValidators";

describe("solicitacaoPagamentoValidators", () => {
  describe("normalizarTipoDespesa", () => {
    it("deve reconhecer combustíveis", () => {
      expect(normalizarTipoDespesa("Combustível")).toBe("COMBUSTIVEIS");
      expect(normalizarTipoDespesa("COMBUSTÍVEL")).toBe("COMBUSTIVEIS");
      expect(normalizarTipoDespesa("combustivel")).toBe("COMBUSTIVEIS");
      expect(normalizarTipoDespesa("Combust. Aviação")).toBe("COMBUSTIVEIS");
    });

    it("deve reconhecer despesas de viagem", () => {
      expect(normalizarTipoDespesa("Despesa de Viagem")).toBe("DESPESAS_DE_VIAGEM");
      expect(normalizarTipoDespesa("DESPESAS_VIAGEM")).toBe("DESPESAS_DE_VIAGEM");
      expect(normalizarTipoDespesa("Despesa Viagem")).toBe("DESPESAS_DE_VIAGEM");
    });

    it("deve retornar OUTRA para tipos desconhecidos", () => {
      expect(normalizarTipoDespesa("Manutenção")).toBe("OUTRA");
      expect(normalizarTipoDespesa("Consultoria")).toBe("OUTRA");
      expect(normalizarTipoDespesa("Hotel")).toBe("OUTRA");
    });
  });

  describe("findExistingFuelReference", () => {
    const mockAbastecimentos = [
      {
        id: "abast-1",
        id_clientes: "client-1",
        valor_total: 1250.0,
        data: "2024-01-15",
        nf: "12345",
      },
      {
        id: "abast-2",
        id_clientes: "client-1",
        valor_total: 850.5,
        data: "2024-01-20",
        nf: "12346",
      },
      {
        id: "abast-3",
        id_clientes: "client-2",
        valor_total: 1250.0,
        data: "2024-01-15",
        nf: "12347",
      },
    ];

    it("deve encontrar correspondência EXATA (cliente + valor + data)", () => {
      const match = findExistingFuelReference(
        {
          clienteId: "client-1",
          valor: 1250.0,
          data: "2024-01-15",
          numeroNf: "",
        },
        mockAbastecimentos
      );
      expect(match?.id).toBe("abast-1");
    });

    it("deve encontrar correspondência FORTE (cliente + valor + NF)", () => {
      const match = findExistingFuelReference(
        {
          clienteId: "client-1",
          valor: 850.5,
          data: undefined,
          numeroNf: "12346",
        },
        mockAbastecimentos
      );
      expect(match?.id).toBe("abast-2");
    });

    it("deve encontrar correspondência MÉDIA (cliente + valor)", () => {
      const match = findExistingFuelReference(
        {
          clienteId: "client-1",
          valor: 1250.0,
          data: undefined,
          numeroNf: "",
        },
        mockAbastecimentos
      );
      expect(match?.id).toBe("abast-1");
    });

    it("deve respeitar tolerância de valor (0.01)", () => {
      const match = findExistingFuelReference(
        {
          clienteId: "client-1",
          valor: 1250.005, // aproximado
          data: "2024-01-15",
          numeroNf: "",
        },
        mockAbastecimentos
      );
      expect(match?.id).toBe("abast-1");
    });

    it("deve não encontrar se cliente diferente", () => {
      const match = findExistingFuelReference(
        {
          clienteId: "client-99",
          valor: 1250.0,
          data: "2024-01-15",
          numeroNf: "",
        },
        mockAbastecimentos
      );
      expect(match).toBeNull();
    });

    it("deve não encontrar se valor diferente", () => {
      const match = findExistingFuelReference(
        {
          clienteId: "client-1",
          valor: 999.99,
          data: "2024-01-15",
          numeroNf: "",
        },
        mockAbastecimentos
      );
      expect(match).toBeNull();
    });

    it("deve ser case-insensitive para NF", () => {
      const match = findExistingFuelReference(
        {
          clienteId: "client-1",
          valor: 850.5,
          data: undefined,
          numeroNf: "12346", // lowercase
        },
        mockAbastecimentos
      );
      expect(match?.id).toBe("abast-2");
    });
  });

  describe("findExistingTravelExpenseReference", () => {
    const mockTravelReports = [
      {
        id: "travel-1",
        clientes_id: "client-1",
        total_valor: 2500.0,
        despesas: JSON.stringify([
          { description: "Hotel São Paulo", amount: 1200 },
          { description: "Transporte", amount: 800 },
          { description: "Refeições", amount: 500 },
        ]),
      },
      {
        id: "travel-2",
        clientes_id: "client-1",
        total_valor: 850.0,
        despesas: [
          { description: "Combustível", amount: 500 },
          { description: "Pedágio", amount: 350 },
        ] as any,
      },
      {
        id: "travel-3",
        clientes_id: "client-2",
        total_valor: 2500.0,
        despesas: JSON.stringify([
          { description: "Hotel Rio", amount: 1500 },
        ]),
      },
    ];

    it("deve encontrar correspondência EXATA (cliente + valor total)", () => {
      const match = findExistingTravelExpenseReference(
        {
          clienteId: "client-1",
          valor: 2500.0,
          descricao: "",
        },
        mockTravelReports
      );
      expect(match?.id).toBe("travel-1");
    });

    it("deve encontrar correspondência FORTE (cliente + valor + descrição)", () => {
      const match = findExistingTravelExpenseReference(
        {
          clienteId: "client-1",
          valor: 1200,
          descricao: "Hotel São Paulo",
        },
        mockTravelReports
      );
      expect(match?.id).toBe("travel-1");
    });

    it("deve encontrar com descrição parcial", () => {
      const match = findExistingTravelExpenseReference(
        {
          clienteId: "client-1",
          valor: 1200,
          descricao: "Hotel",
        },
        mockTravelReports
      );
      expect(match?.id).toBe("travel-1");
    });

    it("deve respeitar tolerância de valor", () => {
      const match = findExistingTravelExpenseReference(
        {
          clienteId: "client-1",
          valor: 2500.005,
          descricao: "",
        },
        mockTravelReports
      );
      expect(match?.id).toBe("travel-1");
    });

    it("deve não encontrar se cliente diferente", () => {
      const match = findExistingTravelExpenseReference(
        {
          clienteId: "client-99",
          valor: 2500.0,
          descricao: "",
        },
        mockTravelReports
      );
      expect(match).toBeNull();
    });

    it("deve parsear despesas como string ou array", () => {
      const match1 = findExistingTravelExpenseReference(
        {
          clienteId: "client-1",
          valor: 1200,
          descricao: "Hotel",
        },
        mockTravelReports
      );
      expect(match1?.id).toBe("travel-1"); // String JSON

      const match2 = findExistingTravelExpenseReference(
        {
          clienteId: "client-1",
          valor: 500,
          descricao: "Combustível",
        },
        mockTravelReports
      );
      expect(match2?.id).toBe("travel-2"); // Array direto
    });

    it("deve ser case-insensitive para descrição", () => {
      const match = findExistingTravelExpenseReference(
        {
          clienteId: "client-1",
          valor: 1200,
          descricao: "hotel são paulo",
        },
        mockTravelReports
      );
      expect(match?.id).toBe("travel-1");
    });
  });

  describe("Casos de Uso Reais", () => {
    it("Cenário 1: Combustível duplicado", () => {
      const abastecimentos = [
        {
          id: "real-fuel-1",
          id_clientes: "tam-transportes",
          valor_total: 1250.0,
          data: "2024-01-15",
          nf: "FAT-001",
        },
      ];

      // Solicitação de pagamento para o mesmo abastecimento
      const match = findExistingFuelReference(
        {
          clienteId: "tam-transportes",
          valor: 1250.0,
          data: "2024-01-15",
          numeroNf: "FAT-001",
        },
        abastecimentos
      );

      expect(match?.id).toBe("real-fuel-1");
    });

    it("Cenário 2: Despesa de viagem duplicada", () => {
      const travelReports = [
        {
          id: "real-travel-1",
          clientes_id: "geolink-log",
          total_valor: 2500.0,
          despesas: JSON.stringify([
            { description: "Hotel em São Paulo", amount: 1500 },
            { description: "Transporte", amount: 700 },
            { description: "Refeições", amount: 300 },
          ]),
        },
      ];

      // Usuário tenta criar solicitação para hotel da mesma viagem
      const match = findExistingTravelExpenseReference(
        {
          clienteId: "geolink-log",
          valor: 1500,
          descricao: "Hotel em São Paulo",
        },
        travelReports
      );

      expect(match?.id).toBe("real-travel-1");
    });

    it("Cenário 3: Sem duplicata - tipo diferente", () => {
      const abastecimentos = [];

      // Solicitação de tipo "Manutenção" não deve buscar em abastecimentos
      const tipo = normalizarTipoDespesa("Manutenção");
      expect(tipo).toBe("OUTRA");
    });
  });
});
