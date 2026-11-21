/**
 * Datos de referencia (plantillas). Se usan en la migración de seed y en los
 * tests como fixture, para que ambos describan exactamente la misma plantilla.
 */
export interface LayoutFieldSeed {
  targetPath: string;
  sourcePath?: string;
  defaultValue?: unknown;
  isRequired?: boolean;
}

export interface DynamicFieldSeed {
  label: string;
  sourceField?: string;
  defaultValue?: unknown;
  isRequired?: boolean;
}

export interface TemplateSeed {
  product: string;
  endorsementType: string;
  layout: string;
  version: number;
  eventDescription: string;
  dynamicFields: DynamicFieldSeed[];
  events: string[];
}

export const PRODUCTS = [{ code: 'Rumbo', name: 'Rumbo' }];

export const ENDORSEMENT_TYPES = [
  { code: 'CambioFrecuencia', name: 'Cambio de frecuencia de pago' },
  { code: 'CambioMoneda', name: 'Cambio de moneda' },
];

/** Contrato del core v1: esqueleto y orden del JSON de salida. */
export const CORE_LAYOUT_V1 = {
  code: 'CORE_ENDORSE_V1',
  description: 'Contrato de endosos del core principal v1',
  fields: [
    { targetPath: 'policyNumber', sourcePath: 'input.policyNumber', isRequired: true },
    { targetPath: 'idEnvio', sourcePath: 'input.idEnvio', isRequired: true },
    { targetPath: 'financialPlansEntity.description', sourcePath: 'input.frecuencia', isRequired: true },
    { targetPath: 'currency.description', sourcePath: 'input.moneda', isRequired: true },
    { targetPath: 'productEntity.description', sourcePath: 'input.producto', isRequired: true },
    { targetPath: 'eventEntity.description', sourcePath: 'template.eventDescription', isRequired: true },
    { targetPath: 'eventEntity.dynamicData', sourcePath: 'template.dynamicData', isRequired: true },
    { targetPath: 'eventAppliedEntities', sourcePath: 'template.appliedEvents', isRequired: true },
    { targetPath: 'riskUnitEntities[0].insuranceObjectEntities[0].insuranceObjectNumber', defaultValue: '1' },
    { targetPath: 'riskUnitEntities[0].insuranceObjectEntities[0].coverageEntities', defaultValue: [] },
    { targetPath: 'riskUnitEntities[0].insuranceObjectEntities[0].participationEntities', defaultValue: [] },
    { targetPath: 'riskUnitEntities[0].plansEntity.description', sourcePath: 'input.plan', isRequired: true },
    { targetPath: 'riskUnitEntities[0].riskUnitNumber', defaultValue: '1' },
    { targetPath: 'participationEntities', defaultValue: [] },
  ] as LayoutFieldSeed[],
};

/** Plantilla del ejemplo del reto (Rumbo + CambioFrecuencia). */
export const RUMBO_CAMBIO_FRECUENCIA: TemplateSeed = {
  product: 'Rumbo',
  endorsementType: 'CambioFrecuencia',
  layout: CORE_LAYOUT_V1.code,
  version: 1,
  eventDescription: 'SolicitarEndoso',
  dynamicFields: [
    { label: 'ProductosVida', sourceField: 'producto', isRequired: true },
    { label: 'NombreUsuario', sourceField: 'usuario', isRequired: true },
    { label: 'NumeroPolizaEndoso', sourceField: 'policyNumber', isRequired: true },
    { label: 'TipoEndosoPol', defaultValue: 'Endoso Simple' },
    { label: 'ResponsableAtencion', sourceField: 'responsableAtencion', defaultValue: 'SAC' },
    { label: 'EndosoModifPrima', sourceField: 'endosoModifPrima', defaultValue: 'Si' },
    { label: 'InicioVigenciaEndoso', sourceField: 'inicioVigenciaEndoso', defaultValue: 'Default' },
    { label: 'TipoVigenciaEndoso', sourceField: 'tipoVigenciaEndoso', defaultValue: '' },
    { label: 'EndososSimplesSACRumbo', defaultValue: 'TES008' },
    { label: 'FechaSolicitud', sourceField: 'fechaSolicitud', isRequired: true },
    { label: 'FechaCliente', sourceField: 'fechaCliente', isRequired: true },
    { label: 'FechaEfectiva', sourceField: 'fechaEfectiva', isRequired: true },
  ],
  events: ['SolicitarEndoso', 'AprobarEndoso'],
};

/**
 * Segunda plantilla de ejemplo para demostrar extensibilidad: se agregó solo
 * con datos (mismo layout, otras etiquetas y defaults), sin tocar código.
 */
export const RUMBO_CAMBIO_MONEDA: TemplateSeed = {
  product: 'Rumbo',
  endorsementType: 'CambioMoneda',
  layout: CORE_LAYOUT_V1.code,
  version: 1,
  eventDescription: 'SolicitarEndoso',
  dynamicFields: [
    { label: 'ProductosVida', sourceField: 'producto', isRequired: true },
    { label: 'NombreUsuario', sourceField: 'usuario', defaultValue: 'interface.servicios' },
    { label: 'NumeroPolizaEndoso', sourceField: 'policyNumber', isRequired: true },
    { label: 'TipoEndosoPol', defaultValue: 'Endoso Simple' },
    { label: 'MonedaNueva', sourceField: 'monedaNueva', isRequired: true },
    { label: 'EndosoModifPrima', defaultValue: 'Si' },
    { label: 'EndososSimplesSACRumbo', defaultValue: 'TES010' },
    { label: 'FechaSolicitud', sourceField: 'fechaSolicitud', isRequired: true },
    { label: 'FechaEfectiva', sourceField: 'fechaEfectiva', isRequired: true },
  ],
  events: ['SolicitarEndoso', 'ValidarMoneda', 'AprobarEndoso'],
};

export const TEMPLATES: TemplateSeed[] = [RUMBO_CAMBIO_FRECUENCIA, RUMBO_CAMBIO_MONEDA];
