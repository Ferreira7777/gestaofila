import React, { useState, useEffect, useRef } from 'react';
import { supabase, supabaseUrl, supabaseAnonKey } from './lib/supabase';
import Auth from './Auth';
import { 
  Users, UserPlus, Baby, Clock, CheckCircle2, 
  Send, XCircle, LogOut, Plus, Search, Settings, Link
} from 'lucide-react';
import PublicCheckin from './PublicCheckin';

function App() {
  const [session, setSession] = useState(null);
  const [companyId, setCompanyId] = useState(null);
  const [companyName, setCompanyName] = useState('');
  
  const [customers, setCustomers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('queue'); // 'queue' | 'history'
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    adults: 1,
    children: 0
  });

  const [submitting, setSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  // Estado para Check-in Público
  const [regId, setRegId] = useState(null);
  
  // Método de SMS individual por dispositivo (Direct | Twilio)
  const [smsMethod, setSmsMethod] = useState(localStorage.getItem('fila_sms_method') || 'direct');

  const handleSmsMethodChange = (method) => {
    setSmsMethod(method);
    localStorage.setItem('fila_sms_method', method);
  };
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('reg');
    if (r) setRegId(r);
  }, []);

  // Temporizador para atualizar os contadores "há X min" a cada 60s
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Verificar sessão ativa
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        loadUserProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        loadUserProfile(session.user);
      } else {
        setSession(null);
        setCompanyId(null);
        setCustomers([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (user) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('company_id, companies(name)')
        .eq('id', user.id)
        .single();
        
      if (!error && data) {
        setSession(user);
        setCompanyId(data.company_id);
        setCompanyName(data.companies.name);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!companyId) return;
    
    fetchCustomers();
    
    // Subscrever a alterações na tabela customers com filtro por empresa
    const channel = supabase
      .channel('customers-channel')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'customers',
        filter: `company_id=eq.${companyId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setCustomers(prev => {
            // Evitar duplicados se a inserção manual já tiver adicionado o registo
            if (prev.find(c => c.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        } else if (payload.eventType === 'UPDATE') {
          setCustomers(prev => prev.map(c => c.id === payload.new.id ? payload.new : c));
        } else if (payload.eventType === 'DELETE') {
          setCustomers(prev => prev.filter(c => c.id === payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      
      // Filtro para mostrar apenas os clientes de HOJE
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', companyId)
        .gte('created_at', todayISO) // FILTRO CRÍTICO: Registos desde as 00:00 de hoje
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      // Garantir IDs únicos no fetch inicial
      const uniqueData = Array.from(new Map(data.map(item => [item.id, item])).values());
      setCustomers(uniqueData);
    } catch (err) {
      console.error('Erro no fetch:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneBlur = async () => {
    if (!formData.phone || formData.phone.length < 9) return;
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('first_name, last_name')
        .eq('company_id', companyId)
        .eq('phone_number', formData.phone)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (data) {
        setFormData(prev => ({ 
          ...prev, 
          firstName: prev.firstName || data.first_name, 
          lastName: prev.lastName || data.last_name 
        }));
      }
    } catch (err) {
      // Ignorar, pois pode ser simplesmente a primeira vez que o cliente vem
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    
    isSubmittingRef.current = true;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.from('customers').insert([{
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone_number: formData.phone,
        adults: parseInt(formData.adults),
        children: parseInt(formData.children),
        status: 'waiting',
        company_id: companyId
      }]).select();

      if (error) throw error;
      
      if (data && data[0]) {
        // Fallback optimista para quando realtime está um bocado lento
        setCustomers(prev => {
          if (!prev.find(c => c.id === data[0].id)) {
            return [...prev, data[0]];
          }
          return prev;
        });
      }

      setShowModal(false);
      setFormData({ firstName: '', lastName: '', phone: '', adults: 1, children: 0 });
    } catch (err) {
      alert('Erro ao registar cliente: ' + err.message);
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  const updateStatus = async (id, newStatus, extraData = {}) => {
    try {
      const { error } = await supabase
        .from('customers')
        .update({ status: newStatus, ...extraData })
        .eq('id', id);
      
      if (error) throw error;
      setCustomers(prev => prev.map(c => c.id === id ? { ...c, status: newStatus, ...extraData } : c));
    } catch (err) {
      alert('Erro ao atualizar estado: ' + err.message);
    }
  };

  const sendSMS = async (customer) => {
    const message = `Olá ${customer.first_name}, a sua mesa para ${customer.adults + customer.children} pessoas está pronta no ${companyName}! Por favor, dirija-se à recepção. Caso desista da reserva da mesa, por favor envie mensagem "Cancelar". Obrigado.`;
    
    if (smsMethod === 'twilio') {
      try {
        const baseUrl = (supabaseUrl || '').replace(/\/$/, '');
        const targetUrl = `${baseUrl}/functions/v1/send-sms`;

        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey,
          },
          body: JSON.stringify({
            to: customer.phone_number,
            name: customer.first_name,
            content: message
          })
        });
        
        if (!response.ok) {
           throw new Error('Falha na ligação ao servidor de SMS.');
        }
        
        // Sucesso discreto (Pode ser removido se quiser que seja 100% silencioso)
        console.log('Notificação enviada via Twilio');

      } catch (err) {
        console.error('Erro Twilio:', err);
        alert('Não foi possível enviar a SMS automática. Verifique a sua ligação ou tente o Método Direto.');
        return; 
      }
    } else {
      // Método Direto (Grátis via Telemóvel)
      const smsUrl = `sms:${customer.phone_number}?body=${encodeURIComponent(message)}`;
      window.location.href = smsUrl;
    }
    
    await updateStatus(customer.id, 'notified', { notified_at: new Date().toISOString() });
  };

  const formatArrival = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '';
    const diffMins = Math.floor((now - new Date(timestamp).getTime()) / 60000);
    if (diffMins <= 0) return 'AGORINHA';
    return `HÁ ${diffMins} MIN`;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const getUniqueCustomers = () => {
    const sorted = [...customers].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const uniqueMap = new Map();
    sorted.forEach(c => {
      uniqueMap.set(c.phone_number, c);
    });
    return Array.from(uniqueMap.values()).sort((a, b) => (a.first_name || '').localeCompare(b.first_name || ''));
  };

  if (regId) {
    return <PublicCheckin companyId={regId} />;
  }

  if (loading && !session) {
    return <div style={{ textAlign: 'center', padding: '4rem', color: 'white' }}>A carregar plataforma...</div>;
  }

  // Se não tem sessão ativa, mostra ecrã de Auth
  if (!session) {
    return <Auth onLogin={(user, cid, cname) => {
      setSession(user);
      setCompanyId(cid);
      setCompanyName(cname);
    }} />;
  }

  return (
    <div className="container">
      {/* Header */}
      <header className="header" style={{ marginBottom: '2rem' }}>
        <div className="logo-section">
          <div className="logo-icon">
            <Users size={24} />
          </div>
          <div>
            <h1>{companyName}</h1>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>Gestão de Fila Inteligente</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className={`btn ${viewMode === 'queue' ? 'btn-primary' : ''}`} onClick={() => setViewMode('queue')} style={{ background: viewMode === 'queue' ? '' : 'rgba(255,255,255,0.1)' }}>
            Fila Atual
          </button>
          <button className={`btn ${viewMode === 'history' ? 'btn-primary' : ''}`} onClick={() => setViewMode('history')} style={{ background: viewMode === 'history' ? '' : 'rgba(255,255,255,0.1)' }}>
            Histórico
          </button>
          <button className={`btn ${viewMode === 'clients' ? 'btn-primary' : ''}`} onClick={() => setViewMode('clients')} style={{ background: viewMode === 'clients' ? '' : 'rgba(255,255,255,0.1)' }}>
            Clientes
          </button>
          <button className={`btn ${viewMode === 'settings' ? 'btn-primary' : ''}`} onClick={() => setViewMode('settings')} style={{ background: viewMode === 'settings' ? '' : 'rgba(255,255,255,0.1)' }}>
            <Settings size={20} />
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={20} /> <span className="hide-mobile">Novo Cliente</span>
          </button>
          <button className="btn-icon" onClick={handleLogout} title="Terminar Sessão" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {viewMode === 'settings' && (
        <div className="glass" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Settings className="text-primary" /> Configurações do Sistema
          </h2>
          <div className="glass" style={{ padding: '2rem', background: 'rgba(255,255,255,0.02)' }}>
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Link size={18} /> Módulo de Auto-Check-in (Público)
            </h3>
            <p style={{ color: 'var(--text-dim)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              Partilhe este link ou gere um QR Code para que os seus clientes se possam registar na fila de espera autonomamente.
            </p>
            
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-color)' }}>
              <code style={{ fontSize: '0.85rem', color: 'var(--primary)', wordBreak: 'break-all' }}>
                {window.location.origin}/?reg={companyId}
              </code>
              <button className="btn" style={{ fontSize: '0.75rem', padding: '0.5rem 1rem' }} onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/?reg=${companyId}`);
                alert('Link copiado!');
              }}>
                Copiar Link
              </button>
            </div>
            
            <div style={{ marginTop: '2rem', padding: '2rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
              <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Send size={18} /> Método de Notificação (Este Dispositivo)
              </h3>
              <p style={{ color: 'var(--text-dim)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                Escolha como deseja enviar as notificações para este telemóvel ou computador específico.
              </p>
              
              <div style={{ display: 'grid', gap: '1rem' }}>
                <label className={`glass ${smsMethod === 'direct' ? 'border-primary' : ''}`} style={{ padding: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid var(--border-color)' }}>
                  <input 
                    type="radio" 
                    name="sms_method" 
                    checked={smsMethod === 'direct'} 
                    onChange={() => handleSmsMethodChange('direct')}
                  />
                  <div>
                    <p style={{ fontWeight: 600, margin: 0 }}>Link Direto (Grátis)</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: 0 }}>Usa o seu telemóvel atual. Abre a sua app de mensagens nativa.</p>
                  </div>
                </label>
                
                <label className={`glass ${smsMethod === 'twilio' ? 'border-primary' : ''}`} style={{ padding: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid var(--border-color)' }}>
                  <input 
                    type="radio" 
                    name="sms_method" 
                    checked={smsMethod === 'twilio'} 
                    onChange={() => handleSmsMethodChange('twilio')}
                  />
                  <div>
                    <p style={{ fontWeight: 600, margin: 0 }}>Twilio Automático (Profissional)</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: 0 }}>Envio imediato em segundo plano. Requer conta Twilio e saldo. Não precisa de sair da app.</p>
                  </div>
                </label>
              </div>
            </div>
            
            <div style={{ marginTop: '2rem', padding: '2rem', border: '1px solid var(--border-color)', borderRadius: '1.5rem', textAlign: 'center', background: 'rgba(255,255,255,0.03)' }}>
              <p style={{ fontSize: '1rem', color: 'var(--text-main)', marginBottom: '1.5rem', fontWeight: 600 }}>O seu QR Code de Check-in:</p>
              <div style={{ background: 'white', padding: '1rem', display: 'inline-block', borderRadius: '1rem', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', marginBottom: '1.5rem' }}>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(`${window.location.origin}/?reg=${companyId}`)}`}
                  alt="QR Code"
                  style={{ display: 'block', width: '200px', height: '200px' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button 
                  className="btn" 
                  style={{ background: 'var(--success)', color: 'white', fontSize: '0.875rem' }} 
                  onClick={() => window.open(`https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&margin=10&data=${encodeURIComponent(`${window.location.origin}/?reg=${companyId}`)}`, '_blank')}
                >
                  Abrir QR Code (Alta Qualidade)
                </button>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '1rem' }}>
                Dica: Pode imprimir esta imagem e colocá-la na receção para os clientes lerem.
              </p>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'clients' && (
        <div className="glass" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Users className="text-primary" /> Carteira de Clientes ({getUniqueCustomers().length})
          </h2>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {getUniqueCustomers().map((c) => (
              <div key={c.phone_number} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{c.first_name} {c.last_name}</h3>
                  <p style={{ color: 'var(--text-dim)', margin: 0, marginTop: '0.25rem', fontWeight: 600 }}>{c.phone_number}</p>
                </div>
                <button 
                  className="btn-icon success" 
                  title="WhatsApp"
                  style={{ width: 'auto', padding: '0 1rem', borderRadius: '2rem', gap: '0.5rem', borderColor: '#25D366', color: '#25D366' }}
                  onClick={() => window.location.href = `https://wa.me/${c.phone_number.replace(/\D/g,'')}?text=Ol%C3%A1%20${encodeURIComponent(c.first_name)},%20temos%20novidades%20no%20${encodeURIComponent(companyName)}!`}
                >
                  <Send size={16} /> <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>WhatsApp</span>
                </button>
              </div>
            ))}
            {getUniqueCustomers().length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--text-dim)' }}>Sem clientes registados.</p>
            )}
          </div>
        </div>
      )}

      {viewMode !== 'clients' && (
      <>
      {/* Stats Overview */}
      <div className="stats-grid">
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
          {(() => {
            const items = customers.filter(c => viewMode === 'history' ? true : (c.status !== 'seated' && c.status !== 'cancelled'));
            // Deduplicação absoluta no render para evitar quebra do DOM se as keys forem repetidas
            const uniqueItems = Array.from(new Map(items.map(item => [item.id, item])).values());
            
            return uniqueItems
              .sort((a, b) => {
                const prioridade = { notified: 1, waiting: 2, seated: 3, cancelled: 4 };
                const pA = prioridade[a.status] || 99;
                const pB = prioridade[b.status] || 99;
                if (pA !== pB) return pA - pB;
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
              })
              .map((customer) => (
                <div key={customer.id} className="glass customer-card" style={{ opacity: (customer.status === 'seated' || customer.status === 'cancelled') ? 0.6 : 1 }}>
              <div className="card-header">
                <div>
                  <h3 className="customer-name">{customer.first_name} {customer.last_name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.2rem' }}>
                    <span className={`status-badge status-${customer.status}`} style={{ textTransform: 'uppercase' }}>
                      {customer.status === 'waiting' ? 'Em Espera' : customer.status === 'notified' ? 'Notificado' : customer.status === 'seated' ? 'Sentado' : 'Cancelado'}
                    </span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                      {customer.status === 'waiting' 
                        ? formatRelativeTime(customer.created_at || customer.arrival_time)
                        : formatRelativeTime(customer.notified_at || customer.created_at || customer.arrival_time)}
                    </span>
                  </div>
                </div>
                <div className="meta-item" style={{ color: 'var(--text-dim)' }}>
                  <Clock size={16} /> {formatArrival(customer.created_at || customer.arrival_time)}
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
                {customer.status !== 'seated' && customer.status !== 'cancelled' && (
                  <>
                    <button className="btn-icon primary" title="Enviar SMS" onClick={() => sendSMS(customer)}>
                      <Send size={18} />
                    </button>
                    <button className="btn-icon success" title="Sentar Cliente" onClick={() => updateStatus(customer.id, 'seated')}>
                      <CheckCircle2 size={18} />
                    </button>
                    <button className="btn-icon danger" title="Cancelar" onClick={() => updateStatus(customer.id, 'cancelled')}>
                      <XCircle size={18} />
                    </button>
                  </>
                )}
                {(customer.status === 'seated' || customer.status === 'cancelled') && (
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                    Cliente {customer.status === 'seated' ? 'sentado e finalizado' : 'cancelado da fila'}.
                  </span>
                )}
              </div>
                </div>
              ));
          })()}
          {customers.filter(c => viewMode === 'history' ? true : (c.status !== 'seated' && c.status !== 'cancelled')).length === 0 && (
            <div className="glass" style={{ gridColumn: '1 / -1', padding: '4rem', textAlign: 'center', borderStyle: 'dashed' }}>
              <p style={{ color: 'var(--text-dim)' }}>
                {viewMode === 'history' ? 'Ainda não existem clientes no histórico.' : 'A fila está vazia. Comece por registar um novo cliente.'}
              </p>
            </div>
          )}
        </div>
      )}
      </>
      )}

      {/* Registration Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="glass modal-content">
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <UserPlus className="text-primary" /> Novo Cliente
            </h2>
            <form onSubmit={handleSubmit}>
              
              <div className="form-group">
                <label className="form-label">Telemóvel (escreva o número e pressione fora)</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type="tel" 
                    className="form-input" 
                    placeholder="Ex: 91xxxxxxx"
                    required 
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    onBlur={handlePhoneBlur}
                  />
                  <Search size={16} style={{ position: 'absolute', right: '1rem', top: '1.1rem', color: 'var(--text-dim)' }} />
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.4rem' }}>
                  A plataforma preenche automaticamente caso este cliente já vos tenha visitado.
                </p>
              </div>

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
                <button type="submit" disabled={submitting} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                  {submitting ? 'A registar...' : 'Registar na Fila'}
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
