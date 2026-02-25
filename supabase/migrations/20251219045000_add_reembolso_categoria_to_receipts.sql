-- Add reembolso_categoria_id column to receipts table to track reimbursement category
ALTER TABLE public.receipts 
ADD COLUMN reembolso_categoria_id UUID REFERENCES public.categorias_movimentacao(id);

-- Add comment to document the purpose of this column
COMMENT ON COLUMN public.receipts.reembolso_categoria_id IS 'Category ID for reimbursement requests (receipts with type=reembolso)';
