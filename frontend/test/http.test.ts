import { describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError } from '../src/api/http';

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

const tokenResponse = (token = 'tok-1', expiresIn = 3600) => json(200, { accessToken: token, expiresIn });

describe('ApiClient', () => {
  const creds = { clientId: 'id', clientSecret: 'secret' };

  it('obtiene un token, lo envía como Bearer y lo reutiliza', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(json(200, { a: 1 }))
      .mockResolvedValueOnce(json(200, { b: 2 }));
    const client = new ApiClient('http://api/', creds, fetchFn);

    expect((await client.get('/x')).data).toEqual({ a: 1 });
    expect((await client.post('/y', { z: 1 })).data).toEqual({ b: 2 });

    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(fetchFn.mock.calls[0][0]).toBe('http://api/v1/auth/token');
    expect(JSON.parse(fetchFn.mock.calls[0][1].body)).toEqual(creds);
    expect(fetchFn.mock.calls[1][1].headers.Authorization).toBe('Bearer tok-1');
    expect(fetchFn.mock.calls[2][1].headers['Content-Type']).toBe('application/json');
  });

  it('renueva el token cuando está por expirar', async () => {
    let now = 0;
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse('t1', 60))
      .mockResolvedValueOnce(json(200, {}))
      .mockResolvedValueOnce(tokenResponse('t2', 60))
      .mockResolvedValueOnce(json(200, {}));
    const client = new ApiClient('http://api', creds, fetchFn, () => now);

    await client.get('/x');
    now = 45_000; // dentro del margen de 30 s antes de expirar
    await client.get('/x');

    expect(fetchFn.mock.calls[3][1].headers.Authorization).toBe('Bearer t2');
  });

  it('reintenta una vez con token nuevo si recibe 401', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse('viejo'))
      .mockResolvedValueOnce(json(401, { message: 'expired' }))
      .mockResolvedValueOnce(tokenResponse('nuevo'))
      .mockResolvedValueOnce(json(200, { ok: true }));
    const client = new ApiClient('http://api', creds, fetchFn);

    expect((await client.get('/x')).data).toEqual({ ok: true });
    expect(fetchFn.mock.calls[3][1].headers.Authorization).toBe('Bearer nuevo');
  });

  it('comparte una única petición de token entre llamadas concurrentes', async () => {
    const fetchFn = vi.fn(async (url: string) => (url.endsWith('/token') ? tokenResponse() : json(200, {})));
    const client = new ApiClient('http://api', creds, fetchFn as unknown as typeof fetch);

    await Promise.all([client.get('/a'), client.get('/b'), client.get('/c')]);

    expect(fetchFn.mock.calls.filter(([url]) => url.endsWith('/token'))).toHaveLength(1);
  });

  it('convierte errores del API en ApiError con code y details', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        json(422, { message: 'Faltan campos', code: 'MISSING_REQUIRED_FIELDS', details: { missing: [{ field: 'plan' }] } }),
      );
    const client = new ApiClient('http://api', creds, fetchFn);

    const error = await client.post('/t', {}).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, code: 'MISSING_REQUIRED_FIELDS', message: 'Faltan campos' });
    expect(error.details).toEqual({ missing: [{ field: 'plan' }] });
  });

  it('reporta errores de red de forma legible', async () => {
    const client = new ApiClient('http://api', creds, vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(client.get('/x')).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
  });

  it('tolera respuestas de error no JSON', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response('<html>502</html>', { status: 502 }));
    const client = new ApiClient('http://api', creds, fetchFn);
    await expect(client.get('/x')).rejects.toMatchObject({ status: 502, message: 'Error HTTP 502' });
  });
});
