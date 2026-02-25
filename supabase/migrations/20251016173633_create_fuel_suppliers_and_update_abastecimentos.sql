/*
  # Fuel Control System - Suppliers and Refueling Updates

  1. New Tables
    - `fuel_suppliers`
      - `id` (uuid, primary key)
      - `city_name` (text) - Nome da cidade
      - `icao_code` (text) - Código ICAO
      - `supplier_name` (text) - Nome do fornecedor
      - `contact_person` (text) - Pessoa de contato
      - `phone` (text) - Telefone
      - `avgas_price` (numeric) - Valor AVGAS
      - `jet_price` (numeric) - Valor JET
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Changes to existing tables
    - Add columns to `abastecimentos`:
      - `client_id` (uuid) - Reference to clients table
      - `trecho` (text) - Flight route
      - `local` (text) - Refueling location
      - `abastecimento_galoes` (numeric) - Gallons refueled
      - `ano` (text) - Year for grouping

  3. Security
    - Enable RLS on `fuel_suppliers` table
    - Add policies for authenticated users to read their data
*/

-- Create fuel_suppliers table
CREATE TABLE IF NOT EXISTS fuel_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_name text NOT NULL,
  icao_code text NOT NULL,
  supplier_name text NOT NULL,
  contact_person text,
  phone text,
  avgas_price numeric(10,4) DEFAULT 0,
  jet_price numeric(10,4) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add missing columns to abastecimentos if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'abastecimentos' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE abastecimentos ADD COLUMN client_id uuid REFERENCES clients(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'abastecimentos' AND column_name = 'trecho'
  ) THEN
    ALTER TABLE abastecimentos ADD COLUMN trecho text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'abastecimentos' AND column_name = 'local'
  ) THEN
    ALTER TABLE abastecimentos ADD COLUMN local text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'abastecimentos' AND column_name = 'abastecimento_galoes'
  ) THEN
    ALTER TABLE abastecimentos ADD COLUMN abastecimento_galoes numeric(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'abastecimentos' AND column_name = 'ano'
  ) THEN
    ALTER TABLE abastecimentos ADD COLUMN ano text;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE fuel_suppliers ENABLE ROW LEVEL SECURITY;

-- Policies for fuel_suppliers
CREATE POLICY "Authenticated users can read fuel suppliers"
  ON fuel_suppliers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert fuel suppliers"
  ON fuel_suppliers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update fuel suppliers"
  ON fuel_suppliers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete fuel suppliers"
  ON fuel_suppliers FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_fuel_suppliers_icao ON fuel_suppliers(icao_code);
CREATE INDEX IF NOT EXISTS idx_abastecimentos_client ON abastecimentos(client_id);
CREATE INDEX IF NOT EXISTS idx_abastecimentos_aeronave ON abastecimentos(aeronave_id);
CREATE INDEX IF NOT EXISTS idx_abastecimentos_ano ON abastecimentos(ano);
