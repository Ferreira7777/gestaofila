import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Users, UserPlus, Baby, CheckCircle2 } from 'lucide-react';

function PublicCheckin({ companyId }) {
  const [companyName, setCompanyName] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [queuePos, setQueuePos] = useState(0);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    adults: 1,
    children: 0
  });

  useEffect(() => {
    async function loadCompany() {
      const { data, error } = await supabase
        .from('companies')
        .select('name')
        .eq('id', companyId)
        .single();
      
      if (data) setCompanyName(data.name);
      setLoading(false);
    }
    loadCompany();
  }, [companyId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('customers').insert([{
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone_number: formData.phone,
        adults: parseInt(formData.adults),
        children: parseInt(formData.children),
        status: 'waiting',
        company_id: companyId
      }]);

      if (error) throw error;

      // Obter posição na fila (quantos estão waiting)
      const { count } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'waiting');

      setQueuePos(count || 0);
      setSuccess(true);
    } catch (err) {
      alert('Erro ao registar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !success) {
    return (
      <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'white' }}>
        <p>A carregar formulário...</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="glass" style={{ padding: '3rem', textAlign: 'center', maxWidth: '500px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div className="status-badge status-seated" style={{ width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--success)', color: 'white' }}>
               <CheckCircle2 size={32} />
            </div>
          </div>
          <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Sucesso!</h2>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-dim)', marginBottom: '2rem' }}>
            Olá <strong>{formData.firstName}</strong>, foste adicionado(a) à fila do <strong>{companyName}</strong>. 
          </p>
          <div className="glass" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.05)', marginBottom: '2rem' }}>
             <p style={{ fontSize: '0.875rem', color: 'var(--text-dim)', margin: 0 }}>A tua posição atual na fila é:</p>
             <p style={{ fontSize: '3rem', fontWeight: 800, margin: '0.5rem 0', color: 'var(--primary)' }}>#{queuePos}</p>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>
            Receberás um SMS quando a tua mesa para {parseInt(formData.adults) + parseInt(formData.children)} pessoas estiver pronta.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ display: 'flex', justifyContent: 'center', padding: '2rem 1rem' }}>
      <div className="glass" style={{ width: '100%', maxWidth: '600px', padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className="logo-icon" style={{ margin: '0 auto 1.5rem' }}>
            <Users size={32} />
          </div>
          <h1 style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>{companyName}</h1>
          <p style={{ color: 'var(--text-dim)' }}>Registo de Fila de Espera</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Primeiro Nome</label>
              <input 
                type="text" 
                className="form-input" 
                required 
                placeholder="Ex: Pedro"
                value={formData.firstName}
                onChange={(e) => setFormData({...formData, firstName: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Último Nome</label>
              <input 
                type="text" 
                className="form-input" 
                required 
                placeholder="Ex: Silva"
                value={formData.lastName}
                onChange={(e) => setFormData({...formData, lastName: e.target.value})}
              />
            </div>
          </div>
          
          <div className="form-group">
            <label className="form-label">Telemóvel</label>
            <input 
              type="tel" 
              className="form-input" 
              required 
              placeholder="Ex: 912345678"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Adultos</label>
              <input 
                type="number" 
                min="1" 
                className="form-input" 
                required 
                value={formData.adults}
                onChange={(e) => setFormData({...formData, adults: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Crianças</label>
              <input 
                type="number" 
                min="0" 
                className="form-input" 
                required 
                value={formData.children}
                onChange={(e) => setFormData({...formData, children: e.target.value})}
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', padding: '1.2rem', fontSize: '1.1rem', marginTop: '1rem', justifyContent: 'center' }}>
            <UserPlus size={20} /> {loading ? 'A registar...' : 'Entrar na Fila'}
          </button>
        </form>
        
        <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
           © 2026 {companyName} • Gestão de Fila Inteligente
        </p>
      </div>
    </div>
  );
}

export default PublicCheckin;
