import Boom from '@hapi/boom';
import Hapi, { Request, ResponseToolkit, Server } from '@hapi/hapi';
import { randomUUID } from 'node:crypto';
import { AppConfig } from './config/env';
import { Container } from './container';
import { authPlugin } from './plugins/auth.plugin';
import { errorHandlerPlugin } from './plugins/error-handler.plugin';
import { registerSwagger } from './plugins/swagger.plugin';
import { healthRoutes } from './routes/health.routes';
import { v1Routes } from './routes/v1';

interface RequestApp {
  requestId?: string;
}

const REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

export const requestIdOf = (request: Request): string => (request.app as RequestApp).requestId ?? randomUUID();

export interface ServerOptions {
  swagger?: boolean;
  logRequests?: boolean;
}

/**
 * Crea (sin arrancar) el servidor. Recibe las dependencias ya construidas, por
 * lo que en tests se inyectan fakes y se usa `server.inject` sin red ni BD.
 */
export const createServer = async (
  config: AppConfig,
  container: Container,
  options: ServerOptions = {},
): Promise<Server> => {
  const server = Hapi.server({
    host: config.host,
    port: config.port,
    routes: {
      cors: {
        origin: config.corsOrigins,
        additionalExposedHeaders: ['X-Template-Id', 'X-Template-Version', 'X-Request-Id'],
      },
      security: { hsts: true, xframe: 'deny', noSniff: true, referrer: 'no-referrer' },
      payload: { maxBytes: 64 * 1024 },
      validate: {
        // Por defecto Hapi oculta el detalle de validación; lo exponemos (400).
        failAction: (_request: Request, _h: ResponseToolkit, error?: Error) => {
          throw Boom.badRequest(error?.message ?? 'Payload inválido');
        },
      },
    },
  });

  await server.register({ plugin: authPlugin, options: config.auth });
  await server.register(errorHandlerPlugin);
  if (options.swagger ?? true) {
    await registerSwagger(server);
  }

  server.route(healthRoutes(container.health));
  await server.register({ plugin: v1Routes, options: container.v1 }, { routes: { prefix: '/v1' } });

  // El id por defecto de Hapi incluye el hostname y el PID del servidor: no se
  // expone. Se propaga el X-Request-Id entrante (si es razonable) o un UUID.
  server.ext('onRequest', (request, h) => {
    const incoming = request.headers['x-request-id'];
    (request.app as RequestApp).requestId =
      typeof incoming === 'string' && REQUEST_ID.test(incoming) ? incoming : randomUUID();
    return h.continue;
  });

  server.ext('onPreResponse', (request, h) => {
    const { response } = request;
    const requestId = requestIdOf(request);
    if (Boom.isBoom(response)) {
      response.output.headers['X-Request-Id'] = requestId;
    } else {
      response.header('X-Request-Id', requestId);
    }
    return h.continue;
  });

  if (options.logRequests ?? config.env !== 'test') {
    server.events.on('response', (request) => {
      const status = Boom.isBoom(request.response) ? request.response.output.statusCode : request.response.statusCode;
      console.log(
        JSON.stringify({
          severity: status >= 500 ? 'ERROR' : 'INFO',
          requestId: requestIdOf(request),
          method: request.method.toUpperCase(),
          path: request.path,
          status,
          latencyMs: Date.now() - request.info.received,
        }),
      );
    });
    server.events.on({ name: 'request', channels: 'app' }, (_request, event) => {
      console.error(JSON.stringify({ severity: 'ERROR', tags: event.tags, data: event.data }));
    });
  }

  return server;
};
