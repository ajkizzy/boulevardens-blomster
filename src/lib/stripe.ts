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
  'bare-fordi': { name: 'Bare fordi...', price: 19900 },
  'velkommen-tilbage': { name: 'Velkommen tilbage!', price: 29900 },
  tillykke: { name: 'Tillykke!', price: 24900 },
  kaerlighed: { name: 'Kaerlighed', price: 29900 },
  'saeson-kompakt': { name: 'Saesonens blomster - kompakt', price: 24900 },
  'saeson-hojluftig': { name: 'Saesonens blomster - hojluftig', price: 24900 },
};
