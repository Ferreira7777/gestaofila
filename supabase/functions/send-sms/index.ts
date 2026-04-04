const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, content } = await req.json();
    
    // Novas Variáveis para o EasySendSMS (Secrets)
    const apiKey = (Deno.env.get('EASYSEND_API_KEY') || '').trim();
    const fromName = (Deno.env.get('EASYSEND_FROM') || 'GESTAOFILA').trim();

    if (!apiKey) {
      throw new Error("Falta o segredo EASYSEND_API_KEY no Supabase.");
    }

    // FORMATADOR: O EasySendSMS quer o número internacional LIMPO (Ex: 351960000000)
    let cleanTo = (to || '').trim().replace(/\s/g, '').replace('+', '');
    
    // Se for um número PT de 9 dígitos sem prefixo, adiciona 351
    if (cleanTo.length === 9 && (cleanTo.startsWith('9') || cleanTo.startsWith('2'))) {
      cleanTo = `351${cleanTo}`;
    }

    console.log(`A enviar pedido para EasySendSMS para o número ${cleanTo}...`);

    const response = await fetch(`https://restapi.easysendsms.app/v1/rest/sms/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        from: fromName,
        to: cleanTo,
        text: content,
        type: 0 // 0 = Texto Normal (GSM), 1 = Unicode
      })
    });

    const data = await response.json();
    console.log(`Resposta do EasySendSMS (Status ${response.status}):`, JSON.stringify(data));

    if (!response.ok) {
      throw new Error(data.message || 'Erro ao comunicar com o EasySendSMS.')
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error(`ERRO NA EDGE FUNCTION: ${error.message}`);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
