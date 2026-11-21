import { MigrationInterface, QueryRunner } from 'typeorm';

/** Esquema de plantillas dinámicas. Ver docs/ER.md para el diagrama. */
export class InitSchema1732190000000 implements MigrationInterface {
  name = 'InitSchema1732190000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE product (
        id          SERIAL PRIMARY KEY,
        code        VARCHAR(50)  NOT NULL CONSTRAINT uq_product_code UNIQUE,
        name        VARCHAR(120) NOT NULL,
        is_active   BOOLEAN      NOT NULL DEFAULT TRUE
      )`);

    await q.query(`
      CREATE TABLE endorsement_type (
        id          SERIAL PRIMARY KEY,
        code        VARCHAR(50)  NOT NULL CONSTRAINT uq_endorsement_type_code UNIQUE,
        name        VARCHAR(120) NOT NULL,
        is_active   BOOLEAN      NOT NULL DEFAULT TRUE
      )`);

    await q.query(`
      CREATE TABLE output_layout (
        id          SERIAL PRIMARY KEY,
        code        VARCHAR(50)  NOT NULL CONSTRAINT uq_output_layout_code UNIQUE,
        description VARCHAR(200) NOT NULL
      )`);

    await q.query(`
      CREATE TABLE output_layout_field (
        id            SERIAL PRIMARY KEY,
        layout_id     INT          NOT NULL REFERENCES output_layout(id) ON DELETE CASCADE,
        target_path   VARCHAR(200) NOT NULL,
        source_path   VARCHAR(200),
        default_value JSONB,
        is_required   BOOLEAN      NOT NULL DEFAULT FALSE,
        sort_order    INT          NOT NULL CHECK (sort_order > 0),
        CONSTRAINT uq_layout_field_order  UNIQUE (layout_id, sort_order),
        CONSTRAINT uq_layout_field_target UNIQUE (layout_id, target_path),
        CONSTRAINT ck_layout_field_source CHECK (source_path IS NOT NULL OR default_value IS NOT NULL)
      )`);

    await q.query(`
      CREATE TABLE endorsement_template (
        id                  SERIAL PRIMARY KEY,
        product_id          INT          NOT NULL REFERENCES product(id),
        endorsement_type_id INT          NOT NULL REFERENCES endorsement_type(id),
        layout_id           INT          NOT NULL REFERENCES output_layout(id),
        version             INT          NOT NULL DEFAULT 1 CHECK (version > 0),
        event_description   VARCHAR(100) NOT NULL,
        is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
        created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT uq_template_version UNIQUE (product_id, endorsement_type_id, version)
      )`);
    // Solo una versión activa por producto + tipo de endoso.
    await q.query(`
      CREATE UNIQUE INDEX uq_template_one_active
        ON endorsement_template (product_id, endorsement_type_id)
        WHERE is_active`);

    await q.query(`
      CREATE TABLE template_dynamic_field (
        id            SERIAL PRIMARY KEY,
        template_id   INT          NOT NULL REFERENCES endorsement_template(id) ON DELETE CASCADE,
        label         VARCHAR(100) NOT NULL,
        source_field  VARCHAR(100),
        default_value JSONB,
        is_required   BOOLEAN      NOT NULL DEFAULT FALSE,
        sort_order    INT          NOT NULL CHECK (sort_order > 0),
        CONSTRAINT uq_dynamic_field_order UNIQUE (template_id, sort_order),
        CONSTRAINT uq_dynamic_field_label UNIQUE (template_id, label),
        CONSTRAINT ck_dynamic_field_source CHECK (source_field IS NOT NULL OR default_value IS NOT NULL)
      )`);

    await q.query(`
      CREATE TABLE template_event (
        id           SERIAL PRIMARY KEY,
        template_id  INT          NOT NULL REFERENCES endorsement_template(id) ON DELETE CASCADE,
        description  VARCHAR(100) NOT NULL,
        order_event  INT          NOT NULL CHECK (order_event > 0),
        CONSTRAINT uq_template_event_order UNIQUE (template_id, order_event)
      )`);
  }

  async down(q: QueryRunner): Promise<void> {
    for (const table of [
      'template_event',
      'template_dynamic_field',
      'endorsement_template',
      'output_layout_field',
      'output_layout',
      'endorsement_type',
      'product',
    ]) {
      await q.query(`DROP TABLE IF EXISTS ${table}`);
    }
  }
}
