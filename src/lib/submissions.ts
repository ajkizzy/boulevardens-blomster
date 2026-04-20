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
import { PRODUCTS, toGrossOre } from '@/lib/stripe';

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
  contactName: string;
  companyName: string;
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

function buildTotalsFromItems(items: OrderRecordItem[]) {
  const subtotalExVatOre = items.reduce(
    (sum, item) => sum + item.lineTotalExVatOre,
    0,
  );
  const totalIncVatOre = items.reduce(
    (sum, item) => sum + item.lineTotalIncVatOre,
    0,
  );

  return {
    subtotalExVatOre,
    vatOre: totalIncVatOre - subtotalExVatOre,
    totalIncVatOre,
  };
}

export function serializeOrderItemsForMetadata(items: OrderRecordItem[]): string {
  return items.map((item) => `${item.id}:${item.qty}`).join('|');
}

function deserializeOrderItemsFromMetadata(value: string): OrderRecordItem[] {
  return value
    .split('|')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const [id, qtyValue] = entry.split(':');
      const qty = Number(qtyValue);
      const product = PRODUCTS[id];

      if (!product || !Number.isInteger(qty) || qty <= 0) {
        return [];
      }

      const unitPriceExVatOre = product.price;
      const unitPriceIncVatOre = toGrossOre(unitPriceExVatOre);

      return [
        {
          id,
          name: product.name,
          qty,
          unitPriceExVatOre,
          unitPriceIncVatOre,
          lineTotalExVatOre: unitPriceExVatOre * qty,
          lineTotalIncVatOre: unitPriceIncVatOre * qty,
        },
      ];
    });
}

function getSessionMetadataValue(
  metadata: Stripe.Metadata | null | undefined,
  key: string,
): string {
  const value = metadata?.[key];
  return typeof value === 'string' ? value : '';
}

