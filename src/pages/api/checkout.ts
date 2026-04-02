import type { APIRoute } from 'astro';
import type Stripe from 'stripe';
import type { Locale } from '@/lib/i18n';
import { getOrderPagePath, getRequestOrigin } from '@/lib/config';
import {
  serializeOrderItemsForMetadata,
  createOrderRecord,
  saveOrderRecord,
  sendCustomerOrderAcknowledgement,
  sendOwnerOrderNotification,
  type OrderRecordCustomer,
  type OrderRecordItem,
} from '@/lib/submissions';
import { getStripe, PRODUCTS, toGrossOre } from '@/lib/stripe';

export const prerender = false;

const ONLINE_PAYMENT_KEYWORDS = ['mobilepay', 'kort', 'card'];

interface CheckoutRequestLineItem {
  id: string;
  qty: number;
}

interface CheckoutRequestBody {
  lineItems?: CheckoutRequestLineItem[];
  address?: string;
  deliveryDate?: string;
  deliveryClock?: string;
  deliveryTime?: string;
  cardText?: string;
  phone?: string;
  email?: string;
  comment?: string;
  companyCode?: string;
  payment?: string;
  invoiceEmail?: string;
  locale?: Locale;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parseLocale(locale: unknown): Locale {
  return locale === 'en' ? 'en' : 'da';
}

function isOnlinePayment(payment: string): boolean {
  const lower = payment.toLowerCase();
  return ONLINE_PAYMENT_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function getMessages(locale: Locale) {
  return locale === 'en'
    ? {
        required: 'Please complete all required fields.',
        noProducts: 'Add at least one bouquet to continue.',
        invalidProducts: 'No valid bouquets were found in the basket.',
        error: 'An error occurred. Please try again.',
        stripeError: 'Payment could not be started. Please try again.',
      }
    : {
        required: 'Udfyld venligst alle påkrævede felter.',
        noProducts: 'Tilføj mindst én buket for at fortsætte.',
        invalidProducts: 'Ingen gyldige buketter blev fundet i kurven.',
        error: 'Der opstod en fejl. Prøv venligst igen.',
        stripeError: 'Betalingen kunne ikke startes. Prøv venligst igen.',
      };
}

function getPaymentLabel(payment: string, locale: Locale): string {
  const lower = payment.toLowerCase();

  if (lower.includes('mobilepay')) {
    return 'MobilePay';
  }

  if (lower.includes('kort') || lower.includes('card')) {
    return locale === 'en'
      ? 'Card payment (Visa / Mastercard)'
      : 'Kortbetaling (Visa / Mastercard)';
  }

  return locale === 'en'
    ? 'Invoice (manual)'
    : 'Faktura (manuel)';
}

function buildValidatedItems(
  lineItems: CheckoutRequestLineItem[],
): OrderRecordItem[] {
  const items: OrderRecordItem[] = [];

  for (const item of lineItems) {
    if (!item || typeof item.id !== 'string') {
      continue;
    }

    const qty = Number(item.qty);

    if (!Number.isInteger(qty) || qty <= 0) {
      continue;
    }

    const catalogEntry = PRODUCTS[item.id];

    if (!catalogEntry) {
      continue;
    }

    const unitPriceExVatOre = catalogEntry.price;
    const unitPriceIncVatOre = toGrossOre(unitPriceExVatOre);

    items.push({
      id: item.id,
      name: catalogEntry.name,
      qty,
      unitPriceExVatOre,
      unitPriceIncVatOre,
      lineTotalExVatOre: unitPriceExVatOre * qty,
      lineTotalIncVatOre: unitPriceIncVatOre * qty,
    });
  }

  return items;
}

function buildCustomer(body: CheckoutRequestBody): OrderRecordCustomer {
  return {
    address: body.address?.trim() || '',
    deliveryTime: body.deliveryTime?.trim() || '',
    cardText: body.cardText?.trim() || '',
    phone: body.phone?.trim() || '',
    email: body.email?.trim() || '',
    comment: body.comment?.trim() || '',
    companyCode: body.companyCode?.trim() || '',
    invoiceEmail: body.invoiceEmail?.trim() || '',
  };
}

function metadataValue(value: string): string {
  return value.slice(0, 500);
}

function isWeekdayDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function isAllowedDeliveryClock(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return false;
  }

  if (![0, 15, 30, 45].includes(minutes)) {
    return false;
  }

  if (hours === 9 || hours === 18) {
    return minutes === 0;
  }

  return (hours >= 7 && hours < 9) || (hours >= 16 && hours < 18);
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json()) as CheckoutRequestBody;
    const locale = parseLocale(body.locale);
    const messages = getMessages(locale);
    const payment = body.payment?.trim() || '';
    const customer = buildCustomer(body);
    const deliveryDate = body.deliveryDate?.trim() || '';
    const deliveryClock = body.deliveryClock?.trim() || '';

