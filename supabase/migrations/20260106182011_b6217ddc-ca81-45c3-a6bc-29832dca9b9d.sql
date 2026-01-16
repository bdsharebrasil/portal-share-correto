-- Tabela de prestadores de serviço PJ
CREATE TABLE public.prestadores_servico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cpf_cnpj TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  endereco TEXT,
  cidade TEXT,
  uf TEXT,
  banco TEXT,
  agencia TEXT,
  conta TEXT,
  tipo_conta TEXT,
  pix TEXT,
  observacoes TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de notas fiscais dos prestadores
CREATE TABLE public.prestador_notas_fiscais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prestador_id UUID NOT NULL REFERENCES public.prestadores_servico(id) ON DELETE CASCADE,
  numero_nota TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  descricao TEXT,
  mes_referencia INTEGER NOT NULL,
  ano_referencia INTEGER NOT NULL,
  data_emissao DATE NOT NULL,
  data_vencimento DATE,
  data_pagamento DATE,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, pago, cancelado
  arquivo_nota_url TEXT,
  comprovante_pagamento_url TEXT,
  controle_bancario_id UUID REFERENCES public.controle_bancario(id),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prestadores_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestador_notas_fiscais ENABLE ROW LEVEL SECURITY;

-- Policies for prestadores_servico
CREATE POLICY "Authenticated users can view prestadores" 
ON public.prestadores_servico 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert prestadores" 
ON public.prestadores_servico 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update prestadores" 
ON public.prestadores_servico 
FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete prestadores" 
ON public.prestadores_servico 
FOR DELETE 
USING (auth.role() = 'authenticated');

-- Policies for prestador_notas_fiscais
CREATE POLICY "Authenticated users can view notas fiscais" 
ON public.prestador_notas_fiscais 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert notas fiscais" 
ON public.prestador_notas_fiscais 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update notas fiscais" 
ON public.prestador_notas_fiscais 
FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete notas fiscais" 
ON public.prestador_notas_fiscais 
FOR DELETE 
USING (auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE TRIGGER update_prestadores_servico_updated_at
BEFORE UPDATE ON public.prestadores_servico
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_prestador_notas_fiscais_updated_at
BEFORE UPDATE ON public.prestador_notas_fiscais
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for better performance
CREATE INDEX idx_prestador_notas_mes_ano ON public.prestador_notas_fiscais(prestador_id, ano_referencia, mes_referencia);
CREATE INDEX idx_prestador_notas_status ON public.prestador_notas_fiscais(status);