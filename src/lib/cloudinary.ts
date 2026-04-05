import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env';

// Configure from CLOUDINARY_URL env var (format: cloudinary://key:secret@cloud_name)
// or from individual vars
if (env.CLOUDINARY_URL) {
  cloudinary.config({ cloudinary_url: env.CLOUDINARY_URL });
} else if (env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key:    env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export { cloudinary };

/**
 * Upload a buffer to Cloudinary and return the secure URL.
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  folder = 'crisisapp',
  resourceType: 'image' | 'auto' = 'image',
): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Cloudinary upload failed'));
        resolve(result.secure_url);
      },
    );
    stream.end(buffer);
  });
}