export function buildRecoveredOrderFromCheckoutSession(
  session: Stripe.Checkout.Session,
): OrderRecord | null {
  const metadata = session.metadata;
  const orderId = getSessionMetadataValue(metadata, 'orderId');
  const items = deserializeOrderItemsFromMetadata(
    getSessionMetadataValue(metadata, 'itemsCompact'),
  );

  if (!orderId || items.length === 0) {
    return null;
  }

  const locale = getSessionMetadataValue(metadata, 'locale') === 'en' ? 'en' : 'da';
  const email =
    getSessionMetadataValue(metadata, 'email') ||
    session.customer_details?.email ||
    session.customer_email ||
    '';

  return {
    id: orderId,
    locale,
    createdAt: new Date((session.created || Date.now() / 1000) * 1000).toISOString(),
    siteOrigin: getSessionMetadataValue(metadata, 'siteOrigin') || undefined,
    status: 'pending_payment',
    paymentMethod:
      getSessionMetadataValue(metadata, 'paymentMethod') ||
      (locale === 'en' ? 'Online payment' : 'Online betaling'),
    items,
    totals: buildTotalsFromItems(items),
    customer: {
      address: getSessionMetadataValue(metadata, 'address'),
      deliveryTime: getSessionMetadataValue(metadata, 'deliveryTime'),
      cardText: getSessionMetadataValue(metadata, 'cardText'),
      contactName: getSessionMetadataValue(metadata, 'contactName'),
      companyName: getSessionMetadataValue(metadata, 'companyName'),
      phone: getSessionMetadataValue(metadata, 'phone'),
      email,
      comment: getSessionMetadataValue(metadata, 'comment'),
      companyCode: getSessionMetadataValue(metadata, 'companyCode'),
      invoiceEmail: getSessionMetadataValue(metadata, 'invoiceEmail'),
    },
    stripe: {
      checkoutSessionId: session.id,
      paymentStatus: session.payment_status || 'unpaid',
    },
    notifications: {},
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
        contactNameLabel: 'Contact person',
        companyNameLabel: 'Company name',
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
        contactNameLabel: 'Kontaktperson',
        companyNameLabel: 'Virksomhed',
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
    <div style="margin:20px 0 0 0;">
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="background-color:#526349;">
            <th style="text-align:left; padding:10px 12px; color:#ffffff; font-weight:600; font-size:13px;">${text.productLabel}</th>
            <th style="text-align:center; padding:10px 12px; color:#ffffff; font-weight:600; font-size:13px;">${text.quantityLabel}</th>
            <th style="text-align:right; padding:10px 12px; color:#ffffff; font-weight:600; font-size:13px;">${text.unitPriceLabel}</th>
            <th style="text-align:right; padding:10px 12px; color:#ffffff; font-weight:600; font-size:13px;">${text.lineTotalLabel}</th>
          </tr>
        </thead>
        <tbody>
          ${renderOrderItemsHtml(order.items, order.locale)}
        </tbody>
      </table>
      <div style="margin-top:16px; padding:12px; background-color:#f9fafb; border-radius:6px;">
        <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #e5e7eb;">
          <span style="color:#6b7280;">${text.subtotalLabel}:</span>
          <strong style="color:#1f2937;">${formatDkkFromOre(order.totals.subtotalExVatOre, text.localeTag)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #e5e7eb;">
          <span style="color:#6b7280;">${text.vatLabel} (25%):</span>
          <strong style="color:#1f2937;">${formatDkkFromOre(order.totals.vatOre, text.localeTag)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; padding:6px 0; margin-top:4px; border-top:2px solid #526349;">
          <span style="color:#1f2937; font-weight:600; font-size:15px;">${text.totalLabel}:</span>
          <strong style="color:#526349; font-size:15px;">${formatDkkFromOre(order.totals.totalIncVatOre, text.localeTag)}</strong>
        </div>
      </div>
    </div>
  `;
}

function renderOrderDetailsHtml(order: OrderRecord): string {
  const text = orderLocaleText(order.locale);
  const invoiceEmail = order.customer.invoiceEmail || order.customer.email;

  return `
    <div style="margin:16px 0; background-color:#f9fafb; border-radius:8px; padding:16px; font-size:13px;">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div>
          <p style="margin:0 0 8px 0; color:#6b7280;"><strong>${text.customerOrderLabel}:</strong></p>
          <p style="margin:0 0 12px 0; color:#1f2937;">${escapeHtml(order.id)}</p>

          <p style="margin:0 0 8px 0; color:#6b7280;"><strong>${text.paymentLabel}:</strong></p>
          <p style="margin:0 0 12px 0; color:#1f2937;">${escapeHtml(order.paymentMethod)}</p>

          <p style="margin:0 0 8px 0; color:#6b7280;"><strong>${text.contactNameLabel}:</strong></p>
          <p style="margin:0 0 12px 0; color:#1f2937;">${escapeHtml(order.customer.contactName)}</p>

          <p style="margin:0 0 8px 0; color:#6b7280;"><strong>${text.companyNameLabel}:</strong></p>
          <p style="margin:0; color:#1f2937;">${escapeHtml(order.customer.companyName)}</p>
        </div>
        <div>
          <p style="margin:0 0 8px 0; color:#6b7280;"><strong>${text.addressLabel}:</strong></p>
          <p style="margin:0 0 12px 0; color:#1f2937;">${escapeHtml(order.customer.address)}</p>

          <p style="margin:0 0 8px 0; color:#6b7280;"><strong>${text.deliveryLabel}:</strong></p>
          <p style="margin:0 0 12px 0; color:#1f2937;">${escapeHtml(order.customer.deliveryTime)}</p>

          <p style="margin:0 0 8px 0; color:#6b7280;"><strong>${text.phoneLabel}:</strong></p>
          <p style="margin:0 0 12px 0; color:#1f2937;">${escapeHtml(order.customer.phone)}</p>

          <p style="margin:0 0 8px 0; color:#6b7280;"><strong>${text.emailLabel}:</strong></p>
          <p style="margin:0; color:#1f2937;">${escapeHtml(order.customer.email)}</p>
        </div>
      </div>
      ${
        invoiceEmail !== order.customer.email
          ? `<div style="margin-top:12px; padding-top:12px; border-top:1px solid #e5e7eb;">
               <p style="margin:0 0 4px 0; color:#6b7280;"><strong>${text.invoiceEmailLabel}:</strong></p>
               <p style="margin:0; color:#1f2937;">${escapeHtml(invoiceEmail)}</p>
             </div>`
          : ''
      }
      ${
        order.customer.companyCode
          ? `<div style="margin-top:8px;"><p style="margin:0 0 4px 0; color:#6b7280;"><strong>${text.companyCodeLabel}:</strong></p><p style="margin:0; color:#1f2937;">${escapeHtml(order.customer.companyCode)}</p></div>`
          : ''
      }
      ${
        order.customer.cardText
          ? `<div style="margin-top:8px; padding:8px; background-color:#ffffff; border-left:3px solid #526349; border-radius:4px;"><p style="margin:0 0 4px 0; color:#6b7280;"><strong>${text.cardTextLabel}:</strong></p><p style="margin:0; color:#1f2937; font-style:italic;">"${escapeHtml(order.customer.cardText)}"</p></div>`
          : ''
      }
      ${
        order.customer.comment
          ? `<div style="margin-top:8px;"><p style="margin:0 0 4px 0; color:#6b7280;"><strong>${text.commentLabel}:</strong></p><p style="margin:0; color:#1f2937;">${escapeHtml(order.customer.comment)}</p></div>`
          : ''
      }
    </div>
  `;
}

function wrapEmailHtml(content: string, title: string): string {
  return `
    <div style="font-family:'Noto Serif', Georgia, serif; background-color:#f9fafb; padding:20px;">
      <div style="max-width:680px; margin:0 auto; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 6px rgba(0,0,0,0.07);">
        <!-- Green header -->
        <div style="background-color:#526349; padding:24px; text-align:center; border-bottom:2px solid #46553f;">
          <h1 style="margin:0; font-size:28px; color:#ffffff; font-family:'Noto Serif', Georgia, serif; font-weight:600;">Boulevardens Blomster</h1>
        </div>
        <!-- Content -->
        <div style="padding:24px; color:#1f2937; font-family:Arial,sans-serif; font-size:14px; line-height:1.6;">
          ${content}
        </div>
        <!-- Footer -->
        <div style="background-color:#f4f4ef; padding:16px 24px; border-top:1px solid #e5e7eb; font-size:12px; color:#6b7280; text-align:center;">
          <p style="margin:0; padding:0;">Høje Taastrup Boulevard 55, 2630 Høje Taastrup | +45 40 20 30 40</p>
          <p style="margin:4px 0 0 0; padding:0;">boulevardensblomster.dk</p>
        </div>
      </div>
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
    `${text.contactNameLabel}: ${order.customer.contactName}`,
    `${text.companyNameLabel}: ${order.customer.companyName}`,
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

  const statusBadge = order.status === 'manual_invoice'
    ? '<span style="display:inline-block; background-color:#fbbf24; color:#78350f; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:600; margin-bottom:12px;">FAKTURA</span>'
    : '<span style="display:inline-block; background-color:#10b981; color:#ffffff; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:600; margin-bottom:12px;">PAID</span>';

  const emailContent = `
    <h2 style="margin:0 0 12px 0; font-size:20px; color:#1f2937;">${escapeHtml(subjectBase)}</h2>
    ${statusBadge}
    <p style="margin:0 0 16px 0; color:#6b7280;">${escapeHtml(intro)}</p>
    ${renderOrderDetailsHtml(order)}
    ${renderOrderSummaryHtml(order)}
  `;

  const sent = await sendMail({
    to: SHOP_NOTIFICATION_EMAIL,
    subject,
    replyTo: order.customer.email,
    text: `${intro}\n\n${renderOrderDetailsText(order)}`,
    html: wrapEmailHtml(emailContent, subjectBase),
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

  const emailContent = `
    <h2 style="margin:0 0 12px 0; font-size:20px; color:#1f2937;">${escapeHtml(
      isManualInvoice
        ? text.customerInvoiceHeading
        : text.customerPaidHeading,
    )}</h2>
    <p style="margin:0 0 16px 0; color:#6b7280; line-height:1.6;">${escapeHtml(body)}</p>
    ${renderOrderDetailsHtml(order)}
    ${renderOrderSummaryHtml(order)}
    <div style="margin-top:20px; padding:12px; background-color:#f9fafb; border-radius:6px; text-align:center;">
      <p style="margin:0 0 8px 0; color:#6b7280; font-size:12px;">View your order details:</p>
      <a href="${orderPageUrl}" style="display:inline-block; background-color:#526349; color:#ffffff; padding:10px 20px; border-radius:6px; text-decoration:none; font-weight:600; font-size:13px;">${escapeHtml(
        text.orderPageLabel,
      )}</a>
    </div>
  `;

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
    html: wrapEmailHtml(emailContent, isManualInvoice ? text.customerInvoiceHeading : text.customerPaidHeading),
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
