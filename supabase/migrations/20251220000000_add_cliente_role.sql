-- Add new roles to the app_role enum
-- First, create a new enum type with the additional roles
CREATE TYPE public.app_role_new AS ENUM (
  'admin',
  'financeiro_master',
  'gestor_master',
  'financeiro',
  'operacoes',
  'piloto_chefe',
  'tripulante',
  'cotista',
  'cliente',
  'rh',
  'adm',
  'coordenador_de_voo'
);

-- Alter the user_roles table to use the new enum type
ALTER TABLE public.user_roles ALTER COLUMN role TYPE public.app_role_new USING role::text::public.app_role_new;

-- Drop the old enum
DROP TYPE public.app_role;

-- Rename the new enum to the original name
ALTER TYPE public.app_role_new RENAME TO app_role;

-- Add client_id column to user_profiles if it doesn't exist
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- Create an index for client_id lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_client_id ON public.user_profiles(client_id);

-- Update the has_role function signature to match the new enum
-- (it should work automatically with the new enum type)
