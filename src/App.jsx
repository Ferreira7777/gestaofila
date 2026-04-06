import React, { useState, useEffect, useRef } from 'react';
import { supabase, supabaseUrl, supabaseAnonKey } from './lib/supabase';
import Auth from './Auth';
import { 
  Users, UserPlus, Baby, Clock, CheckCircle2, 
  Send, XCircle, LogOut, Plus, Search, Settings, Link, Tablet,
  Trash2, Edit3, Check, X, Image, MessageSquare
} from 'lucide-react';
import PublicCheckin from './PublicCheckin';
import KioskMode from './KioskMode';
import SettingsPanel from './SettingsPanel';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

const NativeSms = Capacitor.isNativePlatform() ? registerPlugin('NativeSms') : null;

function App() {
  const [session, setSession] = useState(null);
  const [companyId, setCompanyId] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState(null);
  const [closingTime, setClosingTime] = useState('00:00');
  
  const [customers, setCustomers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('queue'); // 'queue' | 'history'
  const [statusFilter, setStatusFilter] = useState(null); // 'waiting' | 'notified' | 'seated'
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    adults: 1,
    children: 0
  });

  const [submitting, setSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  // Estados para Gestão de Clientes
  const [selectedClients, setSelectedClients] = useState([]);
  const [bulkMessage, setBulkMessage] = useState('');
  const [editingClient, setEditingClient] = useState(null); // { id, phone, first_name, last_name }
  const [editFormData, setEditFormData] = useState({ firstName: '', lastName: '', phone: '' });


  // Estados para o Histórico Global
  const [historyData, setHistoryData] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);

  const [allClients, setAllClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);

  // Estados para o WhatsApp Marketing
  const [messageChannel, setMessageChannel] = useState('sms'); // 'sms' | 'whatsapp'
  const [marketingImage, setMarketingImage] = useState(null);
  const [marketingImageUrl, setMarketingImageUrl] = useState(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showClientMessageModal, setShowClientMessageModal] = useState(false);
  const [showAppPicker, setShowAppPicker] = useState(false);
  const [appPickerResolve, setAppPickerResolve] = useState(null);
  
  const promptAppPicker = () => new Promise(resolve => {
    setAppPickerResolve(() => resolve);
    setShowAppPicker(true);
  });

  // Estado para Check-in Público
  const [regId, setRegId] = useState(null);
  
  // Estado para Modo Quiosque (Persistido para segurança)
  const [kioskMode, setKioskMode] = useState(localStorage.getItem('kiosk_active') === 'true');
  
  const handleSetKioskMode = (active) => {
    setKioskMode(active);
    if (active) {
      localStorage.setItem('kiosk_active', 'true');
    } else {
      localStorage.removeItem('kiosk_active');
    }
  };
  
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
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('company_id, companies(name, logo_url, closing_time)')
        .eq('id', user.id)
        .single();
        
      if (error || !data) {
        // Se houver erro, forçar logout pois a sessão poderá estar corrompida
        await supabase.auth.signOut();
        setSession(null);
        setCompanyId(null);
      } else {
        setSession(user);
        setCompanyId(data.company_id);
        setCompanyName(data.companies.name);
        setLogoUrl(data.companies.logo_url);
        if (data.companies.closing_time) {
          setClosingTime(data.companies.closing_time);
        }
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      setSession(null);
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
          setCustomers(prev => prev.find(c => c.id === payload.new.id) ? prev : [...prev, payload.new]);
          setAllClients(prev => prev.find(c => c.id === payload.new.id) ? prev : [payload.new, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setCustomers(prev => prev.map(c => c.id === payload.new.id ? payload.new : c));
          setAllClients(prev => prev.map(c => c.id === payload.new.id ? payload.new : c));
        } else if (payload.eventType === 'DELETE') {
          setCustomers(prev => prev.filter(c => c.id === payload.old.id));
          setAllClients(prev => prev.filter(c => c.id === payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, closingTime]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      
      const [closeHour, closeMinute] = (closingTime || '00:00').split(':').map(Number);
      const today = new Date();
      let startOfDay = new Date();
      startOfDay.setHours(closeHour, closeMinute, 0, 0);

      // Se a hora atual for menor que a hora de fecho (ex: 02h00 atual < 04h00 fecho), 
      // significa que ainda estamos no "turno" do dia anterior.
      if (today < startOfDay) {
        startOfDay.setDate(startOfDay.getDate() - 1);
      }

      const todayISO = startOfDay.toISOString();

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', companyId)
        .gte('created_at', todayISO) // FILTRO CRÍTICO: Registos desde a abertura configurada
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

  const fetchHistory = async () => {
    if (!companyId) return;
    try {
      setHistoryLoading(true);
      let query = supabase
        .from('customers')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (historySearch) {
        // Pesquisa por nome ou apelido
        query = query.or(`first_name.ilike.%${historySearch}%,last_name.ilike.%${historySearch}%`);
      }

      if (historyDateFilter) {
        const start = new Date(historyDateFilter);
        start.setHours(0, 0, 0, 0);
        const end = new Date(historyDateFilter);
        end.setHours(23, 59, 59, 999);
        query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      setHistoryData(data || []);
    } catch (err) {
      console.error('Erro no fetch do histórico:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'history') {
      fetchHistory();
    }
  }, [viewMode, historySearch, historyDateFilter, companyId]);

  const fetchGlobalClients = async () => {
    if (!companyId) return;
    try {
      setClientsLoading(true);
      // Carregar todos os registos para criar o CRM global
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAllClients(data || []);
    } catch (err) {
      console.error('Erro no fetch global de clientes:', err);
    } finally {
      setClientsLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'clients') {
      fetchGlobalClients();
    }
  }, [viewMode, companyId]);

  const handleMarketingImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !companyId) return;

    try {
      setIsUploadingImage(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${companyId}/mkt_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('marketing')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('marketing')
        .getPublicUrl(fileName);

      setMarketingImageUrl(publicUrl);
      setMarketingImage(file);
    } catch (err) {
      alert('Erro ao carregar imagem:ifique-se que o bucket "marketing" existe no Supabase.');
      console.error(err);
    } finally {
      setIsUploadingImage(false);
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
      // Verificar se o cliente já está na fila (em espera ou notificado) em qualquer data
      if (formData.phone) {
        const [closeHour, closeMinute] = (closingTime || '00:00').split(':').map(Number);
        const today = new Date();
        let startOfShift = new Date();
        startOfShift.setHours(closeHour, closeMinute, 0, 0);
        if (today < startOfShift) startOfShift.setDate(startOfShift.getDate() - 1);
        const todayISO = startOfShift.toISOString();

        const { data: existing } = await supabase
          .from('customers')
          .select('id, status, created_at')
          .eq('company_id', companyId)
          .eq('phone_number', formData.phone)
          .in('status', ['waiting', 'notified'])
          .limit(1);

        if (existing && existing.length > 0) {
          const oldRecord = existing[0];
          // Se o registo for do turno atual, bloqueia
          if (new Date(oldRecord.created_at) >= new Date(todayISO)) {
            alert('Este cliente já se encontra na fila de espera ou foi notificado hoje. Não é possível registá-lo novamente.');
            isSubmittingRef.current = false;
            setSubmitting(false);
            return;
          } else {
            // Se for de um dia anterior, "limpa" (cancela) o registo antigo para dar lugar ao novo
            await supabase
              .from('customers')
              .update({ status: 'cancelled' })
              .eq('id', oldRecord.id);
            console.log(`Limpando registo obsoleto do cliente ${formData.phone} de ${oldRecord.created_at}`);
          }
        }
      }

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
        
        const data = await response.json();

        if (!response.ok) {
           // Diagnóstico detalhado para o utilizador
           throw new Error(data.error || data.message || 'Erro desconhecido no servidor.');
        }
        
        console.log('Notificação enviada com sucesso:', data);
        alert('Notificação enviada com sucesso!');

      } catch (err) {
        console.error('Falha no Envio:', err);
        alert(`FALHA NO ENVIO:\n${err.message}`);
        return; 
      }
    } else if (smsMethod === 'native') {
       if (Capacitor.isNativePlatform() && NativeSms) {
         try {
           const result = await NativeSms.send({
             phoneNumber: customer.phone_number,
             message: message
           });
           console.log('SMS enviado com sucesso em Background:', result);
           alert('SMS enviado com sucesso em background!');
         } catch (err) {
           alert('Falha nativa a enviar SMS: ' + (err.message || err));
           return;
         }
       } else {
         alert('Erro: O envio invisível só funciona se a app for instalada como APK no teu Android. Foi acionado o método de Link Direto base.');
         const smsUrl = `sms:${customer.phone_number}?body=${encodeURIComponent(message)}`;
         window.location.href = smsUrl;
       }
    } else {
      // Método Direto (Grátis via Telemóvel)
      const smsUrl = `sms:${customer.phone_number}?body=${encodeURIComponent(message)}`;
      window.location.href = smsUrl;
    }
    
    await updateStatus(customer.id, 'notified', { notified_at: new Date().toISOString() });
  };



  // Funções de Gestão de Clientes
  const handleDeleteClient = async (phone) => {
    if (!window.confirm(`Tem a certeza que deseja eliminar o cliente com telemóvel ${phone}? Todos os registos históricos serão apagados.`)) return;
    
    try {
      setLoading(true);
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('company_id', companyId)
        .eq('phone_number', phone);
      
      if (error) throw error;
      
      setCustomers(prev => prev.filter(c => c.phone_number !== phone));
      alert('Cliente e todo o seu histórico eliminados com sucesso.');
    } catch (err) {
      alert('Erro ao eliminar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (client) => {
    setEditingClient(client);
    setEditFormData({ 
      firstName: client.first_name, 
      lastName: client.last_name, 
      phone: client.phone_number 
    });
  };

  const handleUpdateClient = async () => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('customers')
        .update({ 
          first_name: editFormData.firstName, 
          last_name: editFormData.lastName, 
          phone_number: editFormData.phone 
        })
        .eq('company_id', companyId)
        .eq('phone_number', editingClient.phone_number);
      
      if (error) throw error;
      
      const updatedCustomer = { ...editingClient, first_name: editFormData.firstName, last_name: editFormData.lastName, phone_number: editFormData.phone };

      setCustomers(prev => prev.map(c => 
        c.phone_number === editingClient.phone_number ? { ...c, ...updatedCustomer } : c
      ));

      setAllClients(prev => prev.map(c => 
        c.phone_number === editingClient.phone_number ? { ...c, ...updatedCustomer } : c
      ));
      
      setEditingClient(null);
      alert('Dados do cliente atualizados com sucesso.');
    } catch (err) {
      alert('Erro ao atualizar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendBulkSMS = async () => {
    if (selectedClients.length === 0) return alert('Selecione pelo menos um cliente.');
    if (!bulkMessage.trim()) return alert('Escreva a mensagem que deseja enviar.');
    
    const count = selectedClients.length;
    
    // Alerta de volume para WhatsApp (Abre muitas abas)
    if (messageChannel === 'whatsapp' && count > 10) {
      if (!window.confirm(`Atenção: Vai abrir ${count} janelas do WhatsApp. Isto pode tornar o seu computador lento. Recomenda-se enviar em lotes pequenos. Deseja continuar?`)) return;
    } else {
      if (!window.confirm(`Deseja enviar esta campanha para ${count} clientes via ${messageChannel.toUpperCase()} agora?`)) return;
    }

    setLoading(true);
    let successCount = 0;
    let failCount = 0;

    // Conteúdo final com link de imagem se existir
    const finalMsg = marketingImageUrl 
      ? `${bulkMessage}\n\n📷 Ver imagem: ${marketingImageUrl}\n\n${companyName}`
      : `${bulkMessage}\n\n${companyName}`;

    let globalSelectedApp = 'com.whatsapp';
    let globalBase64Content = null;
    let isNativeWA = Capacitor.isNativePlatform() && window.Capacitor?.Plugins?.NativeWhatsApp && messageChannel === 'whatsapp';

    if (isNativeWA) {
      try {
        const NativeWA = window.Capacitor.Plugins.NativeWhatsApp;
        const { whatsapp, whatsappBusiness } = await NativeWA.checkInstalledApps();
        
        if (whatsapp && whatsappBusiness) {
          const pickedApp = await promptAppPicker();
          if (!pickedApp) {
            setLoading(false);
            return; // Aborta envio pois user cancelou
          }
          globalSelectedApp = pickedApp;
        } else if (whatsappBusiness && !whatsapp) {
          globalSelectedApp = 'com.whatsapp.w4b';
        } else if (!whatsapp && !whatsappBusiness) {
          isNativeWA = false; // Fallback para web
        }

        if (isNativeWA && marketingImageUrl) {
          const response = await fetch(marketingImageUrl);
          const blob = await response.blob();
          const reader = new FileReader();
          const base64Data = await new Promise((resolve) => {
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          globalBase64Content = base64Data.split(',')[1];
        }
      } catch (e) {
        console.warn('Erro ao inicializar plugin WA Nativo', e);
        isNativeWA = false;
      }
    }

    for (const phone of selectedClients) {
      const customer = getUniqueCustomers().find(c => c.phone_number === phone);
      if (!customer) continue;
      
      try {
        if (messageChannel === 'whatsapp') {
          const caption = `${bulkMessage}\n\n${companyName}`;

          // CASE 1: Android Nativo (APK) - Nova Integração WhatsApp Nível Premium
          if (isNativeWA) {
            try {
              const NativeWA = window.Capacitor.Plugins.NativeWhatsApp;
              
              await NativeWA.shareWithAttachment({
                phoneNumber: phone,
                message: caption,
                base64Image: globalBase64Content,
                appPackage: globalSelectedApp
              });
              
              successCount++;
              
              // Se há mais clientes para processar, perguntamos ao utilizador se envia o próximo
              const isLastClient = phone === selectedClients[selectedClients.length - 1];
              if (!isLastClient) {
                const proceed = window.confirm(`Mensagem preparada no WhatsApp.\n\nDepois de a enviar, certifique-se que voltou à Gestão de Fila.\n\nClique OK para preparar/disparar o envio para o PRÓXIMO cliente.`);
                if (!proceed) {
                  // Aborta o ciclo para não enviar aos restantes
                  break; 
                }
              }
              continue;
            } catch (nativeErr) {
              console.warn('Erro na partilha nativa APK Custom:', nativeErr);
              // Fallback para wa.me continuará em baixo...
            }
          }

          // CASE 2: Android Antigo ou Fallback PWA Share...

          let sharedViaPWA = false;
          if (marketingImageUrl && navigator.share) {
            try {
              const response = await fetch(marketingImageUrl);
              const blob = await response.blob();
              const file = new File([blob], 'promocao.jpg', { type: blob.type });
              
              if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                  files: [file],
                  title: 'Campanha de Marketing',
                  text: caption
                });
                successCount++;
                sharedViaPWA = true;
              }
            } catch (pwaErr) {
              console.warn('Erro na partilha PWA:', pwaErr);
              // Fallback para wa.me continuará
            }
          }

          // CASE 3: Desktop ou Fallback (wa.me) - Link apenas
          if (!sharedViaPWA) {
            let cleanPhone = phone.replace(/\s+/g, '').replace('+', '');
            if (cleanPhone.length === 9) cleanPhone = `351${cleanPhone}`;
            
            const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            if (isMobile) {
              // Protocolo direto para abrir a APP nativa sem abas intermédias
              window.location.href = `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(finalMsg)}`;
            } else {
              // Fallback para Desktop
              const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(finalMsg)}`;
              window.open(waUrl, '_blank');
            }
            successCount++;
          }

          // Pausa sequencial para o PWA / Desktop (igual ao nativo)
          const isLastClient = phone === selectedClients[selectedClients.length - 1];
          if (!isLastClient) {
            const proceed = window.confirm(`Mensagem preparada.\n\nDepois de a enviar no WhatsApp, certifique-se que voltou a esta janela da Gestão de Fila.\n\nClique OK para preparar e abrir o PRÓXIMO cliente.`);
            if (!proceed) break;
          }
        } else {
          // Canal SMS
          if (smsMethod === 'twilio') {
            const baseUrl = (supabaseUrl || '').replace(/\/$/, '');
            const targetUrl = `${baseUrl}/functions/v1/send-sms`;
            const resp = await fetch(targetUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': supabaseAnonKey },
              body: JSON.stringify({ to: phone, name: customer.first_name, content: finalMsg })
            });
            if (resp.ok) successCount++; else failCount++;
          } else if (smsMethod === 'native' && Capacitor.isNativePlatform() && NativeSms) {
            await NativeSms.send({ phoneNumber: phone, message: finalMsg });
            successCount++;
          } else {
            const smsUrl = `sms:${phone}?body=${encodeURIComponent(finalMsg)}`;
            window.open(smsUrl, '_blank');
            successCount++;
          }
        }
      } catch (err) {
        console.error(`Erro ao enviar para ${phone}:`, err);
        failCount++;
      }
    }

    setLoading(false);
    setSelectedClients([]);
    setBulkMessage('');
    setMarketingImage(null);
    setMarketingImageUrl(null);
    alert(`Processo concluído: ${successCount} envios processados.`);
  };

  const toggleClientSelection = (phone) => {
    setSelectedClients(prev => 
      prev.includes(phone) ? prev.filter(p => p !== phone) : [...prev, phone]
    );
  };

  const toggleSelectAll = () => {
    const allPhones = getUniqueCustomers().map(c => c.phone_number);
    if (selectedClients.length === allPhones.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(allPhones);
    }
  };

  const handleLogoUpload = async (e) => {

    const file = e.target.files[0];
    if (!file || !companyId) return;

    try {
        setLoading(true);
        const fileExt = file.name.split('.').pop();
        const fileName = `${companyId}/logo.${fileExt}`;
        const filePath = `${fileName}`;

        // 1. Upload da imagem para o bucket 'logos' (o bucket deve ser criado no Supabase primeiro)
        const { error: uploadError } = await supabase.storage
            .from('logos')
            .upload(filePath, file, { upsert: true });

        if (uploadError) throw uploadError;

        // 2. Obter URL pública
        const { data: { publicUrl } } = supabase.storage
            .from('logos')
            .getPublicUrl(filePath);

        // 3. Atualizar a tabela companies com a URL
        const { error: updateError } = await supabase
            .from('companies')
            .update({ logo_url: publicUrl })
            .eq('id', companyId);

        if (updateError) throw updateError;

        setLogoUrl(publicUrl);
        alert('Logótipo atualizado com sucesso!');
    } catch (err) {
        console.error('Erro no upload:', err);
        alert('Erro ao carregar logótipo: Certifique-se que criou o bucket "logos" no Supabase e que o definiu como Público.');
    } finally {
        setLoading(false);
    }
  };

  const handleClosingTimeChange = async (e) => {
    const newTime = e.target.value;
    setClosingTime(newTime);
    try {
      await supabase.from('companies').update({ closing_time: newTime }).eq('id', companyId);
    } catch (err) {
      console.error(err);
    }
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
    try {
      await supabase.auth.signOut();
      localStorage.clear(); // Limpar caches de quiosque e sessões locais
      setSession(null);
      setCompanyId(null);
      setCustomers([]);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const getUniqueCustomers = () => {
    // Agora utilizamos o estado global 'allClients' para o CRM
    const dataSource = viewMode === 'clients' ? allClients : customers;
    const sorted = [...dataSource].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
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

  // Se está em modo quiosque, renderizar apenas o quiosque
  if (kioskMode && session && companyId) {
    return (
      <KioskMode
        companyId={companyId}
        companyName={companyName}
        userEmail={session.email}
        onExit={() => handleSetKioskMode(false)}
      />
    );
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
      <div className="sticky-header-wrapper">
        {/* Header */}
        <header className="header">
          <div className="logo-section">
            <div className="logo-icon" style={{ padding: logoUrl ? '0' : '0.5rem', overflow: 'hidden' }}>
              {logoUrl ? (
                  <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                  <Users size={24} />
              )}
            </div>
            <div>
              <h1 style={{ fontSize: '1.4rem', margin: 0 }}>{companyName} <span style={{ fontSize: '0.6rem', verticalAlign: 'middle', opacity: 0.5 }}>v2</span></h1>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Gestão de Fila Inteligente</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => setShowModal(true)} style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Plus size={20} /> <span className="hide-mobile">Nova Reserva</span>
            </button>
            
            <button className={`btn ${viewMode === 'queue' ? 'btn-primary' : ''}`} onClick={() => setViewMode('queue')} style={{ background: viewMode === 'queue' ? '' : 'rgba(255,255,255,0.2)', color: 'white', border: viewMode === 'queue' ? 'none' : '1px solid rgba(255,255,255,0.1)' }}>
              Fila Atual
            </button>
            
            <button className={`btn ${viewMode === 'clients' ? 'btn-primary' : ''}`} onClick={() => setViewMode('clients')} style={{ background: viewMode === 'clients' ? '' : 'rgba(255,255,255,0.2)', color: 'white', border: viewMode === 'clients' ? 'none' : '1px solid rgba(255,255,255,0.1)' }}>
              Clientes
            </button>
            
            <button className={`btn ${viewMode === 'history' ? 'btn-primary' : ''}`} onClick={() => setViewMode('history')} style={{ background: viewMode === 'history' ? '' : 'rgba(255,255,255,0.2)', color: 'white', border: viewMode === 'history' ? 'none' : '1px solid rgba(255,255,255,0.1)' }}>
              Histórico
            </button>

            <button className="btn" onClick={() => handleSetKioskMode(true)} style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }} title="Modo Tablet">
              <Tablet size={18} /> Quiosque
            </button>
            
            <button className={`btn ${viewMode === 'settings' ? 'btn-primary' : ''}`} onClick={() => setViewMode('settings')} style={{ background: viewMode === 'settings' ? '' : 'rgba(255,255,255,0.2)', color: 'white', border: viewMode === 'settings' ? 'none' : '1px solid rgba(255,255,255,0.1)' }}>
              <Settings size={20} />
            </button>
            
            <button className="btn-icon" onClick={handleLogout} title="Terminar Sessão" style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {/* Stats Overview - Agora visível e sticky apenas na Fila Atual no Desktop, oculto se o modal estiver aberto */}
        {viewMode === 'queue' && !showModal && (
          <div className="stats-grid" style={{ marginTop: '1.5rem', marginBottom: '0' }}>
            <div 
              className="glass" 
              style={{ 
                padding: '1.25rem', 
                cursor: 'pointer',
                border: statusFilter === 'waiting' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                boxShadow: statusFilter === 'waiting' ? '0 0 15px rgba(99, 102, 241, 0.2)' : 'none',
                transform: statusFilter === 'waiting' ? 'translateY(-2px)' : 'none',
                transition: 'all 0.2s ease'
              }}
              onClick={() => setStatusFilter(prev => prev === 'waiting' ? null : 'waiting')}
            >
              <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Em Espera</p>
              <p style={{ fontSize: '1.75rem', fontWeight: '700' }}>{customers.filter(c => c.status === 'waiting').length}</p>
            </div>
            <div 
              className="glass" 
              style={{ 
                padding: '1.25rem', 
                cursor: 'pointer',
                border: statusFilter === 'notified' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                boxShadow: statusFilter === 'notified' ? '0 0 15px rgba(99, 102, 241, 0.2)' : 'none',
                transform: statusFilter === 'notified' ? 'translateY(-2px)' : 'none',
                transition: 'all 0.2s ease'
              }}
              onClick={() => setStatusFilter(prev => prev === 'notified' ? null : 'notified')}
            >
              <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Notificados</p>
              <p style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--primary)' }}>{customers.filter(c => c.status === 'notified').length}</p>
            </div>
            <div 
              className="glass" 
              style={{ 
                padding: '1.25rem', 
                cursor: 'pointer',
                border: statusFilter === 'seated' ? '1px solid var(--success)' : '1px solid var(--border-color)',
                boxShadow: statusFilter === 'seated' ? '0 0 15px rgba(16, 185, 129, 0.2)' : 'none',
                transform: statusFilter === 'seated' ? 'translateY(-2px)' : 'none',
                transition: 'all 0.2s ease'
              }}
              onClick={() => setStatusFilter(prev => prev === 'seated' ? null : 'seated')}
            >
              <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Sentados Hoje</p>
              <p style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--success)' }}>{customers.filter(c => c.status === 'seated').length}</p>
            </div>
          </div>
        )}
      </div>

      {viewMode === 'settings' && (
        <SettingsPanel
          companyId={companyId}
          logoUrl={logoUrl}
          handleLogoUpload={handleLogoUpload}
          smsMethod={smsMethod}
          handleSmsMethodChange={handleSmsMethodChange}
          closingTime={closingTime}
          handleClosingTimeChange={handleClosingTimeChange}
        />
      )}

      {viewMode === 'clients' && (
        <div className="glass" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Users className="text-primary" /> Carteira de Clientes ({getUniqueCustomers().length})
            </h2>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                className="btn" 
                onClick={toggleSelectAll}
                style={{ background: 'rgba(255,255,255,0.1)', fontSize: '0.85rem', padding: '0.5rem 1rem' }}
              >
                {selectedClients.length === getUniqueCustomers().length ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </button>
            </div>
          </div>

          {/* Bulk Messaging Panel / Modal Cliente */}
          {showClientMessageModal && (
            <div className="modal-overlay">
              <div className="glass modal-content" style={{ maxWidth: '600px', width: '90%', padding: '2rem' }}>
          <div style={{ background: 'transparent', border: 'none', padding: '0', marginBottom: '0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--primary)', fontSize: '1.1rem' }}>
                <Send size={18} /> Campanhas de Marketing
              </h4>
              
              <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '0.25rem', borderRadius: '0.75rem' }}>
                <button 
                  onClick={() => setMessageChannel('sms')}
                  style={{ 
                    padding: '0.5rem 1rem', 
                    borderRadius: '0.6rem', 
                    border: 'none', 
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    background: messageChannel === 'sms' ? 'var(--primary)' : 'transparent',
                    color: 'white',
                    transition: 'all 0.2s'
                  }}
                >
                  SMS
                </button>
                <button 
                  onClick={() => setMessageChannel('whatsapp')}
                  style={{ 
                    padding: '0.5rem 1rem', 
                    borderRadius: '0.6rem', 
                    border: 'none', 
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    background: messageChannel === 'whatsapp' ? 'var(--success)' : 'transparent',
                    color: 'white',
                    transition: 'all 0.2s'
                  }}
                >
                  WhatsApp
                </button>
              </div>
            </div>

            <textarea
              className="form-input"
              placeholder={messageChannel === 'sms' 
                ? "Escreva a SMS de marketing... (Texto apenas)" 
                : "Escreva a mensagem de WhatsApp... (Pode incluir link de imagem)"}
              style={{ minHeight: '120px', marginBottom: '1rem', background: 'rgba(0,0,0,0.2)', fontSize: '1rem' }}
              value={bulkMessage}
              onChange={(e) => setBulkMessage(e.target.value)}
            />

            {messageChannel === 'whatsapp' && (
              <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '1rem', border: '1px dashed rgba(16, 185, 129, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button 
                    className="btn" 
                    onClick={() => document.getElementById('mkt-image-input').click()}
                    style={{ background: 'rgba(255,255,255,0.1)', fontSize: '0.85rem' }}
                    disabled={isUploadingImage}
                  >
                    <Image size={18} /> {isUploadingImage ? 'A carregar...' : marketingImage ? 'Trocar Imagem' : 'Anexar Imagem'}
                  </button>
                  <input 
                    id="mkt-image-input"
                    type="file" 
                    accept="image/*" 
                    hidden 
                    onChange={handleMarketingImageUpload} 
                  />
                  {marketingImage && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--success)' }}>✓ {marketingImage.name}</span>
                      <button 
                        onClick={() => { setMarketingImage(null); setMarketingImageUrl(null); }}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  A imagem será enviada como um link no WhatsApp para poupar custos de gateway.
                </p>
              </div>
            )}

            {messageChannel === 'sms' && marketingImage && (
              <p style={{ color: 'var(--warning)', fontSize: '0.8rem', marginBottom: '1rem' }}>
                ⚠️ A imagem anexada será ignorada no canal SMS.
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-dim)', fontWeight: 500 }}>
                {selectedClients.length} cliente(s) selecionado(s)
              </p>
              <button 
                className="btn" 
                onClick={handleSendBulkSMS}
                disabled={selectedClients.length === 0 || !bulkMessage.trim() || isUploadingImage}
                style={{ 
                  background: (selectedClients.length === 0 || !bulkMessage.trim()) ? 'rgba(255,255,255,0.1)' : (messageChannel === 'whatsapp' ? 'var(--success)' : 'var(--primary)'),
                  color: 'white',
                  padding: '0.8rem 1.5rem'
                }}
              >
                {messageChannel === 'whatsapp' ? <><MessageSquare size={18} /> Enviar WhatsApp</> : <><Send size={18} /> Enviar SMS</>}
              </button>
            </div>
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
               <button className="btn" onClick={() => setShowClientMessageModal(false)} style={{ background: 'rgba(255,255,255,0.1)', padding: '0.5rem 2rem' }}>Cancelar / Fechar</button>
            </div>
          </div>
          </div>
          </div>
          )}

          {/* FAB for open Messaging Modal */}
          <button 
            onClick={() => setShowClientMessageModal(true)} 
            style={{ 
              position: 'fixed', 
              bottom: '2rem', 
              right: '2rem', 
              zIndex: 900, 
              padding: '1.2rem', 
              borderRadius: '50%', 
              background: 'var(--success)', 
              color: 'white', 
              boxShadow: '0 8px 16px rgba(0,0,0,0.4)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.2s ease'
            }}
            title="Enviar WhatsApp"
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <MessageSquare size={26} />
            {selectedClients.length > 0 && (
              <span style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'var(--danger)', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>
                {selectedClients.length}
              </span>
            )}
          </button>


          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {clientsLoading ? (
              <p style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>A carregar carteira de clientes global...</p>
            ) : getUniqueCustomers().length === 0 ? (
              <p style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>Sem clientes registados na base de dados.</p>
            ) : (
              getUniqueCustomers().map((c) => (
                <div key={c.phone_number} style={{ display: 'flex', alignItems: 'center', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.75rem', gap: '1rem' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedClients.includes(c.phone_number)}
                    onChange={() => toggleClientSelection(c.phone_number)}
                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                  />
                  
                  <div style={{ flex: 1 }}>
                    {editingClient?.phone_number === c.phone_number ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem' }}>
                        <input 
                          className="form-input" 
                          style={{ padding: '0.6rem' }} 
                          placeholder="Primeiro Nome"
                          value={editFormData.firstName} 
                          onChange={(e) => setEditFormData({...editFormData, firstName: e.target.value})}
                        />
                        <input 
                          className="form-input" 
                          style={{ padding: '0.6rem' }} 
                          placeholder="Último Nome"
                          value={editFormData.lastName} 
                          onChange={(e) => setEditFormData({...editFormData, lastName: e.target.value})}
                        />
                        <input 
                          className="form-input" 
                          style={{ padding: '0.6rem' }} 
                          placeholder="Telemóvel"
                          value={editFormData.phone} 
                          onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                        />
                      </div>
                    ) : (
                      <>
                        <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{c.first_name} {c.last_name}</h3>
                        <p style={{ color: 'var(--text-dim)', margin: 0, marginTop: '0.25rem', fontWeight: 600 }}>{c.phone_number}</p>
                      </>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {editingClient?.phone_number === c.phone_number ? (
                      <>
                        <button className="btn-icon success" onClick={handleUpdateClient} title="Guardar">
                          <Check size={18} />
                        </button>
                        <button className="btn-icon danger" onClick={() => setEditingClient(null)} title="Cancelar">
                          <X size={18} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn-icon primary" onClick={() => startEditing(c)} title="Editar">
                          <Edit3 size={18} />
                        </button>
                        <button className="btn-icon danger" onClick={() => handleDeleteClient(c.phone_number)} title="Eliminar Histórico">
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {viewMode === 'history' && (
        <div className="glass" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Clock className="text-primary" /> Histórico Global
            </h2>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Pesquisar por nome..." 
                  style={{ paddingLeft: '2.5rem', width: '250px' }}
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                />
              </div>
              <input 
                type="date" 
                className="form-input" 
                value={historyDateFilter}
                onChange={(e) => setHistoryDateFilter(e.target.value)}
                style={{ width: '180px' }}
              />
              <button 
                className="btn" 
                onClick={() => { setHistorySearch(''); setHistoryDateFilter(''); }}
                style={{ background: 'rgba(255,255,255,0.1)' }}
              >
                Limpar
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 0.5rem' }}>
              <thead>
                <tr style={{ color: 'var(--text-dim)', textAlign: 'left', fontSize: '0.9rem' }}>
                  <th style={{ padding: '1rem' }}>Cliente</th>
                  <th style={{ padding: '1rem' }}>Telemóvel</th>
                  <th style={{ padding: '1rem', textAlign: 'center' }}>PAX</th>
                  <th style={{ padding: '1rem' }}>Data/Hora Chegada</th>
                  <th style={{ padding: '1rem' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '3rem' }}>A carregar histórico...</td>
                  </tr>
                ) : historyData.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '3rem' }}>Nenhum registo encontrado.</td>
                  </tr>
                ) : (
                  historyData.map((c) => (
                    <tr key={c.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '0.75rem' }}>
                      <td style={{ padding: '1rem', fontWeight: 600, borderTopLeftRadius: '0.75rem', borderBottomLeftRadius: '0.75rem' }}>
                        {c.first_name} {c.last_name}
                      </td>
                      <td style={{ padding: '1rem' }}>{c.phone_number}</td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                          <span title="Adultos"><Users size={14} style={{ verticalAlign: 'middle', marginRight: '2px' }} /> {c.adults}</span>
                          {c.children > 0 && <span title="Crianças"><Baby size={14} style={{ verticalAlign: 'middle', marginRight: '2px' }} /> {c.children}</span>}
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {new Date(c.created_at).toLocaleDateString()} {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '1rem', borderTopRightRadius: '0.75rem', borderBottomRightRadius: '0.75rem' }}>
                        <span className={`status-badge status-${c.status}`} style={{ fontSize: '0.65rem' }}>
                          {c.status === 'waiting' ? 'Em Espera' : c.status === 'notified' ? 'Notificado' : c.status === 'seated' ? 'Sentado' : 'Cancelado'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewMode === 'queue' && (
      <>
      {/* Queue Grid */}
      {loading ? (
        <p style={{ textAlign: 'center', color: "var(--text-dim)" }}>A carregar fila...</p>
      ) : (
        <div className="queue-grid">
          {(() => {
            const items = customers.filter(c => {
              if (statusFilter) return c.status === statusFilter;
              return c.status !== 'seated' && c.status !== 'cancelled';
            });
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
                <div key={customer.id} className="glass customer-card">
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
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-icon primary" onClick={() => sendSMS(customer)} title="Enviar Notificação">
                    <Send size={18} />
                  </button>
                  <button className="btn-icon success" onClick={() => updateStatus(customer.id, 'seated')} title="Marcar como Sentado">
                    <CheckCircle2 size={18} />
                  </button>
                  <button className="btn-icon danger" onClick={() => updateStatus(customer.id, 'cancelled')} title="Cancelar">
                    <XCircle size={18} />
                  </button>
                </div>
              </div>
              
              <div className="customer-meta">
                <div className="meta-item">
                  <Baby size={16} />
                  <span>{customer.adults} adultos, {customer.children} crianças</span>
                </div>
                <div className="meta-item">
                  <Clock size={16} />
                  <span>Chegada: {formatArrival(customer.created_at || customer.arrival_time)}</span>
                </div>
              </div>

              <div className="card-actions">
                <button className="btn-icon" onClick={() => {
                  const msg = `sms:${customer.phone_number}?body=${encodeURIComponent(`Olá ${customer.first_name}, a sua mesa está pronta!`)}`;
                  window.location.href = msg;
                }} title="Mensagem Direta">
                  <Link size={18} />
                </button>
              </div>
            </div>
          ));
          })()}
        </div>
      )}
      </>
      )}

      {/* Registration Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="glass modal-content">
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <UserPlus className="text-primary" /> Nova Reserva
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Telemóvel</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="912 345 678"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    onBlur={handlePhoneBlur}
                  />
                  <Search size={18} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Primeiro Nome</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Último Nome</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, adults: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, children: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitting}>
                  {submitting ? 'A registar...' : 'Adicionar à Fila'}
                </button>
                <button type="button" className="btn" style={{ background: 'rgba(255,255,255,0.1)' }} onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* App Picker Modal (WhatsApp vs Business) */}
      {showAppPicker && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="glass modal-content" style={{ maxWidth: '350px', textAlign: 'center' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Qual WhatsApp abrir?</h3>
            <p style={{ color: 'var(--text-dim)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Foram detetadas as duas versões no dispositivo.
            </p>
            <div style={{ display: 'grid', gap: '1rem' }}>
               <button 
                  className="btn btn-primary" 
                  onClick={() => {
                    appPickerResolve('com.whatsapp');
                    setShowAppPicker(false);
                  }}
               >
                  WhatsApp Pessoal
               </button>
               <button 
                  className="btn" 
                  style={{ background: 'var(--success)', color: 'white' }}
                  onClick={() => {
                    appPickerResolve('com.whatsapp.w4b');
                    setShowAppPicker(false);
                  }}
               >
                  WhatsApp Business
               </button>
               <button 
                  className="btn" 
                  style={{ background: 'rgba(255,255,255,0.1)', marginTop: '0.5rem' }}
                  onClick={() => {
                    appPickerResolve(null);
                    setShowAppPicker(false);
                  }}
               >
                  Cancelar
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
