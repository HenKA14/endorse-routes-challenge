/**
 * Lectura/escritura por ruta con notación `a.b[0].c`, sin dependencias.
 * Se bloquean claves que permitirían prototype pollution, porque las rutas
 * vienen de configuración en BD.
 */
export type PathToken = string | number;

const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor']);
const TOKEN = /([^.[\]]+)|\[(\d+)\]/g;
const VALID_PATH = /^[A-Za-z_$][\w$]*(\[\d+\])*(\.[A-Za-z_$][\w$]*(\[\d+\])*)*$/;

export const isValidPath = (path: string): boolean => {
  if (!VALID_PATH.test(path)) return false;
  return parsePath(path).every((t) => typeof t === 'number' || !FORBIDDEN.has(t));
};

export const parsePath = (path: string): PathToken[] => {
  const tokens: PathToken[] = [];
  for (const match of path.matchAll(TOKEN)) {
    tokens.push(match[2] !== undefined ? Number(match[2]) : match[1]);
  }
  return tokens;
};

const assertSafe = (path: string): PathToken[] => {
  if (!isValidPath(path)) {
    throw new Error(`Ruta inválida: "${path}"`);
  }
  return parsePath(path);
};

export const getByPath = (source: unknown, path: string): unknown => {
  let current: unknown = source;
  for (const token of assertSafe(path)) {
    if (current === null || typeof current !== 'object') return undefined;
    if (!Object.prototype.hasOwnProperty.call(current, token)) return undefined;
    current = (current as Record<PathToken, unknown>)[token];
  }
  return current;
};

/**
 * Escribe `value` en `target` creando objetos/arrays intermedios. Las claves se
 * insertan en el orden de llamada, lo que define el orden del JSON final.
 */
export const setByPath = (target: Record<string, unknown>, path: string, value: unknown): void => {
  const tokens = assertSafe(path);
  let current: Record<PathToken, unknown> = target;

  tokens.forEach((token, index) => {
    const isLast = index === tokens.length - 1;
    if (isLast) {
      current[token] = value;
      return;
    }
    const nextIsIndex = typeof tokens[index + 1] === 'number';
    const existing = current[token];
    if (existing === undefined || existing === null || typeof existing !== 'object') {
      current[token] = nextIsIndex ? [] : {};
    } else if (Array.isArray(existing) !== nextIsIndex) {
      throw new Error(`Conflicto de tipos en la ruta "${path}" (token "${token}")`);
    }
    current = current[token] as Record<PathToken, unknown>;
  });
};
