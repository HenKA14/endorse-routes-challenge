import {
  CORE_LAYOUT_V1,
  RUMBO_CAMBIO_FRECUENCIA,
  RUMBO_CAMBIO_MONEDA,
} from '../../../src/database/seeds/reference-data';
import {
  InvalidTemplateError,
  MissingRequiredFieldsError,
  TemplateNotFoundError,
} from '../../../src/errors/domain.errors';
import { EndorseTranslatorService } from '../../../src/services/endorse-translator.service';
import { InMemoryTemplateRepository } from '../../fixtures/in-memory-template.repository';
import { PDF_INPUT, PDF_OUTPUT } from '../../fixtures/pdf-example';
import { buildLayout, buildTemplateModel } from '../../fixtures/template.fixture';

describe('EndorseTranslatorService', () => {
  const repo = new InMemoryTemplateRepository([
    buildTemplateModel(RUMBO_CAMBIO_FRECUENCIA, { id: 10, shuffle: true }),
    buildTemplateModel(RUMBO_CAMBIO_MONEDA, { id: 20 }),
  ]);
  const service = new EndorseTranslatorService(repo);

  it('traduce el ejemplo del enunciado exactamente (valores y orden de claves)', async () => {
    const result = await service.translate(PDF_INPUT);

    expect(result.payload).toEqual(PDF_OUTPUT);
    // toEqual ignora el orden de claves; el core exige JSON ordenado.
    expect(JSON.stringify(result.payload)).toBe(JSON.stringify(PDF_OUTPUT));
    expect(result).toMatchObject({ templateId: 10, templateVersion: 1 });
  });

  it('permite sobrescribir un valor por defecto enviándolo en la entrada', async () => {
    const { payload } = await service.translate({ ...PDF_INPUT, responsableAtencion: 'Canal Digital' });
    const dynamicData = (payload.eventEntity as { dynamicData: Array<{ etiqueta: string; value: unknown }> })
      .dynamicData;

    expect(dynamicData.find((d) => d.etiqueta === 'ResponsableAtencion')?.value).toBe('Canal Digital');
  });

  it('ignora campos de entrada que la plantilla no usa', async () => {
    const { payload } = await service.translate({ ...PDF_INPUT, campoExtra: 'x' });
    expect(JSON.stringify(payload)).not.toContain('campoExtra');
  });

  it('usa otra plantilla para otro tipo de endoso sin cambiar código', async () => {
    const { payload, templateId } = await service.translate({
      ...PDF_INPUT,
      tipoEndoso: 'CambioMoneda',
      monedaNueva: 'Dólares',
      usuario: '',
    });

    expect(templateId).toBe(20);
    expect(payload.eventAppliedEntities).toEqual([
      { description: 'SolicitarEndoso', orderEvent: 1 },
      { description: 'ValidarMoneda', orderEvent: 2 },
      { description: 'AprobarEndoso', orderEvent: 3 },
    ]);
    expect(payload.eventEntity).toMatchObject({
      dynamicData: expect.arrayContaining([
        { etiqueta: 'MonedaNueva', value: 'Dólares' },
        { etiqueta: 'NombreUsuario', value: 'interface.servicios' },
        { etiqueta: 'EndososSimplesSACRumbo', value: 'TES010' },
      ]),
    });
  });

  it('lanza TemplateNotFoundError si no hay plantilla activa', async () => {
    await expect(service.translate({ producto: 'Rumbo', tipoEndoso: 'Inexistente' })).rejects.toBeInstanceOf(
      TemplateNotFoundError,
    );
  });

  it('reporta TODOS los campos faltantes de layout y dynamicData en un solo error', async () => {
    const { usuario, fechaEfectiva, moneda, ...partial } = PDF_INPUT;
    void usuario;
    void fechaEfectiva;
    void moneda;

    const error = await service.translate(partial).catch((e) => e);

    expect(error).toBeInstanceOf(MissingRequiredFieldsError);
    expect((error as MissingRequiredFieldsError).missing).toEqual([
      { field: 'usuario', target: 'eventEntity.dynamicData.NombreUsuario' },
      { field: 'fechaEfectiva', target: 'eventEntity.dynamicData.FechaEfectiva' },
      { field: 'moneda', target: 'currency.description' },
    ]);
    expect(error.message).toBe('Faltan campos requeridos por la plantilla: usuario, fechaEfectiva, moneda');
  });

  it('trata strings en blanco como no enviados', async () => {
    await expect(service.translate({ ...PDF_INPUT, plan: '  ' })).rejects.toMatchObject({
      missing: [{ field: 'plan', target: 'riskUnitEntities[0].plansEntity.description' }],
    });
  });

  it('usa el targetPath como referencia cuando falta un valor de plantilla requerido sin origen de input', async () => {
    const layout = buildLayout([
      ...CORE_LAYOUT_V1.fields,
      { targetPath: 'extra.value', sourcePath: 'template.noExiste', isRequired: true },
    ]);
    const svc = new EndorseTranslatorService(
      new InMemoryTemplateRepository([buildTemplateModel(RUMBO_CAMBIO_FRECUENCIA, { layout })]),
    );

    await expect(svc.translate(PDF_INPUT)).rejects.toMatchObject({
      missing: [{ field: 'template.noExiste', target: 'extra.value' }],
    });
  });

  it('propaga InvalidTemplateError si la configuración en BD es inválida', async () => {
    const layout = buildLayout([{ targetPath: 'a..b', defaultValue: 1 }]);
    const svc = new EndorseTranslatorService(
      new InMemoryTemplateRepository([buildTemplateModel(RUMBO_CAMBIO_FRECUENCIA, { layout })]),
    );
    await expect(svc.translate(PDF_INPUT)).rejects.toBeInstanceOf(InvalidTemplateError);
  });

  it('elige la versión más alta activa', async () => {
    const v1 = buildTemplateModel(RUMBO_CAMBIO_FRECUENCIA, { id: 1 });
    const v2 = buildTemplateModel({ ...RUMBO_CAMBIO_FRECUENCIA, version: 2, eventDescription: 'SolicitarEndosoV2' }, { id: 2 });
    const svc = new EndorseTranslatorService(new InMemoryTemplateRepository([v1, v2]));

    const result = await svc.translate(PDF_INPUT);
    expect(result.templateVersion).toBe(2);
    expect(result.payload.eventEntity).toMatchObject({ description: 'SolicitarEndosoV2' });
  });
});
