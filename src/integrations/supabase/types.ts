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
          boleto_url: string | null
          client_id: string | null
          comanda: string | null
          comanda_url: string | null
          created_at: string | null
          data: string
          id: string
          litros: number
          local: string
          nota_url: string | null
          observacao: string | null
          partner_index: number | null
          partner_name: string | null
          status_pagamento: string | null
          trecho: string
          updated_at: string | null
          valor_total: number | null
          valor_unitario: number
        }
        Insert: {
          abastecedor?: string | null
          abastecimento_galoes?: number | null
          aeronave_id?: string | null
          boleto_url?: string | null
          client_id?: string | null
          comanda?: string | null
          comanda_url?: string | null
          created_at?: string | null
          data: string
          id?: string
          litros?: number
          local: string
          nota_url?: string | null
          observacao?: string | null
          partner_index?: number | null
          partner_name?: string | null
          status_pagamento?: string | null
          trecho: string
          updated_at?: string | null
          valor_total?: number | null
          valor_unitario?: number
        }
        Update: {
          abastecedor?: string | null
          abastecimento_galoes?: number | null
          aeronave_id?: string | null
          boleto_url?: string | null
          client_id?: string | null
          comanda?: string | null
          comanda_url?: string | null
          created_at?: string | null
          data?: string
          id?: string
          litros?: number
          local?: string
          nota_url?: string | null
          observacao?: string | null
          partner_index?: number | null
          partner_name?: string | null
          status_pagamento?: string | null
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
            foreignKeyName: "abastecimentos_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abastecimentos_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "abastecimentos_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
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
            foreignKeyName: "abastecimentos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abastecimentos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "abastecimentos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "abastecimentos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_simples"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "abastecimentos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "abastecimentos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "abastecimentos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "abastecimentos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      absence_justifications: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          document_url: string | null
          entry_date: string
          id: string
          justification: string
          rejection_reason: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          document_url?: string | null
          entry_date: string
          id?: string
          justification: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          document_url?: string | null
          entry_date?: string
          id?: string
          justification?: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          celula_prox_revisao: number | null
          created_at: string | null
          fuel_consumption: number | null
          horimeter_active: number | null
          horimeter_end: number | null
          horimeter_start: number | null
          hourly_price: string | null
          id: string
          image_url: string | null
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
          celula_prox_revisao?: number | null
          created_at?: string | null
          fuel_consumption?: number | null
          horimeter_active?: number | null
          horimeter_end?: number | null
          horimeter_start?: number | null
          hourly_price?: string | null
          id?: string
          image_url?: string | null
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
          celula_prox_revisao?: number | null
          created_at?: string | null
          fuel_consumption?: number | null
          horimeter_active?: number | null
          horimeter_end?: number | null
          horimeter_start?: number | null
          hourly_price?: string | null
          id?: string
          image_url?: string | null
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
          {
            foreignKeyName: "aircraft_hourly_rates_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_hourly_rates_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_hourly_rates_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_hourly_rates_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_hourly_rates_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
      }
      aircraft_live_status: {
        Row: {
          aircraft_id: string
          current_flight_id: string | null
          current_location: string | null
          current_status: string
          expected_arrival: string | null
          id: string
          last_departure: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          aircraft_id: string
          current_flight_id?: string | null
          current_location?: string | null
          current_status?: string
          expected_arrival?: string | null
          id?: string
          last_departure?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          aircraft_id?: string
          current_flight_id?: string | null
          current_location?: string | null
          current_status?: string
          expected_arrival?: string | null
          id?: string
          last_departure?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aircraft_live_status_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: true
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_live_status_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: true
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_live_status_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: true
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_live_status_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: true
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_live_status_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: true
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_live_status_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: true
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_live_status_current_flight_id_fkey"
            columns: ["current_flight_id"]
            isOneToOne: false
            referencedRelation: "flight_booking_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_live_status_current_flight_id_fkey"
            columns: ["current_flight_id"]
            isOneToOne: false
            referencedRelation: "pending_booking_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      aircraft_loans: {
        Row: {
          borrower_aircraft_id: string | null
          borrower_client_id: string
          created_at: string | null
          entry_date: string
          hours_borrowed: number
          hours_paid_back: number | null
          id: string
          lender_aircraft_id: string
          lender_client_id: string
          logbook_entry_id: string | null
          notes: string | null
          payback_entry_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          borrower_aircraft_id?: string | null
          borrower_client_id: string
          created_at?: string | null
          entry_date: string
          hours_borrowed: number
          hours_paid_back?: number | null
          id?: string
          lender_aircraft_id: string
          lender_client_id: string
          logbook_entry_id?: string | null
          notes?: string | null
          payback_entry_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          borrower_aircraft_id?: string | null
          borrower_client_id?: string
          created_at?: string | null
          entry_date?: string
          hours_borrowed?: number
          hours_paid_back?: number | null
          id?: string
          lender_aircraft_id?: string
          lender_client_id?: string
          logbook_entry_id?: string | null
          notes?: string | null
          payback_entry_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aircraft_loans_borrower_aircraft_id_fkey"
            columns: ["borrower_aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_loans_borrower_aircraft_id_fkey"
            columns: ["borrower_aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_loans_borrower_aircraft_id_fkey"
            columns: ["borrower_aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_loans_borrower_aircraft_id_fkey"
            columns: ["borrower_aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_loans_borrower_aircraft_id_fkey"
            columns: ["borrower_aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_loans_borrower_aircraft_id_fkey"
            columns: ["borrower_aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_loans_borrower_client_id_fkey"
            columns: ["borrower_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_loans_borrower_client_id_fkey"
            columns: ["borrower_client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "aircraft_loans_borrower_client_id_fkey"
            columns: ["borrower_client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "aircraft_loans_borrower_client_id_fkey"
            columns: ["borrower_client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_simples"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "aircraft_loans_borrower_client_id_fkey"
            columns: ["borrower_client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "aircraft_loans_borrower_client_id_fkey"
            columns: ["borrower_client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "aircraft_loans_borrower_client_id_fkey"
            columns: ["borrower_client_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "aircraft_loans_borrower_client_id_fkey"
            columns: ["borrower_client_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "aircraft_loans_lender_aircraft_id_fkey"
            columns: ["lender_aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_loans_lender_aircraft_id_fkey"
            columns: ["lender_aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_loans_lender_aircraft_id_fkey"
            columns: ["lender_aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_loans_lender_aircraft_id_fkey"
            columns: ["lender_aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_loans_lender_aircraft_id_fkey"
            columns: ["lender_aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_loans_lender_aircraft_id_fkey"
            columns: ["lender_aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_loans_lender_client_id_fkey"
            columns: ["lender_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_loans_lender_client_id_fkey"
            columns: ["lender_client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "aircraft_loans_lender_client_id_fkey"
            columns: ["lender_client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "aircraft_loans_lender_client_id_fkey"
            columns: ["lender_client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_simples"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "aircraft_loans_lender_client_id_fkey"
            columns: ["lender_client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "aircraft_loans_lender_client_id_fkey"
            columns: ["lender_client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "aircraft_loans_lender_client_id_fkey"
            columns: ["lender_client_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "aircraft_loans_lender_client_id_fkey"
            columns: ["lender_client_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "aircraft_loans_logbook_entry_id_fkey"
            columns: ["logbook_entry_id"]
            isOneToOne: false
            referencedRelation: "crew_flight_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_loans_logbook_entry_id_fkey"
            columns: ["logbook_entry_id"]
            isOneToOne: false
            referencedRelation: "logbook_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_loans_payback_entry_id_fkey"
            columns: ["payback_entry_id"]
            isOneToOne: false
            referencedRelation: "crew_flight_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_loans_payback_entry_id_fkey"
            columns: ["payback_entry_id"]
            isOneToOne: false
            referencedRelation: "logbook_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      aircraft_maintenance_config: {
        Row: {
          aircraft_id: string
          alert_green_threshold: number
          alert_orange_threshold: number
          alert_red_threshold: number
          alert_yellow_threshold: number
          created_at: string | null
          id: string
          interval_hours: number
          is_active: boolean | null
          maintenance_type: string
          updated_at: string | null
        }
        Insert: {
          aircraft_id: string
          alert_green_threshold?: number
          alert_orange_threshold?: number
          alert_red_threshold?: number
          alert_yellow_threshold?: number
          created_at?: string | null
          id?: string
          interval_hours?: number
          is_active?: boolean | null
          maintenance_type: string
          updated_at?: string | null
        }
        Update: {
          aircraft_id?: string
          alert_green_threshold?: number
          alert_orange_threshold?: number
          alert_red_threshold?: number
          alert_yellow_threshold?: number
          created_at?: string | null
          id?: string
          interval_hours?: number
          is_active?: boolean | null
          maintenance_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aircraft_maintenance_config_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_maintenance_config_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_maintenance_config_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_maintenance_config_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_maintenance_config_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_maintenance_config_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
      }
      aircraft_maintenance_records: {
        Row: {
          aircraft_id: string
          cost: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          maintenance_center: string | null
          maintenance_type: string
          mechanic_name: string | null
          next_due_hours: number
          observations: string | null
          performed_at_hours: number
          performed_date: string
          service_order_number: string | null
          updated_at: string | null
        }
        Insert: {
          aircraft_id: string
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          maintenance_center?: string | null
          maintenance_type: string
          mechanic_name?: string | null
          next_due_hours: number
          observations?: string | null
          performed_at_hours: number
          performed_date?: string
          service_order_number?: string | null
          updated_at?: string | null
        }
        Update: {
          aircraft_id?: string
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          maintenance_center?: string | null
          maintenance_type?: string
          mechanic_name?: string | null
          next_due_hours?: number
          observations?: string | null
          performed_at_hours?: number
          performed_date?: string
          service_order_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aircraft_maintenance_records_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_maintenance_records_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_maintenance_records_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_maintenance_records_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_maintenance_records_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_maintenance_records_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
      }
      aircraft_partners: {
        Row: {
          aircraft_id: string
          balance_hours: number | null
          created_at: string | null
          id: string
          partner_id: string
          quota_hours: number | null
          updated_at: string | null
        }
        Insert: {
          aircraft_id: string
          balance_hours?: number | null
          created_at?: string | null
          id?: string
          partner_id: string
          quota_hours?: number | null
          updated_at?: string | null
        }
        Update: {
          aircraft_id?: string
          balance_hours?: number | null
          created_at?: string | null
          id?: string
          partner_id?: string
          quota_hours?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aircraft_partners_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_partners_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_partners_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_partners_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_partners_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_partners_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_partners_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_partners_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "aircraft_partners_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "aircraft_partners_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_simples"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "aircraft_partners_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "aircraft_partners_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "aircraft_partners_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "aircraft_partners_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      aircraft_shareholders: {
        Row: {
          aircraft_id: string
          client_id: string
          created_at: string | null
          id: string
          quota_hours: number
        }
        Insert: {
          aircraft_id: string
          client_id: string
          created_at?: string | null
          id?: string
          quota_hours: number
        }
        Update: {
          aircraft_id?: string
          client_id?: string
          created_at?: string | null
          id?: string
          quota_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "aircraft_shareholders_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_shareholders_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_shareholders_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_shareholders_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_shareholders_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_shareholders_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "aircraft_shareholders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_shareholders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "aircraft_shareholders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "aircraft_shareholders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_simples"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "aircraft_shareholders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "aircraft_shareholders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "aircraft_shareholders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "aircraft_shareholders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      bank_reconciliations: {
        Row: {
          afeta_caixa_empresa: boolean | null
          aircraft_id: string | null
          amount: number
          boleto_url: string | null
          categoria_movimentacao_id: string | null
          category: string | null
          client_id: string | null
          comprovante_url: string | null
          controle_bancario_id: string | null
          created_at: string | null
          created_by: string
          data_reembolso: string | null
          date: string
          description: string
          doc: string | null
          forma_pagamento: string | null
          fornecedor_dados: Json | null
          fornecedor_nome: string | null
          id: string
          nf_url: string | null
          payment_term: string | null
          percentual: string | null
          receiver_id: string | null
          reference_id: string | null
          reference_type: string | null
          saldo_pendente: number | null
          status: string
          tipo_documento: string | null
          type: string
          updated_at: string | null
          valor_reembolsado: number | null
        }
        Insert: {
          afeta_caixa_empresa?: boolean | null
          aircraft_id?: string | null
          amount: number
          boleto_url?: string | null
          categoria_movimentacao_id?: string | null
          category?: string | null
          client_id?: string | null
          comprovante_url?: string | null
          controle_bancario_id?: string | null
          created_at?: string | null
          created_by: string
          data_reembolso?: string | null
          date: string
          description: string
          doc?: string | null
          forma_pagamento?: string | null
          fornecedor_dados?: Json | null
          fornecedor_nome?: string | null
          id?: string
          nf_url?: string | null
          payment_term?: string | null
          percentual?: string | null
          receiver_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          saldo_pendente?: number | null
          status: string
          tipo_documento?: string | null
          type: string
          updated_at?: string | null
          valor_reembolsado?: number | null
        }
        Update: {
          afeta_caixa_empresa?: boolean | null
          aircraft_id?: string | null
          amount?: number
          boleto_url?: string | null
          categoria_movimentacao_id?: string | null
          category?: string | null
          client_id?: string | null
          comprovante_url?: string | null
          controle_bancario_id?: string | null
          created_at?: string | null
          created_by?: string
          data_reembolso?: string | null
          date?: string
          description?: string
          doc?: string | null
          forma_pagamento?: string | null
          fornecedor_dados?: Json | null
          fornecedor_nome?: string | null
          id?: string
          nf_url?: string | null
          payment_term?: string | null
          percentual?: string | null
          receiver_id?: string | null
          reference_id?: string | null
          reference_type?: string | null
          saldo_pendente?: number | null
          status?: string
          tipo_documento?: string | null
          type?: string
          updated_at?: string | null
          valor_reembolsado?: number | null
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
            foreignKeyName: "bank_reconciliations_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "bank_reconciliations_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "bank_reconciliations_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "bank_reconciliations_aircraft_id_fkey"
            columns: ["aircraft_id"]
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
            foreignKeyName: "bank_reconciliations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "bank_reconciliations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "bank_reconciliations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_simples"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "bank_reconciliations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "bank_reconciliations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "bank_reconciliations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "bank_reconciliations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "bank_reconciliations_controle_bancario_id_fkey"
            columns: ["controle_bancario_id"]
            isOneToOne: false
            referencedRelation: "controle_bancario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_controle_bancario_id_fkey"
            columns: ["controle_bancario_id"]
            isOneToOne: false
            referencedRelation: "v_folha_pagamento_completa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_controle_bancario_id_fkey"
            columns: ["controle_bancario_id"]
            isOneToOne: false
            referencedRelation: "vw_financeiro_caixa"
            referencedColumns: ["lancamento_caixa_id"]
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
      blocked_flight_dates: {
        Row: {
          aircraft_id: string | null
          block_date: string
          blocked_by: string | null
          created_at: string | null
          id: string
          is_fleet_wide: boolean | null
          reason: string | null
        }
        Insert: {
          aircraft_id?: string | null
          block_date: string
          blocked_by?: string | null
          created_at?: string | null
          id?: string
          is_fleet_wide?: boolean | null
          reason?: string | null
        }
        Update: {
          aircraft_id?: string | null
          block_date?: string
          blocked_by?: string | null
          created_at?: string | null
          id?: string
          is_fleet_wide?: boolean | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocked_flight_dates_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_flight_dates_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_flight_dates_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "blocked_flight_dates_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "blocked_flight_dates_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "blocked_flight_dates_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
      }
      categorias_movimentacao: {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          categoria_pai_id: string | null
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
          categoria_pai_id?: string | null
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
          categoria_pai_id?: string | null
          criado_em?: string | null
          criado_por?: string
          descricao?: string | null
          grupo_categoria?: string | null
          id?: string
          nome?: string
          reembolsavel?: boolean | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_movimentacao_categoria_pai_id_fkey"
            columns: ["categoria_pai_id"]
            isOneToOne: false
            referencedRelation: "categorias_movimentacao"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "client_aircraft_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_aircraft_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "client_aircraft_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "client_aircraft_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "client_aircraft_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "client_aircraft_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_aircraft_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "client_aircraft_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "client_aircraft_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_simples"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "client_aircraft_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "client_aircraft_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "client_aircraft_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "client_aircraft_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_cliente_completo"
            referencedColumns: ["cliente_id"]
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
          {
            foreignKeyName: "client_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "client_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "client_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_simples"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "client_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "client_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "client_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "client_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      client_portal_auth: {
        Row: {
          client_id: string
          created_at: string | null
          email: string
          id: string
          is_active: boolean | null
          last_login: string | null
          password_hash: string
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          last_login?: string | null
          password_hash: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          last_login?: string | null
          password_hash?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_auth_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_auth_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "client_portal_auth_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "client_portal_auth_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_simples"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "client_portal_auth_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "client_portal_auth_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "client_portal_auth_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "client_portal_auth_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_cliente_completo"
            referencedColumns: ["cliente_id"]
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
            foreignKeyName: "client_portal_files_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_files_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "client_portal_files_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "client_portal_files_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "client_portal_files_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "client_portal_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_portal_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "client_portal_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "client_portal_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_simples"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "client_portal_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "client_portal_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "client_portal_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "client_portal_files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          aircraft: string | null
          city: string | null
          cnpj: string | null
          company_name: string | null
          created_at: string | null
          documents: Json | null
          email: string | null
          financial_contact: string | null
          id: string
          inscricao_estadual: string | null
          logo_url: string | null
          observations: string | null
          partner_cpf: string | null
          partner_cpf2: string | null
          partner_cpf3: string | null
          partner_name: string | null
          partner_name2: string | null
          partner_name3: string | null
          partner_percentage1: number | null
          partner_percentage2: number | null
          partner_percentage3: number | null
          phone: string | null
          proprietario: string | null
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
          company_name?: string | null
          created_at?: string | null
          documents?: Json | null
          email?: string | null
          financial_contact?: string | null
          id?: string
          inscricao_estadual?: string | null
          logo_url?: string | null
          observations?: string | null
          partner_cpf?: string | null
          partner_cpf2?: string | null
          partner_cpf3?: string | null
          partner_name?: string | null
          partner_name2?: string | null
          partner_name3?: string | null
          partner_percentage1?: number | null
          partner_percentage2?: number | null
          partner_percentage3?: number | null
          phone?: string | null
          proprietario?: string | null
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
          company_name?: string | null
          created_at?: string | null
          documents?: Json | null
          email?: string | null
          financial_contact?: string | null
          id?: string
          inscricao_estadual?: string | null
          logo_url?: string | null
          observations?: string | null
          partner_cpf?: string | null
          partner_cpf2?: string | null
          partner_cpf3?: string | null
          partner_name?: string | null
          partner_name2?: string | null
          partner_name3?: string | null
          partner_percentage1?: number | null
          partner_percentage2?: number | null
          partner_percentage3?: number | null
          phone?: string | null
          proprietario?: string | null
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
          {
            foreignKeyName: "clients_aircraft_fkey"
            columns: ["aircraft"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_aircraft_fkey"
            columns: ["aircraft"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "clients_aircraft_fkey"
            columns: ["aircraft"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "clients_aircraft_fkey"
            columns: ["aircraft"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "clients_aircraft_fkey"
            columns: ["aircraft"]
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
      components: {
        Row: {
          aircraft_id: string
          created_at: string | null
          current_life_cycles: number | null
          current_life_hours: number | null
          id: string
          installed_cycles: number | null
          installed_date: string
          installed_hours: number | null
          location: string | null
          manufacturer: string | null
          name: string
          observations: string | null
          part_number: string
          serial_number: string
          status: string | null
          total_life_cycles: number | null
          total_life_hours: number | null
          updated_at: string | null
        }
        Insert: {
          aircraft_id: string
          created_at?: string | null
          current_life_cycles?: number | null
          current_life_hours?: number | null
          id?: string
          installed_cycles?: number | null
          installed_date: string
          installed_hours?: number | null
          location?: string | null
          manufacturer?: string | null
          name: string
          observations?: string | null
          part_number: string
          serial_number: string
          status?: string | null
          total_life_cycles?: number | null
          total_life_hours?: number | null
          updated_at?: string | null
        }
        Update: {
          aircraft_id?: string
          created_at?: string | null
          current_life_cycles?: number | null
          current_life_hours?: number | null
          id?: string
          installed_cycles?: number | null
          installed_date?: string
          installed_hours?: number | null
          location?: string | null
          manufacturer?: string | null
          name?: string
          observations?: string | null
          part_number?: string
          serial_number?: string
          status?: string | null
          total_life_cycles?: number | null
          total_life_hours?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "components_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "components_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "components_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "components_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "components_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "components_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
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
            referencedRelation: "active_flight_cycles"
            referencedColumns: ["registration"]
          },
          {
            foreignKeyName: "contas_apagar_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["registration"]
          },
          {
            foreignKeyName: "contas_apagar_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["registration"]
          },
          {
            foreignKeyName: "contas_apagar_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "crew_flight_history"
            referencedColumns: ["aircraft_registration"]
          },
          {
            foreignKeyName: "contas_apagar_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "pending_booking_requests"
            referencedColumns: ["aircraft_registration"]
          },
          {
            foreignKeyName: "contas_apagar_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_registro"]
          },
          {
            foreignKeyName: "contas_apagar_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_registro"]
          },
          {
            foreignKeyName: "contas_apagar_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "vw_categorias_aeronave"
            referencedColumns: ["aeronave_registro"]
          },
          {
            foreignKeyName: "contas_apagar_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "vw_dashboard_clientes"
            referencedColumns: ["aeronave"]
          },
          {
            foreignKeyName: "contas_apagar_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave"]
          },
          {
            foreignKeyName: "contas_apagar_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_registro"]
          },
          {
            foreignKeyName: "contas_apagar_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "vw_extrato_cliente"
            referencedColumns: ["aeronave_registro"]
          },
          {
            foreignKeyName: "contas_apagar_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "vw_financeiro_caixa"
            referencedColumns: ["aeronave"]
          },
          {
            foreignKeyName: "contas_apagar_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["aeronave"]
          },
        ]
      }
      contas_areceber: {
        Row: {
          aeronave: string
          arquivo_pdf_url: string | null
          atualizado_em: string | null
          banco_recebimento: string | null
          boleto_url: string | null
          categoria: string
          cliente_cnpj: string
          cliente_nome: string
          comprovante_recebimento_url: string | null
          criado_em: string | null
          criado_por: string | null
          data_criacao: string
          data_recebimento: string | null
          data_vencimento: string
          descricao: string | null
          fornecedor_id: string | null
          fornecedor_tipo: string | null
          id: string
          nota_fiscal_url: string | null
          numero: string
          status: string
          valor: number
        }
        Insert: {
          aeronave: string
          arquivo_pdf_url?: string | null
          atualizado_em?: string | null
          banco_recebimento?: string | null
          boleto_url?: string | null
          categoria: string
          cliente_cnpj: string
          cliente_nome: string
          comprovante_recebimento_url?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_criacao: string
          data_recebimento?: string | null
          data_vencimento: string
          descricao?: string | null
          fornecedor_id?: string | null
          fornecedor_tipo?: string | null
          id?: string
          nota_fiscal_url?: string | null
          numero: string
          status: string
          valor: number
        }
        Update: {
          aeronave?: string
          arquivo_pdf_url?: string | null
          atualizado_em?: string | null
          banco_recebimento?: string | null
          boleto_url?: string | null
          categoria?: string
          cliente_cnpj?: string
          cliente_nome?: string
          comprovante_recebimento_url?: string | null
          criado_em?: string | null
          criado_por?: string | null
          data_criacao?: string
          data_recebimento?: string | null
          data_vencimento?: string
          descricao?: string | null
          fornecedor_id?: string | null
          fornecedor_tipo?: string | null
          id?: string
          nota_fiscal_url?: string | null
          numero?: string
          status?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "contas_areceber_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "active_flight_cycles"
            referencedColumns: ["registration"]
          },
          {
            foreignKeyName: "contas_areceber_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["registration"]
          },
          {
            foreignKeyName: "contas_areceber_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["registration"]
          },
          {
            foreignKeyName: "contas_areceber_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "crew_flight_history"
            referencedColumns: ["aircraft_registration"]
          },
          {
            foreignKeyName: "contas_areceber_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "pending_booking_requests"
            referencedColumns: ["aircraft_registration"]
          },
          {
            foreignKeyName: "contas_areceber_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_registro"]
          },
          {
            foreignKeyName: "contas_areceber_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_registro"]
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
            referencedRelation: "vw_dashboard_clientes"
            referencedColumns: ["aeronave"]
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
            referencedRelation: "vw_extrato_cliente"
            referencedColumns: ["aeronave_registro"]
          },
          {
            foreignKeyName: "contas_areceber_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "vw_financeiro_caixa"
            referencedColumns: ["aeronave"]
          },
          {
            foreignKeyName: "contas_areceber_aeronave_fkey"
            columns: ["aeronave"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["aeronave"]
          },
          {
            foreignKeyName: "contas_areceber_fornecedor_favorito_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores_favoritos"
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
          empresa_id: string
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
          empresa_id: string
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
          empresa_id?: string
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
          aeronave_id: string | null
          aeronave_registro: string | null
          atualizado_por: string | null
          boleto_url: string | null
          categoria_id: string
          client_id: string | null
          client_name: string | null
          colaborador_id: string | null
          comprovante_url: string | null
          conta_banco: string | null
          criado_por: string
          data: string
          data_atualizacao: string | null
          data_criacao: string | null
          data_reembolso: string | null
          data_vencimento: string | null
          descricao: string
          despesa_original_id: string | null
          fornecedores_favoritos_id: string | null
          grupo_categoria: string | null
          id: string
          lancamento_reembolso_id: string | null
          nf_url: string | null
          numero_documento: string | null
          observacao_cliente: string | null
          observacoes: string | null
          rateio_completo: boolean | null
          rateio_tipo: string | null
          recibo_url: string | null
          reembolsavel: boolean | null
          reembolso_recebido: boolean | null
          status: string | null
          tags: string[] | null
          tem_rateio: boolean | null
          tipo_movimento: string
          travel_report_id: string | null
          valor: number
        }
        Insert: {
          aeronave_id?: string | null
          aeronave_registro?: string | null
          atualizado_por?: string | null
          boleto_url?: string | null
          categoria_id: string
          client_id?: string | null
          client_name?: string | null
          colaborador_id?: string | null
          comprovante_url?: string | null
          conta_banco?: string | null
          criado_por: string
          data: string
          data_atualizacao?: string | null
          data_criacao?: string | null
          data_reembolso?: string | null
          data_vencimento?: string | null
          descricao: string
          despesa_original_id?: string | null
          fornecedores_favoritos_id?: string | null
          grupo_categoria?: string | null
          id?: string
          lancamento_reembolso_id?: string | null
          nf_url?: string | null
          numero_documento?: string | null
          observacao_cliente?: string | null
          observacoes?: string | null
          rateio_completo?: boolean | null
          rateio_tipo?: string | null
          recibo_url?: string | null
          reembolsavel?: boolean | null
          reembolso_recebido?: boolean | null
          status?: string | null
          tags?: string[] | null
          tem_rateio?: boolean | null
          tipo_movimento: string
          travel_report_id?: string | null
          valor: number
        }
        Update: {
          aeronave_id?: string | null
          aeronave_registro?: string | null
          atualizado_por?: string | null
          boleto_url?: string | null
          categoria_id?: string
          client_id?: string | null
          client_name?: string | null
          colaborador_id?: string | null
          comprovante_url?: string | null
          conta_banco?: string | null
          criado_por?: string
          data?: string
          data_atualizacao?: string | null
          data_criacao?: string | null
          data_reembolso?: string | null
          data_vencimento?: string | null
          descricao?: string
          despesa_original_id?: string | null
          fornecedores_favoritos_id?: string | null
          grupo_categoria?: string | null
          id?: string
          lancamento_reembolso_id?: string | null
          nf_url?: string | null
          numero_documento?: string | null
          observacao_cliente?: string | null
          observacoes?: string | null
          rateio_completo?: boolean | null
          rateio_tipo?: string | null
          recibo_url?: string | null
          reembolsavel?: boolean | null
          reembolso_recebido?: boolean | null
          status?: string | null
          tags?: string[] | null
          tem_rateio?: boolean | null
          tipo_movimento?: string
          travel_report_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "controle_bancario_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controle_bancario_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controle_bancario_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "controle_bancario_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "controle_bancario_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "controle_bancario_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "controle_bancario_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_movimentacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controle_bancario_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controle_bancario_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "controle_bancario_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "controle_bancario_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_simples"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "controle_bancario_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "controle_bancario_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "controle_bancario_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "controle_bancario_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "controle_bancario_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controle_bancario_despesa_original_id_fkey"
            columns: ["despesa_original_id"]
            isOneToOne: false
            referencedRelation: "controle_bancario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controle_bancario_despesa_original_id_fkey"
            columns: ["despesa_original_id"]
            isOneToOne: false
            referencedRelation: "v_folha_pagamento_completa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controle_bancario_despesa_original_id_fkey"
            columns: ["despesa_original_id"]
            isOneToOne: false
            referencedRelation: "vw_financeiro_caixa"
            referencedColumns: ["lancamento_caixa_id"]
          },
          {
            foreignKeyName: "controle_bancario_fornecedor_id_fkey"
            columns: ["fornecedores_favoritos_id"]
            isOneToOne: false
            referencedRelation: "fornecedores_favoritos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controle_bancario_lancamento_reembolso_id_fkey"
            columns: ["lancamento_reembolso_id"]
            isOneToOne: false
            referencedRelation: "controle_bancario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controle_bancario_lancamento_reembolso_id_fkey"
            columns: ["lancamento_reembolso_id"]
            isOneToOne: false
            referencedRelation: "v_folha_pagamento_completa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controle_bancario_lancamento_reembolso_id_fkey"
            columns: ["lancamento_reembolso_id"]
            isOneToOne: false
            referencedRelation: "vw_financeiro_caixa"
            referencedColumns: ["lancamento_caixa_id"]
          },
          {
            foreignKeyName: "controle_bancario_travel_report_id_fkey"
            columns: ["travel_report_id"]
            isOneToOne: false
            referencedRelation: "travel_expense_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controle_bancario_travel_report_id_fkey"
            columns: ["travel_report_id"]
            isOneToOne: false
            referencedRelation: "vw_viagens_a_receber"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_flight_hours: {
        Row: {
          aircraft_id: string
          created_at: string | null
          crew_member_id: string
          flight_day: string
          id: string
          ifr_hours: number | null
          month: number
          not_hours: number | null
          total_hours: number | null
          updated_at: string | null
          year: number
        }
        Insert: {
          aircraft_id: string
          created_at?: string | null
          crew_member_id: string
          flight_day: string
          id?: string
          ifr_hours?: number | null
          month: number
          not_hours?: number | null
          total_hours?: number | null
          updated_at?: string | null
          year: number
        }
        Update: {
          aircraft_id?: string
          created_at?: string | null
          crew_member_id?: string
          flight_day?: string
          id?: string
          ifr_hours?: number | null
          month?: number
          not_hours?: number | null
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
          {
            foreignKeyName: "crew_flight_hours_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_flight_hours_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "crew_flight_hours_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "crew_flight_hours_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "crew_flight_hours_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "crew_flight_hours_crew_member_id_fkey"
            columns: ["crew_member_id"]
            isOneToOne: false
            referencedRelation: "crew_members"
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
          admission_date: string | null
          avatar_url: string | null
          birth_date: string | null
          canac: string
          cpf: string | null
          created_at: string | null
          full_name: string
          id: string
          phone: string | null
          rg: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          admission_date?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          canac: string
          cpf?: string | null
          created_at?: string | null
          full_name: string
          id?: string
          phone?: string | null
          rg?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          admission_date?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          canac?: string
          cpf?: string | null
          created_at?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          rg?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ctm_budgets: {
        Row: {
          aircraft_id: string
          budget_file_name: string | null
          budget_file_path: string | null
          created_at: string | null
          created_by: string | null
          id: string
          month: number
          oas_file_name: string | null
          oas_file_path: string | null
          report_file_name: string | null
          report_file_path: string | null
          status: string | null
          updated_at: string | null
          year: number
        }
        Insert: {
          aircraft_id: string
          budget_file_name?: string | null
          budget_file_path?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          month: number
          oas_file_name?: string | null
          oas_file_path?: string | null
          report_file_name?: string | null
          report_file_path?: string | null
          status?: string | null
          updated_at?: string | null
          year: number
        }
        Update: {
          aircraft_id?: string
          budget_file_name?: string | null
          budget_file_path?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          month?: number
          oas_file_name?: string | null
          oas_file_path?: string | null
          report_file_name?: string | null
          report_file_path?: string | null
          status?: string | null
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "ctm_budgets_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctm_budgets_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctm_budgets_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "ctm_budgets_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "ctm_budgets_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "ctm_budgets_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
      }
      ctm_cost_sharing: {
        Row: {
          client_id: string
          comprovante_url: string | null
          created_at: string | null
          data_pagamento: string | null
          horas_voadas: number | null
          id: string
          percentual: number | null
          service_order_id: string
          status_pagamento: string | null
          updated_at: string | null
          valor: number | null
        }
        Insert: {
          client_id: string
          comprovante_url?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          horas_voadas?: number | null
          id?: string
          percentual?: number | null
          service_order_id: string
          status_pagamento?: string | null
          updated_at?: string | null
          valor?: number | null
        }
        Update: {
          client_id?: string
          comprovante_url?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          horas_voadas?: number | null
          id?: string
          percentual?: number | null
          service_order_id?: string
          status_pagamento?: string | null
          updated_at?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ctm_cost_sharing_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctm_cost_sharing_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "ctm_cost_sharing_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "ctm_cost_sharing_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_simples"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "ctm_cost_sharing_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "ctm_cost_sharing_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "ctm_cost_sharing_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "ctm_cost_sharing_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "ctm_cost_sharing_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "ctm_service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      ctm_flight_report_details: {
        Row: {
          client_id: string
          created_at: string | null
          flight_report_id: string
          horas_voadas: number | null
          id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          flight_report_id: string
          horas_voadas?: number | null
          id?: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          flight_report_id?: string
          horas_voadas?: number | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ctm_flight_report_details_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctm_flight_report_details_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "ctm_flight_report_details_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "ctm_flight_report_details_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_simples"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "ctm_flight_report_details_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "ctm_flight_report_details_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "ctm_flight_report_details_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "ctm_flight_report_details_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "ctm_flight_report_details_flight_report_id_fkey"
            columns: ["flight_report_id"]
            isOneToOne: false
            referencedRelation: "ctm_flight_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      ctm_flight_reports: {
        Row: {
          ano: number
          created_at: string | null
          horas_oficina: number | null
          id: string
          mes: string
          service_order_id: string
        }
        Insert: {
          ano: number
          created_at?: string | null
          horas_oficina?: number | null
          id?: string
          mes: string
          service_order_id: string
        }
        Update: {
          ano?: number
          created_at?: string | null
          horas_oficina?: number | null
          id?: string
          mes?: string
          service_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ctm_flight_reports_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "ctm_service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      ctm_maintenance_categories: {
        Row: {
          ativo: boolean | null
          cor: string | null
          created_at: string | null
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
          created_at?: string | null
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
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          intervalo_horas?: number | null
          intervalo_meses?: number | null
          nome?: string
        }
        Relationships: []
      }
      ctm_parts: {
        Row: {
          created_at: string | null
          data_compra: string | null
          descricao: string
          fornecedor: string | null
          garantia_meses: number | null
          id: string
          nota_fiscal: string | null
          observacoes: string | null
          part_number: string | null
          quantidade: number | null
          serial_number: string | null
          service_order_id: string
          valor_total: number | null
          valor_unitario: number | null
        }
        Insert: {
          created_at?: string | null
          data_compra?: string | null
          descricao: string
          fornecedor?: string | null
          garantia_meses?: number | null
          id?: string
          nota_fiscal?: string | null
          observacoes?: string | null
          part_number?: string | null
          quantidade?: number | null
          serial_number?: string | null
          service_order_id: string
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Update: {
          created_at?: string | null
          data_compra?: string | null
          descricao?: string
          fornecedor?: string | null
          garantia_meses?: number | null
          id?: string
          nota_fiscal?: string | null
          observacoes?: string | null
          part_number?: string | null
          quantidade?: number | null
          serial_number?: string | null
          service_order_id?: string
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ctm_parts_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "ctm_service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      ctm_service_orders: {
        Row: {
          aircraft_id: string
          created_at: string | null
          created_by: string | null
          data_entrada: string | null
          data_saida: string | null
          dias_efetivos: number | null
          dias_previstos: number | null
          horas_celula: number | null
          id: string
          numero: string
          objetivo: string | null
          observacoes: string | null
          oficina_contato: string | null
          oficina_nome: string | null
          os_oficina: string | null
          periodo: string | null
          status: string | null
          tipo_manutencao: string
          tipo_rateio: string | null
          total_geral: number | null
          total_mao_obra: number | null
          total_pecas: number | null
          updated_at: string | null
          vencimento_id: string | null
        }
        Insert: {
          aircraft_id: string
          created_at?: string | null
          created_by?: string | null
          data_entrada?: string | null
          data_saida?: string | null
          dias_efetivos?: number | null
          dias_previstos?: number | null
          horas_celula?: number | null
          id?: string
          numero: string
          objetivo?: string | null
          observacoes?: string | null
          oficina_contato?: string | null
          oficina_nome?: string | null
          os_oficina?: string | null
          periodo?: string | null
          status?: string | null
          tipo_manutencao?: string
          tipo_rateio?: string | null
          total_geral?: number | null
          total_mao_obra?: number | null
          total_pecas?: number | null
          updated_at?: string | null
          vencimento_id?: string | null
        }
        Update: {
          aircraft_id?: string
          created_at?: string | null
          created_by?: string | null
          data_entrada?: string | null
          data_saida?: string | null
          dias_efetivos?: number | null
          dias_previstos?: number | null
          horas_celula?: number | null
          id?: string
          numero?: string
          objetivo?: string | null
          observacoes?: string | null
          oficina_contato?: string | null
          oficina_nome?: string | null
          os_oficina?: string | null
          periodo?: string | null
          status?: string | null
          tipo_manutencao?: string
          tipo_rateio?: string | null
          total_geral?: number | null
          total_mao_obra?: number | null
          total_pecas?: number | null
          updated_at?: string | null
          vencimento_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ctm_service_orders_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctm_service_orders_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctm_service_orders_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "ctm_service_orders_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "ctm_service_orders_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "ctm_service_orders_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
      }
      ctm_services: {
        Row: {
          categoria: string | null
          created_at: string | null
          data_execucao: string | null
          descricao: string
          fornecedor: string | null
          id: string
          nota_fiscal: string | null
          observacoes: string | null
          periodo: string | null
          service_order_id: string
          valor: number | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          data_execucao?: string | null
          descricao: string
          fornecedor?: string | null
          id?: string
          nota_fiscal?: string | null
          observacoes?: string | null
          periodo?: string | null
          service_order_id: string
          valor?: number | null
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          data_execucao?: string | null
          descricao?: string
          fornecedor?: string | null
          id?: string
          nota_fiscal?: string | null
          observacoes?: string | null
          periodo?: string | null
          service_order_id?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ctm_services_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "ctm_service_orders"
            referencedColumns: ["id"]
          },
        ]
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
          orçamento: string | null
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
          orçamento?: string | null
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
          orçamento?: string | null
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
            foreignKeyName: "ctm_tracking_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctm_tracking_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "ctm_tracking_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "ctm_tracking_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "ctm_tracking_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "ctm_tracking_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ctm_tracking_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "ctm_tracking_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "ctm_tracking_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_simples"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "ctm_tracking_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "ctm_tracking_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "ctm_tracking_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "ctm_tracking_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_cliente_completo"
            referencedColumns: ["cliente_id"]
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
          aeronave_id: string | null
          aeronave_registro: string | null
          atualizado_em: string | null
          boleto_url: string | null
          categoria_id: string | null
          categoria_nome: string
          client_id: string
          client_name: string
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
          nota_fiscal_url: string | null
          observacoes_pagamento: string | null
          observacoes_validacao: string | null
          outros_documentos: Json | null
          quantidade_lembretes: number | null
          status: string
          validado_por: string | null
          valor: number
          valor_pago: number | null
        }
        Insert: {
          aeronave_id?: string | null
          aeronave_registro?: string | null
          atualizado_em?: string | null
          boleto_url?: string | null
          categoria_id?: string | null
          categoria_nome: string
          client_id: string
          client_name: string
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
          nota_fiscal_url?: string | null
          observacoes_pagamento?: string | null
          observacoes_validacao?: string | null
          outros_documentos?: Json | null
          quantidade_lembretes?: number | null
          status?: string
          validado_por?: string | null
          valor: number
          valor_pago?: number | null
        }
        Update: {
          aeronave_id?: string | null
          aeronave_registro?: string | null
          atualizado_em?: string | null
          boleto_url?: string | null
          categoria_id?: string | null
          categoria_nome?: string
          client_id?: string
          client_name?: string
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
          nota_fiscal_url?: string | null
          observacoes_pagamento?: string | null
          observacoes_validacao?: string | null
          outros_documentos?: Json | null
          quantidade_lembretes?: number | null
          status?: string
          validado_por?: string | null
          valor?: number
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "despesas_cliente_direto_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_cliente_direto_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_cliente_direto_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "despesas_cliente_direto_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
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
            foreignKeyName: "despesas_cliente_direto_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_movimentacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_cliente_direto_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_cliente_direto_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "despesas_cliente_direto_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "despesas_cliente_direto_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_simples"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "despesas_cliente_direto_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "despesas_cliente_direto_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "despesas_cliente_direto_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "despesas_cliente_direto_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "despesas_cliente_direto_controle_bancario_id_fkey"
            columns: ["controle_bancario_id"]
            isOneToOne: false
            referencedRelation: "controle_bancario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_cliente_direto_controle_bancario_id_fkey"
            columns: ["controle_bancario_id"]
            isOneToOne: false
            referencedRelation: "v_folha_pagamento_completa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_cliente_direto_controle_bancario_id_fkey"
            columns: ["controle_bancario_id"]
            isOneToOne: false
            referencedRelation: "vw_financeiro_caixa"
            referencedColumns: ["lancamento_caixa_id"]
          },
        ]
      }
      directives: {
        Row: {
          aircraft_id: string
          applicability: string | null
          compliance_date: string | null
          compliance_hours: number | null
          compliance_method: string | null
          created_at: string | null
          description: string | null
          due_cycles: number | null
          due_date: string | null
          due_hours: number | null
          id: string
          number: string
          observations: string | null
          responsible: string | null
          status: string | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          aircraft_id: string
          applicability?: string | null
          compliance_date?: string | null
          compliance_hours?: number | null
          compliance_method?: string | null
          created_at?: string | null
          description?: string | null
          due_cycles?: number | null
          due_date?: string | null
          due_hours?: number | null
          id?: string
          number: string
          observations?: string | null
          responsible?: string | null
          status?: string | null
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          aircraft_id?: string
          applicability?: string | null
          compliance_date?: string | null
          compliance_hours?: number | null
          compliance_method?: string | null
          created_at?: string | null
          description?: string | null
          due_cycles?: number | null
          due_date?: string | null
          due_hours?: number | null
          id?: string
          number?: string
          observations?: string | null
          responsible?: string | null
          status?: string | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "directives_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directives_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directives_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "directives_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "directives_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "directives_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
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
      expense_config: {
        Row: {
          expense_type: string
          id: string
        }
        Insert: {
          expense_type: string
          id?: string
        }
        Update: {
          expense_type?: string
          id?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "expense_items_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "vw_viagens_a_receber"
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
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "expenses_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
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
            referencedRelation: "ras"
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
      flight_booking_requests: {
        Row: {
          aircraft_id: string
          approved_at: string | null
          approved_by: string | null
          client_id: string
          created_at: string | null
          departure_time: string
          destination: string
          duration_days: number
          id: string
          notes: string | null
          origin: string
          passenger_count: number
          rejection_reason: string | null
          scheduled_date: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          aircraft_id: string
          approved_at?: string | null
          approved_by?: string | null
          client_id: string
          created_at?: string | null
          departure_time: string
          destination: string
          duration_days?: number
          id?: string
          notes?: string | null
          origin: string
          passenger_count?: number
          rejection_reason?: string | null
          scheduled_date: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          aircraft_id?: string
          approved_at?: string | null
          approved_by?: string | null
          client_id?: string
          created_at?: string | null
          departure_time?: string
          destination?: string
          duration_days?: number
          id?: string
          notes?: string | null
          origin?: string
          passenger_count?: number
          rejection_reason?: string | null
          scheduled_date?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flight_booking_requests_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_booking_requests_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_booking_requests_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "flight_booking_requests_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "flight_booking_requests_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "flight_booking_requests_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
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
      flight_cycles: {
        Row: {
          aircraft_id: string | null
          client_id: string | null
          completed_at: string | null
          created_at: string
          destination_icao: string
          finalized_at: string | null
          flight_date: string
          flight_duration_hours: number | null
          flight_type: string
          has_overnight: boolean | null
          has_private_hangar: boolean | null
          id: string
          is_controlled_airport: boolean | null
          observations: string | null
          origin_icao: string
          responsible_user_id: string | null
          return_date: string | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          aircraft_id?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          destination_icao: string
          finalized_at?: string | null
          flight_date: string
          flight_duration_hours?: number | null
          flight_type: string
          has_overnight?: boolean | null
          has_private_hangar?: boolean | null
          id?: string
          is_controlled_airport?: boolean | null
          observations?: string | null
          origin_icao: string
          responsible_user_id?: string | null
          return_date?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          aircraft_id?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          destination_icao?: string
          finalized_at?: string | null
          flight_date?: string
          flight_duration_hours?: number | null
          flight_type?: string
          has_overnight?: boolean | null
          has_private_hangar?: boolean | null
          id?: string
          is_controlled_airport?: boolean | null
          observations?: string | null
          origin_icao?: string
          responsible_user_id?: string | null
          return_date?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_cycles_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_cycles_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_cycles_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "flight_cycles_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
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
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_cycles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "flight_cycles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "flight_cycles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_simples"
            referencedColumns: ["cliente_id"]
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
            referencedRelation: "vw_extrato_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "flight_cycles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "flight_cycles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      flight_documents: {
        Row: {
          aircraft_id: string | null
          alert_days: number | null
          created_at: string | null
          description: string | null
          document_type: string | null
          expiry_date: string | null
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          name: string
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          aircraft_id?: string | null
          alert_days?: number | null
          created_at?: string | null
          description?: string | null
          document_type?: string | null
          expiry_date?: string | null
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          name: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          aircraft_id?: string | null
          alert_days?: number | null
          created_at?: string | null
          description?: string | null
          document_type?: string | null
          expiry_date?: string | null
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flight_documents_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_documents_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_documents_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "flight_documents_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "flight_documents_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "flight_documents_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
      }
      flight_expenses: {
        Row: {
          amount: number | null
          attachment_url: string | null
          created_at: string
          deadline_days: number | null
          expected_date: string | null
          expense_category: string
          expense_name: string
          expense_type: string
          flight_cycle_id: string
          id: string
          observations: string | null
          payment_date: string | null
          received_date: string | null
          sent_to_client_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          attachment_url?: string | null
          created_at?: string
          deadline_days?: number | null
          expected_date?: string | null
          expense_category: string
          expense_name: string
          expense_type: string
          flight_cycle_id: string
          id?: string
          observations?: string | null
          payment_date?: string | null
          received_date?: string | null
          sent_to_client_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          attachment_url?: string | null
          created_at?: string
          deadline_days?: number | null
          expected_date?: string | null
          expense_category?: string
          expense_name?: string
          expense_type?: string
          flight_cycle_id?: string
          id?: string
          observations?: string | null
          payment_date?: string | null
          received_date?: string | null
          sent_to_client_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_expenses_flight_cycle_id_fkey"
            columns: ["flight_cycle_id"]
            isOneToOne: false
            referencedRelation: "active_flight_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_expenses_flight_cycle_id_fkey"
            columns: ["flight_cycle_id"]
            isOneToOne: false
            referencedRelation: "flight_cycles"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "flight_plans_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_plans_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "flight_plans_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "flight_plans_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "flight_plans_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
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
            foreignKeyName: "flight_schedules_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_schedules_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "flight_schedules_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "flight_schedules_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "flight_schedules_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "flight_schedules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_schedules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "flight_schedules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "flight_schedules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_simples"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "flight_schedules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "flight_schedules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "flight_schedules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "flight_schedules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      fornecedores_favoritos: {
        Row: {
          apelido: string | null
          atualizado_em: string
          categoria: string | null
          cidade: string | null
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
          criado_em?: string
          criado_por?: string
          documento?: string | null
          id?: string
          nome_completo?: string
          telefone?: string | null
        }
        Relationships: []
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
      horas_mensais_consolidadas: {
        Row: {
          aeronave_id: string
          aeronave_registro: string
          ano: number
          atualizado_em: string | null
          cliente_id: string
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
          cliente_id: string
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
          cliente_id?: string
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
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_transactions_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_transactions_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "hour_transactions_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
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
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_transactions_from_partner_id_fkey"
            columns: ["from_partner_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "hour_transactions_from_partner_id_fkey"
            columns: ["from_partner_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "hour_transactions_from_partner_id_fkey"
            columns: ["from_partner_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_simples"
            referencedColumns: ["cliente_id"]
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
            referencedRelation: "vw_extrato_cliente"
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
            foreignKeyName: "hour_transactions_from_partner_id_fkey"
            columns: ["from_partner_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "hour_transactions_to_partner_id_fkey"
            columns: ["to_partner_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_transactions_to_partner_id_fkey"
            columns: ["to_partner_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "hour_transactions_to_partner_id_fkey"
            columns: ["to_partner_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "hour_transactions_to_partner_id_fkey"
            columns: ["to_partner_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_simples"
            referencedColumns: ["cliente_id"]
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
            referencedRelation: "vw_extrato_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "hour_transactions_to_partner_id_fkey"
            columns: ["to_partner_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "hour_transactions_to_partner_id_fkey"
            columns: ["to_partner_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
        ]
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
          flight_nature: string
          fuel_added: number | null
          fuel_consu: number | null
          fuel_liters: number | null
          fuel_location: string | null
          fuel_price_per_liter: number | null
          fuel_type: string | null
          id: string
          ifr_time: number | null
          is_closed: boolean | null
          is_equal_split: boolean | null
          is_loan: boolean | null
          last_maintenance_type: string | null
          logbook_month_id: string
          maintenance_approval_responsible: string | null
          next_maintenance_type: string | null
          night_hours: number | null
          occurrences: string | null
          partner_name: string | null
          passengers: number | null
          pic_canac: string
          pilot_signature_date: string | null
          pou_time: string | null
          pousos: number | null
          refueled: boolean | null
          sequential_number: number | null
          sic_canac: string | null
          sic_name: string | null
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
          flight_nature: string
          fuel_added?: number | null
          fuel_consu?: number | null
          fuel_liters?: number | null
          fuel_location?: string | null
          fuel_price_per_liter?: number | null
          fuel_type?: string | null
          id?: string
          ifr_time?: number | null
          is_closed?: boolean | null
          is_equal_split?: boolean | null
          is_loan?: boolean | null
          last_maintenance_type?: string | null
          logbook_month_id: string
          maintenance_approval_responsible?: string | null
          next_maintenance_type?: string | null
          night_hours?: number | null
          occurrences?: string | null
          partner_name?: string | null
          passengers?: number | null
          pic_canac: string
          pilot_signature_date?: string | null
          pou_time?: string | null
          pousos?: number | null
          refueled?: boolean | null
          sequential_number?: number | null
          sic_canac?: string | null
          sic_name?: string | null
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
          flight_nature?: string
          fuel_added?: number | null
          fuel_consu?: number | null
          fuel_liters?: number | null
          fuel_location?: string | null
          fuel_price_per_liter?: number | null
          fuel_type?: string | null
          id?: string
          ifr_time?: number | null
          is_closed?: boolean | null
          is_equal_split?: boolean | null
          is_loan?: boolean | null
          last_maintenance_type?: string | null
          logbook_month_id?: string
          maintenance_approval_responsible?: string | null
          next_maintenance_type?: string | null
          night_hours?: number | null
          occurrences?: string | null
          partner_name?: string | null
          passengers?: number | null
          pic_canac?: string
          pilot_signature_date?: string | null
          pou_time?: string | null
          pousos?: number | null
          refueled?: boolean | null
          sequential_number?: number | null
          sic_canac?: string | null
          sic_name?: string | null
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
            foreignKeyName: "logbook_entries_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logbook_entries_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "logbook_entries_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "logbook_entries_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "logbook_entries_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "logbook_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logbook_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "logbook_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "logbook_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_simples"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "logbook_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "logbook_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "logbook_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "logbook_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_cliente_completo"
            referencedColumns: ["cliente_id"]
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
          has_daily_rate: boolean | null
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
          has_daily_rate?: boolean | null
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
          has_daily_rate?: boolean | null
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
          {
            foreignKeyName: "logbook_months_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logbook_months_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "logbook_months_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "logbook_months_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "logbook_months_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
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
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_items_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_items_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "maintenance_items_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
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
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_notifications_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_notifications_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "maintenance_notifications_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
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
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_reports_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_reports_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "maintenance_reports_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
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
      manutencoes: {
        Row: {
          aeronave_id: string | null
          created_at: string | null
          custo_estimado: number | null
          data_programada: string
          etapa: string
          horas_realizadas: number | null
          id: string
          mecanico: string
          numero_os: string | null
          observacoes: string | null
          oficina: string | null
          tipo: string
          updated_at: string | null
          vencimento_horas: number | null
          vencimento_tipo: string | null
        }
        Insert: {
          aeronave_id?: string | null
          created_at?: string | null
          custo_estimado?: number | null
          data_programada: string
          etapa?: string
          horas_realizadas?: number | null
          id?: string
          mecanico: string
          numero_os?: string | null
          observacoes?: string | null
          oficina?: string | null
          tipo: string
          updated_at?: string | null
          vencimento_horas?: number | null
          vencimento_tipo?: string | null
        }
        Update: {
          aeronave_id?: string | null
          created_at?: string | null
          custo_estimado?: number | null
          data_programada?: string
          etapa?: string
          horas_realizadas?: number | null
          id?: string
          mecanico?: string
          numero_os?: string | null
          observacoes?: string | null
          oficina?: string | null
          tipo?: string
          updated_at?: string | null
          vencimento_horas?: number | null
          vencimento_tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manutencoes_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manutencoes_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manutencoes_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "manutencoes_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "manutencoes_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "manutencoes_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
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
          {
            foreignKeyName: "monthly_diary_closures_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_diary_closures_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "monthly_diary_closures_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
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
      oil_analysis: {
        Row: {
          aircraft_id: string
          al: number
          created_at: string | null
          cu: number
          date: string
          fe: number
          id: string
          si: number
          updated_at: string | null
          viscosity: number
        }
        Insert: {
          aircraft_id: string
          al: number
          created_at?: string | null
          cu: number
          date: string
          fe: number
          id?: string
          si: number
          updated_at?: string | null
          viscosity: number
        }
        Update: {
          aircraft_id?: string
          al?: number
          created_at?: string | null
          cu?: number
          date?: string
          fe?: number
          id?: string
          si?: number
          updated_at?: string | null
          viscosity?: number
        }
        Relationships: [
          {
            foreignKeyName: "oil_analysis_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oil_analysis_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oil_analysis_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "oil_analysis_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "oil_analysis_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "oil_analysis_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
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
          updated_at: string | null
          user_profile: string | null
        }
        Insert: {
          banco?: string | null
          base_salary_holerite?: number | null
          benefit?: string | null
          comprovante_url?: string | null
          created_at?: string | null
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
          updated_at?: string | null
          user_profile?: string | null
        }
        Update: {
          banco?: string | null
          base_salary_holerite?: number | null
          benefit?: string | null
          comprovante_url?: string | null
          created_at?: string | null
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
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_hours_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pilot_hours_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "pilot_hours_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
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
          {
            foreignKeyName: "pilot_hours_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
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
            foreignKeyName: "prestador_notas_fiscais_controle_bancario_id_fkey"
            columns: ["controle_bancario_id"]
            isOneToOne: false
            referencedRelation: "controle_bancario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prestador_notas_fiscais_controle_bancario_id_fkey"
            columns: ["controle_bancario_id"]
            isOneToOne: false
            referencedRelation: "v_folha_pagamento_completa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prestador_notas_fiscais_controle_bancario_id_fkey"
            columns: ["controle_bancario_id"]
            isOneToOne: false
            referencedRelation: "vw_financeiro_caixa"
            referencedColumns: ["lancamento_caixa_id"]
          },
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
      ras: {
        Row: {
          aircraft_id: string
          cell_hours_entry: number | null
          cell_hours_exit: number | null
          created_at: string | null
          description: string | null
          effective_days: number | null
          entry_date: string
          exit_date: string | null
          grand_total: number | null
          id: string
          labor_total: number | null
          maintenance_center: string
          maintenance_type: string
          number: string
          objective: string | null
          os_number: string | null
          parts_total: number | null
          period: string | null
          planned_days: number | null
          responsible: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          aircraft_id: string
          cell_hours_entry?: number | null
          cell_hours_exit?: number | null
          created_at?: string | null
          description?: string | null
          effective_days?: number | null
          entry_date: string
          exit_date?: string | null
          grand_total?: number | null
          id?: string
          labor_total?: number | null
          maintenance_center: string
          maintenance_type: string
          number: string
          objective?: string | null
          os_number?: string | null
          parts_total?: number | null
          period?: string | null
          planned_days?: number | null
          responsible?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          aircraft_id?: string
          cell_hours_entry?: number | null
          cell_hours_exit?: number | null
          created_at?: string | null
          description?: string | null
          effective_days?: number | null
          entry_date?: string
          exit_date?: string | null
          grand_total?: number | null
          id?: string
          labor_total?: number | null
          maintenance_center?: string
          maintenance_type?: string
          number?: string
          objective?: string | null
          os_number?: string | null
          parts_total?: number | null
          period?: string | null
          planned_days?: number | null
          responsible?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ras_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ras_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ras_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "ras_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "ras_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "ras_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
      }
      ras_items: {
        Row: {
          created_at: string | null
          description: string
          id: string
          invoice_number: string | null
          item_type: string
          part_number: string | null
          period: string | null
          quantity: number | null
          ras_id: string
          serial_number: string | null
          supplier: string | null
          total_value: number | null
          unit_value: number | null
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          invoice_number?: string | null
          item_type: string
          part_number?: string | null
          period?: string | null
          quantity?: number | null
          ras_id: string
          serial_number?: string | null
          supplier?: string | null
          total_value?: number | null
          unit_value?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          invoice_number?: string | null
          item_type?: string
          part_number?: string | null
          period?: string | null
          quantity?: number | null
          ras_id?: string
          serial_number?: string | null
          supplier?: string | null
          total_value?: number | null
          unit_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ras_items_ras_id_fkey"
            columns: ["ras_id"]
            isOneToOne: false
            referencedRelation: "ras"
            referencedColumns: ["id"]
          },
        ]
      }
      ras_photos: {
        Row: {
          caption: string | null
          id: string
          photo_url: string
          ras_id: string
          uploaded_at: string | null
        }
        Insert: {
          caption?: string | null
          id?: string
          photo_url: string
          ras_id: string
          uploaded_at?: string | null
        }
        Update: {
          caption?: string | null
          id?: string
          photo_url?: string
          ras_id?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ras_photos_ras_id_fkey"
            columns: ["ras_id"]
            isOneToOne: false
            referencedRelation: "ras"
            referencedColumns: ["id"]
          },
        ]
      }
      rateio_despesas: {
        Row: {
          aeronave_id: string | null
          aeronave_registro: string | null
          atualizado_em: string | null
          boleto: string | null
          categoria_id: string | null
          client_id: string | null
          client_name: string
          comprovante_pagamento_direto_url: string | null
          comprovante_url: string | null
          criado_em: string | null
          data_envio: string | null
          data_pagamento: string | null
          data_pagamento_direto: string | null
          data_vencimento: string | null
          despesa_id: string
          forma_pagamento: string | null
          id: string
          nota_fiscal: string | null
          observacoes: string | null
          pago_diretamente: boolean | null
          percentual: number | null
          recebimento_id: string | null
          status: string | null
          valor: number | null
          valor_rateado: number
        }
        Insert: {
          aeronave_id?: string | null
          aeronave_registro?: string | null
          atualizado_em?: string | null
          boleto?: string | null
          categoria_id?: string | null
          client_id?: string | null
          client_name: string
          comprovante_pagamento_direto_url?: string | null
          comprovante_url?: string | null
          criado_em?: string | null
          data_envio?: string | null
          data_pagamento?: string | null
          data_pagamento_direto?: string | null
          data_vencimento?: string | null
          despesa_id: string
          forma_pagamento?: string | null
          id?: string
          nota_fiscal?: string | null
          observacoes?: string | null
          pago_diretamente?: boolean | null
          percentual?: number | null
          recebimento_id?: string | null
          status?: string | null
          valor?: number | null
          valor_rateado: number
        }
        Update: {
          aeronave_id?: string | null
          aeronave_registro?: string | null
          atualizado_em?: string | null
          boleto?: string | null
          categoria_id?: string | null
          client_id?: string | null
          client_name?: string
          comprovante_pagamento_direto_url?: string | null
          comprovante_url?: string | null
          criado_em?: string | null
          data_envio?: string | null
          data_pagamento?: string | null
          data_pagamento_direto?: string | null
          data_vencimento?: string | null
          despesa_id?: string
          forma_pagamento?: string | null
          id?: string
          nota_fiscal?: string | null
          observacoes?: string | null
          pago_diretamente?: boolean | null
          percentual?: number | null
          recebimento_id?: string | null
          status?: string | null
          valor?: number | null
          valor_rateado?: number
        }
        Relationships: [
          {
            foreignKeyName: "rateio_despesas_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateio_despesas_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateio_despesas_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "rateio_despesas_aeronave_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
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
            foreignKeyName: "rateio_despesas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "expense_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateio_despesas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateio_despesas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "rateio_despesas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "rateio_despesas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_simples"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "rateio_despesas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "rateio_despesas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "rateio_despesas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "rateio_despesas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
        ]
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
          {
            foreignKeyName: "receipt_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "receipt_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "receipt_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_simples"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "receipt_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "receipt_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "receipt_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "receipt_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_cliente_completo"
            referencedColumns: ["cliente_id"]
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
          aircraft_id: string | null
          amount: number
          boleto_url: string | null
          category_name: string | null
          client_id: string | null
          created_at: string | null
          doc_number: string | null
          id: string
          is_shared: boolean | null
          issue_date: string
          max_payment_date: string | null
          nf_url: string | null
          payer_address: string | null
          payer_city: string | null
          payer_document: string | null
          payer_name: string
          payer_uf: string | null
          payment_method: string | null
          pdf_url: string | null
          percentage: number | null
          receipt_number: string
          receipt_type: string | null
          service_description: string
          status: string | null
          total_amount: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          aircraft_id?: string | null
          amount: number
          boleto_url?: string | null
          category_name?: string | null
          client_id?: string | null
          created_at?: string | null
          doc_number?: string | null
          id?: string
          is_shared?: boolean | null
          issue_date: string
          max_payment_date?: string | null
          nf_url?: string | null
          payer_address?: string | null
          payer_city?: string | null
          payer_document?: string | null
          payer_name: string
          payer_uf?: string | null
          payment_method?: string | null
          pdf_url?: string | null
          percentage?: number | null
          receipt_number: string
          receipt_type?: string | null
          service_description: string
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          aircraft_id?: string | null
          amount?: number
          boleto_url?: string | null
          category_name?: string | null
          client_id?: string | null
          created_at?: string | null
          doc_number?: string | null
          id?: string
          is_shared?: boolean | null
          issue_date?: string
          max_payment_date?: string | null
          nf_url?: string | null
          payer_address?: string | null
          payer_city?: string | null
          payer_document?: string | null
          payer_name?: string
          payer_uf?: string | null
          payment_method?: string | null
          pdf_url?: string | null
          percentage?: number | null
          receipt_number?: string
          receipt_type?: string | null
          service_description?: string
          status?: string | null
          total_amount?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "receipts_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "receipts_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "receipts_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "receipts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "receipts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "receipts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_simples"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "receipts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "receipts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "receipts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "receipts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_cliente_completo"
            referencedColumns: ["cliente_id"]
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
      scheduling_aircraft_config: {
        Row: {
          aircraft_id: string
          enabled_for_scheduling: boolean
          id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          aircraft_id: string
          enabled_for_scheduling?: boolean
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          aircraft_id?: string
          enabled_for_scheduling?: boolean
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduling_aircraft_config_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: true
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduling_aircraft_config_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: true
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduling_aircraft_config_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: true
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "scheduling_aircraft_config_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: true
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "scheduling_aircraft_config_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: true
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "scheduling_aircraft_config_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: true
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
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
            referencedRelation: "crew_members"
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
      service_items: {
        Row: {
          aircraft_id: string
          created_at: string | null
          description: string
          id: string
          nfse: string | null
          period: string | null
          provider: string
          service_order_id: string
          status: string | null
          updated_at: string | null
          value: number
        }
        Insert: {
          aircraft_id: string
          created_at?: string | null
          description: string
          id?: string
          nfse?: string | null
          period?: string | null
          provider: string
          service_order_id: string
          status?: string | null
          updated_at?: string | null
          value: number
        }
        Update: {
          aircraft_id?: string
          created_at?: string | null
          description?: string
          id?: string
          nfse?: string | null
          period?: string | null
          provider?: string
          service_order_id?: string
          status?: string | null
          updated_at?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_items_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_items_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_items_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "service_items_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "service_items_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "service_items_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "service_items_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "service_orders_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "service_orders_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "service_orders_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "service_orders_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
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
          archived: string | null
          assigned_to: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          is_public: boolean | null
          priority: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          archived?: string | null
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_public?: boolean | null
          priority?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          archived?: string | null
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_public?: boolean | null
          priority?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      time_correction_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          corrected_time: string
          correction_type: string
          created_at: string
          entry_date: string
          id: string
          original_time: string | null
          reason: string
          rejection_reason: string | null
          status: string
          time_entry_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          corrected_time: string
          correction_type: string
          created_at?: string
          entry_date: string
          id?: string
          original_time?: string | null
          reason: string
          rejection_reason?: string | null
          status?: string
          time_entry_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          corrected_time?: string
          correction_type?: string
          created_at?: string
          entry_date?: string
          id?: string
          original_time?: string | null
          reason?: string
          rejection_reason?: string | null
          status?: string
          time_entry_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_correction_requests_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
        ]
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
          total_crew1: number | null
          total_crew2: number | null
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
          total_crew1?: number | null
          total_crew2?: number | null
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
          total_crew1?: number | null
          total_crew2?: number | null
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
            foreignKeyName: "travel_expense_reports_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_expense_reports_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "travel_expense_reports_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "travel_expense_reports_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "travel_expense_reports_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "travel_expense_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_expense_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "travel_expense_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "travel_expense_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_simples"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "travel_expense_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "travel_expense_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "travel_expense_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "travel_expense_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_cliente_completo"
            referencedColumns: ["cliente_id"]
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
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "user_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "user_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_simples"
            referencedColumns: ["cliente_id"]
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
            referencedRelation: "vw_extrato_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "user_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "user_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_cliente_completo"
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
      weight_balance: {
        Row: {
          aircraft_id: string
          braço_cg_padrao: number
          capacidade_combustivel_total: number | null
          capacidade_combustivel_util: number | null
          cg_limite_dianteiro: number
          cg_limite_traseiro: number
          created_at: string | null
          created_by: string | null
          id: string
          lemac_distancia: number
          mac_comprimento: number
          momento_padrao: number
          notas: string | null
          peso_maximo_decolagem: number
          peso_maximo_pouso: number
          peso_maximo_sem_combustivel: number | null
          peso_vazio_padrao: number
          updated_at: string | null
          validado: boolean | null
          validado_em: string | null
          validado_por: string | null
        }
        Insert: {
          aircraft_id: string
          braço_cg_padrao: number
          capacidade_combustivel_total?: number | null
          capacidade_combustivel_util?: number | null
          cg_limite_dianteiro: number
          cg_limite_traseiro: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          lemac_distancia: number
          mac_comprimento: number
          momento_padrao: number
          notas?: string | null
          peso_maximo_decolagem: number
          peso_maximo_pouso: number
          peso_maximo_sem_combustivel?: number | null
          peso_vazio_padrao: number
          updated_at?: string | null
          validado?: boolean | null
          validado_em?: string | null
          validado_por?: string | null
        }
        Update: {
          aircraft_id?: string
          braço_cg_padrao?: number
          capacidade_combustivel_total?: number | null
          capacidade_combustivel_util?: number | null
          cg_limite_dianteiro?: number
          cg_limite_traseiro?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          lemac_distancia?: number
          mac_comprimento?: number
          momento_padrao?: number
          notas?: string | null
          peso_maximo_decolagem?: number
          peso_maximo_pouso?: number
          peso_maximo_sem_combustivel?: number | null
          peso_vazio_padrao?: number
          updated_at?: string | null
          validado?: boolean | null
          validado_em?: string | null
          validado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weight_balance_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: true
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weight_balance_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: true
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weight_balance_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: true
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "weight_balance_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: true
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "weight_balance_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: true
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "weight_balance_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: true
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
      }
      weight_balance_items: {
        Row: {
          braço_posicao: number
          categoria: string | null
          created_at: string | null
          descricao: string
          id: string
          incluir_no_calculo: boolean | null
          momento: number
          observacao: string | null
          peso_sem_combustivel: number
          updated_at: string | null
          weight_balance_id: string
        }
        Insert: {
          braço_posicao: number
          categoria?: string | null
          created_at?: string | null
          descricao: string
          id?: string
          incluir_no_calculo?: boolean | null
          momento: number
          observacao?: string | null
          peso_sem_combustivel: number
          updated_at?: string | null
          weight_balance_id: string
        }
        Update: {
          braço_posicao?: number
          categoria?: string | null
          created_at?: string | null
          descricao?: string
          id?: string
          incluir_no_calculo?: boolean | null
          momento?: number
          observacao?: string | null
          peso_sem_combustivel?: number
          updated_at?: string | null
          weight_balance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weight_balance_items_weight_balance_id_fkey"
            columns: ["weight_balance_id"]
            isOneToOne: false
            referencedRelation: "weight_balance"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_flight_cycles: {
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
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_cycles_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_cycles_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "flight_cycles_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
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
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_cycles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "flight_cycles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "flight_cycles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_simples"
            referencedColumns: ["cliente_id"]
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
            referencedRelation: "vw_extrato_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "flight_cycles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "flight_cycles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      aircraft_availability: {
        Row: {
          blocked_days_count: number | null
          current_location: string | null
          current_status: string | null
          id: string | null
          model: string | null
          registration: string | null
        }
        Relationships: []
      }
      crew_flight_history: {
        Row: {
          aircraft_model: string | null
          aircraft_registration: string | null
          arrival_aerodrome: string | null
          departure_aerodrome: string | null
          entry_date: string | null
          id: string | null
          ifr_time: number | null
          night_hours: number | null
          pic_canac: string | null
          pic_name: string | null
          sic_canac: string | null
          sic_name: string | null
          total_time: number | null
        }
        Relationships: []
      }
      pending_booking_requests: {
        Row: {
          aircraft_id: string | null
          aircraft_model: string | null
          aircraft_registration: string | null
          client_contact: string | null
          client_email: string | null
          client_id: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string | null
          departure_time: string | null
          destination: string | null
          duration_days: number | null
          id: string | null
          notes: string | null
          origin: string | null
          passenger_count: number | null
          scheduled_date: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flight_booking_requests_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_booking_requests_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flight_booking_requests_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "flight_booking_requests_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "flight_booking_requests_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_despesas_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "flight_booking_requests_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["aeronave_id"]
          },
        ]
      }
      v_folha_pagamento_completa: {
        Row: {
          categoria: string | null
          colaborador: string | null
          conta_banco: string | null
          data: string | null
          data_criacao: string | null
          descricao: string | null
          id: string | null
          numero_documento: string | null
          observacoes: string | null
          status: string | null
          valor: number | null
        }
        Relationships: []
      }
      v_partners: {
        Row: {
          client_id: string | null
          cnpj: string | null
          company_name: string | null
          cpf: string | null
          name: string | null
          partner_position: number | null
        }
        Relationships: []
      }
      v_salary_comparison: {
        Row: {
          colaborador: string | null
          mes_ref: string | null
          qtd_lancamentos: number | null
          status_sync: string | null
          total_destino: number | null
          total_geral_origem: number | null
          total_salario_origem: number | null
          user_profile: string | null
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
      v_salary_discrepancies: {
        Row: {
          colaborador: string | null
          mes_ref: string | null
          qtd_lancamentos: number | null
          status_sync: string | null
          total_destino: number | null
          total_geral_origem: number | null
          total_salario_origem: number | null
          user_profile: string | null
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
      vw_balanco_aeronave: {
        Row: {
          aeronave_id: string | null
          aeronave_modelo: string | null
          aeronave_registro: string | null
          despesas_por_categoria: Json | null
          mes_ano: string | null
          mes_referencia: string | null
          total_cliente_pagou_direto: number | null
          total_despesas: number | null
          total_empresa_pagou: number | null
          total_movimentacoes: number | null
          total_pendente_reembolso: number | null
          total_reembolsado: number | null
        }
        Relationships: []
      }
      vw_balanco_aeronave_simples: {
        Row: {
          aeronave_id: string | null
          aeronave_modelo: string | null
          aeronave_registro: string | null
          mes_ano: string | null
          mes_referencia: string | null
          total_cliente_pagou_direto: number | null
          total_despesas: number | null
          total_empresa_pagou: number | null
          total_movimentacoes: number | null
          total_pendente_reembolso: number | null
          total_reembolsado: number | null
        }
        Relationships: []
      }
      vw_balanco_cliente: {
        Row: {
          aeronaves: string | null
          cliente_cnpj: string | null
          cliente_id: string | null
          cliente_nome: string | null
          despesas_por_categoria: Json | null
          mes_ano: string | null
          mes_referencia: string | null
          qtd_aguardando: number | null
          qtd_processado: number | null
          qtd_reembolsado: number | null
          saldo_pendente: number | null
          total_despesas: number | null
          total_movimentacoes: number | null
          valor_cliente_pagou_direto: number | null
          valor_empresa_adiantou: number | null
          valor_reembolsado: number | null
        }
        Relationships: []
      }
      vw_balanco_cliente_completo: {
        Row: {
          aeronaves: string | null
          cliente_cnpj: string | null
          cliente_id: string | null
          cliente_nome: string | null
          despesas_por_categoria: Json | null
          horas_totais_aeronave: number | null
          horas_voadas: number | null
          litros_consumidos: number | null
          mes_ano: string | null
          mes_referencia: string | null
          percentual_uso: number | null
          qtd_abastecimentos: number | null
          qtd_aguardando: number | null
          qtd_processado: number | null
          qtd_reembolsado: number | null
          saldo_pendente: number | null
          socio1_cpf: string | null
          socio1_nome: string | null
          socio1_percentual: number | null
          socio2_cpf: string | null
          socio2_nome: string | null
          socio2_percentual: number | null
          socio3_cpf: string | null
          socio3_nome: string | null
          socio3_percentual: number | null
          total_despesas: number | null
          total_movimentacoes: number | null
          valor_cliente_pagou_direto: number | null
          valor_combustivel: number | null
          valor_empresa_adiantou: number | null
          valor_reembolsado: number | null
        }
        Relationships: []
      }
      vw_balanco_cliente_simples: {
        Row: {
          aeronaves: string | null
          cliente_cnpj: string | null
          cliente_id: string | null
          cliente_nome: string | null
          mes_ano: string | null
          mes_referencia: string | null
          qtd_aguardando: number | null
          qtd_processado: number | null
          qtd_reembolsado: number | null
          saldo_pendente: number | null
          total_despesas: number | null
          total_movimentacoes: number | null
          valor_cliente_pagou_direto: number | null
          valor_empresa_adiantou: number | null
          valor_reembolsado: number | null
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
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "aircraft_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave"
            referencedColumns: ["aeronave_id"]
          },
          {
            foreignKeyName: "bank_reconciliations_aircraft_id_fkey"
            columns: ["aeronave_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_aeronave_simples"
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
            foreignKeyName: "bank_reconciliations_client_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_client_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "bank_reconciliations_client_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "bank_reconciliations_client_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_balanco_cliente_simples"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "bank_reconciliations_client_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_aeronave"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "bank_reconciliations_client_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_extrato_cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "bank_reconciliations_client_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_reembolsos_pendentes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "bank_reconciliations_client_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_resumo_cliente_completo"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      vw_dashboard_clientes: {
        Row: {
          aeronave: string | null
          afeta_caixa_empresa: boolean | null
          amount: number | null
          boleto_url: string | null
          category: string | null
          cliente_nome: string | null
          comprovante_url: string | null
          created_at: string | null
          date: string | null
          description: string | null
          forma_pagamento: string | null
          fornecedor_nome: string | null
          id: string | null
          nf_url: string | null
          requer_acao: boolean | null
          situacao_visual: string | null
          status: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      vw_dashboard_executivo: {
        Row: {
          primeira_movimentacao: string | null
          qtd_aguardando_comprovante: number | null
          qtd_aguardando_reembolso: number | null
          saldo_total_pendente: number | null
          top_categorias: Json | null
          total_aeronaves_ativas: number | null
          total_clientes_ativos: number | null
          total_movimentacoes: number | null
          ultima_movimentacao: string | null
          valor_empresa_adiantou: number | null
          valor_reembolsado: number | null
          valor_total_movimentado: number | null
        }
        Relationships: []
      }
      vw_dashboard_executivo_simples: {
        Row: {
          primeira_movimentacao: string | null
          qtd_aguardando_comprovante: number | null
          qtd_aguardando_reembolso: number | null
          saldo_total_pendente: number | null
          total_aeronaves_ativas: number | null
          total_clientes_ativos: number | null
          total_movimentacoes: number | null
          ultima_movimentacao: string | null
          valor_empresa_adiantou: number | null
          valor_reembolsado: number | null
          valor_total_movimentado: number | null
        }
        Relationships: []
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
      vw_extrato_cliente: {
        Row: {
          aeronave_registro: string | null
          aeronaves: string | null
          afeta_caixa_empresa: boolean | null
          boleto_url: string | null
          categoria: string | null
          cliente_cnpj: string | null
          cliente_id: string | null
          cliente_nome: string | null
          comprovante_url: string | null
          created_at: string | null
          data: string | null
          data_reembolso: string | null
          descricao: string | null
          fornecedor_nome: string | null
          movimentacao_id: string | null
          nf_url: string | null
          saldo_pendente: number | null
          status: string | null
          status_reembolso: string | null
          tipo_pagamento: string | null
          valor: number | null
          valor_pago: number | null
          valor_total: number | null
        }
        Relationships: []
      }
      vw_financeiro_caixa: {
        Row: {
          aeronave: string | null
          amount: number | null
          boleto_url: string | null
          cliente: string | null
          data_pagamento: string | null
          date: string | null
          description: string | null
          forma_pagamento: string | null
          id: string | null
          lancamento_caixa_id: string | null
          nf_url: string | null
          saldo_pendente: number | null
          status: string | null
          valor_pago: number | null
        }
        Relationships: []
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
      vw_resumo_cliente_completo: {
        Row: {
          aeronaves: string | null
          ano: number | null
          cliente_cnpj: string | null
          cliente_id: string | null
          cliente_nome: string | null
          horas_totais_aeronave: number | null
          horas_voadas: number | null
          litros_consumidos: number | null
          mes: number | null
          mes_ano: string | null
          percentual_uso: number | null
          qtd_abastecimentos: number | null
          saldo_pendente: number | null
          socio1_cpf: string | null
          socio1_nome: string | null
          socio1_percentual: number | null
          socio2_cpf: string | null
          socio2_nome: string | null
          socio2_percentual: number | null
          socio3_cpf: string | null
          socio3_nome: string | null
          socio3_percentual: number | null
          total_despesas: number | null
          total_movimentacoes: number | null
          valor_cliente_pagou_direto: number | null
          valor_combustivel: number | null
          valor_empresa_adiantou: number | null
          valor_reembolsado: number | null
        }
        Relationships: []
      }
      vw_salarios_sincronizados: {
        Row: {
          banco: string | null
          base_salary_holerite: number | null
          benefit: string | null
          created_at: string | null
          decimo_terceiro_parcela1: number | null
          decimo_terceiro_parcela2: number | null
          extra: string | null
          ferias: number | null
          funcionario: string | null
          horas_voo: string | null
          pagamento_id: string | null
          total_lancamentos_criados: number | null
          user_profile: string | null
          valor_total_lancado: number | null
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
      vw_top_categorias: {
        Row: {
          categoria: string | null
          quantidade: number | null
          total_valor: number | null
          valor_medio: number | null
        }
        Relationships: []
      }
      vw_viagens_a_receber: {
        Row: {
          aeronave: string | null
          cliente_nome: string | null
          data_fim_viagem: string | null
          id: string | null
          numero: string | null
          pdf_url: string | null
          qtd_itens: number | null
          status: string | null
          valor_cliente: number | null
          valor_total: number | null
        }
        Insert: {
          aeronave?: string | null
          cliente_nome?: string | null
          data_fim_viagem?: string | null
          id?: string | null
          numero?: string | null
          pdf_url?: string | null
          qtd_itens?: never
          status?: string | null
          valor_cliente?: number | null
          valor_total?: number | null
        }
        Update: {
          aeronave?: string | null
          cliente_nome?: string | null
          data_fim_viagem?: string | null
          id?: string | null
          numero?: string | null
          pdf_url?: string | null
          qtd_itens?: never
          status?: string | null
          valor_cliente?: number | null
          valor_total?: number | null
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
      confirm_booking_request: {
        Args: { p_approved_by: string; p_request_id: string }
        Returns: undefined
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
      is_user_active: { Args: { _user_id: string }; Returns: boolean }
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
