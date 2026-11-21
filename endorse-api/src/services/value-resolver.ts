import { ValueRule } from '../entities/template-config.entity';
import { getByPath } from '../utils/object-path';

export type Resolution = { ok: true; value: unknown } | { ok: false };

const isBlank = (v: unknown): boolean =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/**
 * Regla única de resolución (aplica a layout y a dynamicData):
 *   1. valor del origen si viene y no está vacío
 *   2. si no, valor por defecto de la plantilla
 *   3. si no y es obligatorio -> faltante (ok: false)
 *   4. si no -> null
 */
export class ValueResolver {
  resolve(rule: ValueRule, context: unknown): Resolution {
    if (rule.sourcePath !== null) {
      const value = getByPath(context, rule.sourcePath);
      if (!isBlank(value)) return { ok: true, value };
    }
    if (rule.defaultValue !== null && rule.defaultValue !== undefined) {
      return { ok: true, value: structuredClone(rule.defaultValue) };
    }
    if (rule.isRequired) return { ok: false };
    return { ok: true, value: null };
  }
}
