import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
import type { Locale } from '@/lib/i18n';
import {
  DEFAULT_SITE_URL,
  SHOP_NOTIFICATION_EMAIL,
  SHOP_NAME,
  formatDkkFromOre,
  getOrderPagePath,
} from '@/lib/config';
import { sendMail } from '@/lib/mail';
import { readJsonRecord, saveJsonRecord } from '@/lib/storage';

export interface OrderRecordItem {
  id: string;
  name: string;
  qty: number;
  unitPriceExVatOre: number;
  unitPriceIncVatOre: number;
  lineTotalExVatOre: number;
  lineTotalIncVatOre: number;
}

export interface OrderRecordCustomer {
  address: string;
  deliveryTime: string;
  cardText: string;
  phone: string;
  email: string;
  comment: string;
  companyCode: string;
  invoiceEmail: string;
}

export interface OrderRecord {
  id: string;
  locale: Locale;
  createdAt: string;
  siteOrigin?: string;
  status: 'pending_payment' | 'paid' | 'manual_invoice';
  paymentMethod: string;
  items: OrderRecordItem[];
  totals: {
    subtotalExVatOre: number;
    vatOre: number;
    totalIncVatOre: number;
  };
  customer: OrderRecordCustomer;
  stripe?: {
    checkoutSessionId?: string;
    checkoutUrl?: string;
    paymentStatus?: string;
    paidAt?: string;
  };
  notifications: {
    ownerNotifiedAt?: string;
    customerAcknowledgedAt?: string;
  };
}

export interface ContactRecord {
  id: string;
  locale: Locale;
  createdAt: string;
  name: string;
  email: string;
  message: string;
  notifications: {
    ownerNotifiedAt?: string;
    customerAcknowledgedAt?: string;
  };
}

function orderRecordPath(orderId: string): string {
  return `orders/${orderId}.json`;
}

