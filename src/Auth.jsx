import React, { useState } from 'react';
import { supabase } from './lib/supabase';
import { Users, LogIn, Store } from 'lucide-react';

export default function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Formulário
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      if (isLogin) {
        // LOGIN NORMAL
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        // Vai buscar o perfil do utilizador logado para saber qual é a empresa dele
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('company_id, companies(name)')
          .eq('id', data.user.id)
          .single();

        if (profileError || !profileData) {
          throw new Error('Perfil ou Empresa não encontrados. Contacte o suporte.');
        }

        onLogin(data.user, profileData.company_id, profileData.companies.name);

      } else {
        // REGISTAR NOVA EMPRESA E UTILIZADOR
        // 1. Criar o utilizador no Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({ 
          email, 
          password,
        });
        
        if (authError) throw authError;

        if (authData.user) {
          // 2. Criar a Empresa na Tabela companies
          const { data: companyData, error: companyError } = await supabase
            .from('companies')
            .insert([{ name: companyName }])
            .select()
            .single();

          if (companyError) throw companyError;

          // 3. Criar o Perfil associando o utilizador à empresa recém-criada
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([{ 
              id: authData.user.id, 
              company_id: companyData.id,
              role: 'admin' 
            }]);

          if (profileError) throw profileError;

          // Sucesso
          onLogin(authData.user, companyData.id, companyData.name);
        }
      }
    } catch (error) {
      console.error(error);
      setErrorMsg(error.message || 'Ocorreu um erro na autenticação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <div className="glass modal-content" style={{ animation: 'none', transform: 'none' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="logo-icon" style={{ margin: '0 auto 1rem auto', width: '60px', height: '60px' }}>
            <Users size={30} />
          </div>
          <h1 style={{ fontSize: '2rem' }}>Gestão de Fila</h1>
          <p style={{ color: 'var(--text-dim)' }}>{isLogin ? 'Inicie sessão na sua conta' : 'Crie a sua plataforma gratuíta'}</p>
        </div>

        {errorMsg && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '1rem', borderRadius: '0.75rem', marginBottom: '1.5rem', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleAuth}>
          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Nome do Restaurante / Empresa</label>
              <div style={{ position: 'relative' }}>
                <Store size={18} style={{ position: 'absolute', left: '1rem', top: '1rem', color: 'var(--text-dim)' }} />
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ paddingLeft: '2.5rem' }}
                  required 
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Ex: Restaurante O Chefe"
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input 
              type="email" 
              className="form-input" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Palavra-Passe</label>
            <input 
              type="password" 
              className="form-input" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }} disabled={loading}>
            {loading ? 'A processar...' : (isLogin ? <><LogIn size={18}/> Entrar no Sistema</> : 'Registar Empresa')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-dim)', fontSize: '0.875rem' }}>
          {isLogin ? "Ainda não tem conta? " : "Já possui conta? "}
          <button 
            type="button"
            onClick={() => { setIsLogin(!isLogin); setErrorMsg(''); }}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '600', cursor: 'pointer' }}
          >
            {isLogin ? "Registar Nova Empresa" : "Fazer Login"}
          </button>
        </div>
      </div>
    </div>
  );
}
