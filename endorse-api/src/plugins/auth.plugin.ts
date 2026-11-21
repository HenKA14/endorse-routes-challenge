import Jwt from '@hapi/jwt';
import { Plugin } from '@hapi/hapi';
import { AppConfig } from '../config/env';

/** Valida JWT HS256 (firma, exp, aud, iss) y lo aplica por defecto a todas las rutas. */
export const authPlugin: Plugin<AppConfig['auth']> = {
  name: 'auth',
  register: async (server, config) => {
    await server.register(Jwt);

    server.auth.strategy('jwt', 'jwt', {
      keys: { key: config.jwtSecret, algorithms: ['HS256'] },
      verify: {
        aud: config.audience,
        iss: config.issuer,
        sub: false,
        nbf: true,
        exp: true,
        maxAgeSec: config.ttlSeconds,
        timeSkewSec: 15,
      },
      validate: (artifacts: { decoded: { payload: { sub: string; scope?: string[] } } }) => ({
        isValid: true,
        credentials: { clientId: artifacts.decoded.payload.sub, scope: artifacts.decoded.payload.scope ?? [] },
      }),
    });

    server.auth.default('jwt');
  },
};
