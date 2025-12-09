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
          abastecimento_galoes: number | null
          aeronave_id: string | null
          ano: string | null
          client_id: string | null
          comanda: string | null
          created_at: string | null
          data: string
          id: string
          litros: number
          local: string
          trecho: string
          updated_at: string | null
          valor_total: number | null
          valor_unitario: number
        }
        Insert: {
          abastecedor?: string | null
          abastecimento_galoes?: number | null
          aeronave_id?: string | null
          ano?: string | null
          client_id?: string | null
          comanda?: string | null
          created_at?: string | null
          data: string
          id?: string
          litros?: number
          local: string
          trecho: string
          updated_at?: string | null
          valor_total?: number | null
          valor_unitario?: number
        }
        Update: {
          abastecedor?: string | null
          abastecimento_galoes?: number | null
          aeronave_id?: string | null
          ano?: string | null
          client_id?: string | null
          comanda?: string | null
          created_at?: string | null
          data?: string
          id?: string
          litros?: number
          local?: string
          trecho?: string
          updated_at?: string | null
          valor_total?: number | null
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "abastecimentos_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abastecimentos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
          name: string
          updated_at: string | null
        }
        Insert: {
          coordenadas?: string | null
          created_at?: string | null
          designativo: string
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          coordenadas?: string | null
          created_at?: string | null
          designativo?: string
          id?: string
          name?: string
          updated_at?: string | null
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
      aircraft: {
        Row: {
          base: string | null
          cell_hours_before: number | null
          cell_hours_current: number | null
          cell_hours_prev: number | null
          created_at: string | null
          fuel_consumption: number | null
          horimeter_active: number | null
          horimeter_end: number | null
          horimeter_start: number | null
          hourly_price: string | null
          id: string
          manufacturer: string
          model: string
          owner_name: string
          registration: string
          serial_number: string
          status: string
          updated_at: string | null
          year: string | null
        }
        Insert: {
          base?: string | null
          cell_hours_before?: number | null
          cell_hours_current?: number | null
          cell_hours_prev?: number | null
          created_at?: string | null
          fuel_consumption?: number | null
          horimeter_active?: number | null
          horimeter_end?: number | null
          horimeter_start?: number | null
          hourly_price?: string | null
          id?: string
          manufacturer: string
          model: string
          owner_name: string
          registration: string
          serial_number: string
          status?: string
          updated_at?: string | null
          year?: string | null
        }
        Update: {
          base?: string | null
          cell_hours_before?: number | null
          cell_hours_current?: number | null
          cell_hours_prev?: number | null
          created_at?: string | null
          fuel_consumption?: number | null
          horimeter_active?: number | null
          horimeter_end?: number | null
          horimeter_start?: number | null
          hourly_price?: string | null
          id?: string
          manufacturer?: string
          model?: string
          owner_name?: string
          registration?: string
          serial_number?: string
          status?: string
          updated_at?: string | null
          year?: string | null
        }
        Relationships: []
      }
      aircraft_hourly_rates: {
        Row: {
          aircraft_id: string
          created_at: string | null
          effective_date: string
          hourly_rate: number
          id: string
        }
        Insert: {
          aircraft_id: string
          created_at?: string | null
          effective_date: string
          hourly_rate: number
          id?: string
        }
        Update: {
          aircraft_id?: string
          created_at?: string | null
          effective_date?: string
          hourly_rate?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aircraft_hourly_rates_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_reconciliations: {
        Row: {
          aircraft_id: string | null
          amount: number
          category: string | null
          client_id: string | null
          created_at: string | null
          created_by: string
          date: string
          description: string
          id: string
          payment_term: string | null
          receiver_id: string | null
          reference_id: string | null
          reference_type: string | null
          status: string
          type: string
          updated_at: string | null
        }
        Insert: {
          aircraft_id?: string | null
          amount: number
          category?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by: string
          date: string
          description: string
          id?: string
          payment_term?: string | null
          receiver_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status: string
          type: string
          updated_at?: string | null
        }
        Update: {
          aircraft_id?: string | null
          amount?: number
          category?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string
          date?: string
          description?: string
          id?: string
          payment_term?: string | null
          receiver_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_reconciliations_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
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
          cliente_id: string | null
          cliente_nome: string | null
          criado_em: string | null
          criado_por: string
          descricao: string | null
          id: string
          nome: string
          tipo: string
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          criado_em?: string | null
          criado_por: string
          descricao?: string | null
          id?: string
          nome: string
          tipo: string
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          cliente_id?: string | null
          cliente_nome?: string | null
          criado_em?: string | null
          criado_por?: string
          descricao?: string | null
          id?: string
          nome?: string
          tipo?: string
        }
        Relationships: []
      }
      client_aircraft: {
        Row: {
          aircraft_id: string
          client_id: string
          created_at: string | null
          id: string
          login: string | null
          model_aircraft: string | null
          senha: string | null
          share_percentage: number
          updated_at: string | null
        }
        Insert: {
          aircraft_id: string
          client_id: string
          created_at?: string | null
          id?: string
          login?: string | null
          model_aircraft?: string | null
          senha?: string | null
          share_percentage: number
          updated_at?: string | null
        }
        Update: {
          aircraft_id?: string
          client_id?: string
          created_at?: string | null
          id?: string
          login?: string | null
          model_aircraft?: string | null
          senha?: string | null
          share_percentage?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_aircraft_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_aircraft_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contracts: {
        Row: {
          client_id: string
          created_at: string | null
          description: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          public_url: string | null
          updated_at: string | null
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          public_url?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          public_url?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portal_data: {
        Row: {
          amount: number | null
          client_id: string
          created_at: string | null
          data_type: string
          description: string | null
          due_date: string | null
          file_path: string | null
          id: string
          status: string | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          amount?: number | null
          client_id: string
          created_at?: string | null
          data_type: string
          description?: string | null
          due_date?: string | null
          file_path?: string | null
          id?: string
          status?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          amount?: number | null
          client_id?: string
          created_at?: string | null
          data_type?: string
          description?: string | null
          due_date?: string | null
          file_path?: string | null
          id?: string
          status?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      client_portal_files: {
        Row: {
          aircraft_id: string | null
          amount: number | null
          client_id: string
          created_at: string | null
          description: string | null
          due_date: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          reference_month: number | null
          reference_year: number | null
          status: string | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          aircraft_id?: string | null
          amount?: number | null
          client_id: string
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          reference_month?: number | null
          reference_year?: number | null
          status?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          aircraft_id?: string | null
          amount?: number | null
          client_id?: string
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          reference_month?: number | null
          reference_year?: number | null
          status?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_files_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          aircraft: string | null
          city: string | null
          cnpj: string | null
          cnpj_card_url: string | null
          company_name: string | null
          created_at: string | null
          documents: Json | null
          email: string | null
          financial_contact: string | null
          id: string
          inscricao_estadual: string | null
          logo_url: string | null
          observations: string | null
          phone: string | null
          share_percentage: number | null
          status: string | null
          uf: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          aircraft?: string | null
          city?: string | null
          cnpj?: string | null
          cnpj_card_url?: string | null
          company_name?: string | null
          created_at?: string | null
          documents?: Json | null
          email?: string | null
          financial_contact?: string | null
          id?: string
          inscricao_estadual?: string | null
          logo_url?: string | null
          observations?: string | null
          phone?: string | null
          share_percentage?: number | null
          status?: string | null
          uf?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          aircraft?: string | null
          city?: string | null
          cnpj?: string | null
          cnpj_card_url?: string | null
          company_name?: string | null
          created_at?: string | null
          documents?: Json | null
          email?: string | null
          financial_contact?: string | null
          id?: string
          inscricao_estadual?: string | null
          logo_url?: string | null
          observations?: string | null
          phone?: string | null
          share_percentage?: number | null
          status?: string | null
          uf?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_aircraft_fkey"
            columns: ["aircraft"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          cep: string | null
          cidade: string | null
          cnpj: string
          created_at: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          logo_url: string | null
          nome_fantasia: string | null
          razao_social: string
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          cep?: string | null
          cidade?: string | null
          cnpj: string
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          logo_url?: string | null
          nome_fantasia?: string | null
          razao_social: string
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          cep?: string | null
          cidade?: string | null
          cnpj?: string
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          logo_url?: string | null
          nome_fantasia?: string | null
          razao_social?: string
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          address: string | null
          category: Database["public"]["Enums"]["contact_type"] | null
          city: string | null
          company_name: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          position: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          category?: Database["public"]["Enums"]["contact_type"] | null
          city?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          category?: Database["public"]["Enums"]["contact_type"] | null
          city?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      contas_apagar: {
        Row: {
          aeronave: string
          arquivo_pdf_url: string | null
          atualizado_em: string | null
          categoria: string
          criado_em: string | null
          criado_por: string | null
          data_pagamento_agendado: string | null
          data_recebimento: string
          data_vencimento: string
          descricao: string | null
          fornecedor_cnpj: string
          fornecedor_nome: string
          id: string
          metodo_pagamento: string | null
          numero: string
          observacoes: string | null
          status: string
          valor: number
        }
        Insert: {
          aeronave: string
          arquivo_pdf_url?: string | null
          atualizado_em?: string | null
          categoria: string
          criado_em?: string | null
          criado_por?: string | null
          data_pagamento_agendado?: string | null
          data_recebimento: string
          data_vencimento: string
          descricao?: string | null
          fornecedor_cnpj: string
          fornecedor_nome: string
          id?: string
          metodo_pagamento?: string | null
          numero: string
          observacoes?: string | null
          status: string
          valor: number
        }
        Update: {
          aeronave?: string
          arquivo_pdf_url?: string | null
          atualizado_em?: string | null
          categoria?: string
          criado_em?: string | null
          criado_por?: string | null
          data_pagamento_agendado?: string | null
          data_recebimento?: string
          data_vencimento?: string
          descricao?: string | null
          fornecedor_cnpj?: string
          fornecedor_nome?: string
          id?: string
          metodo_pagamento?: string | null
          numero?: string
          observacoes?: string | null
          status?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "contas_apagar_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["registration"]
          },
        ]
      }
      contas_areceber: {
        Row: {
          aeronave: string
          arquivo_pdf_url: string | null
          atualizado_em: string | null
          categoria: string
          cliente_cnpj: string
          cliente_nome: string
          criado_em: string | null
          criado_por: string | null
          data_criacao: string
          data_vencimento: string
          descricao: string | null
          id: string
          numero: string
          status: string
          valor: number
        }
        Insert: {
          aeronave: string
          arquivo_pdf_url?: string | null
          atualizado_em?: string | null
          categoria: string
          cliente_cnpj: string
          cliente_nome: string
          criado_em?: string | null
          criado_por?: string | null
          data_criacao: string
          data_vencimento: string
          descricao?: string | null
          id?: string
          numero: string
          status: string
          valor: number
        }
        Update: {
          aeronave?: string
          arquivo_pdf_url?: string | null
          atualizado_em?: string | null
          categoria?: string
          cliente_cnpj?: string
          cliente_nome?: string
          criado_em?: string | null
          criado_por?: string | null
          data_criacao?: string
          data_vencimento?: string
          descricao?: string | null
          id?: string
          numero?: string
          status?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "contas_areceber_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["registration"]
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
          empresa_id: string
          id: string
          nome: string
          numero_conta: string | null
          saldo: number | null
          tipo_conta: string | null
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          banco?: string | null
          criado_em?: string | null
          criado_por: string
          empresa_id: string
          id?: string
          nome: string
          numero_conta?: string | null
          saldo?: number | null
          tipo_conta?: string | null
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          banco?: string | null
          criado_em?: string | null
          criado_por?: string
          empresa_id?: string
          id?: string
          nome?: string
          numero_conta?: string | null
          saldo?: number | null
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
          fornecedor: string
          frequencia_recorrencia: string
          id: string
          lembrete_antecipado: boolean | null
          notas: string | null
          status: string
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
          fornecedor: string
          frequencia_recorrencia?: string
          id?: string
          lembrete_antecipado?: boolean | null
          notas?: string | null
          status?: string
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
          fornecedor?: string
          frequencia_recorrencia?: string
          id?: string
          lembrete_antecipado?: boolean | null
          notas?: string | null
          status?: string
          updated_at?: string
          valor?: number | null
        }
        Relationships: []
      }
      controle_bancario: {
        Row: {
          aeronave: string | null
          atualizado_em: string | null
          atualizado_por: string | null
          categoria: string
          comprovante_url: string | null
          conta_banco: string | null
          criado_em: string | null
          criado_por: string
          data: string
          data_atualizacao: string | null
          data_criacao: string | null
          descricao: string
          id: string
          nf_url: string | null
          numero_documento: string | null
          observacoes: string | null
          referencia: string | null
          status: string | null
          tipo_movimento: string
          valor: number
        }
        Insert: {
          aeronave?: string | null
          atualizado_em?: string | null
          atualizado_por?: string | null
          categoria: string
          comprovante_url?: string | null
          conta_banco?: string | null
          criado_em?: string | null
          criado_por: string
          data: string
          data_atualizacao?: string | null
          data_criacao?: string | null
          descricao: string
          id?: string
          nf_url?: string | null
          numero_documento?: string | null
          observacoes?: string | null
          referencia?: string | null
          status?: string | null
          tipo_movimento: string
          valor: number
        }
        Update: {
          aeronave?: string | null
          atualizado_em?: string | null
          atualizado_por?: string | null
          categoria?: string
          comprovante_url?: string | null
          conta_banco?: string | null
          criado_em?: string | null
          criado_por?: string
          data?: string
          data_atualizacao?: string | null
          data_criacao?: string | null
          descricao?: string
          id?: string
          nf_url?: string | null
          numero_documento?: string | null
          observacoes?: string | null
          referencia?: string | null
          status?: string | null
          tipo_movimento?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "controle_bancario_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["registration"]
          },
        ]
      }
      crew_flight_hours: {
        Row: {
          aircraft_id: string
          created_at: string | null
          crew_member_id: string
          id: string
          month: number
          total_hours: number | null
          updated_at: string | null
          year: number
        }
        Insert: {
          aircraft_id: string
          created_at?: string | null
          crew_member_id: string
          id?: string
          month: number
          total_hours?: number | null
          updated_at?: string | null
          year: number
        }
        Update: {
          aircraft_id?: string
          created_at?: string | null
          crew_member_id?: string
          id?: string
          month?: number
          total_hours?: number | null
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "crew_flight_hours_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_licenses: {
        Row: {
          CMA: Database["public"]["Enums"]["cma_classe"] | null
          created_at: string | null
          crew_member_id: string | null
          expiry_date: string | null
          FS_RH: string | null
          id: string
          issue_date: string | null
          license_number: string
          license_type: string
          updated_at: string | null
          validade_cma: string | null
        }
        Insert: {
          CMA?: Database["public"]["Enums"]["cma_classe"] | null
          created_at?: string | null
          crew_member_id?: string | null
          expiry_date?: string | null
          FS_RH?: string | null
          id?: string
          issue_date?: string | null
          license_number: string
          license_type: string
          updated_at?: string | null
          validade_cma?: string | null
        }
        Update: {
          CMA?: Database["public"]["Enums"]["cma_classe"] | null
          created_at?: string | null
          crew_member_id?: string | null
          expiry_date?: string | null
          FS_RH?: string | null
          id?: string
          issue_date?: string | null
          license_number?: string
          license_type?: string
          updated_at?: string | null
          validade_cma?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crew_licenses_crew_member_id_fkey"
            columns: ["crew_member_id"]
            isOneToOne: false
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_members: {
        Row: {
          address: string | null
          birth_date: string | null
          canac: string
          cpf: string | null
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          phone: string | null
          photo_url: string | null
          rg: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          canac: string
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          photo_url?: string | null
          rg?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          canac?: string
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          photo_url?: string | null
          rg?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ctm_tracking: {
        Row: {
          aircraft_id: string | null
          client_id: string | null
          control_type: string
          created_at: string | null
          hours_after: number | null
          id: string
          invoice_number: string | null
          item_name: string
          last_change_date: string | null
          last_change_hours: number | null
          left_value: string | null
          month: number
          remaining_hours: number | null
          right_value: string | null
          service_order_number: string | null
          updated_at: string | null
          year: number
        }
        Insert: {
          aircraft_id?: string | null
          client_id?: string | null
          control_type: string
          created_at?: string | null
          hours_after?: number | null
          id?: string
          invoice_number?: string | null
          item_name: string
          last_change_date?: string | null
          last_change_hours?: number | null
          left_value?: string | null
          month: number
          remaining_hours?: number | null
          right_value?: string | null
          service_order_number?: string | null
          updated_at?: string | null
          year: number
        }
        Update: {
          aircraft_id?: string | null
          client_id?: string | null
          control_type?: string
          created_at?: string | null
          hours_after?: number | null
          id?: string
          invoice_number?: string | null
          item_name?: string
          last_change_date?: string | null
          last_change_hours?: number | null
          left_value?: string | null
          month?: number
          remaining_hours?: number | null
          right_value?: string | null
          service_order_number?: string | null
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "ctm_tracking_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctm_tracking_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      document_folder_permissions: {
        Row: {
          created_at: string | null
          created_by: string
          folder_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          folder_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          folder_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_folder_permissions_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      document_folders: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_restricted: boolean | null
          name: string
          parent_folder_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_restricted?: boolean | null
          name: string
          parent_folder_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_restricted?: boolean | null
          name?: string
          parent_folder_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_folders_parent_folder_id_fkey"
            columns: ["parent_folder_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          file_path: string
          file_size: number
          file_type: string
          folder_id: string | null
          id: string
          name: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_path: string
          file_size: number
          file_type: string
          folder_id?: string | null
          id?: string
          name: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_path?: string
          file_size?: number
          file_type?: string
          folder_id?: string | null
          id?: string
          name?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
        ]
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
      expense_items: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          description: string | null
          id: string
          paid_by: string
          receipt_url: string | null
          report_id: string
          report_number: string
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          paid_by: string
          receipt_url?: string | null
          report_id: string
          report_number: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          paid_by?: string
          receipt_url?: string | null
          report_id?: string
          report_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_items_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "travel_expense_reports"
            referencedColumns: ["id"]
          },
        ]
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
      favorite_services: {
        Row: {
          created_at: string | null
          description: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      flight_checklists: {
        Row: {
          checklist_type: string
          created_at: string | null
          flight_plan_id: string | null
          id: string
          items: Json | null
          updated_at: string | null
        }
        Insert: {
          checklist_type: string
          created_at?: string | null
          flight_plan_id?: string | null
          id?: string
          items?: Json | null
          updated_at?: string | null
        }
        Update: {
          checklist_type?: string
          created_at?: string | null
          flight_plan_id?: string | null
          id?: string
          items?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flight_checklists_flight_plan_id_fkey"
            columns: ["flight_plan_id"]
            isOneToOne: false
            referencedRelation: "flight_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_documents: {
        Row: {
          created_at: string | null
          description: string | null
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          name: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          name: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          name?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      flight_payments: {
        Row: {
          amount: number
          created_at: string | null
          flight_schedule_id: string | null
          id: string
          notes: string | null
          payment_date: string
          payment_method: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          flight_schedule_id?: string | null
          id?: string
          notes?: string | null
          payment_date: string
          payment_method?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          flight_schedule_id?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flight_payments_flight_schedule_id_fkey"
            columns: ["flight_schedule_id"]
            isOneToOne: false
            referencedRelation: "flight_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_plans: {
        Row: {
          aircraft_id: string | null
          alternate_airport: string | null
          arrival_airport: string
          created_at: string | null
          created_by: string | null
          cruise_altitude: string | null
          departure_airport: string
          estimated_time: string | null
          flight_date: string
          flight_schedule_id: string | null
          fuel_endurance: string | null
          id: string
          pilot_in_command: string
          remarks: string | null
          route: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          aircraft_id?: string | null
          alternate_airport?: string | null
          arrival_airport: string
          created_at?: string | null
          created_by?: string | null
          cruise_altitude?: string | null
          departure_airport: string
          estimated_time?: string | null
          flight_date: string
          flight_schedule_id?: string | null
          fuel_endurance?: string | null
          id?: string
          pilot_in_command: string
          remarks?: string | null
          route?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          aircraft_id?: string | null
          alternate_airport?: string | null
          arrival_airport?: string
          created_at?: string | null
          created_by?: string | null
          cruise_altitude?: string | null
          departure_airport?: string
          estimated_time?: string | null
          flight_date?: string
          flight_schedule_id?: string | null
          fuel_endurance?: string | null
          id?: string
          pilot_in_command?: string
          remarks?: string | null
          route?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flight_plans_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_plans_flight_schedule_id_fkey"
            columns: ["flight_schedule_id"]
            isOneToOne: false
            referencedRelation: "flight_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_schedules: {
        Row: {
          aircraft_id: string | null
          client_id: string | null
          contact: string | null
          created_at: string | null
          crew_member_id: string | null
          destination: string | null
          estimated_duration: string | null
          flight_date: string | null
          flight_time: string | null
          flight_type: string | null
          id: string
          observations: string | null
          origin: string | null
          passengers: number | null
          status: string
          updated_at: string | null
        }
        Insert: {
          aircraft_id?: string | null
          client_id?: string | null
          contact?: string | null
          created_at?: string | null
          crew_member_id?: string | null
          destination?: string | null
          estimated_duration?: string | null
          flight_date?: string | null
          flight_time?: string | null
          flight_type?: string | null
          id?: string
          observations?: string | null
          origin?: string | null
          passengers?: number | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          aircraft_id?: string | null
          client_id?: string | null
          contact?: string | null
          created_at?: string | null
          crew_member_id?: string | null
          destination?: string | null
          estimated_duration?: string | null
          flight_date?: string | null
          flight_time?: string | null
          flight_type?: string | null
          id?: string
          observations?: string | null
          origin?: string | null
          passengers?: number | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_crew_member_id"
            columns: ["crew_member_id"]
            isOneToOne: false
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_schedules_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_schedules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_suppliers: {
        Row: {
          city_name: string
          contact_person: string | null
          created_at: string | null
          fuel_price_avgas: number | null
          fuel_price_jet: number | null
          icao_code: string | null
          id: string
          phone: string | null
          supplier_name: string
          updated_at: string | null
        }
        Insert: {
          city_name: string
          contact_person?: string | null
          created_at?: string | null
          fuel_price_avgas?: number | null
          fuel_price_jet?: number | null
          icao_code?: string | null
          id?: string
          phone?: string | null
          supplier_name: string
          updated_at?: string | null
        }
        Update: {
          city_name?: string
          contact_person?: string | null
          created_at?: string | null
          fuel_price_avgas?: number | null
          fuel_price_jet?: number | null
          icao_code?: string | null
          id?: string
          phone?: string | null
          supplier_name?: string
          updated_at?: string | null
        }
        Relationships: []
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
      logbook_crew_members: {
        Row: {
          created_at: string | null
          crew_member_id: string
          funcao_codigo: number
          id: string
          logbook_entry_id: string
        }
        Insert: {
          created_at?: string | null
          crew_member_id: string
          funcao_codigo: number
          id?: string
          logbook_entry_id: string
        }
        Update: {
          created_at?: string | null
          crew_member_id?: string
          funcao_codigo?: number
          id?: string
          logbook_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "logbook_crew_members_entry_fkey"
            columns: ["logbook_entry_id"]
            isOneToOne: false
            referencedRelation: "logbook_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logbook_crew_members_entry_fkey"
            columns: ["logbook_entry_id"]
            isOneToOne: false
            referencedRelation: "view_logbook_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logbook_crew_members_member_fkey"
            columns: ["crew_member_id"]
            isOneToOne: false
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
        ]
      }
      logbook_entries: {
        Row: {
          ac_time: string | null
          aircraft_id: string
          airframe_hours_next_maintenance: number | null
          arrival_aerodrome: string
          cargo_kg: number | null
          celula: number | null
          client_id: string | null
          closed_at: string | null
          closed_by: string | null
          confirmed: boolean | null
          confirmed_at: string | null
          confirmed_by: string | null
          cor_time: string | null
          corrective_actions: string | null
          created_at: string | null
          created_by: string | null
          crew_checkin_time: string | null
          daily_rate: number | null
          day_time: number | null
          dep_time: string | null
          departure_aerodrome: string
          detected_by: string | null
          discrepancies: string | null
          distance_nm: number | null
          entry_date: string
          extras: string | null
          flight_nature: string
          flight_rules: string | null
          fuel_added: number | null
          fuel_liters: number | null
          fuel_location: string | null
          fuel_price_per_liter: number | null
          fuel_type: string | null
          id: string
          ifr_time: number | null
          ifr_type: string | null
          is_closed: boolean | null
          last_maintenance_type: string | null
          logbook_month_id: string
          maintenance_approval_responsible: string | null
          next_maintenance_type: string | null
          night_hours: number | null
          observations: string | null
          occurrences: string | null
          passengers: number | null
          pic_canac: string
          pilot_signature_date: string | null
          pou_time: string | null
          pousos: number | null
          refueled: boolean | null
          sequential_number: number | null
          sic_canac: string | null
          sic_name: string | null
          sunrise_time: string | null
          sunset_time: string | null
          time: number | null
          total_time: number | null
        }
        Insert: {
          ac_time?: string | null
          aircraft_id: string
          airframe_hours_next_maintenance?: number | null
          arrival_aerodrome: string
          cargo_kg?: number | null
          celula?: number | null
          client_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          confirmed?: boolean | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          cor_time?: string | null
          corrective_actions?: string | null
          created_at?: string | null
          created_by?: string | null
          crew_checkin_time?: string | null
          daily_rate?: number | null
          day_time?: number | null
          dep_time?: string | null
          departure_aerodrome: string
          detected_by?: string | null
          discrepancies?: string | null
          distance_nm?: number | null
          entry_date: string
          extras?: string | null
          flight_nature: string
          flight_rules?: string | null
          fuel_added?: number | null
          fuel_liters?: number | null
          fuel_location?: string | null
          fuel_price_per_liter?: number | null
          fuel_type?: string | null
          id?: string
          ifr_time?: number | null
          ifr_type?: string | null
          is_closed?: boolean | null
          last_maintenance_type?: string | null
          logbook_month_id: string
          maintenance_approval_responsible?: string | null
          next_maintenance_type?: string | null
          night_hours?: number | null
          observations?: string | null
          occurrences?: string | null
          passengers?: number | null
          pic_canac: string
          pilot_signature_date?: string | null
          pou_time?: string | null
          pousos?: number | null
          refueled?: boolean | null
          sequential_number?: number | null
          sic_canac?: string | null
          sic_name?: string | null
          sunrise_time?: string | null
          sunset_time?: string | null
          time?: number | null
          total_time?: number | null
        }
        Update: {
          ac_time?: string | null
          aircraft_id?: string
          airframe_hours_next_maintenance?: number | null
          arrival_aerodrome?: string
          cargo_kg?: number | null
          celula?: number | null
          client_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          confirmed?: boolean | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          cor_time?: string | null
          corrective_actions?: string | null
          created_at?: string | null
          created_by?: string | null
          crew_checkin_time?: string | null
          daily_rate?: number | null
          day_time?: number | null
          dep_time?: string | null
          departure_aerodrome?: string
          detected_by?: string | null
          discrepancies?: string | null
          distance_nm?: number | null
          entry_date?: string
          extras?: string | null
          flight_nature?: string
          flight_rules?: string | null
          fuel_added?: number | null
          fuel_liters?: number | null
          fuel_location?: string | null
          fuel_price_per_liter?: number | null
          fuel_type?: string | null
          id?: string
          ifr_time?: number | null
          ifr_type?: string | null
          is_closed?: boolean | null
          last_maintenance_type?: string | null
          logbook_month_id?: string
          maintenance_approval_responsible?: string | null
          next_maintenance_type?: string | null
          night_hours?: number | null
          observations?: string | null
          occurrences?: string | null
          passengers?: number | null
          pic_canac?: string
          pilot_signature_date?: string | null
          pou_time?: string | null
          pousos?: number | null
          refueled?: boolean | null
          sequential_number?: number | null
          sic_canac?: string | null
          sic_name?: string | null
          sunrise_time?: string | null
          sunset_time?: string | null
          time?: number | null
          total_time?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "logbook_entries_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logbook_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logbook_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logbook_entries_pic_canac_fkey"
            columns: ["pic_canac"]
            isOneToOne: false
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logbook_entries_sic_canac_fkey"
            columns: ["sic_canac"]
            isOneToOne: false
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
        ]
      }
      logbook_months: {
        Row: {
          aircraft_id: string
          base_aerodrome: string | null
          celula_anterior: number | null
          celula_atual: number | null
          celula_disponivel: number | null
          celula_prox_revisao: number | null
          confirmed: boolean | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string | null
          daily_rate: number | null
          fuel_consumption: string | null
          horimetro_ativo: number | null
          horimetro_final: number | null
          horimetro_inicio: number | null
          id: string
          is_closed: boolean | null
          month: number
          year: number
        }
        Insert: {
          aircraft_id: string
          base_aerodrome?: string | null
          celula_anterior?: number | null
          celula_atual?: number | null
          celula_disponivel?: number | null
          celula_prox_revisao?: number | null
          confirmed?: boolean | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          daily_rate?: number | null
          fuel_consumption?: string | null
          horimetro_ativo?: number | null
          horimetro_final?: number | null
          horimetro_inicio?: number | null
          id?: string
          is_closed?: boolean | null
          month: number
          year: number
        }
        Update: {
          aircraft_id?: string
          base_aerodrome?: string | null
          celula_anterior?: number | null
          celula_atual?: number | null
          celula_disponivel?: number | null
          celula_prox_revisao?: number | null
          confirmed?: boolean | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          daily_rate?: number | null
          fuel_consumption?: string | null
          horimetro_ativo?: number | null
          horimetro_final?: number | null
          horimetro_inicio?: number | null
          id?: string
          is_closed?: boolean | null
          month?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "logbook_months_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
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
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
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
      manutencoes: {
        Row: {
          aeronave_id: string | null
          created_at: string | null
          custo_estimado: number | null
          data_programada: string
          etapa: string
          id: string
          mecanico: string
          numero_os: string | null
          observacoes: string | null
          oficina: string | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          aeronave_id?: string | null
          created_at?: string | null
          custo_estimado?: number | null
          data_programada: string
          etapa?: string
          id?: string
          mecanico: string
          numero_os?: string | null
          observacoes?: string | null
          oficina?: string | null
          tipo: string
          updated_at?: string | null
        }
        Update: {
          aeronave_id?: string | null
          created_at?: string | null
          custo_estimado?: number | null
          data_programada?: string
          etapa?: string
          id?: string
          mecanico?: string
          numero_os?: string | null
          observacoes?: string | null
          oficina?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manutencoes_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_fiscais_saida: {
        Row: {
          arquivo_pdf_url: string | null
          atualizado_em: string | null
          categoria: string
          cliente_cnpj: string
          cliente_nome: string
          criado_em: string | null
          criado_por: string | null
          data_criacao: string
          data_vencimento: string
          descricao: string | null
          id: string
          numero: string
          status: string
          valor: number
        }
        Insert: {
          arquivo_pdf_url?: string | null
          atualizado_em?: string | null
          categoria: string
          cliente_cnpj: string
          cliente_nome: string
          criado_em?: string | null
          criado_por?: string | null
          data_criacao: string
          data_vencimento: string
          descricao?: string | null
          id?: string
          numero: string
          status: string
          valor: number
        }
        Update: {
          arquivo_pdf_url?: string | null
          atualizado_em?: string | null
          categoria?: string
          cliente_cnpj?: string
          cliente_nome?: string
          criado_em?: string | null
          criado_por?: string | null
          data_criacao?: string
          data_vencimento?: string
          descricao?: string | null
          id?: string
          numero?: string
          status?: string
          valor?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          read: boolean | null
          task_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          read?: boolean | null
          task_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          read?: boolean | null
          task_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamento_salario_funcionario: {
        Row: {
          banco: string | null
          base_salary_holerite: number | null
          benefit: string | null
          comprovante_url: string | null
          created_at: string | null
          decimo_terceiro_parcela1: number | null
          decimo_terceiro_parcela2: number | null
          extra: string | null
          ferias: number | null
          holerite_url: string | null
          horas_voo: string | null
          id: string
          obs: string | null
          updated_at: string | null
          user_profile: string | null
        }
        Insert: {
          banco?: string | null
          base_salary_holerite?: number | null
          benefit?: string | null
          comprovante_url?: string | null
          created_at?: string | null
          decimo_terceiro_parcela1?: number | null
          decimo_terceiro_parcela2?: number | null
          extra?: string | null
          ferias?: number | null
          holerite_url?: string | null
          horas_voo?: string | null
          id?: string
          obs?: string | null
          updated_at?: string | null
          user_profile?: string | null
        }
        Update: {
          banco?: string | null
          base_salary_holerite?: number | null
          benefit?: string | null
          comprovante_url?: string | null
          created_at?: string | null
          decimo_terceiro_parcela1?: number | null
          decimo_terceiro_parcela2?: number | null
          extra?: string | null
          ferias?: number | null
          holerite_url?: string | null
          horas_voo?: string | null
          id?: string
          obs?: string | null
          updated_at?: string | null
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
          valor_total: number | null
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
          valor_total?: number | null
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
          valor_total?: number | null
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
          created_at: string | null
          data_aprovacao_1: string | null
          data_necessaria: string | null
          data_solicitacao: string | null
          descricao: string
          id: string
          motivo_rejeicao_1: string | null
          numero_solicitacao: string
          observacoes: string | null
          priority: string | null
          solicitante_nome: string | null
          status: string
          tipo: string
          "tipo_ de_servico": string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          aprovador_1_id?: string | null
          created_at?: string | null
          data_aprovacao_1?: string | null
          data_necessaria?: string | null
          data_solicitacao?: string | null
          descricao: string
          id?: string
          motivo_rejeicao_1?: string | null
          numero_solicitacao: string
          observacoes?: string | null
          priority?: string | null
          solicitante_nome?: string | null
          status?: string
          tipo: string
          "tipo_ de_servico"?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          aprovador_1_id?: string | null
          created_at?: string | null
          data_aprovacao_1?: string | null
          data_necessaria?: string | null
          data_solicitacao?: string | null
          descricao?: string
          id?: string
          motivo_rejeicao_1?: string | null
          numero_solicitacao?: string
          observacoes?: string | null
          priority?: string | null
          solicitante_nome?: string | null
          status?: string
          tipo?: string
          "tipo_ de_servico"?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      recados: {
        Row: {
          autor_id: string
          created_at: string | null
          departamento: string | null
          fixado: boolean | null
          id: string
          lido_por: string[] | null
          mensagem: string
          updated_at: string | null
        }
        Insert: {
          autor_id: string
          created_at?: string | null
          departamento?: string | null
          fixado?: boolean | null
          id?: string
          lido_por?: string[] | null
          mensagem: string
          updated_at?: string | null
        }
        Update: {
          autor_id?: string
          created_at?: string | null
          departamento?: string | null
          fixado?: boolean | null
          id?: string
          lido_por?: string[] | null
          mensagem?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      receipt_descriptions: {
        Row: {
          created_at: string | null
          description: string
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      receipt_history: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string | null
          id: string
          issue_date: string
          month: number
          pdf_path: string
          receipt_number: string
          receipt_type: string
          user_id: string
          year: number
        }
        Insert: {
          amount: number
          client_id?: string | null
          created_at?: string | null
          id?: string
          issue_date: string
          month: number
          pdf_path: string
          receipt_number: string
          receipt_type: string
          user_id: string
          year: number
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string | null
          id?: string
          issue_date?: string
          month?: number
          pdf_path?: string
          receipt_number?: string
          receipt_type?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "receipt_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_number_sequences: {
        Row: {
          created_at: string | null
          id: string
          next_number: number
          updated_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          next_number?: number
          updated_at?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          id?: string
          next_number?: number
          updated_at?: string | null
          year?: number
        }
        Relationships: []
      }
      receipts: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string | null
          doc_number: string | null
          id: string
          issue_date: string
          max_payment_date: string | null
          payer_address: string | null
          payer_city: string | null
          payer_document: string | null
          payer_name: string
          payer_uf: string | null
          payment_method: string | null
          pdf_url: string | null
          receipt_number: string
          receipt_type: string | null
          service_description: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          client_id?: string | null
          created_at?: string | null
          doc_number?: string | null
          id?: string
          issue_date: string
          max_payment_date?: string | null
          payer_address?: string | null
          payer_city?: string | null
          payer_document?: string | null
          payer_name: string
          payer_uf?: string | null
          payment_method?: string | null
          pdf_url?: string | null
          receipt_number: string
          receipt_type?: string | null
          service_description: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string | null
          doc_number?: string | null
          id?: string
          issue_date?: string
          max_payment_date?: string | null
          payer_address?: string | null
          payer_city?: string | null
          payer_document?: string | null
          payer_name?: string
          payer_uf?: string | null
          payment_method?: string | null
          pdf_url?: string | null
          receipt_number?: string
          receipt_type?: string | null
          service_description?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
      senhas: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          login: string
          observacoes: string | null
          senha: string
          site: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          login: string
          observacoes?: string | null
          senha: string
          site: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          login?: string
          observacoes?: string | null
          senha?: string
          site?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      service_orders: {
        Row: {
          aircraft_id: string | null
          created_at: string | null
          description: string | null
          id: string
          order_number: string
          period: string | null
          service_type: string
          status: string
          supplier: string | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          aircraft_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          order_number: string
          period?: string | null
          service_type: string
          status?: string
          supplier?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          aircraft_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          order_number?: string
          period?: string | null
          service_type?: string
          status?: string
          supplier?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
        ]
      }
      task_notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          read: boolean | null
          status_changed_to: string | null
          task_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          read?: boolean | null
          status_changed_to?: string | null
          task_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          read?: boolean | null
          status_changed_to?: string | null
          task_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
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
      tasks: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          absence_approved: boolean | null
          absence_approved_at: string | null
          absence_approved_by: string | null
          absence_rejection_reason: string | null
          clock_in: string | null
          clock_out: string | null
          created_at: string | null
          entry_date: string
          id: string
          lunch_end: string | null
          lunch_start: string | null
          status: string
          total_hours: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          absence_approved?: boolean | null
          absence_approved_at?: string | null
          absence_approved_by?: string | null
          absence_rejection_reason?: string | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string | null
          entry_date?: string
          id?: string
          lunch_end?: string | null
          lunch_start?: string | null
          status?: string
          total_hours?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          absence_approved?: boolean | null
          absence_approved_at?: string | null
          absence_approved_by?: string | null
          absence_rejection_reason?: string | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string | null
          entry_date?: string
          id?: string
          lunch_end?: string | null
          lunch_start?: string | null
          status?: string
          total_hours?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      time_entry_attachments: {
        Row: {
          created_at: string | null
          entry_date: string
          file_name: string
          file_path: string
          file_type: string | null
          id: string
          justification_type: string
          notes: string | null
          time_entry_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          entry_date: string
          file_name: string
          file_path: string
          file_type?: string | null
          id?: string
          justification_type?: string
          notes?: string | null
          time_entry_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          entry_date?: string
          file_name?: string
          file_path?: string
          file_type?: string | null
          id?: string
          justification_type?: string
          notes?: string | null
          time_entry_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entry_attachments_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_expense_reports: {
        Row: {
          aircraft_id: string | null
          aircraft_registration: string | null
          client: string | null
          client_id: string | null
          created_at: string | null
          crew_member_id: string | null
          crew_member_name: string | null
          crew_member_name_2: string | null
          days_count: number
          end_date: string
          expenses: string | null
          id: string
          observations: string | null
          pdf_url: string | null
          report_number: string
          route: string | null
          start_date: string
          status: string | null
          total_amount: number | null
          total_client: number | null
          total_crew: number | null
          total_food: number | null
          total_fuel: number | null
          total_lodging: number | null
          total_other: number | null
          total_sharebrasil: number | null
          total_transport: number | null
          updated_at: string | null
        }
        Insert: {
          aircraft_id?: string | null
          aircraft_registration?: string | null
          client?: string | null
          client_id?: string | null
          created_at?: string | null
          crew_member_id?: string | null
          crew_member_name?: string | null
          crew_member_name_2?: string | null
          days_count: number
          end_date: string
          expenses?: string | null
          id?: string
          observations?: string | null
          pdf_url?: string | null
          report_number: string
          route?: string | null
          start_date: string
          status?: string | null
          total_amount?: number | null
          total_client?: number | null
          total_crew?: number | null
          total_food?: number | null
          total_fuel?: number | null
          total_lodging?: number | null
          total_other?: number | null
          total_sharebrasil?: number | null
          total_transport?: number | null
          updated_at?: string | null
        }
        Update: {
          aircraft_id?: string | null
          aircraft_registration?: string | null
          client?: string | null
          client_id?: string | null
          created_at?: string | null
          crew_member_id?: string | null
          crew_member_name?: string | null
          crew_member_name_2?: string | null
          days_count?: number
          end_date?: string
          expenses?: string | null
          id?: string
          observations?: string | null
          pdf_url?: string | null
          report_number?: string
          route?: string | null
          start_date?: string
          status?: string | null
          total_amount?: number | null
          total_client?: number | null
          total_crew?: number | null
          total_food?: number | null
          total_fuel?: number | null
          total_lodging?: number | null
          total_other?: number | null
          total_sharebrasil?: number | null
          total_transport?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "travel_expense_reports_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_expense_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_expense_reports_crew_member_id_fkey"
            columns: ["crew_member_id"]
            isOneToOne: false
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
        ]
      }
      user_documents: {
        Row: {
          category: string | null
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          uploaded_by: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type: string
          id?: string
          uploaded_by?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
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
          cpf: string | null
          created_at: string | null
          display_name: string | null
          email: string
          employment_status: string | null
          full_name: string
          id: string
          phone: string | null
          rg: string | null
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
          cpf?: string | null
          created_at?: string | null
          display_name?: string | null
          email: string
          employment_status?: string | null
          full_name: string
          id: string
          phone?: string | null
          rg?: string | null
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
          cpf?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string
          employment_status?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          rg?: string | null
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
          created_at: string
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
          created_at?: string
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
          created_at?: string
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
      view_logbook_entries: {
        Row: {
          ac_time: string | null
          aircraft_id: string | null
          arrival_aerodrome: string | null
          celula: number | null
          client_id: string | null
          computed_total_time: number | null
          confirmed: boolean | null
          confirmed_at: string | null
          confirmed_by: string | null
          cor_time: string | null
          created_at: string | null
          daily_rate: number | null
          day_time: number | null
          dep_time: string | null
          departure_aerodrome: string | null
          entry_date: string | null
          extras: string | null
          fuel_added: number | null
          fuel_liters: number | null
          id: string | null
          ifr_time: number | null
          logbook_month_id: string | null
          night_hours: number | null
          pic_canac: string | null
          pou_time: string | null
          pousos: number | null
          sic_canac: string | null
          time: number | null
          total_time: number | null
        }
        Insert: {
          ac_time?: string | null
          aircraft_id?: string | null
          arrival_aerodrome?: string | null
          celula?: number | null
          client_id?: string | null
          computed_total_time?: never
          confirmed?: boolean | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          cor_time?: string | null
          created_at?: string | null
          daily_rate?: number | null
          day_time?: number | null
          dep_time?: string | null
          departure_aerodrome?: string | null
          entry_date?: string | null
          extras?: string | null
          fuel_added?: number | null
          fuel_liters?: number | null
          id?: string | null
          ifr_time?: number | null
          logbook_month_id?: string | null
          night_hours?: number | null
          pic_canac?: string | null
          pou_time?: string | null
          pousos?: number | null
          sic_canac?: string | null
          time?: number | null
          total_time?: number | null
        }
        Update: {
          ac_time?: string | null
          aircraft_id?: string | null
          arrival_aerodrome?: string | null
          celula?: number | null
          client_id?: string | null
          computed_total_time?: never
          confirmed?: boolean | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          cor_time?: string | null
          created_at?: string | null
          daily_rate?: number | null
          day_time?: number | null
          dep_time?: string | null
          departure_aerodrome?: string | null
          entry_date?: string | null
          extras?: string | null
          fuel_added?: number | null
          fuel_liters?: number | null
          id?: string | null
          ifr_time?: number | null
          logbook_month_id?: string | null
          night_hours?: number | null
          pic_canac?: string | null
          pou_time?: string | null
          pousos?: number | null
          sic_canac?: string | null
          time?: number | null
          total_time?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "logbook_entries_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logbook_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logbook_entries_pic_canac_fkey"
            columns: ["pic_canac"]
            isOneToOne: false
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logbook_entries_sic_canac_fkey"
            columns: ["sic_canac"]
            isOneToOne: false
            referencedRelation: "crew_members"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_contas_apagar_com_fluxo: {
        Row: {
          arquivo_pdf_url: string | null
          categoria: string | null
          conta_banco: string | null
          criado_em: string | null
          data_recebimento: string | null
          data_vencimento: string | null
          descricao: string | null
          fluxo_criado_em: string | null
          fluxo_id: string | null
          fornecedor_cnpj: string | null
          fornecedor_nome: string | null
          id: string | null
          metodo_pagamento: string | null
          numero: string | null
          observacoes: string | null
          status_conta_apagar: string | null
          status_fluxo: string | null
          valor: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_total_hours: {
        Args: {
          p_clock_in: string
          p_clock_out: string
          p_lunch_end: string
          p_lunch_start: string
        }
        Returns: number
      }
      earth: { Args: never; Returns: number }
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
      gerar_numero_os: {
        Args: { p_aeronave_id: string; p_data: string }
        Returns: string
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
      is_user_active: { Args: { _user_id: string }; Returns: boolean }
      next_receipt_number:
        | { Args: never; Returns: number }
        | { Args: { p_year: number }; Returns: string }
      send_report_to_ctm: { Args: { report_id: string }; Returns: undefined }
      update_controle_bancario_banco: {
        Args: { p_conta_apagar_id: string; p_conta_banco: string }
        Returns: {
          message: string
          success: boolean
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
      cma_classe: "primeira_classe" | "segunda_classe"
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
      cma_classe: ["primeira_classe", "segunda_classe"],
      contact_type: ["Colaboradores", "Fornecedores", "Hoteis", "Cliente"],
    },
  },
} as const
