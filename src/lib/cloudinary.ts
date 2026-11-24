import { Platform } from 'react-native';

const CLOUD_NAME = (process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || '').trim();
const UPLOAD_PRESET = (process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '').trim();
const DEFAULT_FOLDER = (process.env.EXPO_PUBLIC_CLOUDINARY_FOLDER || '').trim() || 'puran-haat';

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

  // Trailing whitespace inside an env value (a stray \r from a CRLF .env file,
  // for example) makes Cloudinary reject the request with "folder must not end
  // with a whitespace" or "Upload preset not found". Trim before sending.
  const folder = (options.folder || DEFAULT_FOLDER).trim();
  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

  const buildForm = (appendFile: (form: FormData) => void): FormData => {
    const form = new FormData();
    form.append('upload_preset', UPLOAD_PRESET as string);
    form.append('folder', folder);
    appendFile(form);
    return form;
  };

  const send = async (
    form: FormData,
  ): Promise<{ response: Response; payload: CloudinaryResponse }> => {
    let response: Response;
    try {
      response = await fetch(endpoint, { method: 'POST', body: form });
    } catch {
      throw new Error('Could not reach Cloudinary. Check your internet connection and try again.');
    }
    const payload = (await response.json().catch(() => ({}))) as CloudinaryResponse;
    return { response, payload };
  };

  let response: Response;
  let payload: CloudinaryResponse;

  if (Platform.OS === 'web') {
    const source = await fetch(uri);
    if (!source.ok) throw new Error('Could not read the selected photo.');
    const blob = await source.blob();
    const webForm = buildForm((form) => form.append('file', blob, fileNameFor(uri)));
    ({ response, payload } = await send(webForm));
  } else {
    const nativeForm = buildForm((form) => {
      form.append('file', {
        uri,
        name: fileNameFor(uri),
        type: mimeFor(uri),
      } as unknown as Blob);
    });
    ({ response, payload } = await send(nativeForm));

    // The Android photo picker sometimes hands back a URI whose bytes the
    // multipart encoder cannot stream, which Cloudinary rejects as an invalid
    // file. Re-read it as a blob and retry once before surfacing the error.
    if (!response.ok) {
      try {
        const blob = await (await fetch(uri)).blob();
        if (blob.size > 0) {
          const retryForm = buildForm((form) => form.append('file', blob, fileNameFor(uri)));
          ({ response, payload } = await send(retryForm));
        }
      } catch {
        // Keep the original failure; it carries Cloudinary's own message.
      }
    }
  }

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