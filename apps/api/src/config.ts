import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'

// Node does not automatically read .env files. Keep production environment-only,
// but make local API and dedicated worker commands use the repository .env file.
if (process.env.NODE_ENV !== 'production') {
  for (const candidate of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../.env'), resolve(process.cwd(), '../../.env')]) {
    if (existsSync(candidate)) { process.loadEnvFile(candidate); break }
  }
}

export const config = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000), HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1), SESSION_SECRET: z.string().min(32),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:5174'),
  ADMIN_ORIGIN: z.string().url().default('http://localhost:5173'),
  UPLOAD_DIR: z.string().default('./uploads'), MAX_UPLOAD_BYTES: z.coerce.number().default(524288000),
  SMTP_HOST: z.string().optional(), SMTP_PORT: z.coerce.number().default(587), SMTP_USER: z.string().optional(), SMTP_PASSWORD: z.string().optional(), SMTP_FROM: z.string().default('CMS <no-reply@example.com>'),
  DEEPSEEK_API_KEY: z.string().optional(), DEEPSEEK_API_URL: z.string().url().default('https://api.deepseek.com'), DEEPSEEK_MODEL: z.string().default('deepseek-chat'),
  OLLAMA_URL: z.string().url().default('http://localhost:11434'), OLLAMA_MODEL: z.string().default('deepseek-r1:latest'),
  PEXELS_API_KEY: z.string().optional(), PIXABAY_API_KEY: z.string().optional(), UNSPLASH_ACCESS_KEY: z.string().optional(),
  NEWS_BOT_POLL_INTERVAL_SECONDS: z.coerce.number().int().min(15).default(60), NEWS_BOT_TIMEZONE: z.string().default('Asia/Kuala_Lumpur'),
  INDEXNOW_KEY: z.string().optional(),
}).parse(process.env)