    if (
      !customer.address ||
      !customer.deliveryTime ||
      !customer.phone ||
      !customer.email ||
      !payment
    ) {
      return json({ error: messages.required }, 400);
    }

    if (!isWeekdayDate(deliveryDate) || !isAllowedDeliveryClock(deliveryClock)) {
      return json({ error: messages.required }, 400);
    }

    if (!Array.isArray(body.lineItems) || body.lineItems.length === 0) {
      return json({ error: messages.noProducts }, 400);
    }

    const items = buildValidatedItems(body.lineItems);

    if (items.length === 0) {
      return json({ error: messages.invalidProducts }, 400);
    }

    const subtotalExVatOre = items.reduce(
      (sum, item) => sum + item.lineTotalExVatOre,
      0,
    );
    const totalIncVatOre = items.reduce(
      (sum, item) => sum + item.lineTotalIncVatOre,
      0,
    );
    const vatOre = totalIncVatOre - subtotalExVatOre;
    const paymentLabel = getPaymentLabel(payment, locale);
    const origin = getRequestOrigin(request);

    if (!isOnlinePayment(payment)) {
      const order = createOrderRecord({
        locale,
        paymentMethod: paymentLabel,
        siteOrigin: origin,
        status: 'manual_invoice',
        customer,
        items,
        totals: {
          subtotalExVatOre,
          vatOre,
          totalIncVatOre,
        },
      });

      await saveOrderRecord(order);

      await Promise.allSettled([
        sendOwnerOrderNotification(order),
        sendCustomerOrderAcknowledgement(order),
      ]);

      await saveOrderRecord(order);

      return json({ success: true, orderId: order.id });
    }

    const order = createOrderRecord({
      locale,
      paymentMethod: paymentLabel,
      siteOrigin: origin,
      status: 'pending_payment',
      customer,
      items,
      totals: {
        subtotalExVatOre,
        vatOre,
        totalIncVatOre,
      },
    });

    await saveOrderRecord(order);

    const stripe = getStripe();
    const orderPagePath = getOrderPagePath(locale);
    const paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
      ['card'];

    if (payment.toLowerCase().includes('mobilepay')) {
      paymentMethodTypes.push('mobilepay');
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: paymentMethodTypes,
      line_items: items.map((item) => ({
        price_data: {
          currency: 'dkk',
          product_data: {
            name: item.name,
          },
          unit_amount: item.unitPriceIncVatOre,
        },
        quantity: item.qty,
      })),
      mode: 'payment',
      success_url: `${origin}${orderPagePath}?success=true&order=${order.id}`,
      cancel_url: `${origin}${orderPagePath}?cancelled=true&order=${order.id}`,
      customer_email: customer.email,
      metadata: {
        orderId: order.id,
        locale,
        paymentMethod: metadataValue(paymentLabel),
        siteOrigin: metadataValue(origin),
        itemsCompact: metadataValue(serializeOrderItemsForMetadata(items)),
        address: metadataValue(customer.address),
        deliveryTime: metadataValue(customer.deliveryTime),
        phone: metadataValue(customer.phone),
        email: metadataValue(customer.email),
        invoiceEmail: metadataValue(customer.invoiceEmail),
        companyCode: metadataValue(customer.companyCode),
        cardText: metadataValue(customer.cardText),
        comment: metadataValue(customer.comment),
      },
    });

    if (!session.url) {
      return json({ error: messages.stripeError }, 500);
    }

    order.stripe = {
      checkoutSessionId: session.id,
      checkoutUrl: session.url,
      paymentStatus: session.payment_status || 'unpaid',
    };

    await saveOrderRecord(order);

    return json({ url: session.url, orderId: order.id });
  } catch (error) {
    console.error('Checkout error:', error);
    return json({ error: getMessages('da').error }, 500);
  }
};
