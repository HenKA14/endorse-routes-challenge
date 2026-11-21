import { Plugin } from '@hapi/hapi';
import { AuthController } from '../../controllers/auth.controller';
import { EndorseController } from '../../controllers/endorse.controller';
import { TemplateController } from '../../controllers/template.controller';
import { authRoutes } from './auth.routes';
import { endorseRoutes } from './endorse.routes';
import { templateRoutes } from './template.routes';

export interface V1Controllers {
  endorse: EndorseController;
  templates: TemplateController;
  auth: AuthController;
}

/**
 * Versión 1 del API. Se registra con prefijo `/v1`; una v2 sería otro plugin
 * registrado con `/v2`, conviviendo mientras los clientes migran.
 */
export const v1Routes: Plugin<V1Controllers> = {
  name: 'routes-v1',
  register: (server, controllers) => {
    server.route([
      ...authRoutes(controllers.auth),
      ...endorseRoutes(controllers.endorse),
      ...templateRoutes(controllers.templates),
    ]);
  },
};
