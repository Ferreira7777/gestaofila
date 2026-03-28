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
CREATE POLICY "Permitir criação de empresas a utilizadores autenticados" 
ON public.companies FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- O utilizador só vê os dados da sua própria empresa
CREATE POLICY "Visualizar a própria empresa" 
ON public.companies FOR SELECT 
USING (
  id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
);

-- Permitir ao utilizador resgistar o seu próprio perfil
CREATE POLICY "Permitir utilizador criar o seu perfil" 
ON public.profiles FOR INSERT 
TO authenticated 
WITH CHECK (id = auth.uid());

-- O utilizador só vê perfis da sua empresa
CREATE POLICY "Visualizar perfis da própria empresa" 
ON public.profiles FOR SELECT 
USING (
  company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
);

-- O grande filtro dos clientes: apenas ler, inserir, atualizar e apagar se pertencerem à sua empresa
CREATE POLICY "Gerir clientes da própria empresa" 
ON public.customers FOR ALL 
USING (
  company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
)
WITH CHECK (
  company_id IN (SELECT company_id FROM public.profiles WHERE profiles.id = auth.uid())
);

-- Activar Realtime para novos perfis e empresas (opcional)
alter publication supabase_realtime add table companies;
alter publication supabase_realtime add table profiles;
