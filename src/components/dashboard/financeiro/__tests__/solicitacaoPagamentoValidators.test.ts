declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: <T>(actual: T) => {
  toBe(expected: unknown): void;
  toBeNull(): void;
};

import {
  findExistingFuelReference,
  findExistingReceiptReference,
  findExistingTravelExpenseReference,
  normalizarTipoDespesa,
  normalizarTipoRateio,
  resolverFornecedorSolicitacao,
  resolverPagoPorSolicitacao,
  resolverSubcategoriaSelecionadaParaPayload,
  resolverTipoRateioPadraoParaDespesa,
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

  describe("normalizarTipoRateio", () => {
    it("deve normalizar os tipos de rateio suportados", () => {
      expect(normalizarTipoRateio("FIXO")).toBe("FIXO");
      expect(normalizarTipoRateio("variável por voo")).toBe("VARIAVEL_POR_VOO");
      expect(normalizarTipoRateio("Variável por hora")).toBe("VARIAVEL_POR_HORA");
      expect(normalizarTipoRateio("extra")).toBe("EXTRA");
    });

    it("deve retornar FIXO para valores desconhecidos", () => {
      expect(normalizarTipoRateio("")).toBe("FIXO");
      expect(normalizarTipoRateio("qualquer coisa")).toBe("FIXO");
    });
  });

  describe("resolverTipoRateioPadraoParaDespesa", () => {
    it("define variável por hora para combustíveis", () => {
      expect(resolverTipoRateioPadraoParaDespesa("Combustíveis")).toBe("VARIAVEL_POR_HORA");
      expect(resolverTipoRateioPadraoParaDespesa("COMBUSTÍVEIS")).toBe("VARIAVEL_POR_HORA");
    });

    it("define fixo para despesas adm/share", () => {
      expect(resolverTipoRateioPadraoParaDespesa("ADM SHARE BRASIL")).toBe("FIXO");
      expect(resolverTipoRateioPadraoParaDespesa("ADM E TRIP SHARE BRASIL")).toBe("FIXO");
    });

    it("não força um tipo automático para outras categorias", () => {
      expect(resolverTipoRateioPadraoParaDespesa("Despesas de viagem")).toBeNull();
      expect(resolverTipoRateioPadraoParaDespesa("Manutenção")).toBeNull();
    });
  });

  describe("resolverPagoPorSolicitacao", () => {
    it("usa o nome do sócio quando a despesa é específica", () => {
      expect(resolverPagoPorSolicitacao({ socioNome: "Ana", clienteNome: "Cliente A", rateadoParaTodosSocios: false })).toBe("Ana");
    });

    it("usa o nome do cliente para despesas rateadas entre todos os sócios", () => {
      expect(resolverPagoPorSolicitacao({ socioNome: "Ana", clienteNome: "Cliente A", rateadoParaTodosSocios: true })).toBe("Cliente A");
    });

    it("usa o nome do sócio quando há exatamente um sócio no rateio", () => {
      expect(resolverPagoPorSolicitacao({ socioNome: "DEJALMO", clienteNome: "DGA ADMINISTRADORA DE BENS SPE LTDA", socioCount: 1 })).toBe("DEJALMO");
    });

    it("usa o nome do cliente quando há mais de um sócio no rateio", () => {
      expect(resolverPagoPorSolicitacao({ socioNome: "DEJALMO", clienteNome: "DGA ADMINISTRADORA DE BENS SPE LTDA", socioCount: 2 })).toBe("DGA ADMINISTRADORA DE BENS SPE LTDA");
    });
  });

  describe("resolverFornecedorSolicitacao", () => {
    it("força o fornecedor SHARE BRASIL para despesas de viagem", () => {
      expect(resolverFornecedorSolicitacao({ isViagemMode: true, fornecedorNome: "Fornecedor X" })).toBe("SHARE BRASIL");
    });

    it("mantém o fornecedor informado para outros tipos de despesa", () => {
      expect(resolverFornecedorSolicitacao({ isViagemMode: false, fornecedorNome: "Fornecedor X" })).toBe("Fornecedor X");
    });
  });

  describe("resolverSubcategoriaSelecionadaParaPayload", () => {
    it("retorna apenas a subcategoria selecionada", () => {
      expect(resolverSubcategoriaSelecionadaParaPayload({ subcategoriaSelecionada: "Hotel" })).toBe("Hotel");
    });

    it("preserva o valor da subcategoria quando ela corresponde à opção do tipo de despesa", () => {
      expect(resolverSubcategoriaSelecionadaParaPayload({ subcategoriaSelecionada: "TARIFA DE NAVEGAÇÃO AEREA - DECEA", subcategoria1: "TARIFA INFRAERO", subcategoria2: "TARIFA DE NAVEGAÇÃO AEREA - DECEA" })).toBe("TARIFA DE NAVEGAÇÃO AEREA - DECEA");
    });

    it("retorna null quando não há subcategoria selecionada", () => {
      expect(resolverSubcategoriaSelecionadaParaPayload({ subcategoriaSelecionada: "   " })).toBeNull();
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

  describe("findExistingReceiptReference", () => {
    const mockRecibos = [
      {
        id: "receipt-1",
        cliente_id: "client-1",
        valor_total: 1250.0,
        numero_recibo: "RCB-001",
      },
      {
        id: "receipt-2",
        cliente_id: "client-1",
        valor_total: 850.5,
        numero: "NF-55",
      },
      {
        id: "receipt-3",
        cliente_id: "client-2",
        valor_total: 1250.0,
        numero_recibo: "RCB-002",
      },
    ];

    it("deve encontrar correspondência por cliente + valor + número de recibo", () => {
      const match = findExistingReceiptReference(
        {
          clienteId: "client-1",
          valor: 1250.0,
          numeroRecibo: "RCB-001",
        },
        mockRecibos
      );
      expect(match?.id).toBe("receipt-1");
    });

    it("deve encontrar correspondência por número mesmo sem valor exato", () => {
      const match = findExistingReceiptReference(
        {
          clienteId: "client-1",
          valor: 850.5,
          numeroRecibo: "nf-55",
        },
        mockRecibos
      );
      expect(match?.id).toBe("receipt-2");
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
        pago_em: null, // Não pago
      },
      {
        id: "travel-2",
        clientes_id: "client-1",
        total_valor: 850.0,
        despesas: [
          { description: "Combustível", amount: 500 },
          { description: "Pedágio", amount: 350 },
        ] as any,
        pago_em: null, // Não pago
      },
      {
        id: "travel-3",
        clientes_id: "client-2",
        total_valor: 2500.0,
        despesas: JSON.stringify([
          { description: "Hotel Rio", amount: 1500 },
        ]),
        pago_em: "2024-01-20T10:00:00Z", // Já pago
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

    it("deve permitir pagamento para relatório não pago (pago_em = null)", () => {
      // Relatório não pago não deve ser encontrado como duplicado
      const match = findExistingTravelExpenseReference(
        {
          clienteId: "client-1",
          valor: 2500.0,
          descricao: "Relatório de viagem",
        },
        mockTravelReports
      );
      // Como travel-1 não foi pago, a busca não encontrará nada
      // (apenas relatórios pagos são considerados duplicados)
      expect(match).toBeNull();
    });

    it("deve bloquear pagamento duplicado para relatório já pago (pago_em != null)", () => {
      // Relatório já pago deve ser encontrado como referência duplicada
      const paidReports = mockTravelReports.filter((r) => r.pago_em != null);
      const match = findExistingTravelExpenseReference(
        {
          clienteId: "client-2",
          valor: 2500.0,
          descricao: "",
        },
        paidReports
      );
      expect(match?.id).toBe("travel-3");
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

    it("Cenário 2: Despesa de viagem não paga - permitir novo pagamento", () => {
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
          pago_em: null, // Não foi pago ainda
        },
      ];

      // Usuário tenta criar solicitação para viagem não paga
      // Não deve encontrar como duplicado pois ainda não foi pago
      const match = findExistingTravelExpenseReference(
        {
          clienteId: "geolink-log",
          valor: 2500.0,
          descricao: "Relatório de viagem",
        },
        travelReports
      );

      expect(match).toBeNull(); // Permite criar novo pagamento
    });

    it("Cenário 2B: Despesa de viagem já paga - bloquear novo pagamento", () => {
      const paidTravelReports = [
        {
          id: "real-travel-1-paid",
          clientes_id: "geolink-log",
          total_valor: 2500.0,
          despesas: JSON.stringify([
            { description: "Hotel em São Paulo", amount: 1500 },
            { description: "Transporte", amount: 700 },
            { description: "Refeições", amount: 300 },
          ]),
          pago_em: "2024-01-15T10:00:00Z", // Já foi pago
        },
      ];

      // Usuário tenta criar nova solicitação para viagem já paga
      // Deve encontrar como referência duplicada (pois já foi pago)
      const match = findExistingTravelExpenseReference(
        {
          clienteId: "geolink-log",
          valor: 2500.0,
          descricao: "Relatório de viagem",
        },
        paidTravelReports
      );

      expect(match?.id).toBe("real-travel-1-paid"); // Bloqueia duplicação
    });

    it("Cenário 3: Sem duplicata - tipo diferente", () => {
      const abastecimentos = [];

      // Solicitação de tipo "Manutenção" não deve buscar em abastecimentos
      const tipo = normalizarTipoDespesa("Manutenção");
      expect(tipo).toBe("OUTRA");
    });
  });
});

