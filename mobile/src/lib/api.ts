import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Where the Pharm-LIT API lives.
 *  - EXPO_PUBLIC_API_URL wins if set (use this for production builds).
 *  - On web we call the same origin (the API serves the web build, or Metro proxies /api).
 *  - On a phone running Expo Go we reuse the dev machine's IP on port 4000.
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (Platform.OS === 'web') {
    // `npm run web` (Metro on :8081) → talk to the API on :4000; otherwise same origin.
    if (typeof window !== 'undefined' && window.location.port === '8081') {
      return `${window.location.protocol}//${window.location.hostname}:4000`;
    }
    return '';
  }
  const hostUri = Constants.expoConfig?.hostUri; // e.g. "192.168.1.20:8081"
  const host = hostUri?.split(':')[0];
  return host ? `http://${host}:4000` : 'http://localhost:4000';
}

export const API_URL = resolveBaseUrl();

let authToken: string | null = null;
export const setApiToken = (t: string | null) => {
  authToken = t;
};
export const getApiToken = () => authToken;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export async function api<T = any>(method: Method, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach Pharm-LIT. Check your internet connection.');
  }
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    throw new ApiError(res.status, data?.error || `Request failed (${res.status})`, data?.details);
  }
  return data as T;
}

/** URL for an authenticated file (e.g. prescription image) usable in <Image>. */
export function authedUrl(path: string) {
  const sep = path.includes('?') ? '&' : '?';
  return `${API_URL}${path}${authToken ? `${sep}token=${encodeURIComponent(authToken)}` : ''}`;
}
