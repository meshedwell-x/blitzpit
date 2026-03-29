import { SkinSystem } from '../../game/shop/SkinSystem';

const BLITZPIT_API = 'https://blitzpit-api.meshedwell.workers.dev';

export type ShopTab = 'welcome' | 'crates' | 'skins' | 'weapons' | 'vehicles' | 'effects' | 'utility' | 'coins';

export interface ShopTabProps {
  skinSystem: SkinSystem;
  refresh: () => void;
  onSkinChange?: () => void;
}

// Military rarity bar colors
export const RARITY_BAR: Record<string, string> = {
  common: '#6b7b6a',
  uncommon: '#4a6741',
  rare: '#c4a35a',
  epic: '#d4a24e',
  legendary: '#c93a3a',
};

export const TAB_LABELS: Record<ShopTab, string> = {
  welcome: 'WELCOME',
  crates: 'CRATES',
  skins: 'SKINS',
  weapons: 'WEAPONS',
  vehicles: 'VEHICLES',
  effects: 'EFFECTS',
  utility: 'UTILITY',
  coins: 'BLITZ COINS',
};

export async function stripeCheckout(packId: string): Promise<void> {
  try {
    const res = await fetch(`${BLITZPIT_API}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        packId,
        successUrl: window.location.origin + window.location.pathname,
        cancelUrl: window.location.origin + window.location.pathname,
      }),
    });
    const data = await res.json() as { url?: string; error?: string };
    if (data.url) {
      window.location.href = data.url;
    } else {
      console.error('Stripe checkout error:', data.error);
    }
  } catch (err) {
    console.error('Checkout failed:', err);
  }
}
