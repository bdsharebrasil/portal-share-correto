export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      abastecimentos: {
        Row: {
          abastecedor: string | null
          abastecedor_id: string | null
          abastecimento_galoes: number | null
          aeronave_id: string | null
          banco: string | null
          boleto_url: string | null
          comanda: string | null
          comanda_url: string | null
          comprovante_pagamento: string | null
          comprovante_url: string | null
          created_at: string | null
          criado_por: string | null
          data: string
          data_pagamento: string | null
          data_vencimento_boleto: string | null
          descricao: string | null
          forma_pagamento: string | null
          id: string
          id_clientes: string | null
          litros: number
          local: string
          logbook_entry_id: string | null
          nf: string | null
          nota_url: string | null
          observacao: string | null
          prazo: string | null
          socio_nome: string | null
          status: string | null
          tipo_combustivel: string | null
          tipo_faturamento: string | null
          trecho: string
          updated_at: string | null
          valor_total: number | null
          valor_unitario: number
        }
        Insert: {
          abastecedor?: string | null
          abastecedor_id?: string | null
          abastecimento_galoes?: number | null
          aeronave_id?: string | null
          banco?: string | null
          boleto_url?: string | null
          comanda?: string | null
          comanda_url?: string | null
          comprovante_pagamento?: string | null
          comprovante_url?: string | null
          created_at?: string | null
          criado_por?: string | null
          data: string
          data_pagamento?: string | null
          data_vencimento_boleto?: string | null
          descricao?: string | null
          forma_pagamento?: string | null
          id?: string
          id_clientes?: string | null
          litros?: number
          local: string
          logbook_entry_id?: string | null
          nf?: string | null
          nota_url?: string | null
          observacao?: string | null
          prazo?: string | null
          socio_nome?: string | null
          status?: string | null
          tipo_combustivel?: string | null
          tipo_faturamento?: string | null
          trecho: string
          updated_at?: string | null
          valor_total?: number | null
          valor_unitario?: number
        }
        Update: {
          abastecedor?: string | null
          abastecedor_id?: string | null
          abastecimento_galoes?: number | null
          aeronave_id?: string | null
          banco?: string | null
          boleto_url?: string | null
          comanda?: string | null
          comanda_url?: string | null
          comprovante_pagamento?: string | null
          comprovante_url?: string | null
          created_at?: string | null
          criado_por?: string | null
          data?: string
          data_pagamento?: string | null
          data_vencimento_boleto?: string | null
          descricao?: string | null
          forma_pagamento?: string | null
          id?: string
          id_clientes?: string | null
          litros?: number
          local?: string
          logbook_entry_id?: string | null
          nf?: string | null
          nota_url?: string | null
          observacao?: string | null
          prazo?: string | null
          socio_nome?: string | null
          status?: string | null
          tipo_combustivel?: string | null
          tipo_faturamento?: string | null
          trecho?: string
          updated_at?: string | null
          valor_total?: number | null
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "abastecimentos_abastecedor_id_fkey"
            columns: ["abastecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores_combustivel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abastecimentos_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abastecimentos_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abastecimentos_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "abastecimentos_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "abastecimentos_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "abastecimentos_id_clientes_fkey"
            columns: ["id_clientes"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abastecimentos_id_clientes_fkey"
            columns: ["id_clientes"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "abastecimentos_id_clientes_fkey"
            columns: ["id_clientes"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "abastecimentos_logbook_entry_id_fkey"
            columns: ["logbook_entry_id"]
            isOneToOne: false
            referencedRelation: "historico_voo_tripulante"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abastecimentos_logbook_entry_id_fkey"
            columns: ["logbook_entry_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_diario_bordo"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts_receivable: {
        Row: {
          amount: number
          created_at: string | null
          due_date: string
          id: string
          invoice_id: string
          notes: string | null
          payment_date: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          due_date: string
          id?: string
          invoice_id: string
          notes?: string | null
          payment_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          due_date?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_receivable_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      aerodromes: {
        Row: {
          coordenadas: string | null
          created_at: string | null
          designativo: string
          id: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          coordenadas?: string | null
          created_at?: string | null
          designativo: string
          id?: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          coordenadas?: string | null
          created_at?: string | null
          designativo?: string
          id?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      aeronave: {
        Row: {
          ano: string | null
          atualizado_em: string | null
          base: string | null
          consumo_combustivel: number | null
          criado_em: string | null
          data_ultima_revisao: string | null
          fabricante: string
          horas_celula_atual: number | null
          horas_ultima_revisao: number | null
          id: string
          matricula: string
          modelo: string
          modo_celula: string | null
          nome_proprietario: string
          numero_serie: string
          preco_hora: string | null
          proxima_revisao_data: string | null
          proxima_revisao_horas: number | null
          status: string
          tipo_aeronave: string | null
          tipo_ultima_revisao: string | null
          url_imagem: string | null
          velocidade_cruzeiro: string | null
        }
        Insert: {
          ano?: string | null
          atualizado_em?: string | null
          base?: string | null
          consumo_combustivel?: number | null
          criado_em?: string | null
          data_ultima_revisao?: string | null
          fabricante: string
          horas_celula_atual?: number | null
          horas_ultima_revisao?: number | null
          id?: string
          matricula: string
          modelo: string
          modo_celula?: string | null
          nome_proprietario: string
          numero_serie: string
          preco_hora?: string | null
          proxima_revisao_data?: string | null
          proxima_revisao_horas?: number | null
          status?: string
          tipo_aeronave?: string | null
          tipo_ultima_revisao?: string | null
          url_imagem?: string | null
          velocidade_cruzeiro?: string | null
        }
        Update: {
          ano?: string | null
          atualizado_em?: string | null
          base?: string | null
          consumo_combustivel?: number | null
          criado_em?: string | null
          data_ultima_revisao?: string | null
          fabricante?: string
          horas_celula_atual?: number | null
          horas_ultima_revisao?: number | null
          id?: string
          matricula?: string
          modelo?: string
          modo_celula?: string | null
          nome_proprietario?: string
          numero_serie?: string
          preco_hora?: string | null
          proxima_revisao_data?: string | null
          proxima_revisao_horas?: number | null
          status?: string
          tipo_aeronave?: string | null
          tipo_ultima_revisao?: string | null
          url_imagem?: string | null
          velocidade_cruzeiro?: string | null
        }
        Relationships: []
      }
      agendamento_pagamentos: {
        Row: {
          atualizado_por: string | null
          categoria: string | null
          criado_por: string
          criar_conta_a_pagar_automatica: boolean | null
          data_agendamento: string
          data_atualizacao: string | null
          data_criacao: string | null
          descricao: string
          dia_recorrencia: number | null
          eh_recorrente: boolean | null
          fornecedor: string
          frequencia_recorrencia: string | null
          id: string
          lembrete_antecipado: boolean | null
          notas: string | null
          status: string | null
          valor: number
        }
        Insert: {
          atualizado_por?: string | null
          categoria?: string | null
          criado_por: string
          criar_conta_a_pagar_automatica?: boolean | null
          data_agendamento: string
          data_atualizacao?: string | null
          data_criacao?: string | null
          descricao: string
          dia_recorrencia?: number | null
          eh_recorrente?: boolean | null
          fornecedor: string
          frequencia_recorrencia?: string | null
          id?: string
          lembrete_antecipado?: boolean | null
          notas?: string | null
          status?: string | null
          valor: number
        }
        Update: {
          atualizado_por?: string | null
          categoria?: string | null
          criado_por?: string
          criar_conta_a_pagar_automatica?: boolean | null
          data_agendamento?: string
          data_atualizacao?: string | null
          data_criacao?: string | null
          descricao?: string
          dia_recorrencia?: number | null
          eh_recorrente?: boolean | null
          fornecedor?: string
          frequencia_recorrencia?: string | null
          id?: string
          lembrete_antecipado?: boolean | null
          notas?: string | null
          status?: string | null
          valor?: number
        }
        Relationships: []
      }
      anniversary_alerts: {
        Row: {
          birth_date: string
          created_at: string
          days_until_birthday: number
          id: string
          is_today: boolean
          is_upcoming: boolean
          person_id: string
          person_name: string
          person_type: string
          updated_at: string
        }
        Insert: {
          birth_date: string
          created_at?: string
          days_until_birthday: number
          id?: string
          is_today?: boolean
          is_upcoming?: boolean
          person_id: string
          person_name: string
          person_type: string
          updated_at?: string
        }
        Update: {
          birth_date?: string
          created_at?: string
          days_until_birthday?: number
          id?: string
          is_today?: boolean
          is_upcoming?: boolean
          person_id?: string
          person_name?: string
          person_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      arquivos_portal_cliente: {
        Row: {
          aeronave_id: string | null
          ano_referencia: number | null
          atualizado_em: string | null
          caminho_arquivo: string
          cliente_id: string
          criado_em: string | null
          data_vencimento: string | null
          descricao: string | null
          enviado_por: string | null
          id: string
          mes_referencia: number | null
          nome_arquivo: string
          nome_socio: string | null
          status: string | null
          tamanho_arquivo: number
          tipo_arquivo: string
          valor: number | null
        }
        Insert: {
          aeronave_id?: string | null
          ano_referencia?: number | null
          atualizado_em?: string | null
          caminho_arquivo: string
          cliente_id: string
          criado_em?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          enviado_por?: string | null
          id?: string
          mes_referencia?: number | null
          nome_arquivo: string
          nome_socio?: string | null
          status?: string | null
          tamanho_arquivo: number
          tipo_arquivo: string
          valor?: number | null
        }
        Update: {
          aeronave_id?: string | null
          ano_referencia?: number | null
          atualizado_em?: string | null
          caminho_arquivo?: string
          cliente_id?: string
          criado_em?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          enviado_por?: string | null
          id?: string
          mes_referencia?: number | null
          nome_arquivo?: string
          nome_socio?: string | null
          status?: string | null
          tamanho_arquivo?: number
          tipo_arquivo?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_files_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_files_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_files_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "client_portal_files_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "client_portal_files_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "client_portal_files_client_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_files_client_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "client_portal_files_client_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      autenticacao_portal_cliente: {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          clientes_id: string
          criado_em: string | null
          hash_senha: string
          id: string
          login: string
          socios_cliente_id: string | null
          ultimo_login: string | null
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          clientes_id: string
          criado_em?: string | null
          hash_senha: string
          id?: string
          login: string
          socios_cliente_id?: string | null
          ultimo_login?: string | null
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          clientes_id?: string
          criado_em?: string | null
          hash_senha?: string
          id?: string
          login?: string
          socios_cliente_id?: string | null
          ultimo_login?: string | null
        }
        Relationships: []
      }
      benefit_cards: {
        Row: {
          card_type: string
          created_at: string
          id: string
          initial_balance: number
          month: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          card_type: string
          created_at?: string
          id?: string
          initial_balance?: number
          month: number
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          card_type?: string
          created_at?: string
          id?: string
          initial_balance?: number
          month?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      benefit_transactions: {
        Row: {
          amount: number
          benefit_card_id: string
          created_at: string
          description: string
          id: string
          transaction_date: string
          user_id: string
        }
        Insert: {
          amount: number
          benefit_card_id: string
          created_at?: string
          description: string
          id?: string
          transaction_date: string
          user_id: string
        }
        Update: {
          amount?: number
          benefit_card_id?: string
          created_at?: string
          description?: string
          id?: string
          transaction_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "benefit_transactions_benefit_card_id_fkey"
            columns: ["benefit_card_id"]
            isOneToOne: false
            referencedRelation: "benefit_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      birthdays: {
        Row: {
          category: Database["public"]["Enums"]["contact_type"] | null
          created_at: string | null
          data_aniversario: string
          empresa: string | null
          id: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["contact_type"] | null
          created_at?: string | null
          data_aniversario: string
          empresa?: string | null
          id?: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["contact_type"] | null
          created_at?: string | null
          data_aniversario?: string
          empresa?: string | null
          id?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      categorias_movimentacao: {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          criado_em: string | null
          criado_por: string
          descricao: string | null
          grupo_categoria: string | null
          id: string
          nome: string
          reembolsavel: boolean | null
          tipo: string
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          criado_por: string
          descricao?: string | null
          grupo_categoria?: string | null
          id?: string
          nome: string
          reembolsavel?: boolean | null
          tipo: string
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          criado_por?: string
          descricao?: string | null
          grupo_categoria?: string | null
          id?: string
          nome?: string
          reembolsavel?: boolean | null
          tipo?: string
        }
        Relationships: []
      }
      checklists_voo: {
        Row: {
          atualizado_em: string | null
          criado_em: string | null
          id: string
          itens: Json | null
          plano_voo_id: string | null
          tipo_checklist: string
        }
        Insert: {
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          itens?: Json | null
          plano_voo_id?: string | null
          tipo_checklist: string
        }
        Update: {
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          itens?: Json | null
          plano_voo_id?: string | null
          tipo_checklist?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_checklists_flight_plan_id_fkey"
            columns: ["plano_voo_id"]
            isOneToOne: false
            referencedRelation: "planos_voo"
            referencedColumns: ["id"]
          },
        ]
      }
      ciclos_voo: {
        Row: {
          aeronave_id: string | null
          aeroporto_controlado: boolean | null
          atualizado_em: string
          cliente_id: string | null
          concluido_em: string | null
          criado_em: string
          data_retorno: string | null
          data_voo: string
          duracao_horas: number | null
          finalizado_em: string | null
          hangar_privado: boolean | null
          icao_destino: string
          icao_origem: string
          id: string
          iniciado_em: string | null
          nome_pic: string | null
          nome_sic: string | null
          nome_socio: string | null
          observacoes: string | null
          pernoite: boolean | null
          responsavel_id: string | null
          socio_id: string | null
          status: string
          tipo_voo: string
        }
        Insert: {
          aeronave_id?: string | null
          aeroporto_controlado?: boolean | null
          atualizado_em?: string
          cliente_id?: string | null
          concluido_em?: string | null
          criado_em?: string
          data_retorno?: string | null
          data_voo: string
          duracao_horas?: number | null
          finalizado_em?: string | null
          hangar_privado?: boolean | null
          icao_destino: string
          icao_origem: string
          id?: string
          iniciado_em?: string | null
          nome_pic?: string | null
          nome_sic?: string | null
          nome_socio?: string | null
          observacoes?: string | null
          pernoite?: boolean | null
          responsavel_id?: string | null
          socio_id?: string | null
          status?: string
          tipo_voo: string
        }
        Update: {
          aeronave_id?: string | null
          aeroporto_controlado?: boolean | null
          atualizado_em?: string
          cliente_id?: string | null
          concluido_em?: string | null
          criado_em?: string
          data_retorno?: string | null
          data_voo?: string
          duracao_horas?: number | null
          finalizado_em?: string | null
          hangar_privado?: boolean | null
          icao_destino?: string
          icao_origem?: string
          id?: string
          iniciado_em?: string | null
          nome_pic?: string | null
          nome_sic?: string | null
          nome_socio?: string | null
          observacoes?: string | null
          pernoite?: boolean | null
          responsavel_id?: string | null
          socio_id?: string | null
          status?: string
          tipo_voo?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_cycles_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_cycles_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_cycles_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "flight_cycles_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "flight_cycles_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "flight_cycles_client_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_cycles_client_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "flight_cycles_client_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "flight_cycles_partner_fkey"
            columns: ["socio_id"]
            isOneToOne: false
            referencedRelation: "socios"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          aeronave: string | null
          atualizado_em: string | null
          cidade: string | null
          cnpj: string | null
          codigo_cliente: string | null
          contato_financeiro: string | null
          criado_em: string | null
          documentos: Json | null
          email: string | null
          endereco: string | null
          id: string
          inscricao_estadual: string | null
          observacoes: string | null
          proprietario: string | null
          razao_social: string | null
          status: string | null
          telefone: string | null
          tem_socio: boolean
          uf: string | null
          url_logo: string | null
        }
        Insert: {
          aeronave?: string | null
          atualizado_em?: string | null
          cidade?: string | null
          cnpj?: string | null
          codigo_cliente?: string | null
          contato_financeiro?: string | null
          criado_em?: string | null
          documentos?: Json | null
          email?: string | null
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          observacoes?: string | null
          proprietario?: string | null
          razao_social?: string | null
          status?: string | null
          telefone?: string | null
          tem_socio?: boolean
          uf?: string | null
          url_logo?: string | null
        }
        Update: {
          aeronave?: string | null
          atualizado_em?: string | null
          cidade?: string | null
          cnpj?: string | null
          codigo_cliente?: string | null
          contato_financeiro?: string | null
          criado_em?: string | null
          documentos?: Json | null
          email?: string | null
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          observacoes?: string | null
          proprietario?: string | null
          razao_social?: string | null
          status?: string | null
          telefone?: string | null
          tem_socio?: boolean
          uf?: string | null
          url_logo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_aircraft_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_aircraft_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_aircraft_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "clients_aircraft_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "clients_aircraft_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
      }
      colaborador_departamento: {
        Row: {
          cargo: string | null
          colaborador_id: string
          criado_em: string | null
          departamento_id: string
          id: string
        }
        Insert: {
          cargo?: string | null
          colaborador_id: string
          criado_em?: string | null
          departamento_id: string
          id?: string
        }
        Update: {
          cargo?: string | null
          colaborador_id?: string
          criado_em?: string | null
          departamento_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "colaborador_departamento_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_departamento_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      conciliacoes_bancarias: {
        Row: {
          aeronave_id: string | null
          afeta_caixa_empresa: boolean | null
          atualizado_em: string | null
          boleto_url: string | null
          categoria: string | null
          categoria_movimentacao_id: string | null
          clientes_id: string | null
          colaborador: string | null
          comprovante_url: string | null
          controle_bancario_id: string | null
          criado_em: string | null
          criado_por: string
          data: string
          data_reembolso: string | null
          descricao: string
          documento: string | null
          forma_pagamento: string | null
          fornecedor_dados: Json | null
          fornecedor_nome: string | null
          id: string
          nf_url: string | null
          nome_socio: string | null
          percentual: string | null
          prazo_pagamento: string | null
          recebedor_id: string | null
          referencia_id: string | null
          saldo_pendente: number | null
          socio_cliente_id: string | null
          status: string
          tipo: string
          tipo_documento: string | null
          tipo_referencia: string | null
          valor: number
          valor_reembolsado: number | null
        }
        Insert: {
          aeronave_id?: string | null
          afeta_caixa_empresa?: boolean | null
          atualizado_em?: string | null
          boleto_url?: string | null
          categoria?: string | null
          categoria_movimentacao_id?: string | null
          clientes_id?: string | null
          colaborador?: string | null
          comprovante_url?: string | null
          controle_bancario_id?: string | null
          criado_em?: string | null
          criado_por: string
          data: string
          data_reembolso?: string | null
          descricao: string
          documento?: string | null
          forma_pagamento?: string | null
          fornecedor_dados?: Json | null
          fornecedor_nome?: string | null
          id?: string
          nf_url?: string | null
          nome_socio?: string | null
          percentual?: string | null
          prazo_pagamento?: string | null
          recebedor_id?: string | null
          referencia_id?: string | null
          saldo_pendente?: number | null
          socio_cliente_id?: string | null
          status: string
          tipo: string
          tipo_documento?: string | null
          tipo_referencia?: string | null
          valor: number
          valor_reembolsado?: number | null
        }
        Update: {
          aeronave_id?: string | null
          afeta_caixa_empresa?: boolean | null
          atualizado_em?: string | null
          boleto_url?: string | null
          categoria?: string | null
          categoria_movimentacao_id?: string | null
          clientes_id?: string | null
          colaborador?: string | null
          comprovante_url?: string | null
          controle_bancario_id?: string | null
          criado_em?: string | null
          criado_por?: string
          data?: string
          data_reembolso?: string | null
          descricao?: string
          documento?: string | null
          forma_pagamento?: string | null
          fornecedor_dados?: Json | null
          fornecedor_nome?: string | null
          id?: string
          nf_url?: string | null
          nome_socio?: string | null
          percentual?: string | null
          prazo_pagamento?: string | null
          recebedor_id?: string | null
          referencia_id?: string | null
          saldo_pendente?: number | null
          socio_cliente_id?: string | null
          status?: string
          tipo?: string
          tipo_documento?: string | null
          tipo_referencia?: string | null
          valor?: number
          valor_reembolsado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_reconciliations_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "bank_reconciliations_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "bank_reconciliations_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "bank_reconciliations_categoria_fkey"
            columns: ["categoria_movimentacao_id"]
            isOneToOne: false
            referencedRelation: "categorias_movimentacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_client_partner_fkey"
            columns: ["socio_cliente_id"]
            isOneToOne: false
            referencedRelation: "socios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_receiver_id_fkey"
            columns: ["recebedor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacoes_bancarias_clientes_id_fkey"
            columns: ["clientes_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacoes_bancarias_clientes_id_fkey"
            columns: ["clientes_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "conciliacoes_bancarias_clientes_id_fkey"
            columns: ["clientes_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      config_agendamento_aeronave: {
        Row: {
          aeronave_id: string
          atualizado_em: string | null
          atualizado_por: string | null
          habilitado_agendamento: boolean
          id: string
        }
        Insert: {
          aeronave_id: string
          atualizado_em?: string | null
          atualizado_por?: string | null
          habilitado_agendamento?: boolean
          id?: string
        }
        Update: {
          aeronave_id?: string
          atualizado_em?: string | null
          atualizado_por?: string | null
          habilitado_agendamento?: boolean
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduling_aircraft_config_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: true
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduling_aircraft_config_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: true
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduling_aircraft_config_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: true
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "scheduling_aircraft_config_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: true
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "scheduling_aircraft_config_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: true
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
      }
      config_manutencao_aeronave: {
        Row: {
          aeronave_id: string
          ativo: boolean | null
          atualizado_em: string | null
          criado_em: string | null
          id: string
          intervalo_horas: number
          limite_alerta_amarelo: number
          limite_alerta_laranja: number
          limite_alerta_verde: number
          limite_alerta_vermelho: number
          tipo_manutencao: string
        }
        Insert: {
          aeronave_id: string
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          intervalo_horas?: number
          limite_alerta_amarelo?: number
          limite_alerta_laranja?: number
          limite_alerta_verde?: number
          limite_alerta_vermelho?: number
          tipo_manutencao: string
        }
        Update: {
          aeronave_id?: string
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          intervalo_horas?: number
          limite_alerta_amarelo?: number
          limite_alerta_laranja?: number
          limite_alerta_verde?: number
          limite_alerta_vermelho?: number
          tipo_manutencao?: string
        }
        Relationships: [
          {
            foreignKeyName: "aircraft_maintenance_config_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_maintenance_config_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_maintenance_config_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_maintenance_config_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_maintenance_config_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
      }
      configuracao_empresa: {
        Row: {
          cep: string | null
          cidade: string | null
          cnpj: string
          criado_em: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          logo_url: string | null
          nome_fantasia: string | null
          razao_social: string
          telefone: string | null
        }
        Insert: {
          cep?: string | null
          cidade?: string | null
          cnpj: string
          criado_em?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          logo_url?: string | null
          nome_fantasia?: string | null
          razao_social: string
          telefone?: string | null
        }
        Update: {
          cep?: string | null
          cidade?: string | null
          cnpj?: string
          criado_em?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          logo_url?: string | null
          nome_fantasia?: string | null
          razao_social?: string
          telefone?: string | null
        }
        Relationships: []
      }
      contas_apagar: {
        Row: {
          aeronave_registro: string | null
          arquivo_pdf_url: string | null
          atualizado_em: string | null
          banco_pagamento: string | null
          boleto_url: string | null
          categoria: string | null
          categoria_id: string | null
          cliente_id: string | null
          codigo_barras: string | null
          competencia_decea: string | null
          competencia_infraero: string | null
          comprovante_pagamento_url: string | null
          conta_pagamento_fornecedor: string | null
          criado_em: string | null
          criado_por: string | null
          data_agendamento: string | null
          data_pagamento: string | null
          data_recebimento_boleto: string | null
          data_recibo: string | null
          data_vencimento: string
          decea_url: string | null
          descricao: string | null
          empresa: string | null
          fornecedor_combustivel_id: string | null
          fornecedor_favorito_id: string | null
          fornecedor_nome: string | null
          id: string
          infraero_url: string | null
          movimentacao_id: string | null
          nf_numero: string | null
          nf_url: string | null
          numero_doc: string | null
          numero_documento_decea: string | null
          numero_documento_infraero: string | null
          numero_recibo: string | null
          observacoes: string | null
          possui_boleto: boolean | null
          possui_nf: boolean | null
          possui_recibo: boolean | null
          recibo_url: string | null
          reference_id: string | null
          reference_type: string | null
          socios_cliente_id: string | null
          status: string
          valor: number
          valor_pago: string | null
          vencimento_boleto: string | null
        }
        Insert: {
          aeronave_registro?: string | null
          arquivo_pdf_url?: string | null
          atualizado_em?: string | null
          banco_pagamento?: string | null
          boleto_url?: string | null
          categoria?: string | null
          categoria_id?: string | null
          cliente_id?: string | null
          codigo_barras?: string | null
          competencia_decea?: string | null
          competencia_infraero?: string | null
          comprovante_pagamento_url?: string | null
          conta_pagamento_fornecedor?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_agendamento?: string | null
          data_pagamento?: string | null
          data_recebimento_boleto?: string | null
          data_recibo?: string | null
          data_vencimento: string
          decea_url?: string | null
          descricao?: string | null
          empresa?: string | null
          fornecedor_combustivel_id?: string | null
          fornecedor_favorito_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          infraero_url?: string | null
          movimentacao_id?: string | null
          nf_numero?: string | null
          nf_url?: string | null
          numero_doc?: string | null
          numero_documento_decea?: string | null
          numero_documento_infraero?: string | null
          numero_recibo?: string | null
          observacoes?: string | null
          possui_boleto?: boolean | null
          possui_nf?: boolean | null
          possui_recibo?: boolean | null
          recibo_url?: string | null
          reference_id?: string | null
          reference_type?: string | null
          socios_cliente_id?: string | null
          status: string
          valor: number
          valor_pago?: string | null
          vencimento_boleto?: string | null
        }
        Update: {
          aeronave_registro?: string | null
          arquivo_pdf_url?: string | null
          atualizado_em?: string | null
          banco_pagamento?: string | null
          boleto_url?: string | null
          categoria?: string | null
          categoria_id?: string | null
          cliente_id?: string | null
          codigo_barras?: string | null
          competencia_decea?: string | null
          competencia_infraero?: string | null
          comprovante_pagamento_url?: string | null
          conta_pagamento_fornecedor?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_agendamento?: string | null
          data_pagamento?: string | null
          data_recebimento_boleto?: string | null
          data_recibo?: string | null
          data_vencimento?: string
          decea_url?: string | null
          descricao?: string | null
          empresa?: string | null
          fornecedor_combustivel_id?: string | null
          fornecedor_favorito_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          infraero_url?: string | null
          movimentacao_id?: string | null
          nf_numero?: string | null
          nf_url?: string | null
          numero_doc?: string | null
          numero_documento_decea?: string | null
          numero_documento_infraero?: string | null
          numero_recibo?: string | null
          observacoes?: string | null
          possui_boleto?: boolean | null
          possui_nf?: boolean | null
          possui_recibo?: boolean | null
          recibo_url?: string | null
          reference_id?: string | null
          reference_type?: string | null
          socios_cliente_id?: string | null
          status?: string
          valor?: number
          valor_pago?: string | null
          vencimento_boleto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_apagar_aeronave_registro_fkey"
            columns: ["aeronave_registro"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["matricula"]
          },
          {
            foreignKeyName: "contas_apagar_aeronave_registro_fkey"
            columns: ["aeronave_registro"]
            isOneToOne: false
            referencedRelation: "ciclos_voo_ativos"
            referencedColumns: ["registration"]
          },
          {
            foreignKeyName: "contas_apagar_aeronave_registro_fkey"
            columns: ["aeronave_registro"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["registro"]
          },
          {
            foreignKeyName: "contas_apagar_aeronave_registro_fkey"
            columns: ["aeronave_registro"]
            isOneToOne: false
            referencedRelation: "historico_voo_tripulante"
            referencedColumns: ["matricula_aeronave"]
          },
          {
            foreignKeyName: "contas_apagar_aeronave_registro_fkey"
            columns: ["aeronave_registro"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["matricula"]
          },
          {
            foreignKeyName: "contas_apagar_aeronave_registro_fkey"
            columns: ["aeronave_registro"]
            isOneToOne: false
            referencedRelation: "vw_categorias_aeronave"
            referencedColumns: ["aeronave_registro"]
          },
          {
            foreignKeyName: "contas_apagar_aeronave_registro_fkey"
            columns: ["aeronave_registro"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave"]
          },
          {
            foreignKeyName: "contas_apagar_aeronave_registro_fkey"
            columns: ["aeronave_registro"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_registro"]
          },
          {
            foreignKeyName: "contas_apagar_aeronave_registro_fkey"
            columns: ["aeronave_registro"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["aeronave"]
          },
          {
            foreignKeyName: "contas_apagar_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_apagar_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "contas_apagar_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "contas_apagar_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_apagar_fornecedor_combustivel_id_fkey"
            columns: ["fornecedor_combustivel_id"]
            isOneToOne: false
            referencedRelation: "fornecedores_combustivel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_apagar_fornecedor_favorito_id_fkey"
            columns: ["fornecedor_favorito_id"]
            isOneToOne: false
            referencedRelation: "fornecedores_favoritos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_apagar_socios_cliente_id_fkey"
            columns: ["socios_cliente_id"]
            isOneToOne: false
            referencedRelation: "socios"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_areceber: {
        Row: {
          aeronave: string | null
          arquivo_pdf_url: string | null
          atualizado_em: string | null
          banco_recebimento: string | null
          boleto_url: string | null
          categoria: string
          categoria_id: string | null
          cliente_cnpj: string
          cliente_id: string | null
          cliente_nome: string
          comprovante_recebimento_url: string | null
          comprovante_url: string | null
          criado_em: string | null
          criado_por: string | null
          data_criacao: string
          data_pagamento: string | null
          data_recebimento: string | null
          data_vencimento: string
          descricao: string | null
          fornecedor_id: string | null
          id: string
          metodo_pagamento: string | null
          movimentacao_id: string | null
          nf_saida_id: string | null
          nota_fiscal_url: string | null
          numero: string | null
          pago_diretamente: boolean
          reference_id: string | null
          reference_type: string | null
          socio_id: string | null
          status: string
          valor: number
        }
        Insert: {
          aeronave?: string | null
          arquivo_pdf_url?: string | null
          atualizado_em?: string | null
          banco_recebimento?: string | null
          boleto_url?: string | null
          categoria: string
          categoria_id?: string | null
          cliente_cnpj: string
          cliente_id?: string | null
          cliente_nome: string
          comprovante_recebimento_url?: string | null
          comprovante_url?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_criacao: string
          data_pagamento?: string | null
          data_recebimento?: string | null
          data_vencimento: string
          descricao?: string | null
          fornecedor_id?: string | null
          id?: string
          metodo_pagamento?: string | null
          movimentacao_id?: string | null
          nf_saida_id?: string | null
          nota_fiscal_url?: string | null
          numero?: string | null
          pago_diretamente?: boolean
          reference_id?: string | null
          reference_type?: string | null
          socio_id?: string | null
          status: string
          valor: number
        }
        Update: {
          aeronave?: string | null
          arquivo_pdf_url?: string | null
          atualizado_em?: string | null
          banco_recebimento?: string | null
          boleto_url?: string | null
          categoria?: string
          categoria_id?: string | null
          cliente_cnpj?: string
          cliente_id?: string | null
          cliente_nome?: string
          comprovante_recebimento_url?: string | null
          comprovante_url?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_criacao?: string
          data_pagamento?: string | null
          data_recebimento?: string | null
          data_vencimento?: string
          descricao?: string | null
          fornecedor_id?: string | null
          id?: string
          metodo_pagamento?: string | null
          movimentacao_id?: string | null
          nf_saida_id?: string | null
          nota_fiscal_url?: string | null
          numero?: string | null
          pago_diretamente?: boolean
          reference_id?: string | null
          reference_type?: string | null
          socio_id?: string | null
          status?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "contas_areceber_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["matricula"]
          },
          {
            foreignKeyName: "contas_areceber_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "ciclos_voo_ativos"
            referencedColumns: ["registration"]
          },
          {
            foreignKeyName: "contas_areceber_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["registro"]
          },
          {
            foreignKeyName: "contas_areceber_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "historico_voo_tripulante"
            referencedColumns: ["matricula_aeronave"]
          },
          {
            foreignKeyName: "contas_areceber_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["matricula"]
          },
          {
            foreignKeyName: "contas_areceber_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "vw_categorias_aeronave"
            referencedColumns: ["aeronave_registro"]
          },
          {
            foreignKeyName: "contas_areceber_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave"]
          },
          {
            foreignKeyName: "contas_areceber_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_registro"]
          },
          {
            foreignKeyName: "contas_areceber_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["aeronave"]
          },
          {
            foreignKeyName: "contas_areceber_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_movimentacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_areceber_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_areceber_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "contas_areceber_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "contas_areceber_fornecedor_favorito_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores_favoritos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_areceber_nf_saida_id_fkey"
            columns: ["nf_saida_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais_saida"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_areceber_socio_id_fkey"
            columns: ["socio_id"]
            isOneToOne: false
            referencedRelation: "socios"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_bancarias: {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          banco: string | null
          criado_em: string | null
          criado_por: string
          id: string
          numero_conta: string | null
          tipo_conta: string | null
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          banco?: string | null
          criado_em?: string | null
          criado_por: string
          id?: string
          numero_conta?: string | null
          tipo_conta?: string | null
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          banco?: string | null
          criado_em?: string | null
          criado_por?: string
          id?: string
          numero_conta?: string | null
          tipo_conta?: string | null
        }
        Relationships: []
      }
      contas_recorrentes: {
        Row: {
          atualizado_por: string | null
          categoria: string | null
          created_at: string
          criado_por: string
          data_inicio: string
          descricao: string
          dia_recorrencia: number | null
          fornecedor: string | null
          frequencia_recorrencia: string
          id: string
          lembrete_antecipado: boolean | null
          notas: string | null
          status: string | null
          updated_at: string
          valor: number | null
        }
        Insert: {
          atualizado_por?: string | null
          categoria?: string | null
          created_at?: string
          criado_por: string
          data_inicio?: string
          descricao: string
          dia_recorrencia?: number | null
          fornecedor?: string | null
          frequencia_recorrencia?: string
          id?: string
          lembrete_antecipado?: boolean | null
          notas?: string | null
          status?: string | null
          updated_at?: string
          valor?: number | null
        }
        Update: {
          atualizado_por?: string | null
          categoria?: string | null
          created_at?: string
          criado_por?: string
          data_inicio?: string
          descricao?: string
          dia_recorrencia?: number | null
          fornecedor?: string | null
          frequencia_recorrencia?: string
          id?: string
          lembrete_antecipado?: boolean | null
          notas?: string | null
          status?: string | null
          updated_at?: string
          valor?: number | null
        }
        Relationships: []
      }
      contatos: {
        Row: {
          cargo: string | null
          category: Database["public"]["Enums"]["contact_type"] | null
          cidade: string | null
          created_at: string | null
          email: string | null
          empresa: string | null
          endereco: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          cargo?: string | null
          category?: Database["public"]["Enums"]["contact_type"] | null
          cidade?: string | null
          created_at?: string | null
          email?: string | null
          empresa?: string | null
          endereco?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          cargo?: string | null
          category?: Database["public"]["Enums"]["contact_type"] | null
          cidade?: string | null
          created_at?: string | null
          email?: string | null
          empresa?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      contratos_cliente: {
        Row: {
          atualizado_em: string | null
          caminho_arquivo: string
          cliente_id: string
          criado_em: string | null
          descricao: string | null
          enviado_em: string | null
          enviado_por: string | null
          id: string
          nome_arquivo: string
          nome_socio: string | null
          tamanho_arquivo: number | null
          url_publica: string | null
        }
        Insert: {
          atualizado_em?: string | null
          caminho_arquivo: string
          cliente_id: string
          criado_em?: string | null
          descricao?: string | null
          enviado_em?: string | null
          enviado_por?: string | null
          id?: string
          nome_arquivo: string
          nome_socio?: string | null
          tamanho_arquivo?: number | null
          url_publica?: string | null
        }
        Update: {
          atualizado_em?: string | null
          caminho_arquivo?: string
          cliente_id?: string
          criado_em?: string | null
          descricao?: string | null
          enviado_em?: string | null
          enviado_por?: string | null
          id?: string
          nome_arquivo?: string
          nome_socio?: string | null
          tamanho_arquivo?: number | null
          url_publica?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_contracts_client_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contracts_client_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "client_contracts_client_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      cost_simulations: {
        Row: {
          costs: Json
          created_at: string | null
          description: string | null
          form_data: Json
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          costs: Json
          created_at?: string | null
          description?: string | null
          form_data: Json
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          costs?: Json
          created_at?: string | null
          description?: string | null
          form_data?: Json
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cotistas_aeronave: {
        Row: {
          atualizado_em: string | null
          codigo_cliente: string | null
          criado_em: string | null
          id: string
          id_aeronave: string | null
          id_clientes: string
          login: string | null
          modelo_aeronave: string | null
          percentual_sociedade: number
          senha: string | null
          socios_id: string | null
        }
        Insert: {
          atualizado_em?: string | null
          codigo_cliente?: string | null
          criado_em?: string | null
          id?: string
          id_aeronave?: string | null
          id_clientes: string
          login?: string | null
          modelo_aeronave?: string | null
          percentual_sociedade: number
          senha?: string | null
          socios_id?: string | null
        }
        Update: {
          atualizado_em?: string | null
          codigo_cliente?: string | null
          criado_em?: string | null
          id?: string
          id_aeronave?: string | null
          id_clientes?: string
          login?: string | null
          modelo_aeronave?: string | null
          percentual_sociedade?: number
          senha?: string | null
          socios_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_aircraft_aircraft_id_fkey"
            columns: ["id_aeronave"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_aircraft_aircraft_id_fkey"
            columns: ["id_aeronave"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_aircraft_aircraft_id_fkey"
            columns: ["id_aeronave"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "client_aircraft_aircraft_id_fkey"
            columns: ["id_aeronave"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "client_aircraft_aircraft_id_fkey"
            columns: ["id_aeronave"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "cotistas_aeronave_id_clientes_fkey"
            columns: ["id_clientes"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotistas_aeronave_id_clientes_fkey"
            columns: ["id_clientes"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "cotistas_aeronave_id_clientes_fkey"
            columns: ["id_clientes"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "cotistas_aeronave_socios_id_fkey"
            columns: ["socios_id"]
            isOneToOne: false
            referencedRelation: "socios"
            referencedColumns: ["id"]
          },
        ]
      }
      ctm_analise_oleo: {
        Row: {
          aeronave_id: string
          aluminio: number
          cobre: number
          created_at: string | null
          data_analise: string
          ferro: number
          id: string
          ordem_servico_id: string | null
          silicio: number
          updated_at: string | null
          viscosidade: number
        }
        Insert: {
          aeronave_id: string
          aluminio: number
          cobre: number
          created_at?: string | null
          data_analise: string
          ferro: number
          id?: string
          ordem_servico_id?: string | null
          silicio: number
          updated_at?: string | null
          viscosidade: number
        }
        Update: {
          aeronave_id?: string
          aluminio?: number
          cobre?: number
          created_at?: string | null
          data_analise?: string
          ferro?: number
          id?: string
          ordem_servico_id?: string | null
          silicio?: number
          updated_at?: string | null
          viscosidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "oil_analysis_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oil_analysis_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oil_analysis_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "oil_analysis_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "oil_analysis_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
      }
      ctm_categoria: {
        Row: {
          ativo: boolean | null
          cor: string | null
          criado_em: string | null
          descricao: string | null
          icone: string | null
          id: string
          intervalo_horas: number | null
          intervalo_meses: number | null
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          cor?: string | null
          criado_em?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          intervalo_horas?: number | null
          intervalo_meses?: number | null
          nome: string
        }
        Update: {
          ativo?: boolean | null
          cor?: string | null
          criado_em?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          intervalo_horas?: number | null
          intervalo_meses?: number | null
          nome?: string
        }
        Relationships: []
      }
      ctm_despesas_motor: {
        Row: {
          aeronave_id: string
          atualizado_em: string | null
          criado_em: string | null
          data: string
          descricao: string
          fornecedor: string | null
          horas_motor: number | null
          id: string
          lado_motor: string
          numero_oas: string | null
          observacoes: string | null
          tipo: string
          valor: number
        }
        Insert: {
          aeronave_id: string
          atualizado_em?: string | null
          criado_em?: string | null
          data: string
          descricao: string
          fornecedor?: string | null
          horas_motor?: number | null
          id?: string
          lado_motor: string
          numero_oas?: string | null
          observacoes?: string | null
          tipo: string
          valor?: number
        }
        Update: {
          aeronave_id?: string
          atualizado_em?: string | null
          criado_em?: string | null
          data?: string
          descricao?: string
          fornecedor?: string | null
          horas_motor?: number | null
          id?: string
          lado_motor?: string
          numero_oas?: string | null
          observacoes?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "ctm_despesas_motor_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctm_despesas_motor_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctm_despesas_motor_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "ctm_despesas_motor_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "ctm_despesas_motor_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
      }
      ctm_diretrizes: {
        Row: {
          aeronave_id: string
          aplicabilidade: string | null
          atualizado_em: string | null
          ciclos_devidos: number | null
          criado_em: string | null
          data_de_conformidade: string | null
          data_vencimento: string | null
          descricao: string | null
          devido_horas: number | null
          horas_de_conformidade: number | null
          id: string
          metodo_de_conformidade: string | null
          numero: string
          observacoes: string | null
          responsavel: string | null
          status: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          aeronave_id: string
          aplicabilidade?: string | null
          atualizado_em?: string | null
          ciclos_devidos?: number | null
          criado_em?: string | null
          data_de_conformidade?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          devido_horas?: number | null
          horas_de_conformidade?: number | null
          id?: string
          metodo_de_conformidade?: string | null
          numero: string
          observacoes?: string | null
          responsavel?: string | null
          status?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          aeronave_id?: string
          aplicabilidade?: string | null
          atualizado_em?: string | null
          ciclos_devidos?: number | null
          criado_em?: string | null
          data_de_conformidade?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          devido_horas?: number | null
          horas_de_conformidade?: number | null
          id?: string
          metodo_de_conformidade?: string | null
          numero?: string
          observacoes?: string | null
          responsavel?: string | null
          status?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "ctm_diretrizes_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctm_diretrizes_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctm_diretrizes_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "ctm_diretrizes_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "ctm_diretrizes_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
      }
      ctm_execucoes: {
        Row: {
          criado_em: string | null
          data_execucao: string
          horas_aeronave_na_execucao: number | null
          id: string
          item_aeronave_id: string
          observacoes: string | null
          oficina: string | null
          ordem_servico: string | null
          pousos_aeronave_na_execucao: number | null
        }
        Insert: {
          criado_em?: string | null
          data_execucao: string
          horas_aeronave_na_execucao?: number | null
          id?: string
          item_aeronave_id: string
          observacoes?: string | null
          oficina?: string | null
          ordem_servico?: string | null
          pousos_aeronave_na_execucao?: number | null
        }
        Update: {
          criado_em?: string | null
          data_execucao?: string
          horas_aeronave_na_execucao?: number | null
          id?: string
          item_aeronave_id?: string
          observacoes?: string | null
          oficina?: string | null
          ordem_servico?: string | null
          pousos_aeronave_na_execucao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ctm_execucoes_item_aeronave_id_fkey"
            columns: ["item_aeronave_id"]
            isOneToOne: false
            referencedRelation: "ctm_itens_aeronave"
            referencedColumns: ["id"]
          },
        ]
      }
      ctm_itens_aeronave: {
        Row: {
          aeronave_id: string
          ativo: boolean | null
          id: string
          intervalo_horas_override: number | null
          intervalo_meses_override: number | null
          intervalo_pousos_override: number | null
          modelo_item_id: string | null
          nome_item_override: string | null
        }
        Insert: {
          aeronave_id: string
          ativo?: boolean | null
          id?: string
          intervalo_horas_override?: number | null
          intervalo_meses_override?: number | null
          intervalo_pousos_override?: number | null
          modelo_item_id?: string | null
          nome_item_override?: string | null
        }
        Update: {
          aeronave_id?: string
          ativo?: boolean | null
          id?: string
          intervalo_horas_override?: number | null
          intervalo_meses_override?: number | null
          intervalo_pousos_override?: number | null
          modelo_item_id?: string | null
          nome_item_override?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ctm_itens_aeronave_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctm_itens_aeronave_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctm_itens_aeronave_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "ctm_itens_aeronave_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "ctm_itens_aeronave_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "ctm_itens_aeronave_modelo_item_id_fkey"
            columns: ["modelo_item_id"]
            isOneToOne: false
            referencedRelation: "ctm_modelos_item"
            referencedColumns: ["id"]
          },
        ]
      }
      ctm_itens_nao_controlados: {
        Row: {
          aeronave_id: string
          atualizado_em: string
          criado_em: string
          data_ultima_troca: string | null
          horas_apos: number | null
          horas_restantes: number | null
          horas_ultima_troca: number | null
          id: string
          marca: string | null
          media_horas: number | null
          nota_fiscal: string | null
          observacoes: string | null
          ordem_servico: string | null
          posicao: string | null
          pousos_apos: number | null
          pousos_restantes: number | null
          tipo_controle: string
        }
        Insert: {
          aeronave_id: string
          atualizado_em?: string
          criado_em?: string
          data_ultima_troca?: string | null
          horas_apos?: number | null
          horas_restantes?: number | null
          horas_ultima_troca?: number | null
          id?: string
          marca?: string | null
          media_horas?: number | null
          nota_fiscal?: string | null
          observacoes?: string | null
          ordem_servico?: string | null
          posicao?: string | null
          pousos_apos?: number | null
          pousos_restantes?: number | null
          tipo_controle: string
        }
        Update: {
          aeronave_id?: string
          atualizado_em?: string
          criado_em?: string
          data_ultima_troca?: string | null
          horas_apos?: number | null
          horas_restantes?: number | null
          horas_ultima_troca?: number | null
          id?: string
          marca?: string | null
          media_horas?: number | null
          nota_fiscal?: string | null
          observacoes?: string | null
          ordem_servico?: string | null
          posicao?: string | null
          pousos_apos?: number | null
          pousos_restantes?: number | null
          tipo_controle?: string
        }
        Relationships: [
          {
            foreignKeyName: "ctm_itens_nao_controlados_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctm_itens_nao_controlados_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctm_itens_nao_controlados_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "ctm_itens_nao_controlados_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "ctm_itens_nao_controlados_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
      }
      ctm_itens_peso_balanceamento: {
        Row: {
          atualizado_em: string | null
          braço_posicao: number
          categoria: string | null
          criado_em: string | null
          descricao: string
          id: string
          incluir_no_calculo: boolean | null
          momento: number
          observacao: string | null
          peso_balanceamento_id: string
          peso_sem_combustivel: number
        }
        Insert: {
          atualizado_em?: string | null
          braço_posicao: number
          categoria?: string | null
          criado_em?: string | null
          descricao: string
          id?: string
          incluir_no_calculo?: boolean | null
          momento: number
          observacao?: string | null
          peso_balanceamento_id: string
          peso_sem_combustivel: number
        }
        Update: {
          atualizado_em?: string | null
          braço_posicao?: number
          categoria?: string | null
          criado_em?: string | null
          descricao?: string
          id?: string
          incluir_no_calculo?: boolean | null
          momento?: number
          observacao?: string | null
          peso_balanceamento_id?: string
          peso_sem_combustivel?: number
        }
        Relationships: [
          {
            foreignKeyName: "weight_balance_items_weight_balance_id_fkey"
            columns: ["peso_balanceamento_id"]
            isOneToOne: false
            referencedRelation: "ctm_peso_balanceamento"
            referencedColumns: ["id"]
          },
        ]
      }
      ctm_mapa_componente: {
        Row: {
          aeronave_id: string
          atualizado_em: string | null
          categoria: string | null
          ciclos_de_vida_atuais: number | null
          ciclos_de_vida_totais: number | null
          ciclos_instalados: number | null
          criado_em: string | null
          csn: number | null
          cso: number | null
          data_de_vencimento: string | null
          data_instalada: string
          fabricante: string | null
          horas_de_vida_atuais: number | null
          horas_instaladas: number | null
          id: string
          localizacao: string | null
          nome: string
          numero_da_peça: string
          numero_de_serie: string
          observacoes: string | null
          porcentagem_restante: number | null
          remaining_hours: number | null
          status: string | null
          total_horas_de_vida: number | null
          tso: number | null
        }
        Insert: {
          aeronave_id: string
          atualizado_em?: string | null
          categoria?: string | null
          ciclos_de_vida_atuais?: number | null
          ciclos_de_vida_totais?: number | null
          ciclos_instalados?: number | null
          criado_em?: string | null
          csn?: number | null
          cso?: number | null
          data_de_vencimento?: string | null
          data_instalada: string
          fabricante?: string | null
          horas_de_vida_atuais?: number | null
          horas_instaladas?: number | null
          id?: string
          localizacao?: string | null
          nome: string
          numero_da_peça: string
          numero_de_serie: string
          observacoes?: string | null
          porcentagem_restante?: number | null
          remaining_hours?: number | null
          status?: string | null
          total_horas_de_vida?: number | null
          tso?: number | null
        }
        Update: {
          aeronave_id?: string
          atualizado_em?: string | null
          categoria?: string | null
          ciclos_de_vida_atuais?: number | null
          ciclos_de_vida_totais?: number | null
          ciclos_instalados?: number | null
          criado_em?: string | null
          csn?: number | null
          cso?: number | null
          data_de_vencimento?: string | null
          data_instalada?: string
          fabricante?: string | null
          horas_de_vida_atuais?: number | null
          horas_instaladas?: number | null
          id?: string
          localizacao?: string | null
          nome?: string
          numero_da_peça?: string
          numero_de_serie?: string
          observacoes?: string | null
          porcentagem_restante?: number | null
          remaining_hours?: number | null
          status?: string | null
          total_horas_de_vida?: number | null
          tso?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "components_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "components_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "components_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "components_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "components_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
      }
      ctm_modelos_item: {
        Row: {
          base_legal: string | null
          categoria_id: string
          criterio: string | null
          fonte_mpd: string | null
          id: string
          intervalo_horas: number | null
          intervalo_meses: number | null
          intervalo_pousos: number | null
          modelo_aeronave: string
          modelo_motor: string | null
          nome_item: string
          tipo_operacao: string
        }
        Insert: {
          base_legal?: string | null
          categoria_id: string
          criterio?: string | null
          fonte_mpd?: string | null
          id?: string
          intervalo_horas?: number | null
          intervalo_meses?: number | null
          intervalo_pousos?: number | null
          modelo_aeronave: string
          modelo_motor?: string | null
          nome_item: string
          tipo_operacao?: string
        }
        Update: {
          base_legal?: string | null
          categoria_id?: string
          criterio?: string | null
          fonte_mpd?: string | null
          id?: string
          intervalo_horas?: number | null
          intervalo_meses?: number | null
          intervalo_pousos?: number | null
          modelo_aeronave?: string
          modelo_motor?: string | null
          nome_item?: string
          tipo_operacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "ctm_modelos_item_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "ctm_categoria"
            referencedColumns: ["id"]
          },
        ]
      }
      ctm_ordem_acompanhamento_servico: {
        Row: {
          aeronave_id: string
          created_at: string
          data_entrada: string | null
          data_saida: string | null
          id: string
          mecanico_responsavel: string | null
          numero: string | null
          objetivo: string | null
          observacoes: string | null
          oficina_nome: string | null
          periodo: string | null
          periodo_fim: string | null
          periodo_inicio: string | null
          status: string | null
          status_aprovacao: string | null
          tipo_manutencao: string | null
          tipo_rateio: string | null
          total_geral: number | null
          total_mao_obra: number | null
          total_pecas: number | null
          total_valor_os: number | null
          updated_at: string
        }
        Insert: {
          aeronave_id: string
          created_at?: string
          data_entrada?: string | null
          data_saida?: string | null
          id?: string
          mecanico_responsavel?: string | null
          numero?: string | null
          objetivo?: string | null
          observacoes?: string | null
          oficina_nome?: string | null
          periodo?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          status?: string | null
          status_aprovacao?: string | null
          tipo_manutencao?: string | null
          tipo_rateio?: string | null
          total_geral?: number | null
          total_mao_obra?: number | null
          total_pecas?: number | null
          total_valor_os?: number | null
          updated_at?: string
        }
        Update: {
          aeronave_id?: string
          created_at?: string
          data_entrada?: string | null
          data_saida?: string | null
          id?: string
          mecanico_responsavel?: string | null
          numero?: string | null
          objetivo?: string | null
          observacoes?: string | null
          oficina_nome?: string | null
          periodo?: string | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          status?: string | null
          status_aprovacao?: string | null
          tipo_manutencao?: string | null
          tipo_rateio?: string | null
          total_geral?: number | null
          total_mao_obra?: number | null
          total_pecas?: number | null
          total_valor_os?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ctm_ordem_acompanhamento_servico_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctm_ordem_acompanhamento_servico_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctm_ordem_acompanhamento_servico_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "ctm_ordem_acompanhamento_servico_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "ctm_ordem_acompanhamento_servico_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
      }
      ctm_pecas_trocadas: {
        Row: {
          criado_em: string | null
          descricao: string
          fornecedor: string | null
          id: string
          observacoes: string | null
          ordem_servico_id: string
          p_n_instalado: string | null
          p_n_removido: string | null
          quantidade: number
          s_n_instalado: string | null
          s_n_removido: string | null
        }
        Insert: {
          criado_em?: string | null
          descricao: string
          fornecedor?: string | null
          id?: string
          observacoes?: string | null
          ordem_servico_id: string
          p_n_instalado?: string | null
          p_n_removido?: string | null
          quantidade?: number
          s_n_instalado?: string | null
          s_n_removido?: string | null
        }
        Update: {
          criado_em?: string | null
          descricao?: string
          fornecedor?: string | null
          id?: string
          observacoes?: string | null
          ordem_servico_id?: string
          p_n_instalado?: string | null
          p_n_removido?: string | null
          quantidade?: number
          s_n_instalado?: string | null
          s_n_removido?: string | null
        }
        Relationships: []
      }
      ctm_peso_balanceamento: {
        Row: {
          aeronave_id: string
          atualizado_em: string | null
          braco_cg_padrao: number
          capacidade_combustivel_total: number | null
          capacidade_combustivel_util: number | null
          cg_limite_dianteiro: number
          cg_limite_traseiro: number
          criado_em: string | null
          criado_por: string | null
          id: string
          lemac_distancia: number
          mac_comprimento: number
          momento_padrao: number | null
          notas: string | null
          peso_maximo_decolagem: number
          peso_maximo_pouso: number
          peso_maximo_sem_combustivel: number | null
          peso_vazio_padrao: number
          validado: boolean | null
          validado_em: string | null
          validado_por: string | null
        }
        Insert: {
          aeronave_id: string
          atualizado_em?: string | null
          braco_cg_padrao: number
          capacidade_combustivel_total?: number | null
          capacidade_combustivel_util?: number | null
          cg_limite_dianteiro: number
          cg_limite_traseiro: number
          criado_em?: string | null
          criado_por?: string | null
          id?: string
          lemac_distancia: number
          mac_comprimento: number
          momento_padrao?: number | null
          notas?: string | null
          peso_maximo_decolagem: number
          peso_maximo_pouso: number
          peso_maximo_sem_combustivel?: number | null
          peso_vazio_padrao: number
          validado?: boolean | null
          validado_em?: string | null
          validado_por?: string | null
        }
        Update: {
          aeronave_id?: string
          atualizado_em?: string | null
          braco_cg_padrao?: number
          capacidade_combustivel_total?: number | null
          capacidade_combustivel_util?: number | null
          cg_limite_dianteiro?: number
          cg_limite_traseiro?: number
          criado_em?: string | null
          criado_por?: string | null
          id?: string
          lemac_distancia?: number
          mac_comprimento?: number
          momento_padrao?: number | null
          notas?: string | null
          peso_maximo_decolagem?: number
          peso_maximo_pouso?: number
          peso_maximo_sem_combustivel?: number | null
          peso_vazio_padrao?: number
          validado?: boolean | null
          validado_em?: string | null
          validado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weight_balance_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: true
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weight_balance_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: true
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weight_balance_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: true
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "weight_balance_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: true
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "weight_balance_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: true
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
      }
      ctm_ras: {
        Row: {
          aeronave_id: string
          criado_em: string | null
          criado_por: string | null
          data_entrada: string
          data_saida: string | null
          descricao: string | null
          dias_efetivos: number | null
          dias_planejados: number | null
          horas_celula_entrada: number | null
          horas_celula_saida: number | null
          id: string
          numero: string
          oas_numero: string | null
          objetivo: string | null
          periodo: string | null
          status: string | null
          tipo_manutencao: string
          total_geral: number | null
          total_pecas: number | null
          total_trabalho: number | null
        }
        Insert: {
          aeronave_id: string
          criado_em?: string | null
          criado_por?: string | null
          data_entrada: string
          data_saida?: string | null
          descricao?: string | null
          dias_efetivos?: number | null
          dias_planejados?: number | null
          horas_celula_entrada?: number | null
          horas_celula_saida?: number | null
          id?: string
          numero: string
          oas_numero?: string | null
          objetivo?: string | null
          periodo?: string | null
          status?: string | null
          tipo_manutencao: string
          total_geral?: number | null
          total_pecas?: number | null
          total_trabalho?: number | null
        }
        Update: {
          aeronave_id?: string
          criado_em?: string | null
          criado_por?: string | null
          data_entrada?: string
          data_saida?: string | null
          descricao?: string | null
          dias_efetivos?: number | null
          dias_planejados?: number | null
          horas_celula_entrada?: number | null
          horas_celula_saida?: number | null
          id?: string
          numero?: string
          oas_numero?: string | null
          objetivo?: string | null
          periodo?: string | null
          status?: string | null
          tipo_manutencao?: string
          total_geral?: number | null
          total_pecas?: number | null
          total_trabalho?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ras_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ras_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ras_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "ras_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "ras_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "ras_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ctm_ras_fotos: {
        Row: {
          enviado_em: string | null
          id: string
          legenda: string | null
          ras_id: string
          url_foto: string
        }
        Insert: {
          enviado_em?: string | null
          id?: string
          legenda?: string | null
          ras_id: string
          url_foto: string
        }
        Update: {
          enviado_em?: string | null
          id?: string
          legenda?: string | null
          ras_id?: string
          url_foto?: string
        }
        Relationships: [
          {
            foreignKeyName: "ras_fotos_ras_id_fkey"
            columns: ["ras_id"]
            isOneToOne: false
            referencedRelation: "ctm_ras"
            referencedColumns: ["id"]
          },
        ]
      }
      ctm_ras_itens: {
        Row: {
          criado_em: string | null
          descricao: string
          fornecedor: string | null
          id: string
          item_tipo: string
          numero_fatura: string | null
          numero_peca: string | null
          numero_serie: string | null
          periodo: string | null
          quantidade: number | null
          ras_id: string
          valor_total: number | null
          valor_unitario: number | null
        }
        Insert: {
          criado_em?: string | null
          descricao: string
          fornecedor?: string | null
          id?: string
          item_tipo: string
          numero_fatura?: string | null
          numero_peca?: string | null
          numero_serie?: string | null
          periodo?: string | null
          quantidade?: number | null
          ras_id: string
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Update: {
          criado_em?: string | null
          descricao?: string
          fornecedor?: string | null
          id?: string
          item_tipo?: string
          numero_fatura?: string | null
          numero_peca?: string | null
          numero_serie?: string | null
          periodo?: string | null
          quantidade?: number | null
          ras_id?: string
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ras_items_ras_id_fkey"
            columns: ["ras_id"]
            isOneToOne: false
            referencedRelation: "ctm_ras"
            referencedColumns: ["id"]
          },
        ]
      }
      ctm_rastreamento: {
        Row: {
          aeronave_id: string | null
          ano: number
          atualizado_em: string | null
          cliente_id: string | null
          criado_em: string | null
          data_ultima_troca: string | null
          horas_apos: number | null
          horas_restantes: number | null
          horas_ultima_troca: number | null
          id: string
          mes: number
          nome_item: string
          nome_socio: string | null
          numero_nota_fiscal: string | null
          numero_ordem_servico: string | null
          orcamento: string | null
          tipo_controle: string
          valor_direito: string | null
          valor_esquerdo: string | null
        }
        Insert: {
          aeronave_id?: string | null
          ano: number
          atualizado_em?: string | null
          cliente_id?: string | null
          criado_em?: string | null
          data_ultima_troca?: string | null
          horas_apos?: number | null
          horas_restantes?: number | null
          horas_ultima_troca?: number | null
          id?: string
          mes: number
          nome_item: string
          nome_socio?: string | null
          numero_nota_fiscal?: string | null
          numero_ordem_servico?: string | null
          orcamento?: string | null
          tipo_controle: string
          valor_direito?: string | null
          valor_esquerdo?: string | null
        }
        Update: {
          aeronave_id?: string | null
          ano?: number
          atualizado_em?: string | null
          cliente_id?: string | null
          criado_em?: string | null
          data_ultima_troca?: string | null
          horas_apos?: number | null
          horas_restantes?: number | null
          horas_ultima_troca?: number | null
          id?: string
          mes?: number
          nome_item?: string
          nome_socio?: string | null
          numero_nota_fiscal?: string | null
          numero_ordem_servico?: string | null
          orcamento?: string | null
          tipo_controle?: string
          valor_direito?: string | null
          valor_esquerdo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ctm_tracking_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctm_tracking_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctm_tracking_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "ctm_tracking_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "ctm_tracking_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "ctm_tracking_client_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctm_tracking_client_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "ctm_tracking_client_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      ctm_rateio_custos: {
        Row: {
          atualizado_em: string | null
          cliente_id: string
          comprovante_url: string | null
          criado_em: string | null
          data_pagamento: string | null
          horas_voadas: number | null
          id: string
          ordem_servico_id: string
          percentual: number | null
          status_pagamento: string | null
          valor: number | null
        }
        Insert: {
          atualizado_em?: string | null
          cliente_id: string
          comprovante_url?: string | null
          criado_em?: string | null
          data_pagamento?: string | null
          horas_voadas?: number | null
          id?: string
          ordem_servico_id: string
          percentual?: number | null
          status_pagamento?: string | null
          valor?: number | null
        }
        Update: {
          atualizado_em?: string | null
          cliente_id?: string
          comprovante_url?: string | null
          criado_em?: string | null
          data_pagamento?: string | null
          horas_voadas?: number | null
          id?: string
          ordem_servico_id?: string
          percentual?: number | null
          status_pagamento?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ctm_cost_sharing_client_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctm_cost_sharing_client_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "ctm_cost_sharing_client_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      dados_portal_cliente: {
        Row: {
          atualizado_em: string | null
          caminho_arquivo: string | null
          cliente_id: string
          criado_em: string | null
          data_vencimento: string | null
          descricao: string | null
          enviado_por: string | null
          id: string
          status: string | null
          tipo_dado: string
          valor: number | null
        }
        Insert: {
          atualizado_em?: string | null
          caminho_arquivo?: string | null
          cliente_id: string
          criado_em?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          enviado_por?: string | null
          id?: string
          status?: string | null
          tipo_dado: string
          valor?: number | null
        }
        Update: {
          atualizado_em?: string | null
          caminho_arquivo?: string | null
          cliente_id?: string
          criado_em?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          enviado_por?: string | null
          id?: string
          status?: string | null
          tipo_dado?: string
          valor?: number | null
        }
        Relationships: []
      }
      datas_bloqueadas_voo: {
        Row: {
          aeronave_id: string | null
          bloqueado_por: string | null
          criado_em: string | null
          data_bloqueio: string
          frota_inteira: boolean | null
          id: string
          motivo: string | null
        }
        Insert: {
          aeronave_id?: string | null
          bloqueado_por?: string | null
          criado_em?: string | null
          data_bloqueio: string
          frota_inteira?: boolean | null
          id?: string
          motivo?: string | null
        }
        Update: {
          aeronave_id?: string | null
          bloqueado_por?: string | null
          criado_em?: string | null
          data_bloqueio?: string
          frota_inteira?: boolean | null
          id?: string
          motivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocked_flight_dates_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_flight_dates_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_flight_dates_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "blocked_flight_dates_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "blocked_flight_dates_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
      }
      departamentos: {
        Row: {
          atualizado_em: string | null
          cor: string | null
          criado_em: string | null
          criado_por: string
          departamento_pai_id: string | null
          descricao: string | null
          id: string
          nome: string
          ordem: number | null
        }
        Insert: {
          atualizado_em?: string | null
          cor?: string | null
          criado_em?: string | null
          criado_por: string
          departamento_pai_id?: string | null
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number | null
        }
        Update: {
          atualizado_em?: string | null
          cor?: string | null
          criado_em?: string | null
          criado_por?: string
          departamento_pai_id?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "departamentos_departamento_pai_id_fkey"
            columns: ["departamento_pai_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas_cliente_direto: {
        Row: {
          abastecimento_id: string | null
          aeronave_id: string | null
          aeronave_registro: string | null
          atualizado_em: string | null
          boleto_url: string | null
          categoria_nome: string
          clientes_id: string
          comprovante_pagamento_url: string | null
          controle_bancario_id: string | null
          criado_em: string | null
          criado_por: string | null
          data_envio: string | null
          data_pagamento: string | null
          data_pagamento_cliente: string | null
          data_ultimo_lembrete: string | null
          data_validacao: string | null
          data_vencimento: string
          descricao: string
          email_enviado: boolean | null
          enviado_por: string | null
          forma_pagamento: string | null
          fornecedor_cnpj: string | null
          fornecedor_dados: Json | null
          fornecedor_nome: string
          id: string
          lembrete_enviado: boolean | null
          meio_envio: string | null
          nome_cliente: string
          nome_socio: string | null
          nota_fiscal_url: string | null
          observacoes_pagamento: string | null
          observacoes_validacao: string | null
          outros_documentos: Json | null
          percentual: number | null
          quantidade_lembretes: number | null
          status: string
          validado_por: string | null
          valor: number
          valor_pago: number | null
        }
        Insert: {
          abastecimento_id?: string | null
          aeronave_id?: string | null
          aeronave_registro?: string | null
          atualizado_em?: string | null
          boleto_url?: string | null
          categoria_nome: string
          clientes_id: string
          comprovante_pagamento_url?: string | null
          controle_bancario_id?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_envio?: string | null
          data_pagamento?: string | null
          data_pagamento_cliente?: string | null
          data_ultimo_lembrete?: string | null
          data_validacao?: string | null
          data_vencimento: string
          descricao: string
          email_enviado?: boolean | null
          enviado_por?: string | null
          forma_pagamento?: string | null
          fornecedor_cnpj?: string | null
          fornecedor_dados?: Json | null
          fornecedor_nome: string
          id?: string
          lembrete_enviado?: boolean | null
          meio_envio?: string | null
          nome_cliente: string
          nome_socio?: string | null
          nota_fiscal_url?: string | null
          observacoes_pagamento?: string | null
          observacoes_validacao?: string | null
          outros_documentos?: Json | null
          percentual?: number | null
          quantidade_lembretes?: number | null
          status?: string
          validado_por?: string | null
          valor: number
          valor_pago?: number | null
        }
        Update: {
          abastecimento_id?: string | null
          aeronave_id?: string | null
          aeronave_registro?: string | null
          atualizado_em?: string | null
          boleto_url?: string | null
          categoria_nome?: string
          clientes_id?: string
          comprovante_pagamento_url?: string | null
          controle_bancario_id?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_envio?: string | null
          data_pagamento?: string | null
          data_pagamento_cliente?: string | null
          data_ultimo_lembrete?: string | null
          data_validacao?: string | null
          data_vencimento?: string
          descricao?: string
          email_enviado?: boolean | null
          enviado_por?: string | null
          forma_pagamento?: string | null
          fornecedor_cnpj?: string | null
          fornecedor_dados?: Json | null
          fornecedor_nome?: string
          id?: string
          lembrete_enviado?: boolean | null
          meio_envio?: string | null
          nome_cliente?: string
          nome_socio?: string | null
          nota_fiscal_url?: string | null
          observacoes_pagamento?: string | null
          observacoes_validacao?: string | null
          outros_documentos?: Json | null
          percentual?: number | null
          quantidade_lembretes?: number | null
          status?: string
          validado_por?: string | null
          valor?: number
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "despesas_cliente_direto_abastecimento_id_fkey"
            columns: ["abastecimento_id"]
            isOneToOne: false
            referencedRelation: "abastecimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_cliente_direto_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_cliente_direto_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_cliente_direto_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "despesas_cliente_direto_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "despesas_cliente_direto_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "despesas_cliente_direto_clientes_id_fkey"
            columns: ["clientes_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_cliente_direto_clientes_id_fkey"
            columns: ["clientes_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "despesas_cliente_direto_clientes_id_fkey"
            columns: ["clientes_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      despesas_manutencao: {
        Row: {
          aircraft_id: string | null
          client_id: string | null
          created_at: string | null
          created_by: string | null
          descricao: string
          id: string
          manutencao_id: string | null
          partner_expense_id: string | null
          service_order_id: string | null
          tipo_rateio: string
          updated_at: string | null
          valor: number
        }
        Insert: {
          aircraft_id?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          descricao: string
          id?: string
          manutencao_id?: string | null
          partner_expense_id?: string | null
          service_order_id?: string | null
          tipo_rateio?: string
          updated_at?: string | null
          valor?: number
        }
        Update: {
          aircraft_id?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string
          id?: string
          manutencao_id?: string | null
          partner_expense_id?: string | null
          service_order_id?: string | null
          tipo_rateio?: string
          updated_at?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_manutencao_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_manutencao_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_manutencao_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "despesas_manutencao_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "despesas_manutencao_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "despesas_manutencao_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_manutencao_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "despesas_manutencao_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "despesas_manutencao_partner_expense_id_fkey"
            columns: ["partner_expense_id"]
            isOneToOne: false
            referencedRelation: "partner_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas_manutencao_rateio: {
        Row: {
          client_partner_id: string
          created_at: string | null
          despesa_manutencao_id: string
          id: string
          percentual: number | null
          status_pagamento: string | null
          updated_at: string | null
          valor: number | null
        }
        Insert: {
          client_partner_id: string
          created_at?: string | null
          despesa_manutencao_id: string
          id?: string
          percentual?: number | null
          status_pagamento?: string | null
          updated_at?: string | null
          valor?: number | null
        }
        Update: {
          client_partner_id?: string
          created_at?: string | null
          despesa_manutencao_id?: string
          id?: string
          percentual?: number | null
          status_pagamento?: string | null
          updated_at?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "despesas_manutencao_rateio_client_partner_id_fkey"
            columns: ["client_partner_id"]
            isOneToOne: false
            referencedRelation: "socios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_manutencao_rateio_despesa_manutencao_id_fkey"
            columns: ["despesa_manutencao_id"]
            isOneToOne: false
            referencedRelation: "despesas_manutencao"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas_voo: {
        Row: {
          atualizado_em: string
          categoria_despesa: string | null
          ciclo_voo_id: string
          criado_em: string
          data_envio_cliente: string | null
          data_pagamento: string | null
          data_prevista: string | null
          data_recebida: string | null
          id: string
          nome_despesa: string
          observacoes: string | null
          prazo_dias: number | null
          status: string
          tipo_despesa: string
          url_anexo: string | null
          valor: number | null
        }
        Insert: {
          atualizado_em?: string
          categoria_despesa?: string | null
          ciclo_voo_id: string
          criado_em?: string
          data_envio_cliente?: string | null
          data_pagamento?: string | null
          data_prevista?: string | null
          data_recebida?: string | null
          id?: string
          nome_despesa: string
          observacoes?: string | null
          prazo_dias?: number | null
          status?: string
          tipo_despesa: string
          url_anexo?: string | null
          valor?: number | null
        }
        Update: {
          atualizado_em?: string
          categoria_despesa?: string | null
          ciclo_voo_id?: string
          criado_em?: string
          data_envio_cliente?: string | null
          data_pagamento?: string | null
          data_prevista?: string | null
          data_recebida?: string | null
          id?: string
          nome_despesa?: string
          observacoes?: string | null
          prazo_dias?: number | null
          status?: string
          tipo_despesa?: string
          url_anexo?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "flight_expenses_flight_cycle_id_fkey"
            columns: ["ciclo_voo_id"]
            isOneToOne: false
            referencedRelation: "ciclos_voo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_expenses_flight_cycle_id_fkey"
            columns: ["ciclo_voo_id"]
            isOneToOne: false
            referencedRelation: "ciclos_voo_ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      diario_mes: {
        Row: {
          aerodromo_base: string | null
          aeronave_id: string
          ano: number
          celula_anterior_ttotal: number | null
          celula_anterior_tvoo: number | null
          celula_atual_ttotal: number | null
          celula_atual_tvoo: number | null
          celula_disponivel_ttotal: number | null
          celula_disponivel_tvoo: number | null
          celula_prox_revisao_ttotal: number | null
          celula_prox_revisao_tvoo: number | null
          confirmado: boolean | null
          confirmado_em: string | null
          confirmado_por: string | null
          consumo_combustivel: string | null
          criado_em: string | null
          fechado: boolean | null
          horimetro_ativo: number | null
          horimetro_final: number | null
          horimetro_inicio: number | null
          id: string
          mes: number
          tarifa_diaria: number | null
          tem_tarifa_diaria: boolean | null
        }
        Insert: {
          aerodromo_base?: string | null
          aeronave_id: string
          ano: number
          celula_anterior_ttotal?: number | null
          celula_anterior_tvoo?: number | null
          celula_atual_ttotal?: number | null
          celula_atual_tvoo?: number | null
          celula_disponivel_ttotal?: number | null
          celula_disponivel_tvoo?: number | null
          celula_prox_revisao_ttotal?: number | null
          celula_prox_revisao_tvoo?: number | null
          confirmado?: boolean | null
          confirmado_em?: string | null
          confirmado_por?: string | null
          consumo_combustivel?: string | null
          criado_em?: string | null
          fechado?: boolean | null
          horimetro_ativo?: number | null
          horimetro_final?: number | null
          horimetro_inicio?: number | null
          id?: string
          mes: number
          tarifa_diaria?: number | null
          tem_tarifa_diaria?: boolean | null
        }
        Update: {
          aerodromo_base?: string | null
          aeronave_id?: string
          ano?: number
          celula_anterior_ttotal?: number | null
          celula_anterior_tvoo?: number | null
          celula_atual_ttotal?: number | null
          celula_atual_tvoo?: number | null
          celula_disponivel_ttotal?: number | null
          celula_disponivel_tvoo?: number | null
          celula_prox_revisao_ttotal?: number | null
          celula_prox_revisao_tvoo?: number | null
          confirmado?: boolean | null
          confirmado_em?: string | null
          confirmado_por?: string | null
          consumo_combustivel?: string | null
          criado_em?: string | null
          fechado?: boolean | null
          horimetro_ativo?: number | null
          horimetro_final?: number | null
          horimetro_inicio?: number | null
          id?: string
          mes?: number
          tarifa_diaria?: number | null
          tem_tarifa_diaria?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "diario_mes_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diario_mes_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diario_mes_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "diario_mes_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "diario_mes_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
      }
      documentos_internos: {
        Row: {
          caminho_arquivo: string
          criado_em: string
          enviado_por: string
          id: string
          nome: string
          pasta_id: string | null
          tamanho_arquivo: number
          tipo_arquivo: string
        }
        Insert: {
          caminho_arquivo: string
          criado_em?: string
          enviado_por: string
          id?: string
          nome: string
          pasta_id?: string | null
          tamanho_arquivo: number
          tipo_arquivo: string
        }
        Update: {
          caminho_arquivo?: string
          criado_em?: string
          enviado_por?: string
          id?: string
          nome?: string
          pasta_id?: string | null
          tamanho_arquivo?: number
          tipo_arquivo?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["pasta_id"]
            isOneToOne: false
            referencedRelation: "pastas_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_voo: {
        Row: {
          aeronave_id: string | null
          atualizado_em: string | null
          caminho_arquivo: string
          criado_em: string | null
          data_validade: string | null
          descricao: string | null
          dias_alerta: number | null
          enviado_por: string | null
          id: string
          nome: string
          tamanho_arquivo: number | null
          tipo_arquivo: string | null
          tipo_documento: string | null
        }
        Insert: {
          aeronave_id?: string | null
          atualizado_em?: string | null
          caminho_arquivo: string
          criado_em?: string | null
          data_validade?: string | null
          descricao?: string | null
          dias_alerta?: number | null
          enviado_por?: string | null
          id?: string
          nome: string
          tamanho_arquivo?: number | null
          tipo_arquivo?: string | null
          tipo_documento?: string | null
        }
        Update: {
          aeronave_id?: string | null
          atualizado_em?: string | null
          caminho_arquivo?: string
          criado_em?: string | null
          data_validade?: string | null
          descricao?: string | null
          dias_alerta?: number | null
          enviado_por?: string | null
          id?: string
          nome?: string
          tamanho_arquivo?: number | null
          tipo_arquivo?: string | null
          tipo_documento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flight_documents_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_documents_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_documents_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "flight_documents_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "flight_documents_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
      }
      emails_enviados: {
        Row: {
          anexos: Json
          assunto: string
          cc: string | null
          criado_em: string
          destinatario: string
          enviado_por: string | null
          erro_mensagem: string | null
          id: string
          mensagem: string | null
          provider_id: string | null
          reference_id: string | null
          reference_type: string | null
          status: string
          tipo: string | null
        }
        Insert: {
          anexos?: Json
          assunto: string
          cc?: string | null
          criado_em?: string
          destinatario: string
          enviado_por?: string | null
          erro_mensagem?: string | null
          id?: string
          mensagem?: string | null
          provider_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          tipo?: string | null
        }
        Update: {
          anexos?: Json
          assunto?: string
          cc?: string | null
          criado_em?: string
          destinatario?: string
          enviado_por?: string | null
          erro_mensagem?: string | null
          id?: string
          mensagem?: string | null
          provider_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          tipo?: string | null
        }
        Relationships: []
      }
      employee_payslips: {
        Row: {
          employee_id: string
          file_path: string
          id: string
          month: number
          uploaded_at: string | null
          uploaded_by: string | null
          year: number
        }
        Insert: {
          employee_id: string
          file_path: string
          id?: string
          month: number
          uploaded_at?: string | null
          uploaded_by?: string | null
          year: number
        }
        Update: {
          employee_id?: string
          file_path?: string
          id?: string
          month?: number
          uploaded_at?: string | null
          uploaded_by?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_payslips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_payslips_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_thirteenth_salary: {
        Row: {
          created_at: string | null
          first_installment_amount: number
          first_installment_date: string | null
          gross_value: number
          id: string
          net_value: number
          payment_status: string | null
          second_installment_amount: number
          second_installment_date: string | null
          updated_at: string | null
          user_profile: string
          year: number
        }
        Insert: {
          created_at?: string | null
          first_installment_amount?: number
          first_installment_date?: string | null
          gross_value?: number
          id?: string
          net_value?: number
          payment_status?: string | null
          second_installment_amount?: number
          second_installment_date?: string | null
          updated_at?: string | null
          user_profile: string
          year: number
        }
        Update: {
          created_at?: string | null
          first_installment_amount?: number
          first_installment_date?: string | null
          gross_value?: number
          id?: string
          net_value?: number
          payment_status?: string | null
          second_installment_amount?: number
          second_installment_date?: string | null
          updated_at?: string | null
          user_profile?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_thirteenth_salary_user_profile_fkey"
            columns: ["user_profile"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_vacation_config: {
        Row: {
          created_at: string | null
          id: string
          payment_status: string | null
          scheduled_date: string | null
          total_vacation_days: number
          updated_at: string | null
          user_profile: string
          vacation_gross_value: number
          vacation_net_value: number
          vacation_third_value: number
          working_months: number
          year: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          payment_status?: string | null
          scheduled_date?: string | null
          total_vacation_days?: number
          updated_at?: string | null
          user_profile: string
          vacation_gross_value?: number
          vacation_net_value?: number
          vacation_third_value?: number
          working_months?: number
          year: number
        }
        Update: {
          created_at?: string | null
          id?: string
          payment_status?: string | null
          scheduled_date?: string | null
          total_vacation_days?: number
          updated_at?: string | null
          user_profile?: string
          vacation_gross_value?: number
          vacation_net_value?: number
          vacation_third_value?: number
          working_months?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_vacation_config_user_profile_fkey"
            columns: ["user_profile"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa: {
        Row: {
          cnpj: string | null
          id: string
          razao_social: string | null
        }
        Insert: {
          cnpj?: string | null
          id?: string
          razao_social?: string | null
        }
        Update: {
          cnpj?: string | null
          id?: string
          razao_social?: string | null
        }
        Relationships: []
      }
      emprestimos_aeronave: {
        Row: {
          aerodromo_chegada: string | null
          aerodromo_partida: string
          atualizado_em: string | null
          combustivel_adicionado: number | null
          criado_em: string | null
          data_lancamento: string
          horas_devolvidas: number | null
          horas_emprestadas: number
          id: string
          lancamento_devolucao_id: string | null
          lancamento_diario_id: string | null
          nome_piloto: string | null
          observacoes: string | null
          trecho: string | null
        }
        Insert: {
          aerodromo_chegada?: string | null
          aerodromo_partida: string
          atualizado_em?: string | null
          combustivel_adicionado?: number | null
          criado_em?: string | null
          data_lancamento: string
          horas_devolvidas?: number | null
          horas_emprestadas: number
          id?: string
          lancamento_devolucao_id?: string | null
          lancamento_diario_id?: string | null
          nome_piloto?: string | null
          observacoes?: string | null
          trecho?: string | null
        }
        Update: {
          aerodromo_chegada?: string | null
          aerodromo_partida?: string
          atualizado_em?: string | null
          combustivel_adicionado?: number | null
          criado_em?: string | null
          data_lancamento?: string
          horas_devolvidas?: number | null
          horas_emprestadas?: number
          id?: string
          lancamento_devolucao_id?: string | null
          lancamento_diario_id?: string | null
          nome_piloto?: string | null
          observacoes?: string | null
          trecho?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aircraft_loans_logbook_entry_id_fkey"
            columns: ["lancamento_diario_id"]
            isOneToOne: false
            referencedRelation: "historico_voo_tripulante"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_loans_logbook_entry_id_fkey"
            columns: ["lancamento_diario_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_diario_bordo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_loans_payback_entry_id_fkey"
            columns: ["lancamento_devolucao_id"]
            isOneToOne: false
            referencedRelation: "historico_voo_tripulante"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_loans_payback_entry_id_fkey"
            columns: ["lancamento_devolucao_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_diario_bordo"
            referencedColumns: ["id"]
          },
        ]
      }
      escala_tripulacao: {
        Row: {
          aeronave_id: string | null
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          data_fim: string
          data_inicio: string
          funcao: string
          id: string
          membro_id: string
          observacoes: string | null
          solicitacao_id: string | null
          status: string
        }
        Insert: {
          aeronave_id?: string | null
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          data_fim: string
          data_inicio: string
          funcao?: string
          id?: string
          membro_id: string
          observacoes?: string | null
          solicitacao_id?: string | null
          status?: string
        }
        Update: {
          aeronave_id?: string | null
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          data_fim?: string
          data_inicio?: string
          funcao?: string
          id?: string
          membro_id?: string
          observacoes?: string | null
          solicitacao_id?: string | null
          status?: string
        }
        Relationships: []
      }
      expense_configu: {
        Row: {
          categoria_pai: string | null
          expense_type: string
          id: string
          subcategoria_1: string | null
          subcategoria_2: string | null
          subcategoria_3: string | null
          subcategoria_4: string | null
        }
        Insert: {
          categoria_pai?: string | null
          expense_type: string
          id?: string
          subcategoria_1?: string | null
          subcategoria_2?: string | null
          subcategoria_3?: string | null
          subcategoria_4?: string | null
        }
        Update: {
          categoria_pai?: string | null
          expense_type?: string
          id?: string
          subcategoria_1?: string | null
          subcategoria_2?: string | null
          subcategoria_3?: string | null
          subcategoria_4?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_configu_categoria_pai_fkey"
            columns: ["categoria_pai"]
            isOneToOne: false
            referencedRelation: "categorias_movimentacao"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          aircraft_id: string
          category: string
          created_at: string | null
          description: string
          expense_date: string
          id: string
          invoice_number: string | null
          observations: string | null
          payment_method: string | null
          payment_status: string | null
          ras_id: string | null
          split_data: Json | null
          supplier: string | null
          total_value: number
          updated_at: string | null
        }
        Insert: {
          aircraft_id: string
          category: string
          created_at?: string | null
          description: string
          expense_date: string
          id?: string
          invoice_number?: string | null
          observations?: string | null
          payment_method?: string | null
          payment_status?: string | null
          ras_id?: string | null
          split_data?: Json | null
          supplier?: string | null
          total_value: number
          updated_at?: string | null
        }
        Update: {
          aircraft_id?: string
          category?: string
          created_at?: string | null
          description?: string
          expense_date?: string
          id?: string
          invoice_number?: string | null
          observations?: string | null
          payment_method?: string | null
          payment_status?: string | null
          ras_id?: string | null
          split_data?: Json | null
          supplier?: string | null
          total_value?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "expenses_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "expenses_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "expenses_ras_id_fkey"
            columns: ["ras_id"]
            isOneToOne: false
            referencedRelation: "ctm_ras"
            referencedColumns: ["id"]
          },
        ]
      }
      expiration_alerts: {
        Row: {
          alert_type: string
          created_at: string
          days_until_expiry: number
          description: string | null
          entity_name: string | null
          expiry_date: string
          id: string
          reference_id: string
          reference_table: string
          severity: string
          title: string
          updated_at: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          days_until_expiry: number
          description?: string | null
          entity_name?: string | null
          expiry_date: string
          id?: string
          reference_id: string
          reference_table: string
          severity?: string
          title: string
          updated_at?: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          days_until_expiry?: number
          description?: string | null
          entity_name?: string | null
          expiry_date?: string
          id?: string
          reference_id?: string
          reference_table?: string
          severity?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      favorite_payers: {
        Row: {
          address: string | null
          city: string | null
          created_at: string | null
          document: string | null
          id: string
          name: string
          uf: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          document?: string | null
          id?: string
          name: string
          uf?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          document?: string | null
          id?: string
          name?: string
          uf?: string | null
          user_id?: string
        }
        Relationships: []
      }
      favorite_routes: {
        Row: {
          arrival_airport: string
          created_at: string | null
          departure_airport: string
          id: string
          name: string
          route: string
          updated_at: string | null
        }
        Insert: {
          arrival_airport: string
          created_at?: string | null
          departure_airport: string
          id?: string
          name: string
          route: string
          updated_at?: string | null
        }
        Update: {
          arrival_airport?: string
          created_at?: string | null
          departure_airport?: string
          id?: string
          name?: string
          route?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      fornecedores_combustivel: {
        Row: {
          atualizado_em: string | null
          codigo_icao: string | null
          criado_em: string | null
          id: string
          nome_cidade: string
          nome_fornecedor: string
          pessoa_contato: string | null
          preco_avgas: number | null
          preco_jet: number | null
          telefone: string | null
        }
        Insert: {
          atualizado_em?: string | null
          codigo_icao?: string | null
          criado_em?: string | null
          id?: string
          nome_cidade: string
          nome_fornecedor: string
          pessoa_contato?: string | null
          preco_avgas?: number | null
          preco_jet?: number | null
          telefone?: string | null
        }
        Update: {
          atualizado_em?: string | null
          codigo_icao?: string | null
          criado_em?: string | null
          id?: string
          nome_cidade?: string
          nome_fornecedor?: string
          pessoa_contato?: string | null
          preco_avgas?: number | null
          preco_jet?: number | null
          telefone?: string | null
        }
        Relationships: []
      }
      fornecedores_favoritos: {
        Row: {
          apelido: string | null
          atualizado_em: string
          categoria: string | null
          cidade: string | null
          conta_pagamento: string | null
          criado_em: string
          criado_por: string
          documento: string | null
          id: string
          nome_completo: string
          telefone: string | null
        }
        Insert: {
          apelido?: string | null
          atualizado_em?: string
          categoria?: string | null
          cidade?: string | null
          conta_pagamento?: string | null
          criado_em?: string
          criado_por: string
          documento?: string | null
          id?: string
          nome_completo: string
          telefone?: string | null
        }
        Update: {
          apelido?: string | null
          atualizado_em?: string
          categoria?: string | null
          cidade?: string | null
          conta_pagamento?: string | null
          criado_em?: string
          criado_por?: string
          documento?: string | null
          id?: string
          nome_completo?: string
          telefone?: string | null
        }
        Relationships: []
      }
      habilitacoes_tripulante: {
        Row: {
          atualizado_em: string | null
          CMA: Database["public"]["Enums"]["cma_classe"] | null
          criado_em: string | null
          data_validade: string | null
          FS_RH: string | null
          id: string
          membro_tripulacao_id: string | null
          numero_habilitacao: string | null
          observacao: string | null
          tipo_habilitacao: string
          validade_cma: string | null
        }
        Insert: {
          atualizado_em?: string | null
          CMA?: Database["public"]["Enums"]["cma_classe"] | null
          criado_em?: string | null
          data_validade?: string | null
          FS_RH?: string | null
          id?: string
          membro_tripulacao_id?: string | null
          numero_habilitacao?: string | null
          observacao?: string | null
          tipo_habilitacao: string
          validade_cma?: string | null
        }
        Update: {
          atualizado_em?: string | null
          CMA?: Database["public"]["Enums"]["cma_classe"] | null
          criado_em?: string | null
          data_validade?: string | null
          FS_RH?: string | null
          id?: string
          membro_tripulacao_id?: string | null
          numero_habilitacao?: string | null
          observacao?: string | null
          tipo_habilitacao?: string
          validade_cma?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crew_licenses_crew_member_id_fkey"
            columns: ["membro_tripulacao_id"]
            isOneToOne: false
            referencedRelation: "membros_tripulacao"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_rateio_consolidado: {
        Row: {
          aeronave_id: string
          aeronave_registro: string
          bank_reconciliation_id: string | null
          bank_transaction_id: string | null
          categoria_grupo: string | null
          categoria_id: string
          categoria_nome: string
          cliente_id: string
          cliente_nome: string
          consolidado_em: string | null
          consolidado_por: string | null
          criado_em: string | null
          data_competencia: string
          data_conciliacao: string
          data_pagamento: string
          descricao: string
          documento_fiscal: string | null
          foi_reembolso: boolean | null
          horas_totais_aeronave: number | null
          horas_voadas: number
          id: string
          lancamento_rateio_id: string | null
          observacao: string | null
          percentual_participacao: number | null
          percentual_uso: number | null
          reembolso_id: string | null
          status: string | null
          tipo_rateio: string
          valor_pago: number
          valor_rateado: number
          valor_total_lancamento: number
        }
        Insert: {
          aeronave_id: string
          aeronave_registro: string
          bank_reconciliation_id?: string | null
          bank_transaction_id?: string | null
          categoria_grupo?: string | null
          categoria_id: string
          categoria_nome: string
          cliente_id: string
          cliente_nome: string
          consolidado_em?: string | null
          consolidado_por?: string | null
          criado_em?: string | null
          data_competencia: string
          data_conciliacao: string
          data_pagamento: string
          descricao: string
          documento_fiscal?: string | null
          foi_reembolso?: boolean | null
          horas_totais_aeronave?: number | null
          horas_voadas?: number
          id?: string
          lancamento_rateio_id?: string | null
          observacao?: string | null
          percentual_participacao?: number | null
          percentual_uso?: number | null
          reembolso_id?: string | null
          status?: string | null
          tipo_rateio: string
          valor_pago: number
          valor_rateado: number
          valor_total_lancamento: number
        }
        Update: {
          aeronave_id?: string
          aeronave_registro?: string
          bank_reconciliation_id?: string | null
          bank_transaction_id?: string | null
          categoria_grupo?: string | null
          categoria_id?: string
          categoria_nome?: string
          cliente_id?: string
          cliente_nome?: string
          consolidado_em?: string | null
          consolidado_por?: string | null
          criado_em?: string | null
          data_competencia?: string
          data_conciliacao?: string
          data_pagamento?: string
          descricao?: string
          documento_fiscal?: string | null
          foi_reembolso?: boolean | null
          horas_totais_aeronave?: number | null
          horas_voadas?: number
          id?: string
          lancamento_rateio_id?: string | null
          observacao?: string | null
          percentual_participacao?: number | null
          percentual_uso?: number | null
          reembolso_id?: string | null
          status?: string | null
          tipo_rateio?: string
          valor_pago?: number
          valor_rateado?: number
          valor_total_lancamento?: number
        }
        Relationships: []
      }
      historico_recibos: {
        Row: {
          ano: number
          caminho_pdf: string
          cliente_id: string | null
          criado_em: string | null
          data_emissao: string
          id: string
          mes: number
          numero_recibo: string
          tipo_recibo: string
          usuario_id: string
          valor: number
        }
        Insert: {
          ano: number
          caminho_pdf: string
          cliente_id?: string | null
          criado_em?: string | null
          data_emissao: string
          id?: string
          mes: number
          numero_recibo: string
          tipo_recibo: string
          usuario_id: string
          valor: number
        }
        Update: {
          ano?: number
          caminho_pdf?: string
          cliente_id?: string | null
          criado_em?: string | null
          data_emissao?: string
          id?: string
          mes?: number
          numero_recibo?: string
          tipo_recibo?: string
          usuario_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "receipt_history_client_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_history_client_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "receipt_history_client_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      horas_mensais_consolidadas: {
        Row: {
          aeronave_id: string
          aeronave_registro: string
          ano: number
          atualizado_em: string | null
          clientes_id: string
          criado_em: string | null
          data_referencia: string
          fonte_diario_bordo: boolean | null
          fonte_portal_cliente: boolean | null
          horas_totais_aeronave: number
          horas_voadas: number
          id: string
          mes: number
          percentual_uso: number
          validado: boolean | null
          validado_em: string | null
          validado_por: string | null
        }
        Insert: {
          aeronave_id: string
          aeronave_registro: string
          ano: number
          atualizado_em?: string | null
          clientes_id: string
          criado_em?: string | null
          data_referencia: string
          fonte_diario_bordo?: boolean | null
          fonte_portal_cliente?: boolean | null
          horas_totais_aeronave: number
          horas_voadas?: number
          id?: string
          mes: number
          percentual_uso: number
          validado?: boolean | null
          validado_em?: string | null
          validado_por?: string | null
        }
        Update: {
          aeronave_id?: string
          aeronave_registro?: string
          ano?: number
          atualizado_em?: string | null
          clientes_id?: string
          criado_em?: string | null
          data_referencia?: string
          fonte_diario_bordo?: boolean | null
          fonte_portal_cliente?: boolean | null
          horas_totais_aeronave?: number
          horas_voadas?: number
          id?: string
          mes?: number
          percentual_uso?: number
          validado?: boolean | null
          validado_em?: string | null
          validado_por?: string | null
        }
        Relationships: []
      }
      horas_voo_tripulante: {
        Row: {
          aeronave_id: string
          ano: number
          atualizado_em: string | null
          criado_em: string | null
          dia_voo: string
          horas_ifr: number | null
          horas_noturnas: number | null
          horas_totais: number | null
          id: string
          membro_tripulacao_id: string
          mes: number
        }
        Insert: {
          aeronave_id: string
          ano: number
          atualizado_em?: string | null
          criado_em?: string | null
          dia_voo: string
          horas_ifr?: number | null
          horas_noturnas?: number | null
          horas_totais?: number | null
          id?: string
          membro_tripulacao_id: string
          mes: number
        }
        Update: {
          aeronave_id?: string
          ano?: number
          atualizado_em?: string | null
          criado_em?: string | null
          dia_voo?: string
          horas_ifr?: number | null
          horas_noturnas?: number | null
          horas_totais?: number | null
          id?: string
          membro_tripulacao_id?: string
          mes?: number
        }
        Relationships: [
          {
            foreignKeyName: "crew_flight_hours_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_flight_hours_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_flight_hours_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "crew_flight_hours_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "crew_flight_hours_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "crew_flight_hours_crew_member_id_fkey"
            columns: ["membro_tripulacao_id"]
            isOneToOne: false
            referencedRelation: "membros_tripulacao"
            referencedColumns: ["id"]
          },
        ]
      }
      hoteis: {
        Row: {
          cidade: string | null
          created_at: string | null
          endereco: string | null
          id: string
          nome: string
          preco_duplo: number | null
          preco_single: number | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          cidade?: string | null
          created_at?: string | null
          endereco?: string | null
          id?: string
          nome: string
          preco_duplo?: number | null
          preco_single?: number | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          cidade?: string | null
          created_at?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          preco_duplo?: number | null
          preco_single?: number | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      hotel_reservations: {
        Row: {
          booking_reference: string | null
          checkin_date: string
          checkout_date: string
          city: string | null
          confirmation_code: string | null
          country: string | null
          created_at: string | null
          guests: number | null
          hotel_address: string | null
          hotel_name: string
          id: string
          nights: number | null
          notes: string | null
          room_type: string | null
          status: string | null
          total_amount: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          booking_reference?: string | null
          checkin_date: string
          checkout_date: string
          city?: string | null
          confirmation_code?: string | null
          country?: string | null
          created_at?: string | null
          guests?: number | null
          hotel_address?: string | null
          hotel_name: string
          id?: string
          nights?: number | null
          notes?: string | null
          room_type?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          booking_reference?: string | null
          checkin_date?: string
          checkout_date?: string
          city?: string | null
          confirmation_code?: string | null
          country?: string | null
          created_at?: string | null
          guests?: number | null
          hotel_address?: string | null
          hotel_name?: string
          id?: string
          nights?: number | null
          notes?: string | null
          room_type?: string | null
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      hour_transactions: {
        Row: {
          aircraft_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          from_partner_id: string
          hours: number
          id: string
          logbook_entry_id: string | null
          metadata: Json | null
          to_partner_id: string
          type: string | null
        }
        Insert: {
          aircraft_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          from_partner_id: string
          hours: number
          id?: string
          logbook_entry_id?: string | null
          metadata?: Json | null
          to_partner_id: string
          type?: string | null
        }
        Update: {
          aircraft_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          from_partner_id?: string
          hours?: number
          id?: string
          logbook_entry_id?: string | null
          metadata?: Json | null
          to_partner_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hour_transactions_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_transactions_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_transactions_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "hour_transactions_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "hour_transactions_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "hour_transactions_from_partner_id_fkey"
            columns: ["from_partner_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_transactions_from_partner_id_fkey"
            columns: ["from_partner_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "hour_transactions_from_partner_id_fkey"
            columns: ["from_partner_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "hour_transactions_to_partner_id_fkey"
            columns: ["to_partner_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_transactions_to_partner_id_fkey"
            columns: ["to_partner_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "hour_transactions_to_partner_id_fkey"
            columns: ["to_partner_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      instituicoes_bancarias: {
        Row: {
          id: string
          ordem: number
          rotulo: string
        }
        Insert: {
          id: string
          ordem?: number
          rotulo: string
        }
        Update: {
          id?: string
          ordem?: number
          rotulo?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          client_address: string | null
          client_document: string | null
          client_email: string | null
          client_name: string
          created_at: string | null
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string
          observations: string | null
          pdf_url: string | null
          service_description: string
          status: string | null
          updated_at: string | null
          user_id: string
          value: number
        }
        Insert: {
          client_address?: string | null
          client_document?: string | null
          client_email?: string | null
          client_name: string
          created_at?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          issue_date: string
          observations?: string | null
          pdf_url?: string | null
          service_description: string
          status?: string | null
          updated_at?: string | null
          user_id: string
          value: number
        }
        Update: {
          client_address?: string | null
          client_document?: string | null
          client_email?: string | null
          client_name?: string
          created_at?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          observations?: string | null
          pdf_url?: string | null
          service_description?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      justificativa_ausencia: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          atualizado_em: string
          criado_em: string
          data_registro: string
          id: string
          id_usuario: string
          justificativa: string
          motivo_rejeicao: string | null
          status: string
          url_documento: string | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          atualizado_em?: string
          criado_em?: string
          data_registro: string
          id?: string
          id_usuario: string
          justificativa: string
          motivo_rejeicao?: string | null
          status?: string
          url_documento?: string | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          atualizado_em?: string
          criado_em?: string
          data_registro?: string
          id?: string
          id_usuario?: string
          justificativa?: string
          motivo_rejeicao?: string | null
          status?: string
          url_documento?: string | null
        }
        Relationships: []
      }
      lancamento_ponto: {
        Row: {
          atualizado_em: string | null
          ausencia_aprovada: boolean | null
          ausencia_aprovada_em: string | null
          ausencia_aprovada_por: string | null
          criado_em: string | null
          data_entrada: string
          entrada_hora: string | null
          fim_almoco: string | null
          horas_totais: number | null
          id: string
          inicio_almoco: string | null
          motivo_da_ausencia: string | null
          saida_hora: string | null
          status: string
          user_id: string
        }
        Insert: {
          atualizado_em?: string | null
          ausencia_aprovada?: boolean | null
          ausencia_aprovada_em?: string | null
          ausencia_aprovada_por?: string | null
          criado_em?: string | null
          data_entrada?: string
          entrada_hora?: string | null
          fim_almoco?: string | null
          horas_totais?: number | null
          id?: string
          inicio_almoco?: string | null
          motivo_da_ausencia?: string | null
          saida_hora?: string | null
          status?: string
          user_id: string
        }
        Update: {
          atualizado_em?: string | null
          ausencia_aprovada?: boolean | null
          ausencia_aprovada_em?: string | null
          ausencia_aprovada_por?: string | null
          criado_em?: string | null
          data_entrada?: string
          entrada_hora?: string | null
          fim_almoco?: string | null
          horas_totais?: number | null
          id?: string
          inicio_almoco?: string | null
          motivo_da_ausencia?: string | null
          saida_hora?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      lancamento_ponto_anexos: {
        Row: {
          caminho_arquivo: string
          criado_em: string | null
          data_entrada: string
          id: string
          lancamento_ponto_id: string | null
          nome_arquivo: string
          observacoes: string | null
          tipo_arquivo: string | null
          tipo_justificativa: string
          user_id: string
        }
        Insert: {
          caminho_arquivo: string
          criado_em?: string | null
          data_entrada: string
          id?: string
          lancamento_ponto_id?: string | null
          nome_arquivo: string
          observacoes?: string | null
          tipo_arquivo?: string | null
          tipo_justificativa?: string
          user_id: string
        }
        Update: {
          caminho_arquivo?: string
          criado_em?: string | null
          data_entrada?: string
          id?: string
          lancamento_ponto_id?: string | null
          nome_arquivo?: string
          observacoes?: string | null
          tipo_arquivo?: string | null
          tipo_justificativa?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entry_anexos_lancamento_ponto_id_fkey"
            columns: ["lancamento_ponto_id"]
            isOneToOne: false
            referencedRelation: "lancamento_ponto"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos_diario_bordo: {
        Row: {
          abastecido: boolean | null
          acoes_corretivas: string | null
          aerodromo_chegada: string
          aerodromo_partida: string
          aeronave_id: string
          assinado_por: string | null
          carga_kg: string | null
          celula: number | null
          celula_tvoo: number | null
          cliente_tomador_emprestimo_id: string | null
          clientes_id: string | null
          combustivel_adicionado: number | null
          confirmado: boolean | null
          confirmado_em: string | null
          consumo_combustivel_total: number | null
          consumo_combustivel_voo: number | null
          criado_em: string | null
          criado_por: string | null
          data_assinatura_piloto: string | null
          data_registro: string
          detectado_por: string | null
          diario_mes: string
          discrepancias: string | null
          distancia_nm: number | null
          divisao_igual: boolean | null
          emprestimo: boolean | null
          fechado: boolean | null
          fechado_em: string | null
          fechado_por: string | null
          horas_celula_proxima_manutencao: number | null
          horas_diurnas: number | null
          horas_noturnas: number | null
          id: string
          litros_combustivel_inicio_voo: number | null
          local_combustivel: string | null
          natureza_voo: string
          numero_sequencial: number | null
          ocorrencias: string | null
          origem_pic: string | null
          origem_sic: string | null
          passageiros: number | null
          pic_canac: string
          pousos_total: number | null
          preco_combustivel_litro: number | null
          responsavel_aprovacao_manutencao: string | null
          sic_canac: string | null
          sic_name: string | null
          socio_tomador_emprestimo_id: string | null
          socios_id: string | null
          socios_nome: string | null
          tarifa_diaria: string | null
          tempo_ac: string | null
          tempo_cor: string | null
          tempo_dep: string | null
          tempo_ifr: number | null
          tempo_pou: string | null
          tempo_total: number | null
          tempo_voo: number | null
          tipo_combustivel: string | null
          tipo_manutencao_proxima: string | null
          tipo_manutencao_ultima: string | null
          trecho: string | null
          tripulacao_checkin_hora: string | null
        }
        Insert: {
          abastecido?: boolean | null
          acoes_corretivas?: string | null
          aerodromo_chegada: string
          aerodromo_partida: string
          aeronave_id: string
          assinado_por?: string | null
          carga_kg?: string | null
          celula?: number | null
          celula_tvoo?: number | null
          cliente_tomador_emprestimo_id?: string | null
          clientes_id?: string | null
          combustivel_adicionado?: number | null
          confirmado?: boolean | null
          confirmado_em?: string | null
          consumo_combustivel_total?: number | null
          consumo_combustivel_voo?: number | null
          criado_em?: string | null
          criado_por?: string | null
          data_assinatura_piloto?: string | null
          data_registro: string
          detectado_por?: string | null
          diario_mes: string
          discrepancias?: string | null
          distancia_nm?: number | null
          divisao_igual?: boolean | null
          emprestimo?: boolean | null
          fechado?: boolean | null
          fechado_em?: string | null
          fechado_por?: string | null
          horas_celula_proxima_manutencao?: number | null
          horas_diurnas?: number | null
          horas_noturnas?: number | null
          id?: string
          litros_combustivel_inicio_voo?: number | null
          local_combustivel?: string | null
          natureza_voo: string
          numero_sequencial?: number | null
          ocorrencias?: string | null
          origem_pic?: string | null
          origem_sic?: string | null
          passageiros?: number | null
          pic_canac: string
          pousos_total?: number | null
          preco_combustivel_litro?: number | null
          responsavel_aprovacao_manutencao?: string | null
          sic_canac?: string | null
          sic_name?: string | null
          socio_tomador_emprestimo_id?: string | null
          socios_id?: string | null
          socios_nome?: string | null
          tarifa_diaria?: string | null
          tempo_ac?: string | null
          tempo_cor?: string | null
          tempo_dep?: string | null
          tempo_ifr?: number | null
          tempo_pou?: string | null
          tempo_total?: number | null
          tempo_voo?: number | null
          tipo_combustivel?: string | null
          tipo_manutencao_proxima?: string | null
          tipo_manutencao_ultima?: string | null
          trecho?: string | null
          tripulacao_checkin_hora?: string | null
        }
        Update: {
          abastecido?: boolean | null
          acoes_corretivas?: string | null
          aerodromo_chegada?: string
          aerodromo_partida?: string
          aeronave_id?: string
          assinado_por?: string | null
          carga_kg?: string | null
          celula?: number | null
          celula_tvoo?: number | null
          cliente_tomador_emprestimo_id?: string | null
          clientes_id?: string | null
          combustivel_adicionado?: number | null
          confirmado?: boolean | null
          confirmado_em?: string | null
          consumo_combustivel_total?: number | null
          consumo_combustivel_voo?: number | null
          criado_em?: string | null
          criado_por?: string | null
          data_assinatura_piloto?: string | null
          data_registro?: string
          detectado_por?: string | null
          diario_mes?: string
          discrepancias?: string | null
          distancia_nm?: number | null
          divisao_igual?: boolean | null
          emprestimo?: boolean | null
          fechado?: boolean | null
          fechado_em?: string | null
          fechado_por?: string | null
          horas_celula_proxima_manutencao?: number | null
          horas_diurnas?: number | null
          horas_noturnas?: number | null
          id?: string
          litros_combustivel_inicio_voo?: number | null
          local_combustivel?: string | null
          natureza_voo?: string
          numero_sequencial?: number | null
          ocorrencias?: string | null
          origem_pic?: string | null
          origem_sic?: string | null
          passageiros?: number | null
          pic_canac?: string
          pousos_total?: number | null
          preco_combustivel_litro?: number | null
          responsavel_aprovacao_manutencao?: string | null
          sic_canac?: string | null
          sic_name?: string | null
          socio_tomador_emprestimo_id?: string | null
          socios_id?: string | null
          socios_nome?: string | null
          tarifa_diaria?: string | null
          tempo_ac?: string | null
          tempo_cor?: string | null
          tempo_dep?: string | null
          tempo_ifr?: number | null
          tempo_pou?: string | null
          tempo_total?: number | null
          tempo_voo?: number | null
          tipo_combustivel?: string | null
          tipo_manutencao_proxima?: string | null
          tipo_manutencao_ultima?: string | null
          trecho?: string | null
          tripulacao_checkin_hora?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_diario_bordo_diario_mes_fkey"
            columns: ["diario_mes"]
            isOneToOne: false
            referencedRelation: "diario_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_diario_bordo_diario_mes_fkey"
            columns: ["diario_mes"]
            isOneToOne: false
            referencedRelation: "diario_mes_com_disponivel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_diario_bordo_socio_tomador_emprestimo_id_fkey"
            columns: ["socio_tomador_emprestimo_id"]
            isOneToOne: false
            referencedRelation: "socios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_diario_bordo_socios_id_fkey"
            columns: ["socios_id"]
            isOneToOne: false
            referencedRelation: "socios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logbook_entries_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logbook_entries_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logbook_entries_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "logbook_entries_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "logbook_entries_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "logbook_entries_clientes_id_fkey"
            columns: ["clientes_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logbook_entries_clientes_id_fkey"
            columns: ["clientes_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "logbook_entries_clientes_id_fkey"
            columns: ["clientes_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "logbook_entries_created_by_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logbook_entries_loan_recipient_client_fkey"
            columns: ["cliente_tomador_emprestimo_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logbook_entries_loan_recipient_client_fkey"
            columns: ["cliente_tomador_emprestimo_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "logbook_entries_loan_recipient_client_fkey"
            columns: ["cliente_tomador_emprestimo_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      maintenance_items: {
        Row: {
          aircraft_id: string
          created_at: string | null
          description: string
          id: string
          interval_type: string | null
          interval_value: number | null
          last_done_cycles: number | null
          last_done_date: string | null
          last_done_hours: number | null
          next_due_cycles: number | null
          next_due_date: string | null
          next_due_hours: number | null
          observations: string | null
          responsible_mechanic: string | null
          status: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          aircraft_id: string
          created_at?: string | null
          description: string
          id?: string
          interval_type?: string | null
          interval_value?: number | null
          last_done_cycles?: number | null
          last_done_date?: string | null
          last_done_hours?: number | null
          next_due_cycles?: number | null
          next_due_date?: string | null
          next_due_hours?: number | null
          observations?: string | null
          responsible_mechanic?: string | null
          status?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          aircraft_id?: string
          created_at?: string | null
          description?: string
          id?: string
          interval_type?: string | null
          interval_value?: number | null
          last_done_cycles?: number | null
          last_done_date?: string | null
          last_done_hours?: number | null
          next_due_cycles?: number | null
          next_due_date?: string | null
          next_due_hours?: number | null
          observations?: string | null
          responsible_mechanic?: string | null
          status?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_items_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_items_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_items_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "maintenance_items_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "maintenance_items_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
      }
      maintenance_notifications: {
        Row: {
          aircraft_id: string
          alert_level: string
          created_at: string | null
          hours_remaining: number
          id: string
          is_read: boolean | null
          maintenance_type: string
          message: string
          notified_at: string | null
        }
        Insert: {
          aircraft_id: string
          alert_level: string
          created_at?: string | null
          hours_remaining: number
          id?: string
          is_read?: boolean | null
          maintenance_type: string
          message: string
          notified_at?: string | null
        }
        Update: {
          aircraft_id?: string
          alert_level?: string
          created_at?: string | null
          hours_remaining?: number
          id?: string
          is_read?: boolean | null
          maintenance_type?: string
          message?: string
          notified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_notifications_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_notifications_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_notifications_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "maintenance_notifications_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "maintenance_notifications_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
      }
      maintenance_reports: {
        Row: {
          aircraft_id: string
          corrective_action: string | null
          created_at: string | null
          description: string
          id: string
          photo_urls: string[] | null
          report_date: string | null
          reported_by: string
          resolved_at: string | null
          resolved_by: string | null
          sent_date: string | null
          sent_to_ctm: boolean | null
          severity: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          aircraft_id: string
          corrective_action?: string | null
          created_at?: string | null
          description: string
          id?: string
          photo_urls?: string[] | null
          report_date?: string | null
          reported_by: string
          resolved_at?: string | null
          resolved_by?: string | null
          sent_date?: string | null
          sent_to_ctm?: boolean | null
          severity: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          aircraft_id?: string
          corrective_action?: string | null
          created_at?: string | null
          description?: string
          id?: string
          photo_urls?: string[] | null
          report_date?: string | null
          reported_by?: string
          resolved_at?: string | null
          resolved_by?: string | null
          sent_date?: string | null
          sent_to_ctm?: boolean | null
          severity?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_reports_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_reports_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_reports_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "maintenance_reports_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "maintenance_reports_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "maintenance_reports_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      membros_tripulacao: {
        Row: {
          atualizado_em: string | null
          canac: string
          cpf: string | null
          criado_em: string | null
          data_admissao: string | null
          data_nascimento: string | null
          endereco: string | null
          id: string
          nome_completo: string
          rg: string | null
          status: string | null
          telefone: string | null
          url_avatar: string | null
          user_id: string | null
        }
        Insert: {
          atualizado_em?: string | null
          canac: string
          cpf?: string | null
          criado_em?: string | null
          data_admissao?: string | null
          data_nascimento?: string | null
          endereco?: string | null
          id?: string
          nome_completo: string
          rg?: string | null
          status?: string | null
          telefone?: string | null
          url_avatar?: string | null
          user_id?: string | null
        }
        Update: {
          atualizado_em?: string | null
          canac?: string
          cpf?: string | null
          criado_em?: string | null
          data_admissao?: string | null
          data_nascimento?: string | null
          endereco?: string | null
          id?: string
          nome_completo?: string
          rg?: string | null
          status?: string | null
          telefone?: string | null
          url_avatar?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      monthly_diary_closures: {
        Row: {
          aircraft_id: string
          closed_at: string | null
          closed_by: string | null
          closing_observations: string | null
          created_at: string | null
          id: string
          month: number
          total_fuel_added: number
          total_hours: number
          total_landings: number
          year: number
        }
        Insert: {
          aircraft_id: string
          closed_at?: string | null
          closed_by?: string | null
          closing_observations?: string | null
          created_at?: string | null
          id?: string
          month: number
          total_fuel_added?: number
          total_hours?: number
          total_landings?: number
          year: number
        }
        Update: {
          aircraft_id?: string
          closed_at?: string | null
          closed_by?: string | null
          closing_observations?: string | null
          created_at?: string | null
          id?: string
          month?: number
          total_fuel_added?: number
          total_hours?: number
          total_landings?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_diary_closures_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_diary_closures_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_diary_closures_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "monthly_diary_closures_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "monthly_diary_closures_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
      }
      movimentacoes: {
        Row: {
          aeronave_id: string | null
          atualizado_em: string
          banco_nome: string | null
          boleto_url: string | null
          categoria_id: string | null
          categoria_nome: string | null
          clientes_id: string | null
          comprovante_url: string | null
          conciliacao_id: string | null
          contas_apagar_id: string | null
          contas_areceber_id: string | null
          criado_em: string
          criado_por: string | null
          data_competencia: string
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string
          despesa_cliente_direto_id: string | null
          forma_pagamento: string | null
          fornecedor_nome: string | null
          grupo_custo: string | null
          id: string
          movimentacao_origem_id: string | null
          movimentacao_pai_id: string | null
          nf_url: string | null
          numero_boleto: string | null
          numero_doc: string | null
          numero_nf: string | null
          numero_parcela: number
          numero_recibo: string | null
          observacoes: string | null
          pago_diretamente: boolean
          pago_por: string | null
          percentual_uso: number | null
          quantidade_parcelas: number
          recibo_url: string | null
          reembolsavel: boolean
          reembolso_quitado: boolean
          reference_id: string | null
          reference_type: string | null
          socio_id: string | null
          status: string
          tipo: string | null
          tipo_caixa: string | null
          valor_original: number | null
          valor_pago_real: number | null
          valor_rateado: number
        }
        Insert: {
          aeronave_id?: string | null
          atualizado_em?: string
          banco_nome?: string | null
          boleto_url?: string | null
          categoria_id?: string | null
          categoria_nome?: string | null
          clientes_id?: string | null
          comprovante_url?: string | null
          conciliacao_id?: string | null
          contas_apagar_id?: string | null
          contas_areceber_id?: string | null
          criado_em?: string
          criado_por?: string | null
          data_competencia: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao: string
          despesa_cliente_direto_id?: string | null
          forma_pagamento?: string | null
          fornecedor_nome?: string | null
          grupo_custo?: string | null
          id?: string
          movimentacao_origem_id?: string | null
          movimentacao_pai_id?: string | null
          nf_url?: string | null
          numero_boleto?: string | null
          numero_doc?: string | null
          numero_nf?: string | null
          numero_parcela?: number
          numero_recibo?: string | null
          observacoes?: string | null
          pago_diretamente?: boolean
          pago_por?: string | null
          percentual_uso?: number | null
          quantidade_parcelas?: number
          recibo_url?: string | null
          reembolsavel?: boolean
          reembolso_quitado?: boolean
          reference_id?: string | null
          reference_type?: string | null
          socio_id?: string | null
          status?: string
          tipo?: string | null
          tipo_caixa?: string | null
          valor_original?: number | null
          valor_pago_real?: number | null
          valor_rateado: number
        }
        Update: {
          aeronave_id?: string | null
          atualizado_em?: string
          banco_nome?: string | null
          boleto_url?: string | null
          categoria_id?: string | null
          categoria_nome?: string | null
          clientes_id?: string | null
          comprovante_url?: string | null
          conciliacao_id?: string | null
          contas_apagar_id?: string | null
          contas_areceber_id?: string | null
          criado_em?: string
          criado_por?: string | null
          data_competencia?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string
          despesa_cliente_direto_id?: string | null
          forma_pagamento?: string | null
          fornecedor_nome?: string | null
          grupo_custo?: string | null
          id?: string
          movimentacao_origem_id?: string | null
          movimentacao_pai_id?: string | null
          nf_url?: string | null
          numero_boleto?: string | null
          numero_doc?: string | null
          numero_nf?: string | null
          numero_parcela?: number
          numero_recibo?: string | null
          observacoes?: string | null
          pago_diretamente?: boolean
          pago_por?: string | null
          percentual_uso?: number | null
          quantidade_parcelas?: number
          recibo_url?: string | null
          reembolsavel?: boolean
          reembolso_quitado?: boolean
          reference_id?: string | null
          reference_type?: string | null
          socio_id?: string | null
          status?: string
          tipo?: string | null
          tipo_caixa?: string | null
          valor_original?: number | null
          valor_pago_real?: number | null
          valor_rateado?: number
        }
        Relationships: [
          {
            foreignKeyName: "mov_aeronave_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mov_aeronave_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mov_aeronave_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "mov_aeronave_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "mov_aeronave_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "mov_cliente_fkey"
            columns: ["clientes_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mov_cliente_fkey"
            columns: ["clientes_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "mov_cliente_fkey"
            columns: ["clientes_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "mov_contas_apagar_fkey"
            columns: ["contas_apagar_id"]
            isOneToOne: false
            referencedRelation: "contas_apagar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mov_contas_areceber_fkey"
            columns: ["contas_areceber_id"]
            isOneToOne: false
            referencedRelation: "contas_areceber"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mov_origem_fkey"
            columns: ["movimentacao_origem_id"]
            isOneToOne: false
            referencedRelation: "movimentacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mov_pai_fkey"
            columns: ["movimentacao_pai_id"]
            isOneToOne: false
            referencedRelation: "movimentacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mov_socio_fkey"
            columns: ["socio_id"]
            isOneToOne: false
            referencedRelation: "socios"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_fiscais_saida: {
        Row: {
          aeronave: string | null
          aircraft_id: string | null
          arquivo_pdf_url: string | null
          atualizado_em: string | null
          categoria: string
          categoria_despesa_id: string | null
          categoria_despesa_subcategoria: string | null
          categoria_id: string | null
          cliente_cnpj: string
          cliente_id: string | null
          cliente_nome: string
          contas_areceber_id: string | null
          criado_em: string | null
          criado_por: string | null
          data_criacao: string
          data_vencimento: string
          descricao: string | null
          id: string
          numero: string
          socio_id: string | null
          status: string
          valor: number
        }
        Insert: {
          aeronave?: string | null
          aircraft_id?: string | null
          arquivo_pdf_url?: string | null
          atualizado_em?: string | null
          categoria: string
          categoria_despesa_id?: string | null
          categoria_despesa_subcategoria?: string | null
          categoria_id?: string | null
          cliente_cnpj: string
          cliente_id?: string | null
          cliente_nome: string
          contas_areceber_id?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_criacao: string
          data_vencimento: string
          descricao?: string | null
          id?: string
          numero: string
          socio_id?: string | null
          status: string
          valor: number
        }
        Update: {
          aeronave?: string | null
          aircraft_id?: string | null
          arquivo_pdf_url?: string | null
          atualizado_em?: string | null
          categoria?: string
          categoria_despesa_id?: string | null
          categoria_despesa_subcategoria?: string | null
          categoria_id?: string | null
          cliente_cnpj?: string
          cliente_id?: string | null
          cliente_nome?: string
          contas_areceber_id?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_criacao?: string
          data_vencimento?: string
          descricao?: string | null
          id?: string
          numero?: string
          socio_id?: string | null
          status?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_saida_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["matricula"]
          },
          {
            foreignKeyName: "notas_fiscais_saida_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "ciclos_voo_ativos"
            referencedColumns: ["registration"]
          },
          {
            foreignKeyName: "notas_fiscais_saida_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["registro"]
          },
          {
            foreignKeyName: "notas_fiscais_saida_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "historico_voo_tripulante"
            referencedColumns: ["matricula_aeronave"]
          },
          {
            foreignKeyName: "notas_fiscais_saida_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["matricula"]
          },
          {
            foreignKeyName: "notas_fiscais_saida_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "vw_categorias_aeronave"
            referencedColumns: ["aeronave_registro"]
          },
          {
            foreignKeyName: "notas_fiscais_saida_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave"]
          },
          {
            foreignKeyName: "notas_fiscais_saida_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_registro"]
          },
          {
            foreignKeyName: "notas_fiscais_saida_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["aeronave"]
          },
          {
            foreignKeyName: "notas_fiscais_saida_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_saida_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_saida_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "notas_fiscais_saida_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "notas_fiscais_saida_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "notas_fiscais_saida_categoria_despesa_id_fkey"
            columns: ["categoria_despesa_id"]
            isOneToOne: false
            referencedRelation: "expense_configu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_saida_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_movimentacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_saida_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_saida_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "notas_fiscais_saida_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "notas_fiscais_saida_contas_areceber_id_fkey"
            columns: ["contas_areceber_id"]
            isOneToOne: false
            referencedRelation: "contas_areceber"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_saida_socio_id_fkey"
            columns: ["socio_id"]
            isOneToOne: false
            referencedRelation: "socios"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          read: boolean | null
          task_id: string | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          read?: boolean | null
          task_id?: string | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          read?: boolean | null
          task_id?: string | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      oficinas: {
        Row: {
          ativo: boolean | null
          cnpj: string | null
          created_at: string | null
          dados_pagamento: string | null
          endereco: string | null
          id: string
          mecanico_responsavel: string | null
          razao_social: string
          telefone: string | null
          tipo_aeronave: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cnpj?: string | null
          created_at?: string | null
          dados_pagamento?: string | null
          endereco?: string | null
          id?: string
          mecanico_responsavel?: string | null
          razao_social: string
          telefone?: string | null
          tipo_aeronave?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cnpj?: string | null
          created_at?: string | null
          dados_pagamento?: string | null
          endereco?: string | null
          id?: string
          mecanico_responsavel?: string | null
          razao_social?: string
          telefone?: string | null
          tipo_aeronave?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pagamento_salario_funcionario: {
        Row: {
          atualizado_em: string | null
          banco: string | null
          base_salary_holerite: number | null
          benefit: string | null
          comprovante_url: string | null
          criado_em: string | null
          data_pagamento: string | null
          decimo_terceiro_parcela1: number | null
          decimo_terceiro_parcela2: number | null
          extra: string | null
          ferias: number | null
          holerite_url: string | null
          horas_voo: string | null
          id: string
          obs: string | null
          obs2: string | null
          user_profile: string | null
        }
        Insert: {
          atualizado_em?: string | null
          banco?: string | null
          base_salary_holerite?: number | null
          benefit?: string | null
          comprovante_url?: string | null
          criado_em?: string | null
          data_pagamento?: string | null
          decimo_terceiro_parcela1?: number | null
          decimo_terceiro_parcela2?: number | null
          extra?: string | null
          ferias?: number | null
          holerite_url?: string | null
          horas_voo?: string | null
          id?: string
          obs?: string | null
          obs2?: string | null
          user_profile?: string | null
        }
        Update: {
          atualizado_em?: string | null
          banco?: string | null
          base_salary_holerite?: number | null
          benefit?: string | null
          comprovante_url?: string | null
          criado_em?: string | null
          data_pagamento?: string | null
          decimo_terceiro_parcela1?: number | null
          decimo_terceiro_parcela2?: number | null
          extra?: string | null
          ferias?: number | null
          holerite_url?: string | null
          horas_voo?: string | null
          id?: string
          obs?: string | null
          obs2?: string | null
          user_profile?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagamento_salario_funcionario_user_profile_fkey"
            columns: ["user_profile"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_accounts: {
        Row: {
          atualizado_em: string | null
          clientes_id: string
          criado_em: string | null
          id: string
          juros_totais_ganhos: number | null
          nome_banco: string | null
          saldo_atual: number | null
          socio_cpf: string
          socio_nome: string
          socios_cliente_id: string | null
          total_depositado: number | null
          total_gasto: number | null
        }
        Insert: {
          atualizado_em?: string | null
          clientes_id: string
          criado_em?: string | null
          id?: string
          juros_totais_ganhos?: number | null
          nome_banco?: string | null
          saldo_atual?: number | null
          socio_cpf: string
          socio_nome: string
          socios_cliente_id?: string | null
          total_depositado?: number | null
          total_gasto?: number | null
        }
        Update: {
          atualizado_em?: string | null
          clientes_id?: string
          criado_em?: string | null
          id?: string
          juros_totais_ganhos?: number | null
          nome_banco?: string | null
          saldo_atual?: number | null
          socio_cpf?: string
          socio_nome?: string
          socios_cliente_id?: string | null
          total_depositado?: number | null
          total_gasto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_accounts_clientes_id_fkey"
            columns: ["clientes_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_accounts_clientes_id_fkey"
            columns: ["clientes_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "partner_accounts_clientes_id_fkey"
            columns: ["clientes_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "partner_accounts_socios_cliente_id_fkey"
            columns: ["socios_cliente_id"]
            isOneToOne: false
            referencedRelation: "socios"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_expenses: {
        Row: {
          atualizado_em: string | null
          boleto_url: string | null
          categoria: string | null
          clientes_id: string
          cpf_socio: string | null
          criado_em: string | null
          criado_por: string | null
          data_inicio_parcelamento: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          demonstrativo_url: string | null
          descricao: string
          doc: string | null
          id: string
          id_aeronave: string | null
          id_despesa_pai: string | null
          id_referencia: string | null
          metodo_pagamento: string | null
          nf_url: string | null
          nome_banco: string | null
          nome_fornecedor: string | null
          nome_socio: string | null
          numero_fatura: string | null
          numero_parcela: number | null
          observacoes: string | null
          percentual_socio: number | null
          prazo: string
          quantidade_parcelas: number | null
          status: string | null
          tipo_despesa: string
          tipo_referencia: string | null
          url_fatura: string | null
          valor_total: number
        }
        Insert: {
          atualizado_em?: string | null
          boleto_url?: string | null
          categoria?: string | null
          clientes_id: string
          cpf_socio?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_inicio_parcelamento?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          demonstrativo_url?: string | null
          descricao: string
          doc?: string | null
          id?: string
          id_aeronave?: string | null
          id_despesa_pai?: string | null
          id_referencia?: string | null
          metodo_pagamento?: string | null
          nf_url?: string | null
          nome_banco?: string | null
          nome_fornecedor?: string | null
          nome_socio?: string | null
          numero_fatura?: string | null
          numero_parcela?: number | null
          observacoes?: string | null
          percentual_socio?: number | null
          prazo: string
          quantidade_parcelas?: number | null
          status?: string | null
          tipo_despesa: string
          tipo_referencia?: string | null
          url_fatura?: string | null
          valor_total: number
        }
        Update: {
          atualizado_em?: string | null
          boleto_url?: string | null
          categoria?: string | null
          clientes_id?: string
          cpf_socio?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_inicio_parcelamento?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          demonstrativo_url?: string | null
          descricao?: string
          doc?: string | null
          id?: string
          id_aeronave?: string | null
          id_despesa_pai?: string | null
          id_referencia?: string | null
          metodo_pagamento?: string | null
          nf_url?: string | null
          nome_banco?: string | null
          nome_fornecedor?: string | null
          nome_socio?: string | null
          numero_fatura?: string | null
          numero_parcela?: number | null
          observacoes?: string | null
          percentual_socio?: number | null
          prazo?: string
          quantidade_parcelas?: number | null
          status?: string | null
          tipo_despesa?: string
          tipo_referencia?: string | null
          url_fatura?: string | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "partner_expenses_aircraft_id_fkey"
            columns: ["id_aeronave"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_expenses_aircraft_id_fkey"
            columns: ["id_aeronave"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_expenses_aircraft_id_fkey"
            columns: ["id_aeronave"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "partner_expenses_aircraft_id_fkey"
            columns: ["id_aeronave"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "partner_expenses_aircraft_id_fkey"
            columns: ["id_aeronave"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "partner_expenses_clientes_id_fkey"
            columns: ["clientes_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_expenses_clientes_id_fkey"
            columns: ["clientes_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "partner_expenses_clientes_id_fkey"
            columns: ["clientes_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "partner_expenses_parent_expense_id_fkey"
            columns: ["id_despesa_pai"]
            isOneToOne: false
            referencedRelation: "partner_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_transactions: {
        Row: {
          atualizado_em: string | null
          banco_nome: string | null
          clientes_id: string
          criado_em: string | null
          criado_por: string | null
          data_pagamento: string | null
          descricao: string | null
          documento: string | null
          id: string
          metodo_pagamento: string | null
          observacoes: string | null
          prazo: string | null
          referencia_id: string | null
          saldo_antes: number
          saldo_depois: number
          socio_cpf: string
          socio_nome: string
          status: string | null
          subtipo: string | null
          tipo: string
          tipo_referencia: string | null
          url_comprovante: string | null
          valor: number
        }
        Insert: {
          atualizado_em?: string | null
          banco_nome?: string | null
          clientes_id: string
          criado_em?: string | null
          criado_por?: string | null
          data_pagamento?: string | null
          descricao?: string | null
          documento?: string | null
          id?: string
          metodo_pagamento?: string | null
          observacoes?: string | null
          prazo?: string | null
          referencia_id?: string | null
          saldo_antes: number
          saldo_depois: number
          socio_cpf: string
          socio_nome: string
          status?: string | null
          subtipo?: string | null
          tipo: string
          tipo_referencia?: string | null
          url_comprovante?: string | null
          valor: number
        }
        Update: {
          atualizado_em?: string | null
          banco_nome?: string | null
          clientes_id?: string
          criado_em?: string | null
          criado_por?: string | null
          data_pagamento?: string | null
          descricao?: string | null
          documento?: string | null
          id?: string
          metodo_pagamento?: string | null
          observacoes?: string | null
          prazo?: string | null
          referencia_id?: string | null
          saldo_antes?: number
          saldo_depois?: number
          socio_cpf?: string
          socio_nome?: string
          status?: string | null
          subtipo?: string | null
          tipo?: string
          tipo_referencia?: string | null
          url_comprovante?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "partner_transactions_clientes_id_fkey"
            columns: ["clientes_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_transactions_clientes_id_fkey"
            columns: ["clientes_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "partner_transactions_clientes_id_fkey"
            columns: ["clientes_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      pastas_documentos: {
        Row: {
          atualizado_em: string
          criado_em: string
          criado_por: string
          id: string
          nome: string
          pasta_pai_id: string | null
          restrita: boolean | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          criado_por: string
          id?: string
          nome: string
          pasta_pai_id?: string | null
          restrita?: boolean | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string
          id?: string
          nome?: string
          pasta_pai_id?: string | null
          restrita?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "document_folders_parent_folder_id_fkey"
            columns: ["pasta_pai_id"]
            isOneToOne: false
            referencedRelation: "pastas_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_anexos: {
        Row: {
          criado_em: string | null
          file_url: string
          id: string
          movimentacao_id: string | null
          numero_doc: string | null
          tipo_anexo: string
        }
        Insert: {
          criado_em?: string | null
          file_url: string
          id?: string
          movimentacao_id?: string | null
          numero_doc?: string | null
          tipo_anexo: string
        }
        Update: {
          criado_em?: string | null
          file_url?: string
          id?: string
          movimentacao_id?: string | null
          numero_doc?: string | null
          tipo_anexo?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_anexos_movimentacao_id_fkey"
            columns: ["movimentacao_id"]
            isOneToOne: false
            referencedRelation: "movimentacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      permissoes_pasta_documentos: {
        Row: {
          criado_em: string | null
          criado_por: string
          id: string
          pasta_id: string
          usuario_id: string
        }
        Insert: {
          criado_em?: string | null
          criado_por: string
          id?: string
          pasta_id: string
          usuario_id: string
        }
        Update: {
          criado_em?: string | null
          criado_por?: string
          id?: string
          pasta_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_folder_permissions_folder_id_fkey"
            columns: ["pasta_id"]
            isOneToOne: false
            referencedRelation: "pastas_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      pilot_hours: {
        Row: {
          aircraft_id: string
          created_at: string | null
          duilio: string | null
          gramulha: string | null
          id: string
          josmeyr: string | null
          oficina: string | null
          period: string
          ricardo: string | null
          service_order_id: string
          updated_at: string | null
        }
        Insert: {
          aircraft_id: string
          created_at?: string | null
          duilio?: string | null
          gramulha?: string | null
          id?: string
          josmeyr?: string | null
          oficina?: string | null
          period: string
          ricardo?: string | null
          service_order_id: string
          updated_at?: string | null
        }
        Update: {
          aircraft_id?: string
          created_at?: string | null
          duilio?: string | null
          gramulha?: string | null
          id?: string
          josmeyr?: string | null
          oficina?: string | null
          period?: string
          ricardo?: string | null
          service_order_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pilot_hours_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_hours_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_hours_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "pilot_hours_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "pilot_hours_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
      }
      planos_voo: {
        Row: {
          aeronave_id: string | null
          aeroporto_alternativa: string | null
          aeroporto_chegada: string
          aeroporto_partida: string
          altitude_cruzeiro: string | null
          atualizado_em: string | null
          autonomia_combustivel: string | null
          calculos: Json | null
          ciclo_voo_id: string | null
          comandante: string
          criado_em: string | null
          criado_por: string | null
          dados_meteorologicos: Json | null
          dados_validacao: Json | null
          data_voo: string
          id: string
          observacoes: string | null
          rota: string | null
          status: string | null
          tempo_estimado: string | null
        }
        Insert: {
          aeronave_id?: string | null
          aeroporto_alternativa?: string | null
          aeroporto_chegada: string
          aeroporto_partida: string
          altitude_cruzeiro?: string | null
          atualizado_em?: string | null
          autonomia_combustivel?: string | null
          calculos?: Json | null
          ciclo_voo_id?: string | null
          comandante: string
          criado_em?: string | null
          criado_por?: string | null
          dados_meteorologicos?: Json | null
          dados_validacao?: Json | null
          data_voo: string
          id?: string
          observacoes?: string | null
          rota?: string | null
          status?: string | null
          tempo_estimado?: string | null
        }
        Update: {
          aeronave_id?: string | null
          aeroporto_alternativa?: string | null
          aeroporto_chegada?: string
          aeroporto_partida?: string
          altitude_cruzeiro?: string | null
          atualizado_em?: string | null
          autonomia_combustivel?: string | null
          calculos?: Json | null
          ciclo_voo_id?: string | null
          comandante?: string
          criado_em?: string | null
          criado_por?: string | null
          dados_meteorologicos?: Json | null
          dados_validacao?: Json | null
          data_voo?: string
          id?: string
          observacoes?: string | null
          rota?: string | null
          status?: string | null
          tempo_estimado?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flight_plans_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_plans_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_plans_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "flight_plans_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "flight_plans_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
      }
      prestador_notas_fiscais: {
        Row: {
          ano_referencia: number
          arquivo_nota_url: string | null
          comprovante_pagamento_url: string | null
          controle_bancario_id: string | null
          created_at: string
          data_emissao: string
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string | null
          id: string
          mes_referencia: number
          numero_nota: string
          observacoes: string | null
          prestador_id: string
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          ano_referencia: number
          arquivo_nota_url?: string | null
          comprovante_pagamento_url?: string | null
          controle_bancario_id?: string | null
          created_at?: string
          data_emissao: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          id?: string
          mes_referencia: number
          numero_nota: string
          observacoes?: string | null
          prestador_id: string
          status?: string
          updated_at?: string
          valor: number
        }
        Update: {
          ano_referencia?: number
          arquivo_nota_url?: string | null
          comprovante_pagamento_url?: string | null
          controle_bancario_id?: string | null
          created_at?: string
          data_emissao?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          id?: string
          mes_referencia?: number
          numero_nota?: string
          observacoes?: string | null
          prestador_id?: string
          status?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "prestador_notas_fiscais_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "prestadores_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      prestadores_servico: {
        Row: {
          agencia: string | null
          ativo: boolean | null
          banco: string | null
          cidade: string | null
          conta: string | null
          cpf_cnpj: string
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          nome: string
          observacoes: string | null
          pix: string | null
          telefone: string | null
          tipo_conta: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean | null
          banco?: string | null
          cidade?: string | null
          conta?: string | null
          cpf_cnpj: string
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          pix?: string | null
          telefone?: string | null
          tipo_conta?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          ativo?: boolean | null
          banco?: string | null
          cidade?: string | null
          conta?: string | null
          cpf_cnpj?: string
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          pix?: string | null
          telefone?: string | null
          tipo_conta?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_request_approvals: {
        Row: {
          acao: string
          comentarios: string | null
          data_acao: string | null
          id: string
          motivo: string | null
          nivel_aprovacao: number
          purchase_request_id: string
          user_id: string
        }
        Insert: {
          acao: string
          comentarios?: string | null
          data_acao?: string | null
          id?: string
          motivo?: string | null
          nivel_aprovacao: number
          purchase_request_id: string
          user_id: string
        }
        Update: {
          acao?: string
          comentarios?: string | null
          data_acao?: string | null
          id?: string
          motivo?: string | null
          nivel_aprovacao?: number
          purchase_request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_request_approvals_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_request_items: {
        Row: {
          codigo_fornecedor: string | null
          created_at: string | null
          descricao: string
          especificacoes: string | null
          id: string
          numero_item: number
          purchase_request_id: string
          quantidade: number
          unidade: string
          updated_at: string | null
          valor_unitario: number
        }
        Insert: {
          codigo_fornecedor?: string | null
          created_at?: string | null
          descricao: string
          especificacoes?: string | null
          id?: string
          numero_item: number
          purchase_request_id: string
          quantidade: number
          unidade: string
          updated_at?: string | null
          valor_unitario: number
        }
        Update: {
          codigo_fornecedor?: string | null
          created_at?: string | null
          descricao?: string
          especificacoes?: string | null
          id?: string
          numero_item?: number
          purchase_request_id?: string
          quantidade?: number
          unidade?: string
          updated_at?: string | null
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_request_items_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_request_suppliers: {
        Row: {
          cnpj: string | null
          condicoes_pagamento: string | null
          created_at: string | null
          email: string | null
          endereco: string | null
          fornecedor_selecionado: boolean | null
          id: string
          nome_fornecedor: string
          prazo_entrega: string | null
          purchase_request_id: string
          telefone: string | null
          valor_cotado: number | null
        }
        Insert: {
          cnpj?: string | null
          condicoes_pagamento?: string | null
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          fornecedor_selecionado?: boolean | null
          id?: string
          nome_fornecedor: string
          prazo_entrega?: string | null
          purchase_request_id: string
          telefone?: string | null
          valor_cotado?: number | null
        }
        Update: {
          cnpj?: string | null
          condicoes_pagamento?: string | null
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          fornecedor_selecionado?: boolean | null
          id?: string
          nome_fornecedor?: string
          prazo_entrega?: string | null
          purchase_request_id?: string
          telefone?: string | null
          valor_cotado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_request_suppliers_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requests: {
        Row: {
          aprovador_1_id: string | null
          aprovador_2_id: string | null
          centro_custo: string | null
          created_at: string | null
          data_aprovacao_1: string | null
          data_aprovacao_2: string | null
          data_necessaria: string | null
          data_solicitacao: string | null
          departamento: string | null
          descricao: string
          id: string
          motivo_rejeicao_1: string | null
          motivo_rejeicao_2: string | null
          numero_solicitacao: string
          observacoes: string | null
          priority: string | null
          solicitante_nome: string | null
          status: string
          tipo: string
          tipo_de_servico: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          aprovador_1_id?: string | null
          aprovador_2_id?: string | null
          centro_custo?: string | null
          created_at?: string | null
          data_aprovacao_1?: string | null
          data_aprovacao_2?: string | null
          data_necessaria?: string | null
          data_solicitacao?: string | null
          departamento?: string | null
          descricao: string
          id?: string
          motivo_rejeicao_1?: string | null
          motivo_rejeicao_2?: string | null
          numero_solicitacao: string
          observacoes?: string | null
          priority?: string | null
          solicitante_nome?: string | null
          status?: string
          tipo: string
          tipo_de_servico?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          aprovador_1_id?: string | null
          aprovador_2_id?: string | null
          centro_custo?: string | null
          created_at?: string | null
          data_aprovacao_1?: string | null
          data_aprovacao_2?: string | null
          data_necessaria?: string | null
          data_solicitacao?: string | null
          departamento?: string | null
          descricao?: string
          id?: string
          motivo_rejeicao_1?: string | null
          motivo_rejeicao_2?: string | null
          numero_solicitacao?: string
          observacoes?: string | null
          priority?: string | null
          solicitante_nome?: string | null
          status?: string
          tipo?: string
          tipo_de_servico?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rateio_despesas: {
        Row: {
          abastecimento_id: string | null
          aeronave_id: string | null
          aeronave_registro: string | null
          atualizado_em: string | null
          boleto_url: string | null
          categoria_custo: string | null
          cliente_id: string | null
          clientes_nome: string | null
          comprovante_url: string | null
          conferido: boolean
          conferido_em: string | null
          conferido_por: string | null
          criado_em: string | null
          data_emissao: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          demonstrativo_url: string | null
          descricao_despesa: string | null
          despesa_id: string
          fluxo: string | null
          fonte_despesa: string | null
          forma_pagamento: string | null
          fornecedor_nome: string | null
          id: string
          nf_url: string | null
          numero_boleto: string | null
          numero_doc: string | null
          numero_nf: string | null
          numero_recibo: string | null
          observacoes: string | null
          pago_diretamente: boolean | null
          pago_por: string | null
          percentual_sociedade: number | null
          percentual_uso: number | null
          periodicidade: string | null
          recibo_url: string | null
          relatorio_url: string | null
          socio_id: string | null
          socios_nome: string | null
          status: string | null
          subcategoria_1: string | null
          subcategoria_2: string | null
          subcategoria_3: string | null
          subcategoria_4: string | null
          tipo_rateio: string | null
          valor_pago_real: number | null
          valor_rateado: number | null
          valor_total_despesa: number | null
        }
        Insert: {
          abastecimento_id?: string | null
          aeronave_id?: string | null
          aeronave_registro?: string | null
          atualizado_em?: string | null
          boleto_url?: string | null
          categoria_custo?: string | null
          cliente_id?: string | null
          clientes_nome?: string | null
          comprovante_url?: string | null
          conferido?: boolean
          conferido_em?: string | null
          conferido_por?: string | null
          criado_em?: string | null
          data_emissao?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          demonstrativo_url?: string | null
          descricao_despesa?: string | null
          despesa_id: string
          fluxo?: string | null
          fonte_despesa?: string | null
          forma_pagamento?: string | null
          fornecedor_nome?: string | null
          id?: string
          nf_url?: string | null
          numero_boleto?: string | null
          numero_doc?: string | null
          numero_nf?: string | null
          numero_recibo?: string | null
          observacoes?: string | null
          pago_diretamente?: boolean | null
          pago_por?: string | null
          percentual_sociedade?: number | null
          percentual_uso?: number | null
          periodicidade?: string | null
          recibo_url?: string | null
          relatorio_url?: string | null
          socio_id?: string | null
          socios_nome?: string | null
          status?: string | null
          subcategoria_1?: string | null
          subcategoria_2?: string | null
          subcategoria_3?: string | null
          subcategoria_4?: string | null
          tipo_rateio?: string | null
          valor_pago_real?: number | null
          valor_rateado?: number | null
          valor_total_despesa?: number | null
        }
        Update: {
          abastecimento_id?: string | null
          aeronave_id?: string | null
          aeronave_registro?: string | null
          atualizado_em?: string | null
          boleto_url?: string | null
          categoria_custo?: string | null
          cliente_id?: string | null
          clientes_nome?: string | null
          comprovante_url?: string | null
          conferido?: boolean
          conferido_em?: string | null
          conferido_por?: string | null
          criado_em?: string | null
          data_emissao?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          demonstrativo_url?: string | null
          descricao_despesa?: string | null
          despesa_id?: string
          fluxo?: string | null
          fonte_despesa?: string | null
          forma_pagamento?: string | null
          fornecedor_nome?: string | null
          id?: string
          nf_url?: string | null
          numero_boleto?: string | null
          numero_doc?: string | null
          numero_nf?: string | null
          numero_recibo?: string | null
          observacoes?: string | null
          pago_diretamente?: boolean | null
          pago_por?: string | null
          percentual_sociedade?: number | null
          percentual_uso?: number | null
          periodicidade?: string | null
          recibo_url?: string | null
          relatorio_url?: string | null
          socio_id?: string | null
          socios_nome?: string | null
          status?: string | null
          subcategoria_1?: string | null
          subcategoria_2?: string | null
          subcategoria_3?: string | null
          subcategoria_4?: string | null
          tipo_rateio?: string | null
          valor_pago_real?: number | null
          valor_rateado?: number | null
          valor_total_despesa?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rateio_despesas_abastecimento_id_fkey"
            columns: ["abastecimento_id"]
            isOneToOne: false
            referencedRelation: "abastecimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateio_despesas_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateio_despesas_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateio_despesas_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "rateio_despesas_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "rateio_despesas_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "rateio_despesas_categoria_custo_fkey"
            columns: ["categoria_custo"]
            isOneToOne: false
            referencedRelation: "expense_configu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateio_despesas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateio_despesas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "rateio_despesas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "rateio_despesas_socio_id_fkey"
            columns: ["socio_id"]
            isOneToOne: false
            referencedRelation: "socios"
            referencedColumns: ["id"]
          },
        ]
      }
      recados: {
        Row: {
          atualizado_em: string | null
          autor_id: string
          criado_em: string | null
          departamento: string | null
          fixado: boolean | null
          id: string
          lido_por: string[] | null
          mensagem: string
        }
        Insert: {
          atualizado_em?: string | null
          autor_id: string
          criado_em?: string | null
          departamento?: string | null
          fixado?: boolean | null
          id?: string
          lido_por?: string[] | null
          mensagem: string
        }
        Update: {
          atualizado_em?: string | null
          autor_id?: string
          criado_em?: string | null
          departamento?: string | null
          fixado?: boolean | null
          id?: string
          lido_por?: string[] | null
          mensagem?: string
        }
        Relationships: []
      }
      receipt_descriptions: {
        Row: {
          criado_em: string | null
          description: string
          id: string
          user_id: string
        }
        Insert: {
          criado_em?: string | null
          description: string
          id?: string
          user_id?: string
        }
        Update: {
          criado_em?: string | null
          description?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      recibos: {
        Row: {
          aeronave_id: string | null
          atualizado_em: string | null
          boleto_url: string | null
          cidade_pagador: string | null
          cliente_id: string | null
          compartilhado: boolean | null
          competencia_decea: string | null
          competencia_infraero: string | null
          criado_em: string | null
          data_emissao: string
          data_max_pagamento: string | null
          data_quitacao: string | null
          data_vencimento: string | null
          demonstrativo_url: string | null
          descricao_servico: string
          documento_pagador: string | null
          endereco_pagador: string | null
          forma_pagamento: string | null
          id: string
          nf_url: string | null
          nome_categoria: string | null
          nome_pagador: string
          numero_documento: string | null
          numero_recibo: string
          pdf_url: string | null
          percentual: number | null
          recibo_origem_id: string | null
          socios_cliente: string | null
          status: string | null
          subcategoria_1: string | null
          subcategoria_2: string | null
          subcategoria_3: string | null
          subcategoria_4: string | null
          tipo_recibo: string | null
          uf_pagador: string | null
          usuario_id: string
          valor: number
          valor_total: number | null
        }
        Insert: {
          aeronave_id?: string | null
          atualizado_em?: string | null
          boleto_url?: string | null
          cidade_pagador?: string | null
          cliente_id?: string | null
          compartilhado?: boolean | null
          competencia_decea?: string | null
          competencia_infraero?: string | null
          criado_em?: string | null
          data_emissao: string
          data_max_pagamento?: string | null
          data_quitacao?: string | null
          data_vencimento?: string | null
          demonstrativo_url?: string | null
          descricao_servico: string
          documento_pagador?: string | null
          endereco_pagador?: string | null
          forma_pagamento?: string | null
          id?: string
          nf_url?: string | null
          nome_categoria?: string | null
          nome_pagador: string
          numero_documento?: string | null
          numero_recibo: string
          pdf_url?: string | null
          percentual?: number | null
          recibo_origem_id?: string | null
          socios_cliente?: string | null
          status?: string | null
          subcategoria_1?: string | null
          subcategoria_2?: string | null
          subcategoria_3?: string | null
          subcategoria_4?: string | null
          tipo_recibo?: string | null
          uf_pagador?: string | null
          usuario_id: string
          valor: number
          valor_total?: number | null
        }
        Update: {
          aeronave_id?: string | null
          atualizado_em?: string | null
          boleto_url?: string | null
          cidade_pagador?: string | null
          cliente_id?: string | null
          compartilhado?: boolean | null
          competencia_decea?: string | null
          competencia_infraero?: string | null
          criado_em?: string | null
          data_emissao?: string
          data_max_pagamento?: string | null
          data_quitacao?: string | null
          data_vencimento?: string | null
          demonstrativo_url?: string | null
          descricao_servico?: string
          documento_pagador?: string | null
          endereco_pagador?: string | null
          forma_pagamento?: string | null
          id?: string
          nf_url?: string | null
          nome_categoria?: string | null
          nome_pagador?: string
          numero_documento?: string | null
          numero_recibo?: string
          pdf_url?: string | null
          percentual?: number | null
          recibo_origem_id?: string | null
          socios_cliente?: string | null
          status?: string | null
          subcategoria_1?: string | null
          subcategoria_2?: string | null
          subcategoria_3?: string | null
          subcategoria_4?: string | null
          tipo_recibo?: string | null
          uf_pagador?: string | null
          usuario_id?: string
          valor?: number
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "receipts_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "receipts_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "receipts_client_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_client_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "receipts_client_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      recibos_saida: {
        Row: {
          aeronave_id: string | null
          atualizado_em: string
          boleto_url: string | null
          categoria_despesa_id: string | null
          categoria_despesa_subcategoria: string | null
          categoria_id: string | null
          cidade_pagador: string | null
          cliente_id: string | null
          compartilhado: boolean | null
          competencia_decea: string | null
          competencia_infraero: string | null
          contas_areceber_id: string | null
          criado_em: string
          data_emissao: string
          data_max_pagamento: string | null
          data_vencimento: string | null
          demonstrativo_url: string | null
          descricao_servico: string
          documento_pagador: string | null
          endereco_pagador: string | null
          forma_pagamento: string | null
          id: string
          nf_url: string | null
          nome_categoria: string | null
          nome_pagador: string
          numero_documento: string | null
          numero_recibo: string
          observacoes: string | null
          pdf_url: string | null
          percentual: number | null
          socio_id: string | null
          socios_cliente: string | null
          status: string | null
          subcategoria_1: string | null
          subcategoria_2: string | null
          subcategoria_3: string | null
          subcategoria_4: string | null
          tipo_recibo: string | null
          uf_pagador: string | null
          usuario_id: string | null
          valor: number
          valor_total: number | null
        }
        Insert: {
          aeronave_id?: string | null
          atualizado_em?: string
          boleto_url?: string | null
          categoria_despesa_id?: string | null
          categoria_despesa_subcategoria?: string | null
          categoria_id?: string | null
          cidade_pagador?: string | null
          cliente_id?: string | null
          compartilhado?: boolean | null
          competencia_decea?: string | null
          competencia_infraero?: string | null
          contas_areceber_id?: string | null
          criado_em?: string
          data_emissao: string
          data_max_pagamento?: string | null
          data_vencimento?: string | null
          demonstrativo_url?: string | null
          descricao_servico: string
          documento_pagador?: string | null
          endereco_pagador?: string | null
          forma_pagamento?: string | null
          id?: string
          nf_url?: string | null
          nome_categoria?: string | null
          nome_pagador: string
          numero_documento?: string | null
          numero_recibo: string
          observacoes?: string | null
          pdf_url?: string | null
          percentual?: number | null
          socio_id?: string | null
          socios_cliente?: string | null
          status?: string | null
          subcategoria_1?: string | null
          subcategoria_2?: string | null
          subcategoria_3?: string | null
          subcategoria_4?: string | null
          tipo_recibo?: string | null
          uf_pagador?: string | null
          usuario_id?: string | null
          valor: number
          valor_total?: number | null
        }
        Update: {
          aeronave_id?: string | null
          atualizado_em?: string
          boleto_url?: string | null
          categoria_despesa_id?: string | null
          categoria_despesa_subcategoria?: string | null
          categoria_id?: string | null
          cidade_pagador?: string | null
          cliente_id?: string | null
          compartilhado?: boolean | null
          competencia_decea?: string | null
          competencia_infraero?: string | null
          contas_areceber_id?: string | null
          criado_em?: string
          data_emissao?: string
          data_max_pagamento?: string | null
          data_vencimento?: string | null
          demonstrativo_url?: string | null
          descricao_servico?: string
          documento_pagador?: string | null
          endereco_pagador?: string | null
          forma_pagamento?: string | null
          id?: string
          nf_url?: string | null
          nome_categoria?: string | null
          nome_pagador?: string
          numero_documento?: string | null
          numero_recibo?: string
          observacoes?: string | null
          pdf_url?: string | null
          percentual?: number | null
          socio_id?: string | null
          socios_cliente?: string | null
          status?: string | null
          subcategoria_1?: string | null
          subcategoria_2?: string | null
          subcategoria_3?: string | null
          subcategoria_4?: string | null
          tipo_recibo?: string | null
          uf_pagador?: string | null
          usuario_id?: string | null
          valor?: number
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recibos_saida_categoria_despesa_id_fkey"
            columns: ["categoria_despesa_id"]
            isOneToOne: false
            referencedRelation: "expense_configu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recibos_saida_contas_areceber_id_fkey"
            columns: ["contas_areceber_id"]
            isOneToOne: false
            referencedRelation: "contas_areceber"
            referencedColumns: ["id"]
          },
        ]
      }
      salaries: {
        Row: {
          base_salary_bruto: number | null
          base_salary_liquid: number
          benefit: string | null
          created_at: string | null
          effective_date: string
          id: string
          updated_at: string | null
          user_profile: string | null
        }
        Insert: {
          base_salary_bruto?: number | null
          base_salary_liquid: number
          benefit?: string | null
          created_at?: string | null
          effective_date: string
          id?: string
          updated_at?: string | null
          user_profile?: string | null
        }
        Update: {
          base_salary_bruto?: number | null
          base_salary_liquid?: number
          benefit?: string | null
          created_at?: string | null
          effective_date?: string
          id?: string
          updated_at?: string | null
          user_profile?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salaries_user_profile_fkey"
            columns: ["user_profile"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduling_crew_config: {
        Row: {
          crew_member_id: string
          enabled_for_scheduling: boolean
          id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          crew_member_id: string
          enabled_for_scheduling?: boolean
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          crew_member_id?: string
          enabled_for_scheduling?: boolean
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduling_crew_config_crew_member_id_fkey"
            columns: ["crew_member_id"]
            isOneToOne: true
            referencedRelation: "membros_tripulacao"
            referencedColumns: ["id"]
          },
        ]
      }
      senhas: {
        Row: {
          created_by: string | null
          criado_em: string | null
          id: string
          login: string
          observacoes: string | null
          senha: string
          setor: string | null
          site: string
          updated_at: string | null
        }
        Insert: {
          created_by?: string | null
          criado_em?: string | null
          id?: string
          login: string
          observacoes?: string | null
          senha: string
          setor?: string | null
          site: string
          updated_at?: string | null
        }
        Update: {
          created_by?: string | null
          criado_em?: string | null
          id?: string
          login?: string
          observacoes?: string | null
          senha?: string
          setor?: string | null
          site?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sequencia_numeros_recibo: {
        Row: {
          ano: number
          atualizado_em: string | null
          criado_em: string | null
          id: string
          proximo_numero: number
        }
        Insert: {
          ano: number
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          proximo_numero?: number
        }
        Update: {
          ano?: number
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          proximo_numero?: number
        }
        Relationships: []
      }
      socios: {
        Row: {
          atualizado_em: string
          clientes_id: string
          codigo_cliente: string | null
          contato_financeiro: string | null
          cpf: string
          criado_em: string
          documentos: string | null
          email: string | null
          endereco: string | null
          id: string
          nome: string
          percentual_participacao: number | null
        }
        Insert: {
          atualizado_em?: string
          clientes_id: string
          codigo_cliente?: string | null
          contato_financeiro?: string | null
          cpf: string
          criado_em?: string
          documentos?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          percentual_participacao?: number | null
        }
        Update: {
          atualizado_em?: string
          clientes_id?: string
          codigo_cliente?: string | null
          contato_financeiro?: string | null
          cpf?: string
          criado_em?: string
          documentos?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          percentual_participacao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "socios_clientes_id_fkey"
            columns: ["clientes_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "socios_clientes_id_fkey"
            columns: ["clientes_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "socios_clientes_id_fkey"
            columns: ["clientes_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      solicitacoes_correcao_ponto: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          atualizado_em: string
          criado_em: string
          data_entrada: string
          id: string
          justificativa: string
          lancamento_ponto_id: string | null
          motivo_rejeicao: string | null
          status: string
          tempo_corrigido: string
          tempo_original: string | null
          tipo_correcao: string
          user_id: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          atualizado_em?: string
          criado_em?: string
          data_entrada: string
          id?: string
          justificativa: string
          lancamento_ponto_id?: string | null
          motivo_rejeicao?: string | null
          status?: string
          tempo_corrigido: string
          tempo_original?: string | null
          tipo_correcao: string
          user_id: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          atualizado_em?: string
          criado_em?: string
          data_entrada?: string
          id?: string
          justificativa?: string
          lancamento_ponto_id?: string | null
          motivo_rejeicao?: string | null
          status?: string
          tempo_corrigido?: string
          tempo_original?: string | null
          tipo_correcao?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_correcao_ponto_lancamento_ponto_id_fkey"
            columns: ["lancamento_ponto_id"]
            isOneToOne: false
            referencedRelation: "lancamento_ponto"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes_reserva_voo: {
        Row: {
          aeronave_id: string
          aprovado_em: string | null
          aprovado_por: string | null
          atualizado_em: string | null
          cliente_id: string | null
          copiloto_id: string | null
          criado_em: string | null
          data_agendada: string
          destino: string
          dias_duracao: number
          horario_chegada: string | null
          horario_partida: string
          id: string
          motivo_rejeicao: string | null
          observacoes: string | null
          origem: string
          piloto_id: string | null
          qtd_passageiros: number
          status: string | null
        }
        Insert: {
          aeronave_id: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          atualizado_em?: string | null
          cliente_id?: string | null
          copiloto_id?: string | null
          criado_em?: string | null
          data_agendada: string
          destino: string
          dias_duracao?: number
          horario_chegada?: string | null
          horario_partida: string
          id?: string
          motivo_rejeicao?: string | null
          observacoes?: string | null
          origem: string
          piloto_id?: string | null
          qtd_passageiros?: number
          status?: string | null
        }
        Update: {
          aeronave_id?: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          atualizado_em?: string | null
          cliente_id?: string | null
          copiloto_id?: string | null
          criado_em?: string | null
          data_agendada?: string
          destino?: string
          dias_duracao?: number
          horario_chegada?: string | null
          horario_partida?: string
          id?: string
          motivo_rejeicao?: string | null
          observacoes?: string | null
          origem?: string
          piloto_id?: string | null
          qtd_passageiros?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_reserva_voo_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_reserva_voo_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "solicitacoes_reserva_voo_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      status_tempo_real_aeronave: {
        Row: {
          aeronave_id: string
          atualizado_em: string | null
          atualizado_por: string | null
          chegada_prevista: string | null
          id: string
          localizacao_atual: string | null
          status_atual: string
          ultima_partida: string | null
          voo_atual_id: string | null
        }
        Insert: {
          aeronave_id: string
          atualizado_em?: string | null
          atualizado_por?: string | null
          chegada_prevista?: string | null
          id?: string
          localizacao_atual?: string | null
          status_atual?: string
          ultima_partida?: string | null
          voo_atual_id?: string | null
        }
        Update: {
          aeronave_id?: string
          atualizado_em?: string | null
          atualizado_por?: string | null
          chegada_prevista?: string | null
          id?: string
          localizacao_atual?: string | null
          status_atual?: string
          ultima_partida?: string | null
          voo_atual_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aircraft_live_status_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: true
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_live_status_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: true
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_live_status_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: true
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_live_status_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: true
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_live_status_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: true
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_live_status_current_flight_id_fkey"
            columns: ["voo_atual_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_reserva_voo"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas: {
        Row: {
          atribuido_para: string[] | null
          atualizado_em: string | null
          criado_em: string | null
          criado_por: string | null
          descricao: string | null
          equipes: string[]
          id: string
          origem: string
          prazo: string | null
          prioridade: string | null
          progresso: number
          publico: boolean | null
          status: string | null
          titulo: string
        }
        Insert: {
          atribuido_para?: string[] | null
          atualizado_em?: string | null
          criado_em?: string | null
          criado_por?: string | null
          descricao?: string | null
          equipes?: string[]
          id?: string
          origem?: string
          prazo?: string | null
          prioridade?: string | null
          progresso?: number
          publico?: boolean | null
          status?: string | null
          titulo: string
        }
        Update: {
          atribuido_para?: string[] | null
          atualizado_em?: string | null
          criado_em?: string | null
          criado_por?: string | null
          descricao?: string | null
          equipes?: string[]
          id?: string
          origem?: string
          prazo?: string | null
          prioridade?: string | null
          progresso?: number
          publico?: boolean | null
          status?: string | null
          titulo?: string
        }
        Relationships: []
      }
      tarefas_comentarios: {
        Row: {
          atualizado_em: string
          comentario: string
          criado_em: string
          id: string
          tarefa_id: string
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          comentario: string
          criado_em?: string
          id?: string
          tarefa_id: string
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          comentario?: string
          criado_em?: string
          id?: string
          tarefa_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_comentarios_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas_notificacoes: {
        Row: {
          atualizado_em: string | null
          criado_em: string | null
          id: string
          id_da_tarefa: string
          lido: boolean | null
          mensagem: string
          status_alterado_para: string | null
          user_id: string
        }
        Insert: {
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          id_da_tarefa: string
          lido?: boolean | null
          mensagem: string
          status_alterado_para?: string | null
          user_id: string
        }
        Update: {
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          id_da_tarefa?: string
          lido?: boolean | null
          mensagem?: string
          status_alterado_para?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_notificacoes_id_da_tarefa_fkey"
            columns: ["id_da_tarefa"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      taxas_hora_aeronave: {
        Row: {
          aeronave_id: string
          criado_em: string | null
          data_vigencia: string
          id: string
          taxa_hora: number
        }
        Insert: {
          aeronave_id: string
          criado_em?: string | null
          data_vigencia: string
          id?: string
          taxa_hora: number
        }
        Update: {
          aeronave_id?: string
          criado_em?: string | null
          data_vigencia?: string
          id?: string
          taxa_hora?: number
        }
        Relationships: [
          {
            foreignKeyName: "aircraft_hourly_rates_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_hourly_rates_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_hourly_rates_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_hourly_rates_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_hourly_rates_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
      }
      transacoes_horas: {
        Row: {
          criado_em: string | null
          criado_por: string | null
          descricao: string | null
          horas: number
          id: string
          id_aeronave: string
          id_cotista_destino: string
          id_cotista_origem: string
          id_lancamento_diario_bordo: string | null
          metadados: Json | null
          tipo: string | null
        }
        Insert: {
          criado_em?: string | null
          criado_por?: string | null
          descricao?: string | null
          horas: number
          id?: string
          id_aeronave: string
          id_cotista_destino: string
          id_cotista_origem: string
          id_lancamento_diario_bordo?: string | null
          metadados?: Json | null
          tipo?: string | null
        }
        Update: {
          criado_em?: string | null
          criado_por?: string | null
          descricao?: string | null
          horas?: number
          id?: string
          id_aeronave?: string
          id_cotista_destino?: string
          id_cotista_origem?: string
          id_lancamento_diario_bordo?: string | null
          metadados?: Json | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transacoes_horas_aeronave_fkey"
            columns: ["id_aeronave"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_horas_aeronave_fkey"
            columns: ["id_aeronave"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_horas_aeronave_fkey"
            columns: ["id_aeronave"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "transacoes_horas_aeronave_fkey"
            columns: ["id_aeronave"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "transacoes_horas_aeronave_fkey"
            columns: ["id_aeronave"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "transacoes_horas_cotista_destino_fkey"
            columns: ["id_cotista_destino"]
            isOneToOne: false
            referencedRelation: "cotistas_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_horas_cotista_origem_fkey"
            columns: ["id_cotista_origem"]
            isOneToOne: false
            referencedRelation: "cotistas_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_horas_lancamento_fkey"
            columns: ["id_lancamento_diario_bordo"]
            isOneToOne: false
            referencedRelation: "historico_voo_tripulante"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_horas_lancamento_fkey"
            columns: ["id_lancamento_diario_bordo"]
            isOneToOne: false
            referencedRelation: "lancamentos_diario_bordo"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_expense_reports: {
        Row: {
          aeronave_id: string | null
          approval_token: string | null
          assinado_em: string | null
          client_approval_notes: string | null
          client_approval_status: string | null
          client_approved_at: string | null
          clientes_id: string | null
          contas_pagar_trip1_id: string | null
          contas_pagar_trip2_id: string | null
          contas_receber_id: string | null
          created_at: string | null
          crew_approval_notes: string | null
          crew_approval_status: string | null
          crew_approved_at: string | null
          criado_por: string | null
          data_fim: string
          data_inicio: string
          despesas: string | null
          dias_count: number
          enviado_cliente_em: string | null
          enviado_tripulante_em: string | null
          generated_by_user_id: string | null
          id: string
          matricula_aeronave: string | null
          nome_tripulante: string | null
          nome_tripulante_2: string | null
          numero_relatorio: string
          observacoes: string | null
          pago_em: string | null
          pdf_path: string | null
          pdf_url: string | null
          requires_client_approval: boolean | null
          rota: string | null
          socios_id: string | null
          status: string | null
          total_alimentacao: number | null
          total_clientes: number | null
          total_combustivel: number | null
          total_hospedagem: number | null
          total_outros: number | null
          total_sharebrasil: number | null
          total_transporte: number | null
          total_trip: number | null
          total_trip2: number | null
          total_tripulacao: number | null
          total_valor: number | null
          tripulacao_id: string | null
          tripulante_id2: string | null
          updated_at: string | null
        }
        Insert: {
          aeronave_id?: string | null
          approval_token?: string | null
          assinado_em?: string | null
          client_approval_notes?: string | null
          client_approval_status?: string | null
          client_approved_at?: string | null
          clientes_id?: string | null
          contas_pagar_trip1_id?: string | null
          contas_pagar_trip2_id?: string | null
          contas_receber_id?: string | null
          created_at?: string | null
          crew_approval_notes?: string | null
          crew_approval_status?: string | null
          crew_approved_at?: string | null
          criado_por?: string | null
          data_fim: string
          data_inicio: string
          despesas?: string | null
          dias_count: number
          enviado_cliente_em?: string | null
          enviado_tripulante_em?: string | null
          generated_by_user_id?: string | null
          id?: string
          matricula_aeronave?: string | null
          nome_tripulante?: string | null
          nome_tripulante_2?: string | null
          numero_relatorio: string
          observacoes?: string | null
          pago_em?: string | null
          pdf_path?: string | null
          pdf_url?: string | null
          requires_client_approval?: boolean | null
          rota?: string | null
          socios_id?: string | null
          status?: string | null
          total_alimentacao?: number | null
          total_clientes?: number | null
          total_combustivel?: number | null
          total_hospedagem?: number | null
          total_outros?: number | null
          total_sharebrasil?: number | null
          total_transporte?: number | null
          total_trip?: number | null
          total_trip2?: number | null
          total_tripulacao?: number | null
          total_valor?: number | null
          tripulacao_id?: string | null
          tripulante_id2?: string | null
          updated_at?: string | null
        }
        Update: {
          aeronave_id?: string | null
          approval_token?: string | null
          assinado_em?: string | null
          client_approval_notes?: string | null
          client_approval_status?: string | null
          client_approved_at?: string | null
          clientes_id?: string | null
          contas_pagar_trip1_id?: string | null
          contas_pagar_trip2_id?: string | null
          contas_receber_id?: string | null
          created_at?: string | null
          crew_approval_notes?: string | null
          crew_approval_status?: string | null
          crew_approved_at?: string | null
          criado_por?: string | null
          data_fim?: string
          data_inicio?: string
          despesas?: string | null
          dias_count?: number
          enviado_cliente_em?: string | null
          enviado_tripulante_em?: string | null
          generated_by_user_id?: string | null
          id?: string
          matricula_aeronave?: string | null
          nome_tripulante?: string | null
          nome_tripulante_2?: string | null
          numero_relatorio?: string
          observacoes?: string | null
          pago_em?: string | null
          pdf_path?: string | null
          pdf_url?: string | null
          requires_client_approval?: boolean | null
          rota?: string | null
          socios_id?: string | null
          status?: string | null
          total_alimentacao?: number | null
          total_clientes?: number | null
          total_combustivel?: number | null
          total_hospedagem?: number | null
          total_outros?: number | null
          total_sharebrasil?: number | null
          total_transporte?: number | null
          total_trip?: number | null
          total_trip2?: number | null
          total_tripulacao?: number | null
          total_valor?: number | null
          tripulacao_id?: string | null
          tripulante_id2?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "travel_expense_reports_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_expense_reports_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_expense_reports_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "travel_expense_reports_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "travel_expense_reports_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "travel_expense_reports_clientes_id_fkey"
            columns: ["clientes_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_expense_reports_clientes_id_fkey"
            columns: ["clientes_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "travel_expense_reports_clientes_id_fkey"
            columns: ["clientes_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "travel_expense_reports_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_expense_reports_socios_id_fkey"
            columns: ["socios_id"]
            isOneToOne: false
            referencedRelation: "socios"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_report_attachments: {
        Row: {
          caminho_arquivo: string
          created_at: string | null
          expense_index: number
          file_size: number | null
          id: string
          nome_arquivo: string
          tipo_arquivo: string | null
          travel_report_id: string | null
          url_arquivo: string
        }
        Insert: {
          caminho_arquivo: string
          created_at?: string | null
          expense_index: number
          file_size?: number | null
          id?: string
          nome_arquivo: string
          tipo_arquivo?: string | null
          travel_report_id?: string | null
          url_arquivo: string
        }
        Update: {
          caminho_arquivo?: string
          created_at?: string | null
          expense_index?: number
          file_size?: number | null
          id?: string
          nome_arquivo?: string
          tipo_arquivo?: string | null
          travel_report_id?: string | null
          url_arquivo?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_report_attachments_travel_report_id_fkey"
            columns: ["travel_report_id"]
            isOneToOne: false
            referencedRelation: "travel_expense_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_report_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          actor_type: string
          created_at: string
          id: string
          notes: string | null
          report_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          actor_type: string
          created_at?: string
          id?: string
          notes?: string | null
          report_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          actor_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_report_approval_log_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "travel_expense_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      tripulacao: {
        Row: {
          canac: string
          cpf: string | null
          criado_em: string | null
          data_nascimento: string | null
          endereco: string | null
          id: string
          nome_completo: string
          rg: string | null
          status: string
          telefone: string | null
          url_avatar: string | null
        }
        Insert: {
          canac: string
          cpf?: string | null
          criado_em?: string | null
          data_nascimento?: string | null
          endereco?: string | null
          id?: string
          nome_completo: string
          rg?: string | null
          status?: string
          telefone?: string | null
          url_avatar?: string | null
        }
        Update: {
          canac?: string
          cpf?: string | null
          criado_em?: string | null
          data_nascimento?: string | null
          endereco?: string | null
          id?: string
          nome_completo?: string
          rg?: string | null
          status?: string
          telefone?: string | null
          url_avatar?: string | null
        }
        Relationships: []
      }
      user_alert_preferences: {
        Row: {
          action: string
          alert_id: string
          created_at: string
          id: string
          snoozed_until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action?: string
          alert_id: string
          created_at?: string
          id?: string
          snoozed_until?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: string
          alert_id?: string
          created_at?: string
          id?: string
          snoozed_until?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_alert_preferences_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "expiration_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_anniversary_preferences: {
        Row: {
          acknowledged_at: string | null
          action: string
          alert_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          action?: string
          alert_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          action?: string
          alert_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_anniversary_preferences_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "anniversary_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_clientes: {
        Row: {
          atualizado_em: string | null
          avatar_url: string | null
          clientes_id: string | null
          criado_em: string | null
          display_name: string | null
          email: string
          id: string
          razao_social: string
        }
        Insert: {
          atualizado_em?: string | null
          avatar_url?: string | null
          clientes_id?: string | null
          criado_em?: string | null
          display_name?: string | null
          email: string
          id: string
          razao_social: string
        }
        Update: {
          atualizado_em?: string | null
          avatar_url?: string | null
          clientes_id?: string | null
          criado_em?: string | null
          display_name?: string | null
          email?: string
          id?: string
          razao_social?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_clientes_clientes_id_fkey"
            columns: ["clientes_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_clientes_clientes_id_fkey"
            columns: ["clientes_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "user_clientes_clientes_id_fkey"
            columns: ["clientes_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      user_documents: {
        Row: {
          caminho_arquivo: string
          categoria: string | null
          criado_em: string | null
          id: string
          nome_arquivo: string
          tamanho_arquivo: number | null
          tipo_arquivo: string
          uploaded_by: string | null
          user_id: string
        }
        Insert: {
          caminho_arquivo: string
          categoria?: string | null
          criado_em?: string | null
          id?: string
          nome_arquivo: string
          tamanho_arquivo?: number | null
          tipo_arquivo: string
          uploaded_by?: string | null
          user_id: string
        }
        Update: {
          caminho_arquivo?: string
          categoria?: string | null
          criado_em?: string | null
          id?: string
          nome_arquivo?: string
          tamanho_arquivo?: number | null
          tipo_arquivo?: string
          uploaded_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          address: string | null
          admission_date: string | null
          avatar_url: string | null
          bank_account: string | null
          bank_agency: string | null
          bank_name: string | null
          bank_pix: string | null
          birth_date: string | null
          canac: string | null
          client_id: string | null
          cpf: string | null
          created_at: string | null
          departamento: string | null
          display_name: string | null
          email: string
          employment_status: string | null
          full_name: string
          id: string
          phone: string | null
          rg: string | null
          salario: number | null
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          admission_date?: string | null
          avatar_url?: string | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          bank_pix?: string | null
          birth_date?: string | null
          canac?: string | null
          client_id?: string | null
          cpf?: string | null
          created_at?: string | null
          departamento?: string | null
          display_name?: string | null
          email: string
          employment_status?: string | null
          full_name: string
          id: string
          phone?: string | null
          rg?: string | null
          salario?: number | null
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          admission_date?: string | null
          avatar_url?: string | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          bank_pix?: string | null
          birth_date?: string | null
          canac?: string | null
          client_id?: string | null
          cpf?: string | null
          created_at?: string | null
          departamento?: string | null
          display_name?: string | null
          email?: string
          employment_status?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          rg?: string | null
          salario?: number | null
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "user_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vacation_balances: {
        Row: {
          created_at: string | null
          days_available: number | null
          days_earned: number
          days_used: number
          id: string
          updated_at: string | null
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string | null
          days_available?: number | null
          days_earned?: number
          days_used?: number
          id?: string
          updated_at?: string | null
          user_id: string
          year: number
        }
        Update: {
          created_at?: string | null
          days_available?: number | null
          days_earned?: number
          days_used?: number
          id?: string
          updated_at?: string | null
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      vacation_requests: {
        Row: {
          approver_id: string | null
          criado_em: string
          days: number
          end_date: string
          id: string
          remarks: string | null
          start_date: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          approver_id?: string | null
          criado_em?: string
          days: number
          end_date: string
          id?: string
          remarks?: string | null
          start_date: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          approver_id?: string | null
          criado_em?: string
          days?: number
          end_date?: string
          id?: string
          remarks?: string | null
          start_date?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacation_requests_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vacation_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      ciclos_voo_ativos: {
        Row: {
          aircraft_id: string | null
          aircraft_model: string | null
          client_cnpj: string | null
          client_id: string | null
          client_name: string | null
          client_owner: string | null
          completed_at: string | null
          created_at: string | null
          destination_icao: string | null
          flight_date: string | null
          flight_type: string | null
          has_overnight: boolean | null
          id: string | null
          observations: string | null
          origin_icao: string | null
          pilot_canac: string | null
          pilot_name: string | null
          registration: string | null
          return_date: string | null
          started_at: string | null
          status: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flight_cycles_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_cycles_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_cycles_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "flight_cycles_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "flight_cycles_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "flight_cycles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_cycles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "flight_cycles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      diario_mes_com_disponivel: {
        Row: {
          aerodromo_base: string | null
          aeronave_id: string | null
          ano: number | null
          celula_anterior_ttotal: number | null
          celula_anterior_tvoo: number | null
          celula_atual_ttotal: number | null
          celula_atual_tvoo: number | null
          celula_disponivel: number | null
          celula_disponivel_ttotal: number | null
          celula_disponivel_tvoo: number | null
          celula_prox_revisao_ttotal: number | null
          celula_prox_revisao_tvoo: number | null
          confirmado: boolean | null
          confirmado_em: string | null
          confirmado_por: string | null
          consumo_combustivel: string | null
          criado_em: string | null
          fechado: boolean | null
          horimetro_ativo: number | null
          horimetro_final: number | null
          horimetro_inicio: number | null
          id: string | null
          mes: number | null
          modo_celula: string | null
          tarifa_diaria: number | null
          tem_tarifa_diaria: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "diario_mes_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diario_mes_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diario_mes_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "diario_mes_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "diario_mes_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
      }
      disponibilidade_aeronave: {
        Row: {
          dias_bloqueados: number | null
          id: string | null
          localizacao_atual: string | null
          modelo: string | null
          registro: string | null
          status_atual: string | null
        }
        Relationships: []
      }
      historico_voo_tripulante: {
        Row: {
          aerodromo_chegada: string | null
          aerodromo_saida: string | null
          canac_pic: string | null
          canac_sic: string | null
          data_voo: string | null
          horas_noturnas: number | null
          id: string | null
          matricula_aeronave: string | null
          modelo_aeronave: string | null
          nome_pic: string | null
          nome_sic: string | null
          tempo_ifr: number | null
          tempo_total: number | null
        }
        Relationships: []
      }
      vw_aeronave_totais: {
        Row: {
          aeronave_id: string | null
          horas_totais_tempo_total: number | null
          horas_totais_tempo_voo: number | null
          matricula: string | null
          nome_proprietario: string | null
          pousos_totais: number | null
        }
        Relationships: []
      }
      vw_categorias_aeronave: {
        Row: {
          aeronave_id: string | null
          aeronave_registro: string | null
          categoria: string | null
          mes_ano: string | null
          mes_referencia: string | null
          quantidade: number | null
          total_categoria: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_reconciliations_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "bank_reconciliations_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "bank_reconciliations_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
      }
      vw_categorias_cliente: {
        Row: {
          categoria: string | null
          cliente_id: string | null
          cliente_nome: string | null
          mes_ano: string | null
          mes_referencia: string | null
          quantidade: number | null
          total_categoria: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conciliacoes_bancarias_clientes_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conciliacoes_bancarias_clientes_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "conciliacoes_bancarias_clientes_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      vw_despesas_aeronave: {
        Row: {
          aeronave: string | null
          aeronave_id: string | null
          amount: number | null
          boleto_url: string | null
          category: string | null
          cliente: string | null
          comprovante_url: string | null
          created_at: string | null
          date: string | null
          description: string | null
          fornecedor_nome: string | null
          nf_url: string | null
          origem_pagamento: string | null
          status: string | null
        }
        Relationships: []
      }
      vw_extrato_aeronave: {
        Row: {
          aeronave_id: string | null
          aeronave_modelo: string | null
          aeronave_registro: string | null
          afeta_caixa_empresa: boolean | null
          boleto_url: string | null
          categoria: string | null
          cliente_id: string | null
          cliente_nome: string | null
          comprovante_url: string | null
          created_at: string | null
          criado_por: string | null
          data: string | null
          descricao: string | null
          fornecedor_nome: string | null
          movimentacao_id: string | null
          nf_url: string | null
          status: string | null
          tipo_pagamento: string | null
          valor: number | null
          valor_pendente_reembolso: number | null
          valor_reembolsado: number | null
        }
        Relationships: []
      }
      vw_rateio_cotistas: {
        Row: {
          aeronave_id: string | null
          categoria_custo: string | null
          categoria_custo_nome: string | null
          cliente_id: string | null
          cotista_nome: string | null
          mes_ano: string | null
          mes_referencia: string | null
          saldo: number | null
          socio_id: string | null
          tipo_rateio: string | null
          total_devido: number | null
          total_pago: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rateio_despesas_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateio_despesas_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateio_despesas_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "rateio_despesas_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "rateio_despesas_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "rateio_despesas_categoria_custo_fkey"
            columns: ["categoria_custo"]
            isOneToOne: false
            referencedRelation: "expense_configu"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateio_despesas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateio_despesas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "rateio_despesas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "rateio_despesas_socio_id_fkey"
            columns: ["socio_id"]
            isOneToOne: false
            referencedRelation: "socios"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_reembolsos_pendentes: {
        Row: {
          aeronave: string | null
          boleto_url: string | null
          categoria: string | null
          cliente_email: string | null
          cliente_id: string | null
          cliente_nome: string | null
          cliente_telefone: string | null
          comprovante_url: string | null
          created_at: string | null
          data_despesa: string | null
          descricao: string | null
          dias_pendente: number | null
          movimentacao_id: string | null
          nf_url: string | null
          prioridade: string | null
          saldo_pendente: number | null
          status: string | null
          status_legivel: string | null
          valor_ja_pago: number | null
          valor_total: number | null
        }
        Relationships: []
      }
      vw_resumo_mensal_cliente: {
        Row: {
          aeronave_id: string | null
          cliente_id: string | null
          custo_por_hora: number | null
          horas_totais_aeronave: number | null
          horas_voadas: number | null
          mes_ano: string | null
          mes_referencia: string | null
          total_devido: number | null
          total_extra: number | null
          total_fixo: number | null
          total_pago: number | null
          total_variavel: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rateio_despesas_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateio_despesas_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "disponibilidade_aeronave"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateio_despesas_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_aeronave_totais"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "rateio_despesas_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "rateio_despesas_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "rateio_despesas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateio_despesas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "rateio_despesas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      vw_top_categorias: {
        Row: {
          categoria: string | null
          quantidade: number | null
          total_valor: number | null
          valor_medio: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      authenticate_client_portal: {
        Args: { p_email: string; p_password: string }
        Returns: Json
      }
      calcular_consumo_combustivel: {
        Args: { p_id: string }
        Returns: undefined
      }
      calculate_total_hours: {
        Args: {
          p_clock_in: string
          p_clock_out: string
          p_lunch_end: string
          p_lunch_start: string
        }
        Returns: number
      }
      calculate_weight_and_cg: {
        Args: { _combustivel_utilizado?: number; _weight_balance_id: string }
        Returns: {
          cg_braço: number
          cg_percentual: number
          dentro_limites: boolean
          momento_total: number
          peso_total: number
        }[]
      }
      check_date_availability: {
        Args: { p_aircraft_id: string; p_date: string }
        Returns: boolean
      }
      consolidar_despesas_para_historico: {
        Args: { p_bank_reconciliation_id: string; p_consolidado_por?: string }
        Returns: string[]
      }
      consolidar_horas_mensais: { Args: never; Returns: undefined }
      consolidar_horas_mes_especifico: {
        Args: { p_aircraft_id: string; p_ano: number; p_mes: number }
        Returns: undefined
      }
      create_flight_plan_from_booking: {
        Args: { p_booking_id: string; p_pilot_id: string }
        Returns: string
      }
      create_logbook_from_cycle: {
        Args: { p_cycle_id: string; p_pic_id: string; p_sic_id?: string }
        Returns: string
      }
      dms_to_decimal: { Args: { dms_str: string }; Returns: string }
      earth: { Args: never; Returns: number }
      fn_extrato_periodo: {
        Args: {
          p_data_fim: string
          p_data_inicio: string
          p_id: string
          p_tipo: string
        }
        Returns: {
          categoria: string
          data: string
          descricao: string
          documentos: Json
          saldo_pendente: number
          status: string
          tipo_pagamento: string
          valor: number
        }[]
      }
      fn_renumerar_diario: {
        Args: { p_diario_mes: string }
        Returns: undefined
      }
      generate_report_number:
        | { Args: { client_id_param: string }; Returns: string }
        | {
            Args: { client_name: string; report_year: number }
            Returns: string
          }
        | { Args: { p_cliente: string; p_year: string }; Returns: string }
      generate_travel_report_number: {
        Args: { p_client_name: string }
        Returns: string
      }
      gerar_financeiro_relatorio_viagem: {
        Args: { p_report_id: string }
        Returns: undefined
      }
      gerar_numero_os: {
        Args: { p_aeronave_id: string; p_data: string }
        Returns: string
      }
      gerar_numero_relatorio_viagem: {
        Args: { p_cliente_id: string; p_matricula: string }
        Returns: string
      }
      get_partner_by_cpf: {
        Args: { p_cpf: string }
        Returns: {
          client_id: string
          cnpj: string
          company_name: string
          partner_name: string
          partner_position: number
        }[]
      }
      get_salary_category_ids: {
        Args: never
        Returns: {
          cat_beneficio: string
          cat_decimo_ferias: string
          cat_extras: string
          cat_horas_voo: string
          cat_salario_holerite: string
          cat_salario_pj: string
        }[]
      }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_admin_role: { Args: never; Returns: boolean }
      is_financeiro_master: { Args: never; Returns: boolean }
      is_gestor_master: { Args: never; Returns: boolean }
      is_privileged_user: { Args: never; Returns: boolean }
      is_user_active: { Args: { _user_id: string }; Returns: boolean }
      marcar_recado_lido: { Args: { p_recado_id: string }; Returns: undefined }
      next_receipt_number:
        | { Args: never; Returns: number }
        | { Args: { p_year: number }; Returns: string }
      obter_historico_cliente: {
        Args: {
          p_cliente_id: string
          p_data_fim: string
          p_data_inicio: string
        }
        Returns: {
          aeronave_registro: string
          categoria_grupo: string
          categoria_nome: string
          data_competencia: string
          data_pagamento: string
          descricao: string
          foi_reembolso: boolean
          horas_voadas: number
          id: string
          percentual_participacao: number
          status: string
          valor_rateado: number
        }[]
      }
      processar_demonstrativo_voo: {
        Args: {
          p_aeronave_id: string
          p_competencia: string
          p_data_emissao: string
          p_data_vencimento: string
          p_dry_run?: boolean
          p_itens: Json
          p_numero_documento: string
          p_tipo: string
          p_valor_total: number
        }
        Returns: Json
      }
      recalcular_cadeia_celula: {
        Args: {
          p_aeronave_id: string
          p_desde_ano?: number
          p_desde_mes?: number
        }
        Returns: undefined
      }
      recalcular_consumo_aeronave: {
        Args: { p_aeronave_id: string }
        Returns: number
      }
      refresh_anniversary_alerts: { Args: never; Returns: undefined }
      refresh_expiration_alerts: { Args: never; Returns: undefined }
      send_report_to_ctm: { Args: { report_id: string }; Returns: undefined }
      start_flight_execution: {
        Args: { p_booking_id: string; p_pic_id: string; p_sic_id?: string }
        Returns: string
      }
      sync_specific_salary: {
        Args: { salary_id: string }
        Returns: {
          lancamentos_criados: number
          mensagem: string
          status: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "financeiro_master"
        | "gestor_master"
        | "financeiro"
        | "operacoes"
        | "piloto_chefe"
        | "tripulante"
        | "cotista"
        | "cliente"
        | "rh"
        | "adm"
        | "coordenador_de_voo"
      cma_classe: "1º classe" | "2º classe"
      contact_type: "Colaboradores" | "Fornecedores" | "Hoteis" | "Cliente"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "financeiro_master",
        "gestor_master",
        "financeiro",
        "operacoes",
        "piloto_chefe",
        "tripulante",
        "cotista",
        "cliente",
        "rh",
        "adm",
        "coordenador_de_voo",
      ],
      cma_classe: ["1º classe", "2º classe"],
      contact_type: ["Colaboradores", "Fornecedores", "Hoteis", "Cliente"],
    },
  },
} as const
