This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Environment (Filebase)

Create `.env.local` with these keys for Filebase S3 (S3-compatible):

```
FILEBASE_ENDPOINT=https://s3.filebase.com
FILEBASE_REGION=us-east-1
FILEBASE_BUCKET=psusccshop-storage
FILEBASE_ACCESS_KEY=YOUR_KEY
FILEBASE_SECRET_KEY=YOUR_SECRET
```

Optional payment stub values:

```
PAYMENT_BANK=SCB
PAYMENT_ACCOUNT_NAME=PSUSCCSHOP
PAYMENT_ACCOUNT=000-000000-0
```

## Email System (Optional)

Add these for email notifications via Resend:

```
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=SCC Shop <noreply@your-domain.com>
```

Email notifications are sent automatically when:
- New order is placed → Order confirmation email
- Payment is verified → Payment received email  
- Order status changes → Status update email (PAID, READY, SHIPPED, COMPLETED, CANCELLED)

If `RESEND_API_KEY` is not set, emails are logged to console only (dev mode).
// Deployment trigger: 1768916157
