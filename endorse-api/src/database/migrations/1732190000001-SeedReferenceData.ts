import { MigrationInterface, QueryRunner } from 'typeorm';
import { CORE_LAYOUT_V1, ENDORSEMENT_TYPES, PRODUCTS, TEMPLATES } from '../seeds/reference-data';

const json = (value: unknown) => (value === undefined ? null : JSON.stringify(value));

/** Carga las plantillas de referencia. Idempotente (ON CONFLICT DO NOTHING). */
export class SeedReferenceData1732190000001 implements MigrationInterface {
  name = 'SeedReferenceData1732190000001';

  async up(q: QueryRunner): Promise<void> {
    for (const p of PRODUCTS) {
      await q.query(`INSERT INTO product (code, name) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING`, [p.code, p.name]);
    }
    for (const t of ENDORSEMENT_TYPES) {
      await q.query(`INSERT INTO endorsement_type (code, name) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING`, [
        t.code,
        t.name,
      ]);
    }

    const [layout] = await q.query(
      `INSERT INTO output_layout (code, description) VALUES ($1, $2)
       ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description RETURNING id`,
      [CORE_LAYOUT_V1.code, CORE_LAYOUT_V1.description],
    );
    for (const [index, f] of CORE_LAYOUT_V1.fields.entries()) {
      await q.query(
        `INSERT INTO output_layout_field (layout_id, target_path, source_path, default_value, is_required, sort_order)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6) ON CONFLICT DO NOTHING`,
        [layout.id, f.targetPath, f.sourcePath ?? null, json(f.defaultValue), f.isRequired ?? false, index + 1],
      );
    }

    for (const t of TEMPLATES) {
      const rows = await q.query(
        `INSERT INTO endorsement_template (product_id, endorsement_type_id, layout_id, version, event_description)
         SELECT p.id, et.id, l.id, $4, $5
           FROM product p, endorsement_type et, output_layout l
          WHERE p.code = $1 AND et.code = $2 AND l.code = $3
         ON CONFLICT DO NOTHING RETURNING id`,
        [t.product, t.endorsementType, t.layout, t.version, t.eventDescription],
      );
      if (rows.length === 0) continue; // ya existía

      const templateId = rows[0].id;
      for (const [index, f] of t.dynamicFields.entries()) {
        await q.query(
          `INSERT INTO template_dynamic_field (template_id, label, source_field, default_value, is_required, sort_order)
           VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
          [templateId, f.label, f.sourceField ?? null, json(f.defaultValue), f.isRequired ?? false, index + 1],
        );
      }
      for (const [index, description] of t.events.entries()) {
        await q.query(`INSERT INTO template_event (template_id, description, order_event) VALUES ($1, $2, $3)`, [
          templateId,
          description,
          index + 1,
        ]);
      }
    }
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM endorsement_template`);
    await q.query(`DELETE FROM output_layout WHERE code = $1`, [CORE_LAYOUT_V1.code]);
    await q.query(`DELETE FROM endorsement_type`);
    await q.query(`DELETE FROM product`);
  }
}
