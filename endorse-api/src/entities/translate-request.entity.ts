import Joi from 'joi';

export type FlatValue = string | number | boolean | null;

/**
 * DTO de entrada: JSON plano. Solo `producto` y `tipoEndoso` son obligatorios a
 * nivel de contrato (identifican la plantilla); el resto de obligatoriedad la
 * define la plantilla configurada en BD.
 */
export interface TranslateRequestDto {
  producto: string;
  tipoEndoso: string;
  [field: string]: FlatValue;
}

const FIELD_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

export const translateRequestSchema = Joi.object<TranslateRequestDto>({
  producto: Joi.string().trim().min(1).max(50).required(),
  tipoEndoso: Joi.string().trim().min(1).max(50).required(),
})
  .pattern(
    FIELD_NAME,
    Joi.alternatives()
      .try(Joi.string().max(500).allow(''), Joi.number(), Joi.boolean(), Joi.valid(null))
      .messages({ 'alternatives.types': '{#label} debe ser string, number, boolean o null (el JSON debe ser plano)' }),
  )
  .max(100)
  .messages({
    'object.unknown': 'El nombre de campo {#label} no es válido',
  })
  .label('TranslateRequest')
  .example({
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
  });
