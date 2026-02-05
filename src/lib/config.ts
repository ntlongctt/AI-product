export const config = {
  app: {
    name: 'Product Image AI Studio',
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },
  ai: {
    providers: {
      fal: process.env.FAL_KEY,
      replicate: process.env.REPLICATE_API_TOKEN,
      openai: process.env.OPENAI_API_KEY,
    },
  },
  storage: {
    r2: {
      accountId: process.env.R2_ACCOUNT_ID,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      bucketName: process.env.R2_BUCKET_NAME || 'product-images',
    },
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  },
} as const;

export const plans = {
  free: {
    id: 'free',
    name: 'Free',
    generations: 10,
    maxProjects: 5,
    watermark: true,
    priceId: null,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    generations: 100,
    maxProjects: -1,
    watermark: false,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    generations: 500,
    maxProjects: -1,
    watermark: false,
    priceId: process.env.STRIPE_AGENCY_PRICE_ID,
  },
} as const;
