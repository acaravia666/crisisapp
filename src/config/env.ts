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

  CLOUDINARY_URL:          z.string().optional(),
  CLOUDINARY_CLOUD_NAME:   z.string().optional(),
  CLOUDINARY_API_KEY:      z.string().optional(),
  CLOUDINARY_API_SECRET:   z.string().optional(),

  DEFAULT_SEARCH_RADIUS_KM: z.string().default('5'),
  MAX_SEARCH_RADIUS_KM:     z.string().default('50'),
});

const isVercelBuild = process.env.VERCEL && process.env.NODE_ENV === 'production';
const result = envSchema.safeParse(process.env);

if (!result.success && !isVercelBuild) {
  console.error('❌ Invalid environment variables during local execution:');
  console.error(result.error.flatten().fieldErrors);
  process.exit(1);
}

// Use parsed data or empty object with defaults during build
const data = result.success ? result.data : ({} as any);

export const env = {
  ...data,
  PORT:                     parseInt(data.PORT || '3000', 10),
  DATABASE_URL:             data.DATABASE_URL || '',
  JWT_SECRET:               data.JWT_SECRET || '',
  JWT_REFRESH_SECRET:       data.JWT_REFRESH_SECRET || '',
  ANTHROPIC_API_KEY:        data.ANTHROPIC_API_KEY || '',
  DEFAULT_SEARCH_RADIUS_KM: parseFloat(data.DEFAULT_SEARCH_RADIUS_KM || '5'),
  MAX_SEARCH_RADIUS_KM:     parseFloat(data.MAX_SEARCH_RADIUS_KM || '50'),
};
