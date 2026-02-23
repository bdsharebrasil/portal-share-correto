export type ContactCategory = "clientes" | "colaboradores" | "fornecedores" | "hoteis";

export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  position?: string;
  notes?: string;
  type: "pessoa" | "empresa";
  category?: ContactCategory;
  created_at?: string;
  updated_at?: string;
}

export interface ContactFormData {
  nome: string;
  telefone?: string;
  email?: string;
  empresa?: string;
  cargo?: string;
  categoria?: ContactCategory;
  observacoes?: string;
  endereco?: string;
  cidade?: string;
  tipo: "pessoa" | "empresa";
}
