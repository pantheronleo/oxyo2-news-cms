import { z } from 'zod'

export const config = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'),
  PORT: z.coerce.number().default(4000), HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1), SESSION_SECRET: z.string().min(32),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:5174'),
  ADMIN_ORIGIN: z.string().url().default('http://localhost:5173'),
  UPLOAD_DIR: z.string().default('./uploads'), MAX_UPLOAD_BYTES: z.coerce.number().default(524288000),
  SMTP_HOST: z.string().optional(), SMTP_PORT: z.coerce.number().default(587), SMTP_USER: z.string().optional(), SMTP_PASSWORD: z.string().optional(), SMTP_FROM: z.string().default('CMS <no-reply@example.com>'),
  OPENAI_API_KEY: z.string().optional(), OPENAI_TEXT_MODEL: z.string().default('gpt-5.6-terra'), OPENAI_IMAGE_MODEL: z.string().default('gpt-image-2'),
  OLLAMA_URL: z.string().url().default('http://localhost:11434'), OLLAMA_MODEL: z.string().default('deepseek-r1:latest'), OLLAMA_IMAGE_MODEL: z.string().default('x/z-image-turbo'), OLLAMA_VISION_MODEL: z.string().optional(),
  PEXELS_API_KEY: z.string().optional(), PIXABAY_API_KEY: z.string().optional(), UNSPLASH_ACCESS_KEY: z.string().optional(),
  NEWS_BOT_POLL_INTERVAL_SECONDS: z.coerce.number().int().min(15).default(60),
}).parse(process.env)
