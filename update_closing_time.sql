-- Adicionar coluna closing_time na tabela companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS closing_time TEXT DEFAULT '00:00';
