import { z } from 'zod'

export const config = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'),
  PORT: z.coerce.number().default(4000), HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1), SESSION_SECRET: z.string().min(32),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:5174'),
  ADMIN_ORIGIN: z.string().url().default('http://localhost:5173'),
  UPLOAD_DIR: z.string().default('./uploads'), MAX_UPLOAD_BYTES: z.coerce.number().default(524288000),
  SMTP_HOST: z.string().optional(), SMTP_PORT: z.coerce.number().default(587), SMTP_USER: z.string().optional(), SMTP_PASSWORD: z.string().optional(), SMTP_FROM: z.string().default('CMS <no-reply@example.com>'),
}).parse(process.env)
