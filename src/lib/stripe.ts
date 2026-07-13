import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

export const VAT_RATE = 0.25;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = import.meta.env.STRIPE_SECRET_KEY;

    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not set in environment variables.');
    }

    stripeInstance = new Stripe(key, { apiVersion: '2024-12-18.acacia' });
  }

  return stripeInstance;
}

export function toGrossOre(priceExVatOre: number): number {
  return Math.round(priceExVatOre * (1 + VAT_RATE));
}

// Product price map (prices in DKK ore excl. VAT)
export const PRODUCTS: Record<string, { name: string; price: number }> = {
  'bare-fordi': { name: 'Saesonens blomster - hojluftig', price: 28000 },
  'velkommen-tilbage': { name: 'Saesonens blomster - kompakt', price: 28000 },
  tillykke: { name: 'Tillykke!', price: 28000 },
  kaerlighed: { name: 'Lyserod elegance', price: 28000 },
  'saeson-kompakt': { name: 'Kaerlighed', price: 30000 },
  'saeson-hojluftig': { name: 'Hvid harmoni', price: 28000 },
};
