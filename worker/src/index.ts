interface Env {
  STRIPE_SECRET_KEY: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const PACKS: Record<string, { name: string; amountINR: number; coins: number; bonus: number }> = {
  pack_29:  { name: 'Small Crate - 300 Blitz Coins',       amountINR: 4900,  coins: 300,  bonus: 0    },
  pack_79:  { name: 'Supply Box - 1000 Blitz Coins',      amountINR: 7900,  coins: 900,  bonus: 100  },
  pack_149: { name: 'Airdrop - 2300 Blitz Coins',         amountINR: 14900, coins: 2000, bonus: 300  },
  pack_299: { name: 'War Chest - 5500 Blitz Coins',       amountINR: 29900, coins: 4500, bonus: 1000 },
  pack_499: { name: 'Arsenal - 10500 Blitz Coins',        amountINR: 49900, coins: 8000, bonus: 2500 },
  welcome:  { name: 'Welcome Pack - VIP + 500 Coins',     amountINR: 4900,  coins: 500,  bonus: 0    },
  daily_boost: { name: 'Daily Boost - 200 BC + 2x XP',   amountINR: 4900,  coins: 200,  bonus: 0    },
  lucky_box:   { name: 'Lucky Box - Random Skin',         amountINR: 4900,  coins: 0,    bonus: 0    },
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (url.pathname === '/api/checkout' && request.method === 'POST') {
      return handleCheckout(request, env);
    }
    if (url.pathname === '/api/verify' && request.method === 'GET') {
      return handleVerify(request, env);
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};

async function handleCheckout(request: Request, env: Env): Promise<Response> {
  let body: { packId: string; successUrl: string; cancelUrl: string };
  try {
    body = await request.json() as { packId: string; successUrl: string; cancelUrl: string };
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const pack = PACKS[body.packId];
  if (!pack) {
    return new Response(JSON.stringify({ error: 'Invalid pack' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const params = new URLSearchParams();
  params.append('mode', 'payment');
  params.append('success_url', body.successUrl + '?session_id={CHECKOUT_SESSION_ID}&pack_id=' + body.packId);
  params.append('cancel_url', body.cancelUrl);
  params.append('line_items[0][price_data][currency]', 'inr');
  params.append('line_items[0][price_data][unit_amount]', pack.amountINR.toString());
  params.append('line_items[0][price_data][product_data][name]', pack.name);
  params.append('line_items[0][quantity]', '1');
  params.append('metadata[pack_id]', body.packId);
  params.append('metadata[coins]', (pack.coins + pack.bonus).toString());

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const session = await response.json() as { url?: string; id?: string; error?: { message: string } };

  if (!response.ok || !session.url) {
    return new Response(JSON.stringify({ error: session.error?.message ?? 'Stripe error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleVerify(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');

  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Missing session_id' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: {
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
    },
  });

  const session = await response.json() as {
    payment_status?: string;
    metadata?: { pack_id?: string; coins?: string };
    error?: { message: string };
  };

  if (!response.ok) {
    return new Response(JSON.stringify({ error: session.error?.message ?? 'Stripe error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (session.payment_status === 'paid') {
    return new Response(JSON.stringify({
      success: true,
      packId: session.metadata?.pack_id ?? '',
      coins: parseInt(session.metadata?.coins ?? '0', 10),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: false }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
