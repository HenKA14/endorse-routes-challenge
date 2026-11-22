<script setup lang="ts">
import { computed } from 'vue';
import type { Graph } from '../api/routes.api';
import { graphNodes } from '../utils/json';

const props = defineProps<{
  graph: Graph;
  depots: string[];
  accident: string;
  path?: string[];
}>();

const SIZE = 600;
const R = 190;

/** Distribución circular: simple, determinista y legible para ~20 nodos. */
const positions = computed(() => {
  const nodes = graphNodes(props.graph);
  const map = new Map<string, { x: number; y: number; lx: number; ly: number; anchor: string }>();
  nodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // Etiqueta hacia afuera del círculo para que nombres largos no se encimen.
    map.set(n, {
      x: SIZE / 2 + R * cos,
      y: SIZE / 2 + R * sin,
      lx: SIZE / 2 + (R + 18) * cos,
      ly: SIZE / 2 + (R + 18) * sin + 4,
      anchor: Math.abs(cos) < 0.1 ? 'middle' : cos > 0 ? 'start' : 'end',
    });
  });
  return map;
});

const pathEdges = computed(() => {
  const set = new Set<string>();
  const p = props.path ?? [];
  for (let i = 0; i + 1 < p.length; i++) set.add(`${p[i]}→${p[i + 1]}`);
  return set;
});

/** Aristas únicas por par; si solo existe en un sentido se marca dirigida. */
const edges = computed(() => {
  const seen = new Map<string, { a: string; b: string; w: number; directed: boolean; onPath: boolean }>();
  for (const [from, list] of Object.entries(props.graph)) {
    for (const [to, w] of Object.entries(list)) {
      const key = [from, to].sort().join('|');
      const onPath = pathEdges.value.has(`${from}→${to}`);
      const existing = seen.get(key);
      if (existing) {
        existing.directed = false;
        existing.onPath ||= onPath;
      } else {
        seen.set(key, { a: from, b: to, w, directed: !props.graph[to]?.[from], onPath });
      }
    }
  }
  return [...seen.values()].map((e) => ({ ...e, pa: positions.value.get(e.a)!, pb: positions.value.get(e.b)! }));
});

const nodeList = computed(() =>
  [...positions.value.entries()].map(([name, pos]) => ({
    name,
    ...pos,
    isDepot: props.depots.includes(name),
    isAccident: name === props.accident,
    onPath: props.path?.includes(name) ?? false,
  })),
);
</script>

<template>
  <svg :viewBox="`0 0 ${SIZE} ${SIZE}`" class="graph" role="img" aria-label="Red de distritos">
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" class="arrowhead" />
      </marker>
    </defs>
    <g v-for="e in edges" :key="e.a + e.b">
      <line
        :x1="e.pa.x" :y1="e.pa.y" :x2="e.pb.x" :y2="e.pb.y"
        :class="['edge', { on: e.onPath }]"
        :marker-end="e.directed ? 'url(#arrow)' : undefined"
      />
      <text :x="(e.pa.x + e.pb.x) / 2" :y="(e.pa.y + e.pb.y) / 2 - 4" :class="['weight', { on: e.onPath }]">{{ e.w }}</text>
    </g>
    <g v-for="n in nodeList" :key="n.name">
      <circle
        :cx="n.x" :cy="n.y" :r="n.isDepot || n.isAccident ? 11 : 8"
        :class="['node', { depot: n.isDepot, accident: n.isAccident, on: n.onPath }]"
      />
      <text :x="n.lx" :y="n.ly" :text-anchor="n.anchor" class="label" :class="{ strong: n.isDepot || n.isAccident }">
        {{ n.name }}
      </text>
    </g>
  </svg>
</template>

<style scoped>
.graph { width: 100%; height: auto; display: block; }
.edge { stroke: var(--border-strong); stroke-width: 2; }
.edge.on { stroke: var(--accent); stroke-width: 4; }
.arrowhead { fill: var(--muted); }
.weight { font-size: 11px; fill: var(--muted); text-anchor: middle; paint-order: stroke; stroke: var(--surface); stroke-width: 3px; }
.weight.on { fill: var(--accent); font-weight: 700; }
.node { fill: var(--surface); stroke: var(--muted); stroke-width: 2; }
.node.on { stroke: var(--accent); stroke-width: 3; }
.node.depot { fill: var(--accent); stroke: var(--accent); }
.node.accident { fill: var(--pink); stroke: var(--pink); }
.label { font-size: 13px; fill: var(--text-2); paint-order: stroke; stroke: var(--surface); stroke-width: 4px; }
.label.strong { font-weight: 700; fill: var(--text); }
</style>
