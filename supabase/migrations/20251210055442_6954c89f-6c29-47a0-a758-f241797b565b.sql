-- Create table for favorite suppliers
CREATE TABLE public.fornecedores_favoritos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_completo TEXT NOT NULL,
  cidade TEXT,
  telefone TEXT,
  documento TEXT,
  criado_por UUID NOT NULL,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.fornecedores_favoritos ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view all favorite suppliers" 
ON public.fornecedores_favoritos 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create favorite suppliers" 
ON public.fornecedores_favoritos 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update favorite suppliers" 
ON public.fornecedores_favoritos 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete favorite suppliers" 
ON public.fornecedores_favoritos 
FOR DELETE 
USING (auth.uid() IS NOT NULL);