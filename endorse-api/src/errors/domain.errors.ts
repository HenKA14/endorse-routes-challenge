/** Errores de negocio: no conocen HTTP; el plugin error-handler los traduce. */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  readonly details?: unknown;

  protected constructor(message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.details = details;
  }
}

export class TemplateNotFoundError extends DomainError {
  readonly code = 'TEMPLATE_NOT_FOUND';

  constructor(producto: string, tipoEndoso: string) {
    super(`No existe una plantilla activa para producto="${producto}" y tipoEndoso="${tipoEndoso}"`, {
      producto,
      tipoEndoso,
    });
  }
}

export interface MissingField {
  /** Campo del JSON plano que debía enviarse. */
  field: string;
  /** Dónde iba a usarse (ruta del JSON del core o etiqueta de dynamicData). */
  target: string;
}

export class MissingRequiredFieldsError extends DomainError {
  readonly code = 'MISSING_REQUIRED_FIELDS';
  readonly missing: MissingField[];

  constructor(missing: MissingField[]) {
    const fields = [...new Set(missing.map((m) => m.field))];
    super(`Faltan campos requeridos por la plantilla: ${fields.join(', ')}`, { missing });
    this.missing = missing;
  }
}

export class InvalidTemplateError extends DomainError {
  readonly code = 'INVALID_TEMPLATE_CONFIG';

  constructor(message: string, details?: unknown) {
    super(message, details);
  }
}

export class InvalidCredentialsError extends DomainError {
  readonly code = 'INVALID_CREDENTIALS';

  constructor() {
    super('Credenciales de cliente inválidas');
  }
}
