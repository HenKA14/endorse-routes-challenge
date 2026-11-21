import { appConfig, clientCredentials } from '../config';
import { ApiClient } from './http';

export type FlatValue = string | number | boolean | null;
export type FlatPayload = Record<string, FlatValue>;

export interface TemplateInputField {
  name: string;
  required: boolean;
  defaultValue: unknown;
}

export interface TemplateSummary {
  producto: string;
  tipoEndoso: string;
  version: number;
  layout: string;
  inputFields: TemplateInputField[];
}

export interface MissingField {
  field: string;
  target: string;
}

export interface TranslateResult {
  payload: Record<string, unknown>;
  templateId: string | null;
  templateVersion: string | null;
  requestId: string | null;
  elapsedMs: number;
}

const client = new ApiClient(appConfig.endorseApiUrl, clientCredentials);

export const endorseApi = {
  baseUrl: appConfig.endorseApiUrl,

  async listTemplates(): Promise<TemplateSummary[]> {
    return (await client.get<TemplateSummary[]>('/v1/templates')).data;
  },

  async translate(payload: FlatPayload): Promise<TranslateResult> {
    const started = performance.now();
    const { data, headers } = await client.post<Record<string, unknown>>('/v1/endorse/translate', payload);
    return {
      payload: data,
      templateId: headers.get('X-Template-Id'),
      templateVersion: headers.get('X-Template-Version'),
      requestId: headers.get('X-Request-Id'),
      elapsedMs: Math.round(performance.now() - started),
    };
  },
};

export const PDF_ENDORSE_EXAMPLE: FlatPayload = {
  policyNumber: '08200000049',
  idEnvio: 5984,
  frecuencia: 'Semestral',
  tipoEndoso: 'CambioFrecuencia',
  producto: 'Rumbo',
  plan: 'PlanRumbo',
  moneda: 'Nuevo Sol',
  usuario: 'interface.servicios',
  fechaSolicitud: '2025-08-27',
  fechaCliente: '2025-08-27',
  fechaEfectiva: '2025-09-01',
};
