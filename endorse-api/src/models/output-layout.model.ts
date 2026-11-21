import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { OutputLayoutFieldModel } from './output-layout-field.model';

/**
 * Esqueleto del JSON que espera el core (contrato). Varias plantillas pueden
 * reutilizar el mismo layout; si el core publica un contrato nuevo se crea otro
 * layout (CORE_ENDORSE_V2) sin tocar código.
 */
@Entity({ name: 'output_layout' })
export class OutputLayoutModel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 200 })
  description: string;

  @OneToMany(() => OutputLayoutFieldModel, (field) => field.layout, { cascade: true })
  fields: OutputLayoutFieldModel[];
}
