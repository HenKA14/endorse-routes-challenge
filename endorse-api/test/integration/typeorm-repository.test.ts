import { DataSource } from 'typeorm';
import { createDataSource } from '../../src/database/data-source';
import { TypeOrmTemplateRepository } from '../../src/repositories/template.repository';
import { EndorseTranslatorService } from '../../src/services/endorse-translator.service';
import { PDF_INPUT, PDF_OUTPUT } from '../fixtures/pdf-example';

/**
 * Integración contra Postgres real (migraciones + seed + TypeORM).
 * Se ejecuta solo si TEST_DATABASE_URL está definida, p. ej.:
 *   TEST_DATABASE_URL=postgres://localhost:5432/endorse_test npm test
 */
const url = process.env.TEST_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

describeDb('TypeOrmTemplateRepository (Postgres)', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = createDataSource({ url: url!, ssl: false, runMigrations: true, logging: false });
    await dataSource.initialize();
    await dataSource.dropDatabase();
    await dataSource.runMigrations();
  });

  afterAll(() => dataSource?.destroy());

  it('traduce el ejemplo del enunciado leyendo la plantilla de la BD', async () => {
    const service = new EndorseTranslatorService(new TypeOrmTemplateRepository(dataSource));
    const { payload } = await service.translate(PDF_INPUT);
    expect(JSON.stringify(payload)).toBe(JSON.stringify(PDF_OUTPUT));
  });

  it('lista las plantillas activas', async () => {
    const templates = await new TypeOrmTemplateRepository(dataSource).findAllActive();
    expect(templates.map((t) => t.endorsementType.code)).toEqual(['CambioFrecuencia', 'CambioMoneda']);
  });

  it('la BD impide dos versiones activas para el mismo producto + tipo', async () => {
    await expect(
      dataSource.query(
        `INSERT INTO endorsement_template (product_id, endorsement_type_id, layout_id, version, event_description)
         SELECT product_id, endorsement_type_id, layout_id, 99, 'X' FROM endorsement_template LIMIT 1`,
      ),
    ).rejects.toThrow(/uq_template_one_active/);
  });

  it('una nueva versión activa reemplaza a la anterior sin tocar código', async () => {
    await dataSource.transaction(async (tx) => {
      const [current] = await tx.query(
        `SELECT et.id, et.product_id, et.endorsement_type_id, et.layout_id FROM endorsement_template et
           JOIN endorsement_type t ON t.id = et.endorsement_type_id WHERE t.code = 'CambioFrecuencia'`,
      );
      await tx.query(`UPDATE endorsement_template SET is_active = false WHERE id = $1`, [current.id]);
      const [v2] = await tx.query(
        `INSERT INTO endorsement_template (product_id, endorsement_type_id, layout_id, version, event_description)
         VALUES ($1, $2, $3, 2, 'SolicitarEndoso') RETURNING id`,
        [current.product_id, current.endorsement_type_id, current.layout_id],
      );
      await tx.query(
        `INSERT INTO template_dynamic_field (template_id, label, source_field, default_value, is_required, sort_order)
         SELECT $1, label, source_field, default_value, is_required, sort_order FROM template_dynamic_field WHERE template_id = $2`,
        [v2.id, current.id],
      );
      await tx.query(
        `INSERT INTO template_dynamic_field (template_id, label, default_value, sort_order) VALUES ($1, 'CanalOrigen', '"WEB"', 99)`,
        [v2.id],
      );
    });

    const service = new EndorseTranslatorService(new TypeOrmTemplateRepository(dataSource));
    const result = await service.translate(PDF_INPUT);
    const dynamicData = (result.payload.eventEntity as { dynamicData: Array<{ etiqueta: string }> }).dynamicData;

    expect(result.templateVersion).toBe(2);
    expect(dynamicData.at(-1)).toEqual({ etiqueta: 'CanalOrigen', value: 'WEB' });
  });
});
