-- Create aircraft_loans table
CREATE TABLE IF NOT EXISTS public.aircraft_loans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lender_client_id uuid NOT NULL,
  lender_aircraft_id uuid NOT NULL,
  borrower_client_id uuid NOT NULL,
  borrower_aircraft_id uuid NULL,
  hours_borrowed numeric(10, 2) NOT NULL,
  hours_paid_back numeric(10, 2) NULL DEFAULT 0,
  logbook_entry_id uuid NULL,
  payback_entry_id uuid NULL,
  entry_date timestamp without time zone NOT NULL,
  status character varying(20) NULL DEFAULT 'pending'::character varying,
  notes text NULL,
  created_at timestamp without time zone NULL DEFAULT now(),
  updated_at timestamp without time zone NULL DEFAULT now(),
  CONSTRAINT aircraft_loans_pkey PRIMARY KEY (id),
  CONSTRAINT aircraft_loans_borrower_client_id_fkey FOREIGN KEY (borrower_client_id) REFERENCES clients (id) ON DELETE CASCADE,
  CONSTRAINT aircraft_loans_lender_aircraft_id_fkey FOREIGN KEY (lender_aircraft_id) REFERENCES aircraft (id) ON DELETE CASCADE,
  CONSTRAINT aircraft_loans_borrower_aircraft_id_fkey FOREIGN KEY (borrower_aircraft_id) REFERENCES aircraft (id) ON DELETE SET NULL,
  CONSTRAINT aircraft_loans_logbook_entry_id_fkey FOREIGN KEY (logbook_entry_id) REFERENCES logbook_entries (id) ON DELETE SET NULL,
  CONSTRAINT aircraft_loans_payback_entry_id_fkey FOREIGN KEY (payback_entry_id) REFERENCES logbook_entries (id) ON DELETE SET NULL,
  CONSTRAINT aircraft_loans_lender_client_id_fkey FOREIGN KEY (lender_client_id) REFERENCES clients (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_loans_lender ON public.aircraft_loans USING btree (lender_client_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_loans_borrower ON public.aircraft_loans USING btree (borrower_client_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_loans_status ON public.aircraft_loans USING btree (status) TABLESPACE pg_default
WHERE ((status)::text <> 'settled'::text);

CREATE INDEX IF NOT EXISTS idx_loans_aircraft ON public.aircraft_loans USING btree (lender_aircraft_id) TABLESPACE pg_default;

-- Enable Row Level Security (RLS)
ALTER TABLE public.aircraft_loans ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON TABLE public.aircraft_loans TO authenticated;
GRANT SELECT ON TABLE public.aircraft_loans TO anon;
