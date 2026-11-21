import { describe, expect, it } from 'vitest';
import { coerceInput, graphNodes, highlightJson, parseFlatJson, parseGraphJson } from '../src/utils/json';

describe('parseFlatJson', () => {
  it('acepta objetos planos', () => {
    expect(parseFlatJson('{"a":"x","b":1,"c":true,"d":null}')).toEqual({
      ok: true,
      value: { a: 'x', b: 1, c: true, d: null },
    });
  });

  it.each([
    ['{', 'JSON inválido'],
    ['[1]', 'objeto'],
    ['"x"', 'objeto'],
    ['{"a":{"b":1}}', '"a" no es un valor plano'],
    ['{"a":[1]}', '"a" no es un valor plano'],
  ])('rechaza %s', (text, msg) => {
    const r = parseFlatJson(text);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain(msg);
  });
});

describe('parseGraphJson', () => {
  it('acepta un grafo válido', () => {
    expect(parseGraphJson('{"A":{"B":1}}').ok).toBe(true);
  });

  it.each([['{'], ['[]'], ['{"A":1}'], ['{"A":{"B":"1"}}']])('rechaza %s', (text) => {
    expect(parseGraphJson(text).ok).toBe(false);
  });
});

describe('graphNodes', () => {
  it('incluye nodos que solo son destino, ordenados', () => {
    expect(graphNodes({ Surco: { Ate: 10 }, Barranco: { Surco: 5 } })).toEqual(['Ate', 'Barranco', 'Surco']);
  });
});

describe('coerceInput', () => {
  it('mantiene números si el campo era numérico', () => {
    expect(coerceInput('5985', 5984)).toBe(5985);
    expect(coerceInput('abc', 5984)).toBe('abc');
    expect(coerceInput('', 5984)).toBe('');
  });

  it('no convierte strings numéricos (ej. número de póliza con ceros)', () => {
    expect(coerceInput('08200000049', '0820')).toBe('08200000049');
    expect(coerceInput('1', undefined)).toBe('1');
  });

  it('mantiene booleanos', () => {
    expect(coerceInput('false', true)).toBe(false);
  });
});

describe('highlightJson', () => {
  it('escapa HTML para evitar XSS', () => {
    const html = highlightJson({ x: '<img src=x onerror=alert(1)>' });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('marca claves, strings, números, booleanos y null', () => {
    const html = highlightJson({ k: 's', n: 1, b: true, z: null });
    for (const cls of ['j-key', 'j-str', 'j-num', 'j-bool', 'j-null']) expect(html).toContain(cls);
  });
});
