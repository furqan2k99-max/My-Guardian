import type { ApiErrorBody } from './types';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
export const API_V1_URL = `${API_BASE_URL}/api/v1`;

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error ?? 'Request failed');
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = body.code;
    this.requestId = body.requestId;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  token?: string;
  body?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', token, body } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_V1_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      `Network error reaching ${API_V1_URL}${path} — is the backend running, and is EXPO_PUBLIC_API_URL correct?`,
    );
  }

  let payload: unknown = null;
  const text = await response.text();
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new ApiRequestError(response.status, (payload as ApiErrorBody) ?? {
      error: 'Request failed',
      code: 'UNKNOWN',
      requestId: '',
    });
  }

  return payload as T;
}

export const apiRequest = request;