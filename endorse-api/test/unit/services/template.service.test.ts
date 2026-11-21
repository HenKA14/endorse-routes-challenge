import { RUMBO_CAMBIO_FRECUENCIA, RUMBO_CAMBIO_MONEDA } from '../../../src/database/seeds/reference-data';
import { TemplateRepository } from '../../../src/repositories/template.repository';
import { TemplateService } from '../../../src/services/template.service';
import { InMemoryTemplateRepository } from '../../fixtures/in-memory-template.repository';
import { buildLayout, buildTemplateModel } from '../../fixtures/template.fixture';

describe('TemplateService', () => {
  it('devuelve el resumen de cada plantilla activa', async () => {
    const service = new TemplateService(
      new InMemoryTemplateRepository([
        buildTemplateModel(RUMBO_CAMBIO_FRECUENCIA),
        buildTemplateModel(RUMBO_CAMBIO_MONEDA),
      ]),
    );

    const result = await service.listActive();

    expect(result.map((t) => `${t.producto}/${t.tipoEndoso}`)).toEqual(['Rumbo/CambioFrecuencia', 'Rumbo/CambioMoneda']);
  });

  it('omite (y registra) plantillas mal configuradas sin romper el catálogo', async () => {
    const logger = { warn: jest.fn() };
    const broken = buildTemplateModel(RUMBO_CAMBIO_MONEDA, { layout: buildLayout([]) });
    const service = new TemplateService(
      new InMemoryTemplateRepository([buildTemplateModel(RUMBO_CAMBIO_FRECUENCIA), broken]),
      logger,
    );

    const result = await service.listActive();

    expect(result).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('propaga errores inesperados', async () => {
    const failing: TemplateRepository = {
      findActive: jest.fn(),
      // Fila corrupta sin producto: no es un InvalidTemplateError, debe propagarse.
      findAllActive: jest.fn().mockResolvedValue([
        { layout: { code: 'L', fields: [{ targetPath: 'a', sourcePath: null, defaultValue: 1, sortOrder: 1 }] } },
      ]),
    };
    await expect(new TemplateService(failing, { warn: jest.fn() }).listActive()).rejects.toThrow(TypeError);
  });
});
