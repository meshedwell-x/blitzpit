interface Env {
  STRIPE_SECRET_KEY: string;
  DB: D1Database;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// -- GeoRestriction: Block P2E features for KR users --
const BLOCKED_COUNTRIES = ['KR'];

function isBlocked(request: Request): boolean {
  const cf = (request as unknown as { cf?: { country?: string } }).cf;
  const country = cf?.country ?? '';
  return BLOCKED_COUNTRIES.includes(country);
}

function getCountry(request: Request): string {
  const cf = (request as unknown as { cf?: { country?: string } }).cf;
  return cf?.country ?? 'unknown';
}

// -- Coin Packs --
const PACKS: Record<string, { name: string; amountINR: number; coins: number; bonus: number; usd: number }> = {
  pack_29:  { name: 'BLITZPIT Small Crate - 300 Game Coins',       amountINR: 4900,  coins: 300,  bonus: 0,    usd: 0.59 },
  pack_79:  { name: 'BLITZPIT Supply Box - 1000 Game Coins',      amountINR: 7900,  coins: 900,  bonus: 100,  usd: 0.95 },
  pack_149: { name: 'BLITZPIT Airdrop - 2300 Game Coins',         amountINR: 14900, coins: 2000, bonus: 300,  usd: 1.79 },
  pack_299: { name: 'BLITZPIT War Chest - 5500 Game Coins',       amountINR: 29900, coins: 4500, bonus: 1000, usd: 3.59 },
  pack_499: { name: 'BLITZPIT Arsenal - 10500 Game Coins',        amountINR: 49900, coins: 8000, bonus: 2500, usd: 5.99 },
  welcome:  { name: 'BLITZPIT Welcome Pack - VIP + 500 Coins',    amountINR: 4900,  coins: 500,  bonus: 0,    usd: 0.59 },
  daily_boost: { name: 'BLITZPIT Daily Boost - 200 Coins + 2x XP', amountINR: 4900,  coins: 200,  bonus: 0,    usd: 0.59 },
};

// -- Tournament Entry Fees (USD cents for Stripe) --
// Prizes are awarded as in-game coins only (no monetary payouts)
const TOURNAMENT_FEES: Record<string, { usdCents: number; usd: number; coinPrizePool: number }> = {
  bronze:  { usdCents: 50,   usd: 0.50, coinPrizePool: 5000 },
  silver:  { usdCents: 200,  usd: 2.00, coinPrizePool: 25000 },
  gold:    { usdCents: 500,  usd: 5.00, coinPrizePool: 75000 },
  diamond: { usdCents: 1000, usd: 10.00, coinPrizePool: 200000 },
};

// -- Current Season --
function getCurrentSeasonId(): string {
  const now = new Date();
  return `S${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// -- Generate tournament ID --
function genTournamentId(tier: string): string {
  const d = new Date();
  const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `T_${tier}_${dateStr}`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // -- Existing endpoints --
    if (path === '/api/checkout' && request.method === 'POST') {
      return handleCheckout(request, env);
    }
    if (path === '/api/verify' && request.method === 'GET') {
      return handleVerify(request, env);
    }

    // -- Arena Status (GeoRestriction check) --
    if (path === '/api/arena/status' && request.method === 'GET') {
      const country = getCountry(request);
      const blocked = BLOCKED_COUNTRIES.includes(country);
      return jsonResponse({
        enabled: !blocked,
        country,
        reason: blocked ? 'P2E Arena is not available in South Korea due to local regulations.' : undefined,
      });
    }

    // -- Tournament endpoints (blocked for KR) --
    if (path === '/api/tournament/active' && request.method === 'GET') {
      return handleTournamentActive(request, env);
    }
    if (path === '/api/tournament/join' && request.method === 'POST') {
      if (isBlocked(request)) {
        return jsonResponse({ error: 'Arena not available in your region' }, 403);
      }
      return handleTournamentJoin(request, env);
    }
    if (path === '/api/tournament/score' && request.method === 'POST') {
      return handleTournamentScore(request, env);
    }
    if (path === '/api/tournament/results' && request.method === 'GET') {
      return handleTournamentResults(request, env);
    }

    // -- Leaderboard endpoints --
    if (path === '/api/leaderboard' && request.method === 'GET') {
      return handleLeaderboard(request, env);
    }
    if (path === '/api/leaderboard/score' && request.method === 'POST') {
      return handleLeaderboardScore(request, env);
    }

    // -- Auto-create daily tournaments (cron or manual) --
    if (path === '/api/tournament/auto-create' && request.method === 'POST') {
      return handleAutoCreateTournaments(env);
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },

  // Scheduled handler for auto-creating daily tournaments
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await autoCreateDailyTournaments(env);
  },
};

// ========== CHECKOUT ==========

async function handleCheckout(request: Request, env: Env): Promise<Response> {
  let body: { packId: string; successUrl: string; cancelUrl: string };
  try {
    body = await request.json() as { packId: string; successUrl: string; cancelUrl: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const pack = PACKS[body.packId];
  if (!pack) {
    return jsonResponse({ error: 'Invalid pack' }, 400);
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
  params.append('metadata[usd]', pack.usd.toString());

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
    return jsonResponse({ error: session.error?.message ?? 'Stripe error' }, 500);
  }

  return jsonResponse({ url: session.url, sessionId: session.id });
}

// ========== VERIFY ==========

async function handleVerify(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');

  if (!sessionId) {
    return jsonResponse({ error: 'Missing session_id' }, 400);
  }

  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: {
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
    },
  });

  const session = await response.json() as {
    payment_status?: string;
    metadata?: { pack_id?: string; coins?: string; usd?: string };
    error?: { message: string };
  };

  if (!response.ok) {
    return jsonResponse({ error: session.error?.message ?? 'Stripe error' }, 500);
  }

  if (session.payment_status === 'paid') {
    // Track spending in user_tiers if we have userId
    const usd = parseFloat(session.metadata?.usd ?? '0');
    if (usd > 0) {
      // We'll track this client-side via SkinSystem.addSpending()
    }

    return jsonResponse({
      success: true,
      packId: session.metadata?.pack_id ?? '',
      coins: parseInt(session.metadata?.coins ?? '0', 10),
      usd,
    });
  }

  return jsonResponse({ success: false });
}

// ========== TOURNAMENT: ACTIVE ==========

async function handleTournamentActive(_request: Request, env: Env): Promise<Response> {
  try {
    const now = Date.now();
    const result = await env.DB.prepare(
      `SELECT id, tier, entry_fee, prize_pool, start_time, end_time, status,
       (SELECT COUNT(*) FROM tournament_entries WHERE tournament_id = tournaments.id) as entry_count
       FROM tournaments
       WHERE (status = 'active' AND end_time > ?) OR (status = 'completed' AND end_time > ? - 86400000)
       ORDER BY start_time DESC`
    ).bind(now, now).all();

    const tournaments = (result.results || []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      tier: r.tier as string,
      entryFee: r.entry_fee as number,
      prizePool: r.prize_pool as number,
      startTime: r.start_time as number,
      endTime: r.end_time as number,
      entryCount: r.entry_count as number,
      status: r.status as string,
    }));

    return jsonResponse({ tournaments });
  } catch (err) {
    return jsonResponse({ tournaments: [], error: String(err) });
  }
}

// ========== TOURNAMENT: JOIN ==========

async function handleTournamentJoin(request: Request, env: Env): Promise<Response> {
  let body: { tournamentId: string; userId: string; email: string; successUrl: string; cancelUrl: string };
  try {
    body = await request.json() as { tournamentId: string; userId: string; email: string; successUrl: string; cancelUrl: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  // Check tournament exists and is active
  const tournament = await env.DB.prepare(
    'SELECT * FROM tournaments WHERE id = ? AND status = ?'
  ).bind(body.tournamentId, 'active').first() as Record<string, unknown> | null;

  if (!tournament) {
    return jsonResponse({ error: 'Tournament not found or not active' }, 404);
  }

  // Check if already joined
  const existing = await env.DB.prepare(
    'SELECT id FROM tournament_entries WHERE tournament_id = ? AND user_id = ?'
  ).bind(body.tournamentId, body.userId).first();

  if (existing) {
    return jsonResponse({ alreadyJoined: true });
  }

  const tier = tournament.tier as string;
  const fee = TOURNAMENT_FEES[tier];
  if (!fee) {
    return jsonResponse({ error: 'Invalid tournament tier' }, 400);
  }

  // Create Stripe checkout for entry fee
  const params = new URLSearchParams();
  params.append('mode', 'payment');
  params.append('success_url', body.successUrl + '?session_id={CHECKOUT_SESSION_ID}&tournament_id=' + body.tournamentId + '&tournament_join=1');
  params.append('cancel_url', body.cancelUrl);
  params.append('line_items[0][price_data][currency]', 'usd');
  params.append('line_items[0][price_data][unit_amount]', fee.usdCents.toString());
  params.append('line_items[0][price_data][product_data][name]', `BLITZPIT ${tier.toUpperCase()} League Pass - Game Coins Prize`);
  params.append('line_items[0][quantity]', '1');
  params.append('customer_email', body.email);
  params.append('metadata[tournament_id]', body.tournamentId);
  params.append('metadata[user_id]', body.userId);
  params.append('metadata[email]', body.email);
  params.append('metadata[type]', 'tournament_entry');

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
    return jsonResponse({ error: session.error?.message ?? 'Stripe error' }, 500);
  }

  // We'll register the entry when the payment is verified
  // For now, create a pending entry
  const entryId = `E_${body.userId}_${body.tournamentId}`;
  await env.DB.prepare(
    `INSERT OR IGNORE INTO tournament_entries (id, tournament_id, user_id, email, best_score, prize_won, paid, stripe_session)
     VALUES (?, ?, ?, ?, 0, 0, 0, ?)`
  ).bind(entryId, body.tournamentId, body.userId, body.email, session.id).run();

  return jsonResponse({ url: session.url, sessionId: session.id });
}

// ========== TOURNAMENT: SCORE ==========

async function handleTournamentScore(request: Request, env: Env): Promise<Response> {
  let body: { tournamentId: string; userId: string; score: number; wave: number; kills: number };
  try {
    body = await request.json() as { tournamentId: string; userId: string; score: number; wave: number; kills: number };
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  // Verify entry exists and is paid
  const entry = await env.DB.prepare(
    'SELECT * FROM tournament_entries WHERE tournament_id = ? AND user_id = ? AND paid = 1'
  ).bind(body.tournamentId, body.userId).first() as Record<string, unknown> | null;

  if (!entry) {
    // Try with unpaid (may have been created but payment pending)
    return jsonResponse({ success: false, error: 'Not registered or payment pending' });
  }

  // Update best score if higher
  const currentBest = (entry.best_score as number) || 0;
  if (body.score > currentBest) {
    await env.DB.prepare(
      'UPDATE tournament_entries SET best_score = ?, submitted_at = ? WHERE tournament_id = ? AND user_id = ?'
    ).bind(body.score, Date.now(), body.tournamentId, body.userId).run();
    return jsonResponse({ success: true, bestScore: body.score });
  }

  return jsonResponse({ success: true, bestScore: currentBest });
}

// ========== TOURNAMENT: RESULTS ==========

async function handleTournamentResults(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const tournamentId = url.searchParams.get('tournament_id');
  const userId = url.searchParams.get('user_id');

  if (!tournamentId) {
    return jsonResponse({ error: 'Missing tournament_id' }, 400);
  }

  const tournament = await env.DB.prepare(
    'SELECT * FROM tournaments WHERE id = ?'
  ).bind(tournamentId).first() as Record<string, unknown> | null;

  if (!tournament) {
    return jsonResponse({ error: 'Tournament not found' }, 404);
  }

  const entries = await env.DB.prepare(
    `SELECT user_id, best_score, prize_won FROM tournament_entries
     WHERE tournament_id = ? AND paid = 1
     ORDER BY best_score DESC`
  ).bind(tournamentId).all();

  const ranked = (entries.results || []).map((r: Record<string, unknown>, i: number) => ({
    userId: r.user_id as string,
    bestScore: r.best_score as number,
    rank: i + 1,
    prizeWon: r.prize_won as number,
  }));

  const myEntry = userId ? ranked.find(e => e.userId === userId) ?? null : null;

  return jsonResponse({
    tournament: {
      id: tournament.id,
      tier: tournament.tier,
      entryFee: tournament.entry_fee,
      prizePool: tournament.prize_pool,
      startTime: tournament.start_time,
      endTime: tournament.end_time,
      entryCount: ranked.length,
      status: tournament.status,
    },
    entries: ranked.slice(0, 20),
    myEntry,
  });
}

// ========== LEADERBOARD ==========

async function handleLeaderboard(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const seasonId = url.searchParams.get('season_id') || getCurrentSeasonId();

  try {
    const result = await env.DB.prepare(
      `SELECT user_id, name, best_wave, total_kills, score
       FROM season_scores
       WHERE season_id = ?
       ORDER BY score DESC
       LIMIT 100`
    ).bind(seasonId).all();

    const leaderboard = (result.results || []).map((r: Record<string, unknown>, i: number) => ({
      userId: r.user_id as string,
      name: r.name as string,
      bestWave: r.best_wave as number,
      totalKills: r.total_kills as number,
      score: r.score as number,
      rank: i + 1,
    }));

    return jsonResponse({ leaderboard, seasonId });
  } catch {
    return jsonResponse({ leaderboard: [], seasonId });
  }
}

async function handleLeaderboardScore(request: Request, env: Env): Promise<Response> {
  let body: { userId: string; name: string; wave: number; kills: number };
  try {
    body = await request.json() as { userId: string; name: string; wave: number; kills: number };
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const seasonId = getCurrentSeasonId();
  const score = body.wave * 1000 + body.kills;

  try {
    // Upsert: only update if new score is higher
    const existing = await env.DB.prepare(
      'SELECT score FROM season_scores WHERE user_id = ? AND season_id = ?'
    ).bind(body.userId, seasonId).first() as Record<string, unknown> | null;

    if (!existing) {
      await env.DB.prepare(
        `INSERT INTO season_scores (user_id, season_id, name, best_wave, total_kills, score, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(body.userId, seasonId, body.name, body.wave, body.kills, score, Date.now()).run();
    } else if (score > ((existing.score as number) || 0)) {
      await env.DB.prepare(
        `UPDATE season_scores SET name = ?, best_wave = ?, total_kills = ?, score = ?, updated_at = ?
         WHERE user_id = ? AND season_id = ?`
      ).bind(body.name, body.wave, body.kills, score, Date.now(), body.userId, seasonId).run();
    }

    return jsonResponse({ success: true });
  } catch {
    return jsonResponse({ success: false });
  }
}

