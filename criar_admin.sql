DO $$
DECLARE
  novo_user_id UUID;
  nova_empresa_id UUID;
BEGIN
  -- 1. Criar o Utilizador na tabela de autenticação
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', 
    gen_random_uuid(), 
    'authenticated', 
    'authenticated', 
    'admin@restaurante.com', 
    crypt('admin123', gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    '{}', 
    now(), 
    now()
  ) RETURNING id INTO novo_user_id;

  -- 2. Criar o Restaurante/Empresa
  INSERT INTO public.companies (name)
  VALUES ('O Meu Super Restaurante')
  RETURNING id INTO nova_empresa_id;

  -- 3. Criar o Perfil associando o Utilizador a Empresa
  INSERT INTO public.profiles (id, company_id, role)
  VALUES (novo_user_id, nova_empresa_id, 'admin');

END $$;
