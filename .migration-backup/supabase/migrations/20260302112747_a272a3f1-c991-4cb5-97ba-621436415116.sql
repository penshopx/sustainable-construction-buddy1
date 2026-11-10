
-- Add company logo and signature URL to certificates table
ALTER TABLE public.certificates
ADD COLUMN company_logo_url text NOT NULL DEFAULT '',
ADD COLUMN signature_url text NOT NULL DEFAULT '';
