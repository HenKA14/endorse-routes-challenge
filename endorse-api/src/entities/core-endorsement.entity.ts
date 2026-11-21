export interface DynamicDataItem {
  etiqueta: string;
  value: unknown;
}

export interface AppliedEvent {
  description: string;
  orderEvent: number;
}

/**
 * JSON del core. Su forma la define el layout en BD, por eso se tipa como
 * objeto genérico: el servicio no conoce las claves concretas.
 */
export type CoreEndorsementDto = Record<string, unknown>;

export interface TranslationResult {
  payload: CoreEndorsementDto;
  templateId: number;
  templateVersion: number;
}
