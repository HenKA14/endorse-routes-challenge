import { ServerRoute } from '@hapi/hapi';
import { TemplateController } from '../../controllers/template.controller';
import { SCOPES } from '../../services/auth.service';

export const templateRoutes = (controller: TemplateController): ServerRoute[] => [
  {
    method: 'GET',
    path: '/templates',
    handler: controller.list,
    options: {
      tags: ['api', 'templates'],
      description: 'Lista las plantillas activas y los campos de entrada que consume cada una',
      auth: { access: { scope: [SCOPES.readTemplates] } },
    },
  },
];