function contactRecordPath(contactId: string): string {
  return `contacts/${contactId}.json`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function orderLocaleText(locale: Locale) {
  return locale === 'en'
    ? {
        localeTag: 'en-DK',
        ownerPaidSubject: 'New paid website order',
        ownerInvoiceSubject: 'New invoice order',
        customerPaidSubject: 'Your order has been received',
        customerInvoiceSubject: 'We received your invoice order',
        customerPaidHeading: 'Thank you for your order',
        customerInvoiceHeading: 'Thank you for your order',
        customerPaidBody:
          'We have registered your payment and will process your flower order as soon as possible.',
        customerInvoiceBody:
          'We have received your order request. A manual invoice will be sent from Boulevardens Blomster as soon as possible.',
        customerOrderLabel: 'Order number',
        paymentLabel: 'Payment method',
        productLabel: 'Product',
        quantityLabel: 'Quantity',
        unitPriceLabel: 'Price excl. VAT',
        lineTotalLabel: 'Line total',
        subtotalLabel: 'Subtotal excl. VAT',
        vatLabel: 'VAT',
        totalLabel: 'Total incl. VAT',
        deliveryLabel: 'Delivery time',
        addressLabel: 'Delivery address',
        commentLabel: 'Comment',
        companyCodeLabel: 'Company code',
        invoiceEmailLabel: 'Invoice email',
        cardTextLabel: 'Card text',
        phoneLabel: 'Phone',
        emailLabel: 'Email',
        orderPageLabel: 'Order page',
        ownerIntroPaid:
          'A paid order has been completed through the website.',
        ownerIntroInvoice:
          'A new invoice order has been submitted through the website.',
        contactOwnerSubject: 'New contact form message',
        contactCustomerSubject: 'We received your message',
        contactAckHeading: 'Thank you for your message',
        contactAckBody:
          'We have received your enquiry and will get back to you as soon as possible.',
      }
    : {
        localeTag: 'da-DK',
        ownerPaidSubject: 'Ny betalt webshopordre',
        ownerInvoiceSubject: 'Ny fakturaordre',
        customerPaidSubject: 'Vi har modtaget din bestilling',
        customerInvoiceSubject: 'Vi har modtaget din fakturabestilling',
        customerPaidHeading: 'Tak for din bestilling',
        customerInvoiceHeading: 'Tak for din bestilling',
        customerPaidBody:
          'Vi har registreret din betaling og behandler din blomsterbestilling hurtigst muligt.',
        customerInvoiceBody:
          'Vi har modtaget din bestilling. Boulevardens Blomster sender en manuel faktura hurtigst muligt.',
        customerOrderLabel: 'Ordrenummer',
        paymentLabel: 'Betalingsmetode',
        productLabel: 'Produkt',
        quantityLabel: 'Antal',
        unitPriceLabel: 'Pris ekskl. moms',
        lineTotalLabel: 'Linjetotal',
        subtotalLabel: 'Subtotal ekskl. moms',
        vatLabel: 'Moms',
        totalLabel: 'Total inkl. moms',
        deliveryLabel: 'Leveringstidspunkt',
        addressLabel: 'Leveringsadresse',
        commentLabel: 'Kommentar',
        companyCodeLabel: 'Firmakode',
        invoiceEmailLabel: 'Faktura-email',
        cardTextLabel: 'Korttekst',
        phoneLabel: 'Telefon',
        emailLabel: 'Email',
        orderPageLabel: 'Bestillingsside',
        ownerIntroPaid: 'En betalt ordre er gennemfort via websitet.',
        ownerIntroInvoice: 'En ny fakturaordre er sendt via websitet.',
        contactOwnerSubject: 'Ny besked fra kontaktformularen',
        contactCustomerSubject: 'Vi har modtaget din besked',
        contactAckHeading: 'Tak for din besked',
        contactAckBody:
          'Vi har modtaget din henvendelse og vender tilbage hurtigst muligt.',
      };
}

function renderOrderItemsHtml(
  items: OrderRecordItem[],
  locale: Locale,
): string {
  const text = orderLocaleText(locale);

  return items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0; border-bottom:1px solid #e5e7eb;">${escapeHtml(item.name)}</td>
          <td style="padding:8px 0; border-bottom:1px solid #e5e7eb; text-align:center;">${item.qty}</td>
          <td style="padding:8px 0; border-bottom:1px solid #e5e7eb; text-align:right;">${formatDkkFromOre(item.unitPriceExVatOre, text.localeTag)}</td>
          <td style="padding:8px 0; border-bottom:1px solid #e5e7eb; text-align:right;">${formatDkkFromOre(item.lineTotalExVatOre, text.localeTag)}</td>
        </tr>
      `,
    )
    .join('');
}

function renderOrderSummaryHtml(order: OrderRecord): string {
  const text = orderLocaleText(order.locale);

  return `
    <table style="width:100%; border-collapse:collapse; margin-top:16px;">
      <thead>
        <tr>
          <th style="text-align:left; padding:8px 0; border-bottom:2px solid #d1d5db;">${text.productLabel}</th>
          <th style="text-align:center; padding:8px 0; border-bottom:2px solid #d1d5db;">${text.quantityLabel}</th>
          <th style="text-align:right; padding:8px 0; border-bottom:2px solid #d1d5db;">${text.unitPriceLabel}</th>
          <th style="text-align:right; padding:8px 0; border-bottom:2px solid #d1d5db;">${text.lineTotalLabel}</th>
        </tr>
      </thead>
      <tbody>
        ${renderOrderItemsHtml(order.items, order.locale)}
      </tbody>
    </table>
    <div style="margin-top:16px; font-size:14px;">
      <p style="margin:4px 0;"><strong>${text.subtotalLabel}:</strong> ${formatDkkFromOre(order.totals.subtotalExVatOre, text.localeTag)}</p>
      <p style="margin:4px 0;"><strong>${text.vatLabel}:</strong> ${formatDkkFromOre(order.totals.vatOre, text.localeTag)}</p>
      <p style="margin:4px 0;"><strong>${text.totalLabel}:</strong> ${formatDkkFromOre(order.totals.totalIncVatOre, text.localeTag)}</p>
    </div>
  `;
}

function renderOrderDetailsHtml(order: OrderRecord): string {
  const text = orderLocaleText(order.locale);
  const invoiceEmail = order.customer.invoiceEmail || order.customer.email;

  return `
    <div style="margin-top:16px; font-size:14px; line-height:1.6;">
      <p><strong>${text.customerOrderLabel}:</strong> ${escapeHtml(order.id)}</p>
      <p><strong>${text.paymentLabel}:</strong> ${escapeHtml(order.paymentMethod)}</p>
      <p><strong>${text.addressLabel}:</strong> ${escapeHtml(order.customer.address)}</p>
      <p><strong>${text.deliveryLabel}:</strong> ${escapeHtml(order.customer.deliveryTime)}</p>
      <p><strong>${text.phoneLabel}:</strong> ${escapeHtml(order.customer.phone)}</p>
      <p><strong>${text.emailLabel}:</strong> ${escapeHtml(order.customer.email)}</p>
      <p><strong>${text.invoiceEmailLabel}:</strong> ${escapeHtml(invoiceEmail)}</p>
      ${
        order.customer.companyCode
          ? `<p><strong>${text.companyCodeLabel}:</strong> ${escapeHtml(order.customer.companyCode)}</p>`
          : ''
      }
      ${
        order.customer.cardText
          ? `<p><strong>${text.cardTextLabel}:</strong> ${escapeHtml(order.customer.cardText)}</p>`
          : ''
      }
      ${
        order.customer.comment
          ? `<p><strong>${text.commentLabel}:</strong> ${escapeHtml(order.customer.comment)}</p>`
          : ''
      }
    </div>
  `;
}

function renderOrderDetailsText(order: OrderRecord): string {
  const text = orderLocaleText(order.locale);

  return [
    `${text.customerOrderLabel}: ${order.id}`,
    `${text.paymentLabel}: ${order.paymentMethod}`,
    `${text.addressLabel}: ${order.customer.address}`,
    `${text.deliveryLabel}: ${order.customer.deliveryTime}`,
    `${text.phoneLabel}: ${order.customer.phone}`,
    `${text.emailLabel}: ${order.customer.email}`,
    `${text.invoiceEmailLabel}: ${order.customer.invoiceEmail || order.customer.email}`,
    order.customer.companyCode
      ? `${text.companyCodeLabel}: ${order.customer.companyCode}`
      : '',
    order.customer.cardText
      ? `${text.cardTextLabel}: ${order.customer.cardText}`
      : '',
    order.customer.comment ? `${text.commentLabel}: ${order.customer.comment}` : '',
    '',
    `${text.subtotalLabel}: ${formatDkkFromOre(
      order.totals.subtotalExVatOre,
      text.localeTag,
    )}`,
    `${text.vatLabel}: ${formatDkkFromOre(order.totals.vatOre, text.localeTag)}`,
    `${text.totalLabel}: ${formatDkkFromOre(
      order.totals.totalIncVatOre,
      text.localeTag,
    )}`,
    '',
    ...order.items.map(
      (item) =>
        `${item.qty} x ${item.name} (${formatDkkFromOre(item.unitPriceExVatOre, text.localeTag)} ex VAT) = ${formatDkkFromOre(item.lineTotalExVatOre, text.localeTag)}`,
    ),
  ]
    .filter(Boolean)
    .join('\n');
}

export function createOrderRecord(input: {
  locale: Locale;
  paymentMethod: string;
  siteOrigin?: string;
  status: OrderRecord['status'];
  customer: OrderRecordCustomer;
  items: OrderRecordItem[];
  totals: OrderRecord['totals'];
  stripe?: OrderRecord['stripe'];
}): OrderRecord {
  return {
    id: `ORD-${randomUUID().slice(0, 8).toUpperCase()}`,
    locale: input.locale,
    createdAt: new Date().toISOString(),
    siteOrigin: input.siteOrigin,
    status: input.status,
    paymentMethod: input.paymentMethod,
    items: input.items,
    totals: input.totals,
    customer: input.customer,
    stripe: input.stripe,
    notifications: {},
  };
}

export async function saveOrderRecord(order: OrderRecord): Promise<void> {
  await saveJsonRecord(orderRecordPath(order.id), order);
}

export async function getOrderRecord(orderId: string): Promise<OrderRecord | null> {
  return readJsonRecord<OrderRecord>(orderRecordPath(orderId));
}

export async function saveContactRecord(record: ContactRecord): Promise<void> {
  await saveJsonRecord(contactRecordPath(record.id), record);
}

export function createContactRecord(input: {
  locale: Locale;
  name: string;
  email: string;
  message: string;
}): ContactRecord {
  return {
    id: `MSG-${randomUUID().slice(0, 8).toUpperCase()}`,
    locale: input.locale,
    createdAt: new Date().toISOString(),
    name: input.name,
    email: input.email,
    message: input.message,
    notifications: {},
  };
}

export async function sendOwnerOrderNotification(
  order: OrderRecord,
): Promise<boolean> {
  const text = orderLocaleText(order.locale);
  const subjectBase =
    order.status === 'manual_invoice'
      ? text.ownerInvoiceSubject
      : text.ownerPaidSubject;
  const subject = `${subjectBase} ${order.id}`;
  const intro =
    order.status === 'manual_invoice'
      ? text.ownerIntroInvoice
      : text.ownerIntroPaid;

  const sent = await sendMail({
    to: SHOP_NOTIFICATION_EMAIL,
    subject,
    replyTo: order.customer.email,
    text: `${intro}\n\n${renderOrderDetailsText(order)}`,
    html: `
      <div style="font-family:Arial,sans-serif; max-width:680px; margin:0 auto; color:#1f2937;">
        <h1 style="font-size:24px; margin-bottom:8px;">${escapeHtml(subjectBase)}</h1>
        <p style="margin:0 0 16px 0;">${escapeHtml(intro)}</p>
        ${renderOrderDetailsHtml(order)}
        ${renderOrderSummaryHtml(order)}
      </div>
    `,
  });

  if (sent) {
    order.notifications.ownerNotifiedAt = new Date().toISOString();
  }

  return sent;
}

export async function sendCustomerOrderAcknowledgement(
  order: OrderRecord,
): Promise<boolean> {
  const text = orderLocaleText(order.locale);
  const isManualInvoice = order.status === 'manual_invoice';
  const subject = isManualInvoice
    ? `${text.customerInvoiceSubject} ${order.id}`
    : `${text.customerPaidSubject} ${order.id}`;
  const body = isManualInvoice
    ? text.customerInvoiceBody
    : text.customerPaidBody;
  const orderPageUrl = `${order.siteOrigin || DEFAULT_SITE_URL}${getOrderPagePath(
    order.locale,
  )}`;

  const sent = await sendMail({
    to: order.customer.email,
    subject,
    text: [
      `${text.customerOrderLabel}: ${order.id}`,
      body,
      '',
      renderOrderDetailsText(order),
      '',
      `${text.orderPageLabel}: ${orderPageUrl}`,
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif; max-width:680px; margin:0 auto; color:#1f2937;">
        <h1 style="font-size:24px; margin-bottom:8px;">${escapeHtml(
          isManualInvoice
            ? text.customerInvoiceHeading
            : text.customerPaidHeading,
        )}</h1>
        <p style="margin:0 0 16px 0;">${escapeHtml(body)}</p>
        ${renderOrderDetailsHtml(order)}
        ${renderOrderSummaryHtml(order)}
        <p style="margin-top:20px;">
          <a href="${orderPageUrl}" style="color:#7c2d12;">${escapeHtml(
            text.orderPageLabel,
          )}</a>
        </p>
      </div>
    `,
  });

  if (sent) {
    order.notifications.customerAcknowledgedAt = new Date().toISOString();
  }

  return sent;
}

