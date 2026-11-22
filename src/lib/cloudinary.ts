import { Platform } from 'react-native';

const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
const DEFAULT_FOLDER = process.env.EXPO_PUBLIC_CLOUDINARY_FOLDER || 'puran-haat';

/**
 * Cloudinary unsigned uploads.
 *
 * Firebase Storage is not available on the current Firebase plan, so listing
 * and profile photos are uploaded straight from the client with an unsigned
 * upload preset. Configure these in .env.local:
 *
 *   EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
 *   EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your-unsigned-preset
 *   EXPO_PUBLIC_CLOUDINARY_FOLDER=puran-haat   (optional)
 *
 * The preset must allow unsigned uploads in Cloudinary. Never put an API
 * secret in an EXPO_PUBLIC_ variable — it ships inside the app bundle.
 */
export function isCloudinaryConfigured(): boolean {
  return Boolean(CLOUD_NAME && UPLOAD_PRESET);
}

export function cloudinaryConfigHint(): string {
  return [
    'Photo uploads need Cloudinary. Add these to .env.local and restart Expo:',
    'EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name',
    'EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your-unsigned-preset',
  ].join('\n');
}

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
};

function extensionFor(uri: string): string {
  const clean = uri.split('?')[0].split('#')[0];
  const match = clean.match(/\.([a-zA-Z0-9]+)$/);
  const extension = match?.[1]?.toLowerCase();
  return extension && MIME_BY_EXTENSION[extension] ? extension : 'jpg';
}

function mimeFor(uri: string): string {
  return MIME_BY_EXTENSION[extensionFor(uri)] || 'image/jpeg';
}

function fileNameFor(uri: string): string {
  const extension = extensionFor(uri);
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `photo-${unique}.${extension}`;
}

interface CloudinaryResponse {
  secure_url?: string;
  url?: string;
  error?: { message?: string };
}

export interface UploadImageOptions {
  folder?: string;
}

/**
 * Upload one local image URI (file://, blob:, data:, or http(s)) to Cloudinary
 * and return the public HTTPS URL stored on the item/profile document.
 */
export async function uploadImageToCloudinary(
  uri: string,
  options: UploadImageOptions = {},
): Promise<string> {
  if (!isCloudinaryConfigured()) {
    throw new Error(cloudinaryConfigHint());
  }

  const folder = options.folder || DEFAULT_FOLDER;
  const form = new FormData();
  form.append('upload_preset', UPLOAD_PRESET as string);
  form.append('folder', folder);

  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('Could not read the selected photo.');
    const blob = await response.blob();
    form.append('file', blob, fileNameFor(uri));
  } else {
    const name = fileNameFor(uri);
    form.append('file', {
      uri,
      name,
      type: mimeFor(uri),
    } as unknown as Blob);
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
  let response: Response;
  try {
    response = await fetch(endpoint, { method: 'POST', body: form });
  } catch {
    throw new Error('Could not reach Cloudinary. Check your internet connection and try again.');
  }

  const payload = (await response.json().catch(() => ({}))) as CloudinaryResponse;

  if (!response.ok || payload.error) {
    throw new Error(
      payload.error?.message ||
        `Cloudinary rejected the upload (HTTP ${response.status}). Check the cloud name and upload preset.`,
    );
  }

  const url = payload.secure_url || payload.url;
  if (!url) throw new Error('Cloudinary did not return an image URL.');

  return url;
}

/** Upload images in order, reporting which one failed. */
export async function uploadImagesToCloudinary(
  uris: string[],
  options: UploadImageOptions = {},
): Promise<string[]> {
  const uploaded: string[] = [];
  for (let index = 0; index < uris.length; index += 1) {
    try {
      uploaded.push(await uploadImageToCloudinary(uris[index], options));
    } catch (error) {
      const message = (error as Error).message;
      throw new Error(
        uris.length > 1 ? `Photo ${index + 1} failed to upload. ${message}` : message,
      );
    }
  }
  return uploaded;
}