import type { APIRoute } from 'astro';
import type Stripe from 'stripe';
import {
  buildRecoveredOrderFromCheckoutSession,
  getOrderRecord,
  saveOrderRecord,
  sendCustomerOrderAcknowledgement,
  sendOwnerOrderNotification,
  syncOrderPaymentFromSession,
} from '@/lib/submissions';
import { getStripe } from '@/lib/stripe';

export const prerender = false;

async function handleCompletedCheckout(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const orderId = session.metadata?.orderId;

  if (!orderId) {
    return;
  }

  let order = await getOrderRecord(orderId);

  if (!order) {
    order = buildRecoveredOrderFromCheckoutSession(session);

    if (!order) {
      console.warn(`Webhook received unknown order id ${orderId}.`);
      return;
    }
  }

  await syncOrderPaymentFromSession(order, session);

  const tasks: Promise<unknown>[] = [];

  if (!order.notifications.ownerNotifiedAt) {
    tasks.push(sendOwnerOrderNotification(order));
  }

  if (!order.notifications.customerAcknowledgedAt) {
    tasks.push(sendCustomerOrderAcknowledgement(order));
  }

  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }

  await saveOrderRecord(order);
}

export const POST: APIRoute = async ({ request }) => {
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return new Response('Webhook signature or secret is missing.', {
      status: 400,
    });
  }

  try {
    const payload = await request.text();
    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret,
    );

    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      await handleCompletedCheckout(event.data.object as Stripe.Checkout.Session);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return new Response('Webhook error.', { status: 400 });
  }
};
