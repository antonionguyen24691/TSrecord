import cors from 'cors';
import type { CorsOptions } from 'cors';

const DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:4000',
  'http://127.0.0.1:4000',
  'https://tsrecord.vn',
  'https://www.tsrecord.vn',
];

const parseAllowedOrigins = (): string[] => {
  const fromEnv = process.env.CORS_ALLOWED_ORIGINS
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const extras = [
    process.env.PUBLIC_APP_URL,
    process.env.VITE_SITE_URL,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  const merged = [...(fromEnv ?? DEFAULT_ORIGINS), ...extras];
  return [...new Set(merged)];
};

const isDevLocal = (): boolean =>
  process.env.NODE_ENV !== 'production' && !process.env.VERCEL;

export const createCorsMiddleware = () => {
  const allowedOrigins = parseAllowedOrigins();

  const options: CorsOptions = {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (isDevLocal() && process.env.CORS_ALLOWED_ORIGINS === undefined) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS policy.`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Admin-Api-Key',
      'X-SePay-Signature',
      'X-Webhook-Signature',
      'Stripe-Signature',
    ],
    maxAge: 86_400,
  };

  return cors(options);
};
