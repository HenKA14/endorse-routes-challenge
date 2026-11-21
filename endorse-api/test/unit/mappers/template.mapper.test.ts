import { RUMBO_CAMBIO_FRECUENCIA, TemplateSeed } from '../../../src/database/seeds/reference-data';
import { InvalidTemplateError } from '../../../src/errors/domain.errors';
import { TemplateMapper } from '../../../src/mappers/template.mapper';
import { buildLayout, buildTemplateModel } from '../../fixtures/template.fixture';

describe('TemplateMapper', () => {
  describe('toConfig', () => {
    it('ordena layout, dynamicData y eventos aunque la BD los devuelva desordenados', () => {
      const config = TemplateMapper.toConfig(buildTemplateModel(RUMBO_CAMBIO_FRECUENCIA, { shuffle: true }));

      expect(config.layoutFields[0].targetPath).toBe('policyNumber');
      expect(config.layoutFields.at(-1)!.targetPath).toBe('participationEntities');
      expect(config.dynamicFields.map((f) => f.label).slice(0, 3)).toEqual([
        'ProductosVida',
        'NombreUsuario',
        'NumeroPolizaEndoso',
      ]);
      expect(config.events).toEqual([
        { description: 'SolicitarEndoso', orderEvent: 1 },
        { description: 'AprobarEndoso', orderEvent: 2 },
      ]);
      expect(config).toMatchObject({ productCode: 'Rumbo', endorsementTypeCode: 'CambioFrecuencia', version: 1 });
    });

    it('rechaza rutas de destino inválidas o peligrosas', () => {
      const layout = buildLayout([{ targetPath: '__proto__.x', defaultValue: 1 }]);
      expect(() => TemplateMapper.toConfig(buildTemplateModel(RUMBO_CAMBIO_FRECUENCIA, { layout }))).toThrow(
        InvalidTemplateError,
      );
    });

    it('rechaza sourcePath fuera de input./template.', () => {
      const layout = buildLayout([{ targetPath: 'a', sourcePath: 'process.env.SECRET' }]);
      expect(() => TemplateMapper.toConfig(buildTemplateModel(RUMBO_CAMBIO_FRECUENCIA, { layout }))).toThrow(
        /configuración inválida/,
      );
    });

    it('rechaza campos sin origen ni default y layouts vacíos', () => {
      const badSeed: TemplateSeed = { ...RUMBO_CAMBIO_FRECUENCIA, dynamicFields: [{ label: 'Huérfano' }] };
      expect(() => TemplateMapper.toConfig(buildTemplateModel(badSeed))).toThrow(InvalidTemplateError);

      const layout = buildLayout([{ targetPath: 'a' }]);
      expect(() => TemplateMapper.toConfig(buildTemplateModel(RUMBO_CAMBIO_FRECUENCIA, { layout }))).toThrow(
        InvalidTemplateError,
      );

      expect(() =>
        TemplateMapper.toConfig(buildTemplateModel(RUMBO_CAMBIO_FRECUENCIA, { layout: buildLayout([]) })),
      ).toThrow(InvalidTemplateError);
    });

    it('rechaza sourceField inválido en dynamicData', () => {
      const badSeed: TemplateSeed = {
        ...RUMBO_CAMBIO_FRECUENCIA,
        dynamicFields: [{ label: 'X', sourceField: 'constructor' }],
      };
      try {
        TemplateMapper.toConfig(buildTemplateModel(badSeed));
        fail('debió lanzar');
      } catch (error) {
        expect((error as InvalidTemplateError).details).toEqual({
          errors: ['sourceField inválido en etiqueta X: constructor'],
        });
      }
    });
  });

  describe('toSummary', () => {
    it('lista los campos de entrada sin duplicados, con obligatoriedad y defaults', () => {
      const summary = TemplateMapper.toSummary(TemplateMapper.toConfig(buildTemplateModel(RUMBO_CAMBIO_FRECUENCIA)));
      const byName = Object.fromEntries(summary.inputFields.map((f) => [f.name, f]));

      expect(summary.inputFields.slice(0, 2).map((f) => f.name)).toEqual(['producto', 'tipoEndoso']);
      expect(summary.inputFields.filter((f) => f.name === 'policyNumber')).toHaveLength(1);
      expect(byName.frecuencia).toEqual({ name: 'frecuencia', required: true, defaultValue: null });
      expect(byName.responsableAtencion).toEqual({ name: 'responsableAtencion', required: false, defaultValue: 'SAC' });
      expect(byName.tipoVigenciaEndoso.defaultValue).toBe('');
      expect(Object.keys(byName)).not.toContain('eventDescription');
    });
  });
});
