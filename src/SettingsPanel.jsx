import React from 'react';
import { Settings, Link, Send, Clock, Users } from 'lucide-react';

function SettingsPanel({
  companyId,
  logoUrl,
  handleLogoUpload,
  smsMethod,
  handleSmsMethodChange,
  closingTime,
  handleClosingTimeChange
}) {
  return (
    <div className="glass" style={{ padding: '2rem', marginBottom: '2rem' }}>
      <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Settings className="text-primary" /> Configurações do Sistema
      </h2>
      <div className="glass" style={{ padding: '2rem', background: 'rgba(255,255,255,0.02)' }}>

        {/* 1. Método de Notificação */}
        <div style={{ padding: '2rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
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

            <label className={`glass ${smsMethod === 'native' ? 'border-primary' : ''}`} style={{ padding: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid var(--border-color)' }}>
              <input 
                type="radio" 
                name="sms_method" 
                checked={smsMethod === 'native'} 
                onChange={() => handleSmsMethodChange('native')}
              />
              <div>
                <p style={{ fontWeight: 600, margin: 0 }}>Android Nativo In-App (Silencioso)</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: 0 }}>Apenas na versão APK. Envia escondido pelo teu cartão de comunicações sem custos extras de API.</p>
              </div>
            </label>
          </div>
        </div>

        {/* 2. Fecho do Dia */}
        <div style={{ marginTop: '2rem', padding: '2rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={18} /> Fecho do Dia / Reinício da Fila
          </h3>
          <p style={{ color: 'var(--text-dim)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            Defina a hora a que o seu estabelecimento encerra. A fila é limpa automaticamente quando passar dessa mesma hora (útil para quem fecha portas só depois da meia-noite).
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <input 
              type="time" 
              className="form-input" 
              style={{ width: '150px' }}
              value={closingTime}
              onChange={handleClosingTimeChange}
            />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
              A fila começará do zero todos os dias às {closingTime}.
            </span>
          </div>
        </div>

        {/* 3. Identidade Visual */}
        <div style={{ marginTop: '2rem', padding: '2rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
          <h3 style={{ marginBottom: '1rem' }}>Identidade Visual</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Carregue o logótipo do seu restaurante para aparecer no cabeçalho e páginas de check-in.
          </p>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <div style={{ width: '100px', height: '100px', borderRadius: '1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {logoUrl ? (
                    <img src={logoUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <Users size={32} style={{ opacity: 0.2 }} />
                )}
            </div>
            <div>
               <input 
                 type="file" 
                 id="logo-upload" 
                 accept="image/*" 
                 style={{ display: 'none' }} 
                 onChange={handleLogoUpload}
               />
               <label htmlFor="logo-upload" className="btn btn-primary" style={{ cursor: 'pointer' }}>
                 {logoUrl ? 'Alterar Logótipo' : 'Escolher Logótipo'}
               </label>
               <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.5rem' }}>
                 Sugestão: Use uma imagem quadrada (.png ou .jpg).
               </p>
            </div>
          </div>
        </div>

        {/* 4. Módulo de Auto-Check-in */}
        <div style={{ marginTop: '2rem', padding: '2rem', background: 'rgba(255,255,255,0.03)', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
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
        </div>

        {/* 5. QR Code de Check-in */}
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
  );
}

export default SettingsPanel;
