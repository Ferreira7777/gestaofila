-- 1. Adicionar o campo logo_url à tabela de empresas
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 2. Garantir que os administradores podem atualizar os dados da sua própria empresa
-- Primeiro removemos políticas antigas de UPDATE se existirem (para evitar duplicados)
DROP POLICY IF EXISTS "Permitir atualização de dados da própria empresa" ON public.companies;

CREATE POLICY "Permitir atualização de dados da própria empresa" 
ON public.companies FOR UPDATE
TO authenticated
USING (
  id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
)
WITH CHECK (
  id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
);
