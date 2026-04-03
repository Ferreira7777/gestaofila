-- 1. Criação da Tabela de Empresas
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Criação da Tabela de Perfis (liga o Utilizador à Empresa)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Atualização da tabela existente de Clientes
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- 4. Activar o RLS (Row Level Security) - Super Importante para Isolamento
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de Segurança (Policies)

-- Apenas utilizadores autenticados podem criar empresas (no momento do registo)
DROP POLICY IF EXISTS "Permitir criação de empresas a utilizadores autenticados" ON public.companies;
CREATE POLICY "Permitir criação de empresas a utilizadores autenticados" 
ON public.companies FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- O utilizador pode ler as empresas (necessário para o staff e para o check-in público)
DROP POLICY IF EXISTS "Visualizar empresas" ON public.companies;
CREATE POLICY "Visualizar empresas" 
ON public.companies FOR SELECT 
TO public
USING (true);

-- Permitir ao utilizador resgistar o seu próprio perfil
DROP POLICY IF EXISTS "Permitir utilizador criar o seu perfil" ON public.profiles;
CREATE POLICY "Permitir utilizador criar o seu perfil" 
ON public.profiles FOR INSERT 
TO authenticated 
WITH CHECK (id = auth.uid());

-- O utilizador só acede ao seu próprio perfil
DROP POLICY IF EXISTS "Visualizar o proprio perfil" ON public.profiles;
CREATE POLICY "Visualizar o proprio perfil" 
ON public.profiles FOR SELECT 
USING (
  id = auth.uid()
);

-- O grande filtro dos clientes: apenas ler, inserir, atualizar e apagar se pertencerem à sua empresa
DROP POLICY IF EXISTS "Gerir clientes da própria empresa" ON public.customers;
CREATE POLICY "Gerir clientes da própria empresa" 
ON public.customers FOR ALL 
USING (
  company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
)
WITH CHECK (
  company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
);

-- Permitir registo público na fila
DROP POLICY IF EXISTS "Permitir registo público na fila" ON public.customers;
CREATE POLICY "Permitir registo público na fila" 
ON public.customers FOR INSERT 
TO public 
WITH CHECK (
  status = 'waiting' AND 
  company_id IS NOT NULL
);

-- 6. Activar Realtime para novos perfis e empresas (opcional e seguro)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'companies'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.companies;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'customers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
  END IF;
END $$;
