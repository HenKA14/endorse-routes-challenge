import { ServerRoute } from '@hapi/hapi';
import { HealthController } from '../controllers/health.controller';

/** Sin versión: lo consumen el balanceador / Cloud Run, no los clientes. */
export const healthRoutes = (controller: HealthController): ServerRoute[] => [
  {
    method: 'GET',
    path: '/health',
    handler: controller.check,
    options: { auth: false, tags: ['api', 'health'], description: 'Liveness/readiness' },
  },
];
