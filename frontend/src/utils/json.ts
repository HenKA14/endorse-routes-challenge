import type { FlatPayload, FlatValue } from '../api/endorse.api';
import type { Graph } from '../api/routes.api';

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Valida que el texto sea un objeto JSON plano (valores primitivos). */
export const parseFlatJson = (text: string): ParseResult<FlatPayload> => {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `JSON inválido: ${(e as Error).message}` };
  }
  if (!isPlainObject(value)) return { ok: false, error: 'Debe ser un objeto JSON { ... }' };
  const nested = Object.entries(value).find(([, v]) => typeof v === 'object' && v !== null);
  if (nested) return { ok: false, error: `"${nested[0]}" no es un valor plano (string, número, booleano o null)` };
  return { ok: true, value: value as FlatPayload };
};

/** Valida un grafo { nodo: { vecino: peso } } con pesos numéricos. */
export const parseGraphJson = (text: string): ParseResult<Graph> => {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `JSON inválido: ${(e as Error).message}` };
  }
  if (!isPlainObject(value)) return { ok: false, error: 'El grafo debe ser un objeto { nodo: { vecino: peso } }' };
  for (const [node, edges] of Object.entries(value)) {
    if (!isPlainObject(edges)) return { ok: false, error: `Las aristas de "${node}" deben ser un objeto` };
    for (const [to, w] of Object.entries(edges)) {
      if (typeof w !== 'number') return { ok: false, error: `El peso ${node} → ${to} debe ser numérico` };
    }
  }
  return { ok: true, value: value as Graph };
};

/** Todos los nodos del grafo (incluye los que solo son destino), ordenados. */
export const graphNodes = (graph: Graph): string[] => {
  const set = new Set<string>();
  for (const [from, edges] of Object.entries(graph)) {
    set.add(from);
    Object.keys(edges).forEach((to) => set.add(to));
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'es'));
};

/**
 * Convierte lo escrito en un input del formulario conservando el tipo previo:
 * si el campo era numérico y se escribe un número, sigue siendo número
 * (ej. idEnvio: 5984); en otro caso es string (ej. policyNumber "0820...").
 */
export const coerceInput = (text: string, previous: FlatValue | undefined): FlatValue => {
  if (typeof previous === 'number' && text.trim() !== '' && Number.isFinite(Number(text))) return Number(text);
  if (typeof previous === 'boolean' && (text === 'true' || text === 'false')) return text === 'true';
  return text;
};

/** Resaltado de sintaxis mínimo para JSON (escapa HTML antes de colorear). */
export const highlightJson = (value: unknown): string => {
  const json = JSON.stringify(value, null, 2) ?? '';
  const escaped = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped.replace(
    /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'num';
      if (match.startsWith('"')) cls = match.endsWith(':') ? 'key' : 'str';
      else if (match === 'true' || match === 'false') cls = 'bool';
      else if (match === 'null') cls = 'null';
      return `<span class="j-${cls}">${match}</span>`;
    },
  );
};
