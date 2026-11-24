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

/** What a single upload strategy managed to get back from Cloudinary. */
interface UploadOutcome {
  ok: boolean;
  status: number;
  payload: CloudinaryResponse;
}

interface UploadTarget {
  endpoint: string;
  uri: string;
  folder: string;
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

function parseCloudinaryBody(text: string): CloudinaryResponse {
  if (!text || !text.trim()) return {};
  try {
    return JSON.parse(text) as CloudinaryResponse;
  } catch {
    // Cloudinary answered with something that is not JSON (an HTML error page
    // from an upstream proxy, for example). Keep a slice so the cause is
    // visible instead of being swallowed.
    return { error: { message: text.trim().slice(0, 160) } };
  }
}

/**
 * Strategy 1: React Native's own networking, posting a `{uri, name, type}`
 * part. This is the normal path and works on most devices.
 */
async function uploadWithFetch(target: UploadTarget): Promise<UploadOutcome> {
  const form = new FormData();
  form.append('upload_preset', UPLOAD_PRESET);
  form.append('folder', target.folder);
  form.append('file', {
    uri: target.uri,
    name: fileNameFor(target.uri),
    type: mimeFor(target.uri),
  } as unknown as Blob);

  const response = await postFormWithRetry(target.endpoint, form);
  const text = await response.text().catch(() => '');
  return { ok: response.ok, status: response.status, payload: parseCloudinaryBody(text) };
}

/**
 * Strategy 2: Expo's native upload task, which streams the file from disk
 * itself instead of going through React Native's FormData encoder.
 *
 * This exists because some devices fail strategy 1 for every photo with a bare
 * "Network request failed" while the network is demonstrably fine (the same
 * account uploads from a browser over the same connection). The two paths share
 * no JavaScript, so retrying through this one either works or proves the
 * failure is not in the encoder. Both modules already ship inside the app.
 */
async function uploadWithFileSystem(target: UploadTarget): Promise<UploadOutcome> {
  const { File, UploadType } = await import('expo-file-system');

  const result = await new File(target.uri).upload(target.endpoint, {
    httpMethod: 'POST',
    uploadType: UploadType.MULTIPART,
    fieldName: 'file',
    mimeType: mimeFor(target.uri),
    parameters: { upload_preset: UPLOAD_PRESET, folder: target.folder },
  });

  return {
    ok: result.status >= 200 && result.status < 300,
    status: result.status,
    payload: parseCloudinaryBody(result.body),
  };
}

/**
 * Explain why no upload strategy got an answer.
 *
 * The distinction matters: if a plain request to the same host also fails, the
 * phone cannot reach Cloudinary at all (VPN, private DNS or carrier filtering)
 * and retrying the upload will never help. If the probe succeeds, the host is
 * fine and the upload itself is what broke.
 */
async function describeUploadFailure(error: unknown, endpoint: string): Promise<string> {
  const reason = describeRequestError(error);

  // A file that cannot be read is not a network fault; say so plainly.
  if (reason.includes('could not be read from this device')) return reason;

  try {
    await fetch(endpoint, { method: 'HEAD' });
    return `${reason}. Cloudinary is reachable, so the upload itself failed — please try again.`;
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

  if (Platform.OS === 'web') {
    const source = await fetch(uri);
    if (!source.ok) throw new Error('Could not read the selected photo.');
    const blob = await source.blob();

    const form = new FormData();
    form.append('upload_preset', UPLOAD_PRESET);
    form.append('folder', folder);
    form.append('file', blob, fileNameFor(uri));

    const response = await fetch(endpoint, { method: 'POST', body: form });
    const text = await response.text().catch(() => '');
    const payload = parseCloudinaryBody(text);
    if (response.ok && !payload.error) {
      const publicUrl = payload.secure_url || payload.url;
      if (!publicUrl) throw new Error('Cloudinary did not return an image URL.');
      return publicUrl;
    }
    throw new Error(
      payload.error?.message ||
        `Cloudinary rejected the upload (HTTP ${response.status}). Check the cloud name and upload preset.`,
    );
  }

  const target: UploadTarget = { endpoint, uri, folder };
  const strategies = [() => uploadWithFetch(target), () => uploadWithFileSystem(target)];

  // Prefer Cloudinary's own explanation (it means a request arrived) over a
  // transport error, but report the transport error when nothing got through.
  let serverError: string | null = null;
  let transportError: unknown = null;

  for (const strategy of strategies) {
    let outcome: UploadOutcome;
    try {
      outcome = await strategy();
    } catch (error) {
      console.warn('Cloudinary upload strategy failed:', error);
      transportError = error;
      continue;
    }

    if (outcome.ok && !outcome.payload.error) {
      const publicUrl = outcome.payload.secure_url || outcome.payload.url;
      if (!publicUrl) throw new Error('Cloudinary did not return an image URL.');
      return publicUrl;
    }

    serverError =
      outcome.payload.error?.message ||
      `Cloudinary rejected the upload (HTTP ${outcome.status}). Check the cloud name and upload preset.`;
  }

  if (serverError) throw new Error(serverError);
  throw new Error(await describeUploadFailure(transportError, endpoint));
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