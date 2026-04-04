import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { Users, UserPlus, Baby, CheckCircle2, Lock, Search, LogIn } from 'lucide-react';

function KioskMode({ companyId, companyName, userEmail, onExit }) {
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [queuePos, setQueuePos] = useState(0);
  const [waitingCount, setWaitingCount] = useState(0);
  const [showExitModal, setShowExitModal] = useState(false);
  const [exitPassword, setExitPassword] = useState('');
  const [exitError, setExitError] = useState('');
  const [exitLoading, setExitLoading] = useState(false);
  const [countdown, setCountdown] = useState(8);
  const isSubmittingRef = useRef(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    adults: 1,
    children: 0
  });

  // Carregar contador de clientes em espera (realtime)
  useEffect(() => {
    fetchWaitingCount();

    const channel = supabase
      .channel('kiosk-waiting-channel')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'customers',
        filter: `company_id=eq.${companyId}`
      }, () => {
        fetchWaitingCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  const fetchWaitingCount = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'waiting')
        .gte('created_at', today.toISOString());

      setWaitingCount(count || 0);
    } catch (err) {
      console.error('Erro ao contar fila:', err);
    }
  };

  // Auto-preenchimento por telemóvel
  const handlePhoneBlur = async () => {
    if (!formData.phone || formData.phone.length < 9) return;
    try {
      const { data } = await supabase
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
      // Cliente novo, não há problema
    }
  };

  // Submeter registo
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setSubmitting(true);
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

      // Obter posição na fila
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'waiting')
        .gte('created_at', today.toISOString());

      setQueuePos(count || 0);
      setSuccess(true);
      setCountdown(8);
    } catch (err) {
      alert('Erro ao registar: ' + err.message);
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  // Temporizador de retorno automático ao formulário
  useEffect(() => {
    if (!success) return;

    if (countdown <= 0) {
      // Limpar e voltar ao formulário
      setSuccess(false);
      setFormData({ firstName: '', lastName: '', phone: '', adults: 1, children: 0 });
      fetchWaitingCount();
      return;
    }

    const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [success, countdown]);

  // Sair do modo quiosque (com password de login)
  const handleExitSubmit = async (e) => {
    e.preventDefault();
    setExitLoading(true);
    setExitError('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: exitPassword
      });

      if (error) {
        setExitError('Palavra-passe incorreta.');
      } else {
        onExit();
      }
    } catch (err) {
      setExitError('Erro ao verificar credenciais.');
    } finally {
      setExitLoading(false);
    }
  };

  // === ECRÃ DE SUCESSO ===
  if (success) {
    return (
      <div className="kiosk-full-screen">
        <div className="kiosk-container" style={{ textAlign: 'center', maxWidth: '800px' }}>
          <div style={styles.successIcon}>
            <CheckCircle2 size={48} color="white" />
          </div>
          <h1 style={{ fontSize: '2.5rem', margin: '1.5rem 0 0.5rem', color: 'white' }}>
            Registado com sucesso!
          </h1>
          <p style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.7)', marginBottom: '2rem' }}>
            Olá <strong style={{ color: 'white' }}>{formData.firstName}</strong>, foi adicionado(a) à fila do <strong style={{ color: 'white' }}>{companyName}</strong>.
          </p>

          <div style={styles.positionCard}>
            <p style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.6)', margin: 0 }}>A sua posição na fila:</p>
            <p style={{ fontSize: '4rem', fontWeight: 800, color: 'var(--primary)', margin: '0.5rem 0' }}>#{queuePos}</p>
          </div>

          <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.6)', marginTop: '2rem' }}>
            Será notificado quando a sua mesa estiver pronta.
          </p>

          <div style={styles.countdownBar}>
            <div style={{ ...styles.countdownFill, width: `${(countdown / 8) * 100}%` }}></div>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.5rem' }}>
            A voltar ao início em {countdown}s...
          </p>
        </div>
      </div>
    );
  }

  // === ECRÃ PRINCIPAL (FORMULÁRIO) ===
  return (
    <div className="kiosk-full-screen">
      <div className="kiosk-container">
        {/* Cabeçalho */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={styles.logoIcon}>
            <Users size={36} color="white" />
          </div>
          <h1 style={{ fontSize: '3rem', margin: '1rem 0 0.5rem', color: 'white', fontWeight: 700 }}>{companyName}</h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.4rem' }}>Registe-se na Fila de Espera</p>
        </div>

        {/* Contador de espera */}
        <div style={{ ...styles.waitingBadge, padding: '1.5rem', fontSize: '1.3rem' }}>
          <Users size={28} style={{ color: 'var(--primary)' }} />
          <span>
            Neste momento, <strong style={{ color: 'var(--primary)', fontSize: '1.8rem' }}>{waitingCount}</strong> {waitingCount === 1 ? 'cliente está' : 'clientes estão'} à espera
          </span>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit}>
          {/* Telemóvel (primeiro campo, com lookup) */}
          <div style={styles.formGroup}>
            <label className="kiosk-label">Telemóvel</label>
            <div style={{ position: 'relative' }}>
              <input
                type="tel"
                className="form-input kiosk-input"
                placeholder="Ex: 912345678"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                onBlur={handlePhoneBlur}
              />
              <Search size={24} style={{ position: 'absolute', right: '1.5rem', top: '1.3rem', color: 'rgba(255,255,255,0.3)' }} />
            </div>
            <p style={{ ...styles.hint, fontSize: '0.9rem' }}>Se já nos visitou, os seus dados serão preenchidos automaticamente.</p>
          </div>

          {/* Nome */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div style={styles.formGroup}>
              <label className="kiosk-label">Primeiro Nome</label>
              <input
                type="text"
                className="form-input kiosk-input"
                placeholder="Ex: Pedro"
                required
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              />
            </div>
            <div style={styles.formGroup}>
              <label className="kiosk-label">Último Nome</label>
              <input
                type="text"
                className="form-input kiosk-input"
                placeholder="Ex: Silva"
                required
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              />
            </div>
          </div>

          {/* Adultos & Crianças */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div style={styles.formGroup}>
              <label className="kiosk-label">
                <Users size={18} style={{ verticalAlign: 'middle', marginRight: '0.6rem' }} />
                Adultos
              </label>
              <input
                type="number"
                min="1"
                className="form-input kiosk-input"
                required
                value={formData.adults}
                onChange={(e) => setFormData({ ...formData, adults: e.target.value })}
                style={{ textAlign: 'center', fontSize: '2rem', fontWeight: 700 }}
              />
            </div>
            <div style={styles.formGroup}>
              <label className="kiosk-label">
                <Baby size={18} style={{ verticalAlign: 'middle', marginRight: '0.6rem' }} />
                Crianças
              </label>
              <input
                type="number"
                min="0"
                className="form-input kiosk-input"
                required
                value={formData.children}
                onChange={(e) => setFormData({ ...formData, children: e.target.value })}
                style={{ textAlign: 'center', fontSize: '2rem', fontWeight: 700 }}
              />
            </div>
          </div>

          {/* Botão de submissão */}
          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary"
            style={{ ...styles.submitBtn, padding: '1.8rem', fontSize: '1.5rem', borderRadius: '1.5rem' }}
          >
            <UserPlus size={28} />
            {submitting ? 'A registar...' : 'Entrar na Fila'}
          </button>
        </form>

        {/* Rodapé com botão de saída discreto */}
        <div style={styles.footer}>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>
            © 2026 {companyName} • Gestão de Fila Inteligente
          </p>
          <button
            onClick={() => { setShowExitModal(true); setExitPassword(''); setExitError(''); }}
            style={styles.lockBtn}
            title="Sair do Modo Quiosque"
          >
            <Lock size={16} />
          </button>
        </div>
      </div>

      {/* Modal de saída (password) */}
      {showExitModal && (
        <div style={styles.exitOverlay}>
          <div style={styles.exitModal}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <Lock size={28} style={{ color: 'var(--primary)', marginBottom: '0.75rem' }} />
              <h3 style={{ margin: 0, fontSize: '1.3rem', color: 'white' }}>Sair do Modo Quiosque</h3>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                Introduza as credenciais de acesso para regressar ao painel de gestão.
              </p>
            </div>

            {exitError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', textAlign: 'center', fontSize: '0.9rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                {exitError}
              </div>
            )}

            <form onSubmit={handleExitSubmit}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Palavra-Passe</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  required
                  autoFocus
                  value={exitPassword}
                  onChange={(e) => setExitPassword(e.target.value)}
                  style={styles.input}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="submit"
                  disabled={exitLoading}
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: 'center', padding: '0.9rem' }}
                >
                  <LogIn size={18} />
                  {exitLoading ? 'A verificar...' : 'Desbloquear'}
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'white', padding: '0.9rem 1.5rem' }}
                  onClick={() => setShowExitModal(false)}
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

