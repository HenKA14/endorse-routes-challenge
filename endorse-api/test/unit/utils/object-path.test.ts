import { getByPath, isValidPath, parsePath, setByPath } from '../../../src/utils/object-path';

describe('object-path', () => {
  describe('parsePath', () => {
    it('separa claves e índices', () => {
      expect(parsePath('a.b[0].c[12]')).toEqual(['a', 'b', 0, 'c', 12]);
    });
  });

  describe('isValidPath', () => {
    it.each(['policyNumber', 'a.b', 'riskUnitEntities[0].plansEntity.description', 'x[0][1]'])('acepta %s', (p) =>
      expect(isValidPath(p)).toBe(true),
    );

    it.each(['', '.a', 'a.', 'a..b', 'a[x]', '1abc', '__proto__.polluted', 'a.constructor.prototype', 'a b'])(
      'rechaza %s',
      (p) => expect(isValidPath(p)).toBe(false),
    );
  });

  describe('getByPath', () => {
    const source = { input: { a: 1, list: [{ b: 'x' }] }, nil: null };

    it('lee valores anidados e índices', () => {
      expect(getByPath(source, 'input.a')).toBe(1);
      expect(getByPath(source, 'input.list[0].b')).toBe('x');
    });

    it('devuelve undefined si la ruta no existe o atraviesa un primitivo/null', () => {
      expect(getByPath(source, 'input.zzz')).toBeUndefined();
      expect(getByPath(source, 'input.a.b')).toBeUndefined();
      expect(getByPath(source, 'nil.b')).toBeUndefined();
      expect(getByPath(source, 'input.list[5].b')).toBeUndefined();
    });

    it('no lee propiedades heredadas del prototipo', () => {
      expect(getByPath({}, 'toString')).toBeUndefined();
    });

    it('lanza ante rutas peligrosas', () => {
      expect(() => getByPath(source, '__proto__')).toThrow('Ruta inválida');
    });
  });

  describe('setByPath', () => {
    it('crea objetos y arrays intermedios respetando el orden de inserción', () => {
      const target: Record<string, unknown> = {};
      setByPath(target, 'b', 1);
      setByPath(target, 'a[0].x', 'x');
      setByPath(target, 'a[0].y', 'y');
      setByPath(target, 'c.d', true);

      expect(target).toEqual({ b: 1, a: [{ x: 'x', y: 'y' }], c: { d: true } });
      expect(Object.keys(target)).toEqual(['b', 'a', 'c']);
    });

    it('sobrescribe primitivos intermedios', () => {
      const target: Record<string, unknown> = { a: 'texto' };
      setByPath(target, 'a.b', 1);
      expect(target).toEqual({ a: { b: 1 } });
    });

    it('detecta conflictos objeto/array', () => {
      const target: Record<string, unknown> = { a: {} };
      expect(() => setByPath(target, 'a[0]', 1)).toThrow('Conflicto de tipos');
    });

    it('impide prototype pollution', () => {
      expect(() => setByPath({}, '__proto__.polluted', true)).toThrow();
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });
  });
});
