-- Add column to indicate if aircraft has daily rate
ALTER TABLE logbook_months 
ADD COLUMN IF NOT EXISTS has_daily_rate BOOLEAN DEFAULT true;

-- Update existing records: if daily_rate is null or 0, set has_daily_rate to false
UPDATE logbook_months 
SET has_daily_rate = CASE 
  WHEN daily_rate IS NULL OR daily_rate = 0 THEN false 
  ELSE true 
END;