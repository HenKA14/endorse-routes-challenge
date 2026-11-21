import { ValueResolver } from '../../../src/services/value-resolver';

describe('ValueResolver', () => {
  const resolver = new ValueResolver();
  const ctx = { input: { a: 'valor', zero: 0, falso: false, blank: '   ', nil: null } };

  it('usa el valor del origen cuando viene', () => {
    expect(resolver.resolve({ sourcePath: 'input.a', defaultValue: 'def', isRequired: true }, ctx)).toEqual({
      ok: true,
      value: 'valor',
    });
  });

  it('respeta valores falsy válidos (0, false)', () => {
    expect(resolver.resolve({ sourcePath: 'input.zero', defaultValue: 9, isRequired: true }, ctx)).toEqual({
      ok: true,
      value: 0,
    });
    expect(resolver.resolve({ sourcePath: 'input.falso', defaultValue: true, isRequired: true }, ctx)).toEqual({
      ok: true,
      value: false,
    });
  });

  it.each(['input.missing', 'input.blank', 'input.nil'])('cae al default si %s no viene o está vacío', (sourcePath) => {
    expect(resolver.resolve({ sourcePath, defaultValue: 'SAC', isRequired: true }, ctx)).toEqual({
      ok: true,
      value: 'SAC',
    });
  });

  it('acepta string vacío como default explícito', () => {
    expect(resolver.resolve({ sourcePath: 'input.missing', defaultValue: '', isRequired: false }, ctx)).toEqual({
      ok: true,
      value: '',
    });
  });

  it('usa el default como constante cuando no hay origen', () => {
    expect(resolver.resolve({ sourcePath: null, defaultValue: 'TES008', isRequired: false }, ctx)).toEqual({
      ok: true,
      value: 'TES008',
    });
  });

  it('marca faltante si es obligatorio y no hay valor ni default', () => {
    expect(resolver.resolve({ sourcePath: 'input.missing', defaultValue: null, isRequired: true }, ctx)).toEqual({
      ok: false,
    });
  });

  it('devuelve null si es opcional y no hay valor ni default', () => {
    expect(resolver.resolve({ sourcePath: 'input.missing', defaultValue: null, isRequired: false }, ctx)).toEqual({
      ok: true,
      value: null,
    });
  });

  it('clona los defaults para no compartir referencias entre respuestas', () => {
    const rule = { sourcePath: null, defaultValue: [] as unknown[], isRequired: false };
    const first = resolver.resolve(rule, ctx);
    const second = resolver.resolve(rule, ctx);
    expect(first.ok && second.ok && first.value !== second.value).toBe(true);
    expect(first.ok && first.value !== rule.defaultValue).toBe(true);
  });
});
