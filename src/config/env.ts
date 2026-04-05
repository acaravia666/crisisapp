import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  PORT:                    z.string().default('3000'),
  HOST:                    z.string().default('0.0.0.0'),
  NODE_ENV:                z.enum(['development', 'production', 'test']).default('development'),

  DATABASE_URL:            z.string().min(1),

  REDIS_URL:               z.string().default('redis://localhost:6379'),

  JWT_SECRET:              z.string().min(16),
  JWT_REFRESH_SECRET:      z.string().min(16),
  JWT_EXPIRES_IN:          z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN:  z.string().default('30d'),

  ANTHROPIC_API_KEY:       z.string().min(1),

  FCM_PROJECT_ID:          z.string().optional(),
  FCM_CLIENT_EMAIL:        z.string().optional(),
  FCM_PRIVATE_KEY:         z.string().optional(),

  DEFAULT_SEARCH_RADIUS_KM: z.string().default('5'),
  MAX_SEARCH_RADIUS_KM:     z.string().default('50'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  PORT:                     parseInt(parsed.data.PORT, 10),
  DEFAULT_SEARCH_RADIUS_KM: parseFloat(parsed.data.DEFAULT_SEARCH_RADIUS_KM),
  MAX_SEARCH_RADIUS_KM:     parseFloat(parsed.data.MAX_SEARCH_RADIUS_KM),
};
