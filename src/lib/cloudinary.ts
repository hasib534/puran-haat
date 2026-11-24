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

/** Turn a thrown transport error into something a trader can act on. */
function describeRequestError(error: unknown): string {
  const candidate = error as { name?: string; message?: string } | null;
  const message = typeof candidate?.message === 'string' ? candidate.message.trim() : '';

  // React Native reports an unreadable picker URI through this message; it is
  // not a network problem at all and saying "check your connection" would send
  // the user chasing the wrong thing.
  if (/Could not retrieve file for uri/i.test(message)) {
    return 'the photo could not be read from this device — try picking it again';
  }
  if (/Network request failed/i.test(message)) {
    return 'the connection dropped during the upload';
  }
  if (message) return message;
  if (candidate?.name) return candidate.name;
  return 'the request failed';
}

// Uploading several megabytes over mobile data fails intermittently ("Network
// request failed", a dropped socket, a flaky handover between Wi-Fi and data),
// so retry the transport itself before telling the user their connection is
// bad. A failed *response* is never retried here — that is a configuration
// problem and retrying would just burn the user's data again.
const UPLOAD_ATTEMPTS = 3;

async function postFormWithRetry(endpoint: string, form: FormData): Promise<Response> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= UPLOAD_ATTEMPTS; attempt += 1) {
    try {
      return await fetch(endpoint, { method: 'POST', body: form });
    } catch (error) {
      lastError = error;
      if (attempt < UPLOAD_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
      }
    }
  }

  throw lastError;
}

/**
 * Explain why an upload never got an answer.
 *
 * The distinction matters: if a plain request to the same host also fails, the
 * phone cannot reach Cloudinary at all (VPN, private DNS or carrier filtering)
 * and retrying the upload will never help. If the probe succeeds, the host is
 * fine and the connection died mid-upload, which is worth retrying.
 */
async function describeUploadFailure(error: unknown, endpoint: string): Promise<string> {
  const reason = describeRequestError(error);

  // A file that cannot be read is not a network fault; say so plainly.
  if (reason.includes('could not be read from this device')) return reason;

  try {
    await fetch(endpoint, { method: 'HEAD' });
    return `${reason}. Cloudinary is reachable, so the upload itself was interrupted — please try again.`;
  } catch {
    return (
      `${reason}. This phone cannot reach api.cloudinary.com at all, so the ` +
      'upload never started. Check mobile data or Wi-Fi, and turn off any VPN ' +
      'or private DNS before trying again.'
    );
  }
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
      response = await postFormWithRetry(endpoint, form);
    } catch (error) {
      console.warn('Cloudinary upload request failed:', error);
      throw new Error(await describeUploadFailure(error, endpoint));
    }
    const payload = (await response.json().catch(() => ({}))) as CloudinaryResponse;
    return { response, payload };
  };

  // Attempts are tried in order. On native there is only one: a picked photo is
  // a file:// path in the app cache, and retrying it as a blob through
  // fetch(uri) does not work on Android (fetch cannot open file: or content:
  // URIs), so that fallback only wasted a second multi-megabyte upload before
  // failing with a different, less useful message.
  const attempts: (() => Promise<{ response: Response; payload: CloudinaryResponse }>)[] = [];

  if (Platform.OS === 'web') {
    const source = await fetch(uri);
    if (!source.ok) throw new Error('Could not read the selected photo.');
    const blob = await source.blob();
    attempts.push(() => send(buildForm((form) => form.append('file', blob, fileNameFor(uri)))));
  } else {
    attempts.push(() =>
      send(
        buildForm((form) =>
          form.append('file', {
            uri,
            name: fileNameFor(uri),
            type: mimeFor(uri),
          } as unknown as Blob),
        ),
      ),
    );
  }

  // Prefer Cloudinary's own explanation (it means the request arrived) over a
  // transport error, but report the transport error when nothing got through.
  let serverError: string | null = null;
  let requestError: Error | null = null;

  for (const attempt of attempts) {
    let outcome: { response: Response; payload: CloudinaryResponse };
    try {
      outcome = await attempt();
    } catch (error) {
      requestError = error as Error;
      continue;
    }

    if (outcome.response.ok && !outcome.payload.error) {
      const url = outcome.payload.secure_url || outcome.payload.url;
      if (!url) throw new Error('Cloudinary did not return an image URL.');
      return url;
    }

    serverError =
      outcome.payload.error?.message ||
      `Cloudinary rejected the upload (HTTP ${outcome.response.status}). Check the cloud name and upload preset.`;
  }

  throw new Error(
    serverError || requestError?.message || 'Could not upload the photo. Please try again.',
  );
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