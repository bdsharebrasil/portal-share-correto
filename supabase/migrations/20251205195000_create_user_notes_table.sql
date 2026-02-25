-- Create user_notes table for storing individual user notes
CREATE TABLE IF NOT EXISTS public.user_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_notes_user_id ON public.user_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_updated_at ON public.user_notes(updated_at);

-- Enable Row Level Security
ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only see their own notes
CREATE POLICY "Users can view their own notes" ON public.user_notes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy: Users can only create notes for themselves
CREATE POLICY "Users can create their own notes" ON public.user_notes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy: Users can only update their own notes
CREATE POLICY "Users can update their own notes" ON public.user_notes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policy: Users can only delete their own notes
CREATE POLICY "Users can delete their own notes" ON public.user_notes
  FOR DELETE
  USING (auth.uid() = user_id);