export async function sendOwnerContactNotification(
  record: ContactRecord,
): Promise<boolean> {
  const text = orderLocaleText(record.locale);
  const subject = `${text.contactOwnerSubject} ${record.id}`;

  const sent = await sendMail({
    to: SHOP_NOTIFICATION_EMAIL,
    subject,
    replyTo: record.email,
    text: [
      `ID: ${record.id}`,
      `Navn: ${record.name}`,
      `Email: ${record.email}`,
      `Tidspunkt: ${record.createdAt}`,
      '',
      record.message,
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif; max-width:680px; margin:0 auto; color:#1f2937;">
        <h1 style="font-size:24px; margin-bottom:8px;">${escapeHtml(
          text.contactOwnerSubject,
        )}</h1>
        <p><strong>ID:</strong> ${escapeHtml(record.id)}</p>
        <p><strong>Navn:</strong> ${escapeHtml(record.name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(record.email)}</p>
        <p><strong>Tidspunkt:</strong> ${escapeHtml(record.createdAt)}</p>
        <div style="margin-top:16px; padding:16px; background:#f9fafb; border:1px solid #e5e7eb; white-space:pre-wrap;">${escapeHtml(
          record.message,
        )}</div>
      </div>
    `,
  });

  if (sent) {
    record.notifications.ownerNotifiedAt = new Date().toISOString();
  }

  return sent;
}

export async function sendCustomerContactAcknowledgement(
  record: ContactRecord,
): Promise<boolean> {
  const text = orderLocaleText(record.locale);

  const sent = await sendMail({
    to: record.email,
    subject: `${text.contactCustomerSubject} ${record.id}`,
    text: [
      text.contactAckHeading,
      text.contactAckBody,
      '',
      `ID: ${record.id}`,
      '',
      record.message,
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif; max-width:680px; margin:0 auto; color:#1f2937;">
        <h1 style="font-size:24px; margin-bottom:8px;">${escapeHtml(
          text.contactAckHeading,
        )}</h1>
        <p style="margin:0 0 16px 0;">${escapeHtml(text.contactAckBody)}</p>
        <p><strong>ID:</strong> ${escapeHtml(record.id)}</p>
        <div style="margin-top:16px; padding:16px; background:#f9fafb; border:1px solid #e5e7eb; white-space:pre-wrap;">${escapeHtml(
          record.message,
        )}</div>
      </div>
    `,
  });

  if (sent) {
    record.notifications.customerAcknowledgedAt = new Date().toISOString();
  }

  return sent;
}

export async function syncOrderPaymentFromSession(
  order: OrderRecord,
  session: Stripe.Checkout.Session,
): Promise<OrderRecord> {
  order.status = 'paid';
  order.stripe = {
    checkoutSessionId: session.id,
    checkoutUrl: order.stripe?.checkoutUrl,
    paymentStatus: session.payment_status || 'paid',
    paidAt: new Date().toISOString(),
  };

  return order;
}
