-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Colaboradores podem inserir dados do portal" ON public.client_portal_data;
DROP POLICY IF EXISTS "Colaboradores podem atualizar dados do portal" ON public.client_portal_data;
DROP POLICY IF EXISTS "Colaboradores podem deletar dados do portal" ON public.client_portal_data;
DROP POLICY IF EXISTS "Todos podem visualizar dados do portal" ON public.client_portal_data;

-- Recreate policies
CREATE POLICY "Colaboradores podem inserir dados do portal"
ON public.client_portal_data
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Colaboradores podem atualizar dados do portal"
ON public.client_portal_data
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Colaboradores podem deletar dados do portal"
ON public.client_portal_data
FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "Todos podem visualizar dados do portal"
ON public.client_portal_data
FOR SELECT
USING (true);