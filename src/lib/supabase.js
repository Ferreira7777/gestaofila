import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Android Nativo: sessionStorage → obriga login ao reabrir a app
// PWA / Browser: localStorage → mantém sessão persistente
const isNativePlatform = window.Capacitor?.isNativePlatform?.() || false;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isNativePlatform ? window.sessionStorage : window.localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});
