-- Create ctm_service_order_budgets table (linking OAS to Budgets with tracking)
CREATE TABLE IF NOT EXISTS ctm_service_order_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id UUID NOT NULL REFERENCES ctm_service_orders(id) ON DELETE CASCADE,
  budget_id UUID NOT NULL REFERENCES ctm_budgets(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  approval_notes TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create ctm_service_order_documents table (tracks generated PDFs and documents)
CREATE TABLE IF NOT EXISTS ctm_service_order_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_order_id UUID NOT NULL REFERENCES ctm_service_orders(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('pdf_complete', 'ras', 'invoice', 'completion_report')),
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_size_bytes BIGINT,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  generated_by UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create ctm_budget_versions table (tracks version history and changes)
CREATE TABLE IF NOT EXISTS ctm_budget_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES ctm_budgets(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  data JSONB NOT NULL,
  changed_fields JSONB,
  changed_by UUID,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(budget_id, version)
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_ctm_service_order_budgets_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for ctm_service_order_budgets
DROP TRIGGER IF EXISTS update_ctm_service_order_budgets_timestamp_trigger ON ctm_service_order_budgets;
CREATE TRIGGER update_ctm_service_order_budgets_timestamp_trigger
BEFORE UPDATE ON ctm_service_order_budgets
FOR EACH ROW
EXECUTE FUNCTION update_ctm_service_order_budgets_timestamp();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ctm_service_order_budgets_service_order_id
  ON ctm_service_order_budgets(service_order_id);

CREATE INDEX IF NOT EXISTS idx_ctm_service_order_budgets_budget_id
  ON ctm_service_order_budgets(budget_id);

CREATE INDEX IF NOT EXISTS idx_ctm_service_order_budgets_status
  ON ctm_service_order_budgets(status);

CREATE INDEX IF NOT EXISTS idx_ctm_service_order_documents_service_order_id
  ON ctm_service_order_documents(service_order_id);

CREATE INDEX IF NOT EXISTS idx_ctm_service_order_documents_document_type
  ON ctm_service_order_documents(document_type);

CREATE INDEX IF NOT EXISTS idx_ctm_budget_versions_budget_id
  ON ctm_budget_versions(budget_id);

CREATE INDEX IF NOT EXISTS idx_ctm_budget_versions_version
  ON ctm_budget_versions(budget_id, version);

-- Add RLS (Row Level Security) policies
ALTER TABLE ctm_service_order_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ctm_service_order_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ctm_budget_versions ENABLE ROW LEVEL SECURITY;

-- Policy for ctm_service_order_budgets: allow authenticated users to read and write
CREATE POLICY "ctm_service_order_budgets_read_all" ON ctm_service_order_budgets
  FOR SELECT USING (auth.role() = 'authenticated'::text);

CREATE POLICY "ctm_service_order_budgets_insert_all" ON ctm_service_order_budgets
  FOR INSERT WITH CHECK (auth.role() = 'authenticated'::text);

CREATE POLICY "ctm_service_order_budgets_update_all" ON ctm_service_order_budgets
  FOR UPDATE USING (auth.role() = 'authenticated'::text);

CREATE POLICY "ctm_service_order_budgets_delete_all" ON ctm_service_order_budgets
  FOR DELETE USING (auth.role() = 'authenticated'::text);

-- Policy for ctm_service_order_documents: allow authenticated users to read and write
CREATE POLICY "ctm_service_order_documents_read_all" ON ctm_service_order_documents
  FOR SELECT USING (auth.role() = 'authenticated'::text);

CREATE POLICY "ctm_service_order_documents_insert_all" ON ctm_service_order_documents
  FOR INSERT WITH CHECK (auth.role() = 'authenticated'::text);

CREATE POLICY "ctm_service_order_documents_delete_all" ON ctm_service_order_documents
  FOR DELETE USING (auth.role() = 'authenticated'::text);

-- Policy for ctm_budget_versions: allow authenticated users to read and write
CREATE POLICY "ctm_budget_versions_read_all" ON ctm_budget_versions
  FOR SELECT USING (auth.role() = 'authenticated'::text);

CREATE POLICY "ctm_budget_versions_insert_all" ON ctm_budget_versions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated'::text);
