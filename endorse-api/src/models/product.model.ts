import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Producto comercial (ej. Rumbo). */
@Entity({ name: 'product' })
export class ProductModel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
