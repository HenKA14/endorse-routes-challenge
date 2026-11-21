import { Server } from '@hapi/hapi';
import { loadConfig } from '../../src/config/env';
import { buildContainer } from '../../src/container';
import { RUMBO_CAMBIO_FRECUENCIA, RUMBO_CAMBIO_MONEDA } from '../../src/database/seeds/reference-data';
import { createServer } from '../../src/server';
import { InMemoryTemplateRepository } from '../fixtures/in-memory-template.repository';
import { PDF_INPUT, PDF_OUTPUT } from '../fixtures/pdf-example';
import { buildLayout, buildTemplateModel } from '../fixtures/template.fixture';

/**
 * Pruebas de la capa HTTP completa (routes -> controller -> service) con
 * `server.inject`: sin red ni BD, el repositorio es in-memory.
 */
describe('API v1 (HTTP)', () => {
  const config = loadConfig({ NODE_ENV: 'test' });
  let server: Server;
  let dbUp = true;
  let token: string;

  const translate = (payload: unknown, auth = `Bearer ${token}`) =>
    server.inject({ method: 'POST', url: '/v1/endorse/translate', payload: payload as object, headers: { authorization: auth } });

  beforeAll(async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const repo = new InMemoryTemplateRepository([
      buildTemplateModel(RUMBO_CAMBIO_FRECUENCIA, { id: 7 }),
      buildTemplateModel({ ...RUMBO_CAMBIO_MONEDA, product: 'Roto' }, { layout: buildLayout([]) }),
    ]);
    const container = buildContainer(config, {
      templateRepository: repo,
      dbProbe: async () => {
        if (!dbUp) throw new Error('down');
      },
    });
    server = await createServer(config, container, { swagger: false, logRequests: false });
    await server.initialize();

    const res = await server.inject({
      method: 'POST',
      url: '/v1/auth/token',
      payload: { clientId: config.auth.clientId, clientSecret: config.auth.clientSecret },
    });
    token = (res.result as { accessToken: string }).accessToken;
  });

  afterAll(() => server.stop());

  describe('POST /v1/auth/token', () => {
    it('401 con credenciales inválidas', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/v1/auth/token',
        payload: { clientId: 'x', clientSecret: 'y' },
      });
      expect(res.statusCode).toBe(401);
      expect(res.result).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    it('400 si falta el payload', async () => {
      const res = await server.inject({ method: 'POST', url: '/v1/auth/token', payload: {} });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /v1/endorse/translate', () => {
    it('200 con el JSON del core para el ejemplo del enunciado', async () => {
      const res = await translate(PDF_INPUT);

      expect(res.statusCode).toBe(200);
      expect(res.payload).toBe(JSON.stringify(PDF_OUTPUT));
      expect(res.headers['x-template-id']).toBe('7');
      expect(res.headers['x-template-version']).toBe('1');
      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
      expect(String(res.headers['x-request-id'])).not.toContain(require('node:os').hostname());
      expect(res.headers['x-frame-options']).toBe('DENY');
    });

    it('401 sin token', async () => {
      const res = await server.inject({ method: 'POST', url: '/v1/endorse/translate', payload: PDF_INPUT });
      expect(res.statusCode).toBe(401);
    });

    it('401 con token manipulado', async () => {
      const res = await translate(PDF_INPUT, `Bearer ${token.slice(0, -2)}xx`);
      expect(res.statusCode).toBe(401);
    });

    it('400 si el JSON no es plano', async () => {
      const res = await translate({ ...PDF_INPUT, nested: { a: 1 } });
      expect(res.statusCode).toBe(400);
      expect((res.result as { message: string }).message).toContain('JSON debe ser plano');
    });

    it('400 si faltan producto o tipoEndoso', async () => {
      const res = await translate({ policyNumber: '1' });
      expect(res.statusCode).toBe(400);
      expect((res.result as { message: string }).message).toContain('producto');
    });

    it('404 si no existe plantilla', async () => {
      const res = await translate({ producto: 'Rumbo', tipoEndoso: 'Nada' });
      expect(res.statusCode).toBe(404);
      expect(res.result).toMatchObject({ code: 'TEMPLATE_NOT_FOUND' });
    });

    it('422 con el detalle de campos faltantes', async () => {
      const res = await translate({ producto: 'Rumbo', tipoEndoso: 'CambioFrecuencia' });
      const body = res.result as { code: string; details: { missing: Array<{ field: string }> } };

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe('MISSING_REQUIRED_FIELDS');
      expect(body.details.missing.map((m) => m.field)).toEqual(
        expect.arrayContaining(['policyNumber', 'idEnvio', 'frecuencia', 'moneda', 'plan', 'usuario']),
      );
    });

    it('500 con código (sin detalles internos) si la plantilla está mal configurada', async () => {
      const res = await translate({ producto: 'Roto', tipoEndoso: 'CambioMoneda' });
      expect(res.statusCode).toBe(500);
      expect(res.result).toMatchObject({ code: 'INVALID_TEMPLATE_CONFIG' });
      expect(res.result).not.toHaveProperty('details');
    });
  });

  describe('GET /v1/templates', () => {
    it('lista las plantillas válidas', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/v1/templates',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.result).toEqual([expect.objectContaining({ producto: 'Rumbo', tipoEndoso: 'CambioFrecuencia' })]);
    });
  });

  it('propaga un X-Request-Id entrante válido y descarta uno malicioso', async () => {
    const ok = await server.inject({ url: '/health', headers: { 'x-request-id': 'abc-123' } });
    expect(ok.headers['x-request-id']).toBe('abc-123');

    const bad = await server.inject({ url: '/health', headers: { 'x-request-id': '<script>' } });
    expect(bad.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  describe('GET /health', () => {
    it('200 cuando la BD responde', async () => {
      dbUp = true;
      const res = await server.inject('/health');
      expect(res.statusCode).toBe(200);
    });

    it('503 cuando la BD no responde', async () => {
      dbUp = false;
      const res = await server.inject('/health');
      expect(res.statusCode).toBe(503);
      dbUp = true;
    });
  });

  it('rutas sin versión no existen', async () => {
    const res = await translate(PDF_INPUT).then(() =>
      server.inject({ method: 'POST', url: '/endorse/translate', payload: PDF_INPUT }),
    );
    expect(res.statusCode).toBe(404);
  });
});
