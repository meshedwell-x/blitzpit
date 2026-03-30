// GA4 event tracking utility
// Replace G-PLACEHOLDER in layout.tsx with actual Measurement ID from Google Analytics console

export function trackEvent(event: string, params?: Record<string, string | number | boolean>): void {
  if (typeof window === 'undefined') return;
  const g = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof g === 'function') {
    g('event', event, params ?? {});
  }
}

// Predefined tracking calls for key game events
export const GA = {
  gameStart: () => trackEvent('game_start'),
  gameOver: (wave: number, kills: number, time: number) =>
    trackEvent('game_over', { wave, kills, time_seconds: Math.floor(time) }),
  shopOpen: () => trackEvent('shop_open'),
  arenaOpen: () => trackEvent('arena_open'),
  purchase: (itemId: string, coins: number) =>
    trackEvent('purchase', { item_id: itemId, virtual_currency_name: 'BC', value: coins }),
  tournamentJoin: (tier: string) =>
    trackEvent('tournament_join', { tier }),
  waveComplete: (wave: number, kills: number) =>
    trackEvent('wave_complete', { wave, kills }),
};