// === ESTILOS INLINE (para manter o componente auto-contido) ===
const styles = {
  fullScreen: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(135deg, #0a0e1a 0%, #111827 50%, #0d1321 100%)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '1rem',
    zIndex: 9999,
    overflow: 'auto'
  },
  formContainer: {
    width: '100%',
    maxWidth: '560px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '2rem',
    padding: '2.5rem 2rem',
    border: '1px solid rgba(255,255,255,0.08)',
    backdropFilter: 'blur(20px)',
    boxShadow: '0 25px 60px rgba(0,0,0,0.5)'
  },
  successContainer: {
    textAlign: 'center',
    maxWidth: '500px',
    padding: '2rem'
  },
  successIcon: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    background: 'var(--success)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto',
    boxShadow: '0 10px 40px rgba(16, 185, 129, 0.4)'
  },
  positionCard: {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '1.5rem',
    padding: '1.5rem',
    border: '1px solid rgba(255,255,255,0.1)'
  },
  countdownBar: {
    width: '100%',
    height: '4px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '2px',
    marginTop: '2rem',
    overflow: 'hidden'
  },
  countdownFill: {
    height: '100%',
    background: 'var(--primary)',
    borderRadius: '2px',
    transition: 'width 1s linear'
  },
  logoIcon: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--primary), var(--accent))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto',
    boxShadow: '0 10px 30px rgba(99, 102, 241, 0.3)'
  },
  waitingBadge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.6rem',
    padding: '1rem 1.5rem',
    background: 'rgba(99, 102, 241, 0.08)',
    border: '1px solid rgba(99, 102, 241, 0.2)',
    borderRadius: '1rem',
    marginBottom: '2rem',
    fontSize: '1rem',
    color: 'rgba(255,255,255,0.8)'
  },
  formGroup: {
    marginBottom: '1.25rem'
  },
  label: {
    display: 'block',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: '0.5rem'
  },
  input: {
    width: '100%',
    padding: '0.9rem 1rem',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '0.75rem',
    color: 'white',
    fontSize: '1.05rem',
    outline: 'none',
    boxSizing: 'border-box'
  },
  hint: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.35)',
    marginTop: '0.4rem'
  },
  submitBtn: {
    width: '100%',
    padding: '1.2rem',
    fontSize: '1.15rem',
    marginTop: '0.5rem',
    justifyContent: 'center',
    borderRadius: '1rem',
    gap: '0.75rem',
    fontWeight: 700
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '2rem',
    paddingTop: '1rem',
    borderTop: '1px solid rgba(255,255,255,0.06)'
  },
  lockBtn: {
    background: 'none',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.25)',
    borderRadius: '0.5rem',
    padding: '0.5rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
  },
  exitOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.8)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
    backdropFilter: 'blur(8px)'
  },
  exitModal: {
    background: 'rgba(17, 24, 39, 0.95)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '1.5rem',
    padding: '2rem',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
  }
};

export default KioskMode;
