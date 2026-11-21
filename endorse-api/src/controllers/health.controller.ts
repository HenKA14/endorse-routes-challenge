import { ResponseToolkit, Request } from '@hapi/hapi';

/** Función que comprueba una dependencia (ej. `SELECT 1`). */
export type HealthProbe = () => Promise<void>;

export class HealthController {
  constructor(private readonly dbProbe: HealthProbe) {}

  check = async (_request: Request, h: ResponseToolkit) => {
    try {
      await this.dbProbe();
      return h.response({ status: 'ok', db: 'up' });
    } catch {
      return h.response({ status: 'degraded', db: 'down' }).code(503);
    }
  };
}
