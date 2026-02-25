-- Add budget_details column to ctm_budgets table
ALTER TABLE ctm_budgets
ADD COLUMN IF NOT EXISTS budget_details jsonb DEFAULT NULL;

-- Add comment to describe the new column
COMMENT ON COLUMN ctm_budgets.budget_details IS 'Additional budget details including workshop name, motor data, components, and notes';
