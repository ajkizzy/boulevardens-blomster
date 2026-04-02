# Boulevardens Blomster

Modern, locale-aware website for Boulevardens Blomster, a flower shop in Høje Taastrup, Denmark.

Built with **Astro**, **Tailwind CSS**, **Stripe**, SMTP email notifications, and durable order/contact storage.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:4321](http://localhost:4321). The site uses `/da` as the default locale.

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key (starts with `sk_`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `SITE_URL` | Public site URL used in local fallbacks and email links |
| `SHOP_NOTIFICATION_EMAIL` | Inbox for internal website notifications |
| `SMTP_HOST` | SMTP host for order/contact acknowledgements and internal notifications |
| `SMTP_PORT` | SMTP port |
| `SMTP_SECURE` | `true` for SMTPS, otherwise `false` |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `MAIL_FROM` | From address used in outgoing emails |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token for durable order/contact storage |

If `BLOB_READ_WRITE_TOKEN` is missing, the app falls back to local `.data/` storage for development only.

## Project Structure

```text
src/
├── components/     # Reusable Astro components
├── data/           # Locale-specific content and labels
├── layouts/        # Shared page layout
├── lib/            # Stripe, storage, mail, notifications, i18n
├── pages/
│   ├── api/        # Checkout, webhook, contact endpoints
│   ├── da/         # Danish pages
│   └── en/         # English pages
└── styles/         # Global CSS
```

## Orders

The company order flow now works like this:

1. Prices are shown in DKK excluding VAT.
2. VAT is added to the checkout total and the Stripe charge.
3. `Faktura` orders are saved first, then the shop is notified and the buyer receives an acknowledgement email.
4. Online payments are saved first, then Stripe Checkout is launched.
5. When Stripe confirms payment through the webhook, the shop is notified and the buyer receives an acknowledgement email.

All internal website notifications go to `online-shop@boulevardensblomster.dk` by default unless overridden with `SHOP_NOTIFICATION_EMAIL`.

## Contact Form

Contact requests are saved first, then:

1. The shop receives an internal notification email.
2. The sender receives an acknowledgement email.

## Deployment

This project is configured for **Vercel** using the Astro serverless adapter.

### Recommended production setup

1. Create a Vercel project and add the environment variables from `.env.example`.
2. Create a Vercel Blob store and add `BLOB_READ_WRITE_TOKEN`.
3. Configure SMTP for `online-shop@boulevardensblomster.dk`.
4. Add the Stripe webhook endpoint: `https://boulevardensblomster.dk/api/webhook`
5. Set the Stripe webhook to listen for:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`

### Preview deployments

Preview deployments work on Vercel and can be shared with clients before production launch. The checkout API uses the current request origin for Stripe success and cancel redirects, so previews no longer fall back to localhost.

## Legal Pages

The site includes:

- `Handelsbetingelser`
- `Privatlivspolitik`
- English equivalents for the legal pages

These pages are a practical baseline and should be reviewed by the business' legal adviser before final launch.
