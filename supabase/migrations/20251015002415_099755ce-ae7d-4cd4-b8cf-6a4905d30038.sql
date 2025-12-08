-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('flight-documents', 'flight-documents', false);

-- Create table for document folders and files
CREATE TABLE public.flight_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('folder', 'file')),
  parent_folder_id UUID REFERENCES public.flight_documents(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('operations', 'documents')),
  file_url TEXT,
  file_type TEXT,
  file_size INTEGER,
  caption TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.flight_documents ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to manage documents
CREATE POLICY "Authenticated users can view all documents"
ON public.flight_documents
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert documents"
ON public.flight_documents
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update documents"
ON public.flight_documents
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete documents"
ON public.flight_documents
FOR DELETE
TO authenticated
USING (true);

-- Storage policies for flight-documents bucket
CREATE POLICY "Authenticated users can upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'flight-documents');

CREATE POLICY "Authenticated users can view files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'flight-documents');

CREATE POLICY "Authenticated users can update files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'flight-documents');

CREATE POLICY "Authenticated users can delete files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'flight-documents');

-- Trigger to update updated_at
CREATE TRIGGER update_flight_documents_updated_at
BEFORE UPDATE ON public.flight_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();