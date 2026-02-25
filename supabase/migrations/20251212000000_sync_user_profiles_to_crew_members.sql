-- Add missing columns to crew_members table for syncing with user_profiles
ALTER TABLE public.crew_members 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS rg TEXT,
ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_crew_members_user_id ON public.crew_members(user_id);

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view crew members" ON public.crew_members;
DROP POLICY IF EXISTS "Authenticated users can manage crew members" ON public.crew_members;
DROP POLICY IF EXISTS "Authenticated users can insert crew members" ON public.crew_members;
DROP POLICY IF EXISTS "Authenticated users can update crew members" ON public.crew_members;
DROP POLICY IF EXISTS "Authenticated users can delete crew members" ON public.crew_members;

-- Re-enable RLS with correct policies
ALTER TABLE public.crew_members ENABLE ROW LEVEL SECURITY;

-- Create RLS policies that allow public read and authenticated write
CREATE POLICY "crew_members_select_policy"
  ON public.crew_members FOR SELECT
  USING (true);

CREATE POLICY "crew_members_insert_policy"
  ON public.crew_members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "crew_members_update_policy"
  ON public.crew_members FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "crew_members_delete_policy"
  ON public.crew_members FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Function to sync user_profiles to crew_members when user profile is created or updated
CREATE OR REPLACE FUNCTION public.sync_user_profile_to_crew_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user has role 'tripulante'
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.id AND role = 'tripulante'
  ) THEN
    -- Insert or update crew member with user profile data
    INSERT INTO public.crew_members (
      user_id,
      full_name,
      email,
      phone,
      avatar_url,
      address,
      status,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      NEW.full_name,
      NEW.email,
      NEW.phone,
      NEW.avatar_url,
      NEW.address,
      'ativo',
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      avatar_url = EXCLUDED.avatar_url,
      address = EXCLUDED.address,
      updated_at = NOW()
    WHERE crew_members.user_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger on user_profiles INSERT/UPDATE
CREATE TRIGGER user_profile_sync_trigger
AFTER INSERT OR UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_profile_to_crew_member();

-- Function to handle when a user role is set to 'tripulante'
CREATE OR REPLACE FUNCTION public.handle_tripulante_role_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_profile record;
BEGIN
  -- Only process if the role being added is 'tripulante'
  IF NEW.role = 'tripulante' THEN
    -- Get user profile data
    SELECT * INTO v_user_profile FROM public.user_profiles
    WHERE id = NEW.user_id;
    
    IF FOUND THEN
      -- Insert or update crew member
      INSERT INTO public.crew_members (
        user_id,
        full_name,
        email,
        phone,
        avatar_url,
        address,
        status,
        created_at,
        updated_at
      ) VALUES (
        NEW.user_id,
        v_user_profile.full_name,
        v_user_profile.email,
        v_user_profile.phone,
        v_user_profile.avatar_url,
        v_user_profile.address,
        'ativo',
        NOW(),
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        avatar_url = EXCLUDED.avatar_url,
        address = EXCLUDED.address,
        updated_at = NOW()
      WHERE crew_members.user_id = NEW.user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger on user_roles INSERT (when a user is assigned the tripulante role)
CREATE TRIGGER user_role_tripulante_trigger
AFTER INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.handle_tripulante_role_assignment();
