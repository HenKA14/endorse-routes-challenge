import Boom from '@hapi/boom';
import { Plugin, Request, ResponseToolkit } from '@hapi/hapi';
import {
  DomainError,
  InvalidCredentialsError,
  InvalidTemplateError,
  MissingRequiredFieldsError,
  TemplateNotFoundError,
} from '../errors/domain.errors';

type ErrorCtor = abstract new (...args: never[]) => DomainError;

/** Tabla error de dominio -> status HTTP. Agregar un error = agregar una fila. */
const STATUS_BY_ERROR: Array<[ErrorCtor, number]> = [
  [TemplateNotFoundError, 404],
  [MissingRequiredFieldsError, 422],
  [InvalidCredentialsError, 401],
  [InvalidTemplateError, 500],
];

export const toBoom = (error: DomainError): Boom.Boom => {
  const status = STATUS_BY_ERROR.find(([ctor]) => error instanceof ctor)?.[1] ?? 500;
  const boom = new Boom.Boom(error.message, { statusCode: status });
  // Boom oculta el mensaje en 5xx; para errores de configuración queremos
  // exponer el código (no el detalle interno) para que soporte lo identifique.
  boom.output.payload.message = error.message;
  Object.assign(boom.output.payload, {
    code: error.code,
    ...(status < 500 && error.details ? { details: error.details } : {}),
  });
  return boom;
};

export const errorHandlerPlugin: Plugin<void> = {
  name: 'error-handler',
  register: (server) => {
    server.ext('onPreResponse', (request: Request, h: ResponseToolkit) => {
      const { response } = request;
      if (response instanceof DomainError) {
        if (response instanceof InvalidTemplateError) {
          request.log(['error', 'template'], { message: response.message, details: response.details });
        }
        return toBoom(response);
      }
      if (Boom.isBoom(response) && response.output.statusCode >= 500) {
        request.log(['error'], { message: response.message, stack: response.stack });
      }
      return h.continue;
    });
  },
};
