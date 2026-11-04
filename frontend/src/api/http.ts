const API_URL = `${(import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '')}/api`;

export class ApiError extends Error {
  readonly status: number;
  readonly messages: string[];

  constructor(status: number, messages: string[]) {
    super(messages.join('. '));
    this.status = status;
    this.messages = messages;
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

let tokenProvider: () => string | null = () => null;
let unauthorizedHandler: () => void = () => undefined;

// La sesión registra estas funciones para evitar una dependencia circular con la store
export function configureHttp(getToken: () => string | null, onUnauthorized: () => void): void {
  tokenProvider = getToken;
  unauthorizedHandler = onUnauthorized;
}

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const token = tokenProvider();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // En el plan gratuito de Render la API puede tardar cerca de un minuto en despertar
    throw new ApiError(0, ['No se pudo conectar con el servidor. Intenta nuevamente en unos segundos']);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const raw = (data as { message?: string | string[] } | null)?.message;
    const messages = Array.isArray(raw) ? raw : [raw ?? 'Ocurrió un error inesperado'];
    if (response.status === 401 && token) {
      unauthorizedHandler();
    }
    throw new ApiError(response.status, messages);
  }
  return data as T;
}

export function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

export function errorMessages(error: unknown): string[] {
  if (error instanceof ApiError) {
    return error.messages;
  }
  return ['Ocurrió un error inesperado'];
}
