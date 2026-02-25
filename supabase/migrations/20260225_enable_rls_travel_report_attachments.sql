-- Garantir que RLS está ativado na tabela travel_report_attachments
ALTER TABLE IF EXISTS public.travel_report_attachments ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Authenticated users can view travel report attachments" ON public.travel_report_attachments;
DROP POLICY IF EXISTS "Authenticated users can create travel report attachments" ON public.travel_report_attachments;
DROP POLICY IF EXISTS "Authenticated users can update travel report attachments" ON public.travel_report_attachments;
DROP POLICY IF EXISTS "Authenticated users can delete travel report attachments" ON public.travel_report_attachments;

-- Criar políticas de RLS para a tabela
CREATE POLICY "Allow authenticated users to view attachments" ON public.travel_report_attachments
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert attachments" ON public.travel_report_attachments
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update attachments" ON public.travel_report_attachments
FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete attachments" ON public.travel_report_attachments
FOR DELETE TO authenticated USING (true);