// ========== AUTO-CREATE DAILY TOURNAMENTS ==========

async function autoCreateDailyTournaments(env: Env): Promise<void> {
  const tiers = ['bronze', 'silver', 'gold', 'diamond'] as const;
  const now = Date.now();
  const endTime = now + 24 * 60 * 60 * 1000; // 24 hours from now

  for (const tier of tiers) {
    const id = genTournamentId(tier);
    const fee = TOURNAMENT_FEES[tier];

    // Check if already exists
    const existing = await env.DB.prepare(
      'SELECT id FROM tournaments WHERE id = ?'
    ).bind(id).first();

    if (!existing) {
      await env.DB.prepare(
        `INSERT INTO tournaments (id, tier, entry_fee, prize_pool, start_time, end_time, status)
         VALUES (?, ?, ?, ?, ?, ?, 'active')`
      ).bind(id, tier, fee.usd, fee.coinPrizePool, now, endTime).run();
    }
  }

  // Complete expired tournaments and distribute in-game coin prizes
  const expired = await env.DB.prepare(
    `SELECT id, tier FROM tournaments WHERE status = 'active' AND end_time < ?`
  ).bind(now).all();

  for (const t of (expired.results || [])) {
    const tournamentId = t.id as string;
    const tier = t.tier as string;
    const coinPool = TOURNAMENT_FEES[tier]?.coinPrizePool ?? 5000;

    // Get top 3 entries
    const topEntries = await env.DB.prepare(
      `SELECT id, user_id, best_score FROM tournament_entries
       WHERE tournament_id = ? AND paid = 1
       ORDER BY best_score DESC LIMIT 3`
    ).bind(tournamentId).all();

    const entries = topEntries.results || [];
    // Prize split: 50% / 30% / 20% (in-game coins, not monetary)
    const splits = [0.50, 0.30, 0.20];
    for (let i = 0; i < Math.min(entries.length, 3); i++) {
      const coinPrize = Math.floor(coinPool * splits[i]);
      await env.DB.prepare(
        'UPDATE tournament_entries SET prize_won = ? WHERE id = ?'
      ).bind(coinPrize, entries[i].id).run();
    }

    await env.DB.prepare(
      `UPDATE tournaments SET status = 'completed' WHERE id = ?`
    ).bind(tournamentId).run();
  }
}

async function handleAutoCreateTournaments(env: Env): Promise<Response> {
  try {
    await autoCreateDailyTournaments(env);
    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

// Handle tournament join verification (called when user returns from Stripe)
// This is handled via the existing /api/verify endpoint + client-side logic
