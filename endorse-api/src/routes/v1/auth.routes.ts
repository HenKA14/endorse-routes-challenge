import { ServerRoute } from '@hapi/hapi';
import Joi from 'joi';
import { AuthController } from '../../controllers/auth.controller';

export const authRoutes = (controller: AuthController): ServerRoute[] => [
  {
    method: 'POST',
    path: '/auth/token',
    handler: controller.token,
    options: {
      auth: false,
      tags: ['api', 'auth'],
      description: 'Obtiene un JWT (client credentials)',
      validate: {
        payload: Joi.object({
          clientId: Joi.string().max(100).required(),
          clientSecret: Joi.string().max(200).required(),
        }).label('TokenRequest'),
      },
    },
  },
];
