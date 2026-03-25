import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { 
  Users, 
  UserPlus, 
  Baby, 
  Clock, 
  CheckCircle2, 
  MessageSquare, 
  XCircle, 
  ChevronRight,
  LogOut,
  Plus,
  Send
} from 'lucide-react';

function App() {
  const [customers, setCustomers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    adults: 1,
    children: 0
  });

  useEffect(() => {
    fetchCustomers();
    
    // Subscribe to real-time changes
    const subscription = supabase
      .channel('customers-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, (payload) => {
        console.log('Evento Realtime Recebido:', payload);
        if (payload.eventType === 'INSERT') {
          setCustomers(prev => [payload.new, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setCustomers(prev => prev.map(c => c.id === payload.new.id ? payload.new : c));
        } else if (payload.eventType === 'DELETE') {
          setCustomers(prev => prev.filter(c => c.id === payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      console.log('Iniciando fetch de clientes...');
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Erro ao procurar clientes:', error);
        throw error;
      }
      
      console.log('Clientes carregados:', data);
      setCustomers(data || []);
    } catch (err) {
      console.error('Erro geral no fetch:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Tentando registar cliente:', formData);
    try {
      const { data, error } = await supabase.from('customers').insert([{
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone_number: formData.phone,
        adults: parseInt(formData.adults),
        children: parseInt(formData.children),
        status: 'waiting'
      }]).select();

      if (error) {
        console.error('Erro do Supabase ao inserir:', error);
        throw error;
      }
      
      console.log('Cliente registado com sucesso:', data);
      
      // Atualização imediata do estado (fallback enquanto o Realtime não está ativo)
      if (data && data[0]) {
        setCustomers(prev => [data[0], ...prev]);
      }

      setShowModal(false);
      setFormData({ firstName: '', lastName: '', phone: '', adults: 1, children: 0 });
    } catch (err) {
      console.error('Erro na submissão:', err);
      alert('Erro ao registar cliente: ' + (err.message || 'Verifique se criou a tabela no Supabase.'));
    }
  };

  const updateStatus = async (id, newStatus) => {
    try {
      console.log(`A atualizar estado do cliente ${id} para ${newStatus}...`);
      const { error } = await supabase
        .from('customers')
        .update({ status: newStatus })
        .eq('id', id);
      
      if (error) {
        console.error('Erro ao atualizar estado no Supabase:', error);
        throw error;
      }

      // Atualização imediata do estado local
      setCustomers(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
      console.log('Estado atualizado com sucesso localmente.');
    } catch (err) {
      console.error('Erro ao atualizar estado:', err);
      alert('Erro ao atualizar estado: ' + err.message);
    }
  };

  const sendSMS = async (customer) => {
    const message = `Olá ${customer.first_name}, a sua mesa para ${customer.adults + customer.children} pessoas está pronta! Por favor, dirija-se à recepção.`;
    
    console.log(`[SMS Gateway] Sending to ${customer.phone_number}: ${message}`);
    
    // Simulating Android Gateway API Call (Option A)
    // In a real scenario, this would be:
    /*
    await fetch('https://your-android-gateway.com/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer YOUR_KEY' },
      body: JSON.stringify({ to: customer.phone_number, message })
    });
    */

    alert(`SMS enviado para ${customer.first_name} (${customer.phone_number})`);
    
    // Atualização imediata do estado para 'notified'
    await updateStatus(customer.id, 'notified');
  };

  const formatArrival = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="container">
      {/* Header */}
      <header className="header">
        <div className="logo-section">
          <div className="logo-icon">
            <Users size={24} />
          </div>
          <div>
            <h1>Gestão de Fila</h1>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>Elegância na Recepção</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={20} /> Novo Cliente
        </button>
      </header>

      {/* Stats Overview (Optional) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="glass" style={{ padding: '1.5rem' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>Em Espera</p>
          <p style={{ fontSize: '2rem', fontWeight: '700' }}>{customers.filter(c => c.status === 'waiting').length}</p>
        </div>
        <div className="glass" style={{ padding: '1.5rem' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>Notificados</p>
          <p style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary)' }}>{customers.filter(c => c.status === 'notified').length}</p>
        </div>
        <div className="glass" style={{ padding: '1.5rem' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>Sentados Hoje</p>
          <p style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--success)' }}>{customers.filter(c => c.status === 'seated').length}</p>
        </div>
      </div>

      {/* Queue Grid */}
      {loading ? (
        <p style={{ textAlign: 'center', color: "var(--text-dim)" }}>A carregar fila...</p>
      ) : (
        <div className="queue-grid">
          {customers.filter(c => c.status !== 'seated' && c.status !== 'cancelled').map((customer) => (
            <div key={customer.id} className="glass customer-card">
              <div className="card-header">
                <div>
                  <h3 className="customer-name">{customer.first_name} {customer.last_name}</h3>
                  <span className={`status-badge status-${customer.status}`}>
                    {customer.status === 'waiting' ? 'Em Espera' : 'Notificado'}
                  </span>
                </div>
                <div className="meta-item" style={{ color: 'var(--text-dim)' }}>
                  <Clock size={16} /> {formatArrival(customer.arrival_time)}
                </div>
              </div>

              <div className="customer-meta">
                <div className="meta-item">
                  <Users size={16} /> {customer.adults} Adultos
                </div>
                {customer.children > 0 && (
                  <div className="meta-item">
                    <Baby size={16} /> {customer.children} Crianças
                  </div>
                )}
              </div>

              <div className="card-actions">
                <button 
                  className="btn-icon primary" 
                  title="Enviar SMS"
                  onClick={() => sendSMS(customer)}
                >
                  <Send size={18} />
                </button>
                <button 
                  className="btn-icon success" 
                  title="Sentar Cliente"
                  onClick={() => updateStatus(customer.id, 'seated')}
                >
                  <CheckCircle2 size={18} />
                </button>
                <button 
                  className="btn-icon danger" 
                  title="Cancelar"
                  onClick={() => updateStatus(customer.id, 'cancelled')}
                >
                  <XCircle size={18} />
                </button>
              </div>
            </div>
          ))}
          {customers.filter(c => c.status !== 'seated' && c.status !== 'cancelled').length === 0 && (
            <div className="glass" style={{ gridColumn: '1 / -1', padding: '4rem', textAlign: 'center', borderStyle: 'dashed' }}>
              <p style={{ color: 'var(--text-dim)' }}>A fila está vazia. Comece por registar um novo cliente.</p>
            </div>
          )}
        </div>
      )}

      {/* Registration Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="glass modal-content">
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <UserPlus className="text-primary" /> Novo Cliente
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Primeiro Nome</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    required 
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
                  placeholder="+351 9xx xxx xxx"
                  required 
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

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                  Registar na Fila
                </button>
                <button 
                  type="button" 
                  className="btn" 
                  style={{ background: 'var(--border-color)', color: 'white' }}
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
