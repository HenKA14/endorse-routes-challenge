export interface ApiErrorBody {
  statusCode?: number;
  error?: string;
  message?: string;
  code?: string;
  details?: unknown;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiResponse<T> {
  data: T;
  headers: Headers;
  status: number;
}

export interface Credentials {
  clientId: string;
  clientSecret: string;
}

type FetchFn = typeof fetch;

const EXPIRY_MARGIN_MS = 30_000;

/**
 * Cliente HTTP por API: obtiene el JWT, lo cachea hasta poco antes de expirar
 * y reintenta una sola vez si el servidor responde 401 (token revocado/rotado).
 */
export class ApiClient {
  private token: { value: string; expiresAt: number } | null = null;
  private pendingToken: Promise<string> | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly credentials: Credentials,
    private readonly fetchFn: FetchFn = (...args) => fetch(...args),
    private readonly now: () => number = Date.now,
  ) {}

  get<T>(path: string) {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body: unknown) {
    return this.request<T>('POST', path, body);
  }

  private async request<T>(method: string, path: string, body?: unknown, retried = false): Promise<ApiResponse<T>> {
    const token = await this.getToken(retried);
    const res = await this.send(method, path, body, token);

    if (res.status === 401 && !retried) {
      this.token = null;
      return this.request<T>(method, path, body, true);
    }
    return this.parse<T>(res);
  }

  private async getToken(force: boolean): Promise<string> {
    if (!force && this.token && this.token.expiresAt - EXPIRY_MARGIN_MS > this.now()) {
      return this.token.value;
    }
    // Evita pedir N tokens si se lanzan N peticiones en paralelo.
    this.pendingToken ??= this.fetchToken().finally(() => {
      this.pendingToken = null;
    });
    return this.pendingToken;
  }

  private async fetchToken(): Promise<string> {
    const res = await this.send('POST', '/v1/auth/token', this.credentials);
    const { data } = await this.parse<{ accessToken: string; expiresIn: number }>(res);
    this.token = { value: data.accessToken, expiresAt: this.now() + data.expiresIn * 1000 };
    return data.accessToken;
  }

  private async send(method: string, path: string, body: unknown, token?: string): Promise<Response> {
    try {
      return await this.fetchFn(`${this.baseUrl.replace(/\/$/, '')}${path}`, {
        method,
        headers: {
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError(`No se pudo conectar con ${this.baseUrl}. ¿Está levantado el servicio?`, 0, 'NETWORK_ERROR');
    }
  }

  private async parse<T>(res: Response): Promise<ApiResponse<T>> {
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* respuesta no JSON */
    }
    if (!res.ok) {
      const err = (json ?? {}) as ApiErrorBody;
      throw new ApiError(err.message ?? `Error HTTP ${res.status}`, res.status, err.code, err.details);
    }
    return { data: json as T, headers: res.headers, status: res.status };
  }
}
