import { ServerRoute } from '@hapi/hapi';
import Joi from 'joi';
import { EndorseController } from '../../controllers/endorse.controller';
import { translateRequestSchema } from '../../entities/translate-request.entity';
import { SCOPES } from '../../services/auth.service';

export const endorseRoutes = (controller: EndorseController): ServerRoute[] => [
  {
    method: 'POST',
    path: '/endorse/translate',
    handler: controller.translate,
    options: {
      tags: ['api', 'endorse'],
      description: 'Traduce un endoso plano al JSON estructurado del core',
      notes: 'La estructura, el orden y los valores por defecto salen de la plantilla activa (producto + tipoEndoso) en BD.',
      auth: { access: { scope: [SCOPES.translate] } },
      validate: {
        payload: translateRequestSchema,
        headers: Joi.object({ authorization: Joi.string().required() }).unknown(),
      },
      plugins: {
        'hapi-swagger': {
          responses: {
            200: { description: 'JSON listo para el core' },
            400: { description: 'JSON de entrada inválido (no plano, tipos incorrectos)' },
            401: { description: 'Token ausente o inválido' },
            404: { description: 'No existe plantilla activa para producto + tipoEndoso' },
            422: { description: 'Faltan campos requeridos por la plantilla' },
          },
        },
      },
    },
  },
];
