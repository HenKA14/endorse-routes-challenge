<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { PDF_ROUTE_EXAMPLE, routesApi, type Graph, type OptimalRouteResponse } from '../api/routes.api';
import ErrorAlert from '../components/ErrorAlert.vue';
import GraphCanvas from '../components/GraphCanvas.vue';
import JsonViewer from '../components/JsonViewer.vue';
import { graphNodes, parseGraphJson } from '../utils/json';

const graphText = ref('');
const graphError = ref('');
const graph = ref<Graph>({});
const useServerGraph = ref(true);
const accidentLocation = ref('');
const depots = ref<string[]>([]);

const loading = ref(false);
const result = ref<OptimalRouteResponse | null>(null);
const error = ref<unknown>(null);
const loadError = ref<unknown>(null);

const nodes = computed(() => graphNodes(graph.value));
const canSubmit = computed(
  () => !loading.value && !graphError.value && !!accidentLocation.value && depots.value.length > 0,
);
const requestBody = computed(() => ({
  accidentLocation: accidentLocation.value,
  depots: depots.value,
  ...(useServerGraph.value ? {} : { graph: graph.value }),
}));

onMounted(async () => {
  try {
    const res = await routesApi.defaultGraph();
    setGraph(res.graph);
    accidentLocation.value = 'San Isidro';
    depots.value = ['Miraflores', 'Ate'].filter((d) => res.nodes.includes(d));
  } catch (e) {
    loadError.value = e;
    useServerGraph.value = false;
    loadExample();
  }
});

function setGraph(g: Graph) {
  graph.value = g;
  graphText.value = JSON.stringify(g, null, 2);
  graphError.value = '';
}

function onGraphInput(text: string) {
  graphText.value = text;
  useServerGraph.value = false;
  const parsed = parseGraphJson(text);
  if (!parsed.ok) {
    graphError.value = parsed.error;
    return;
  }
  graphError.value = '';
  graph.value = parsed.value;
  depots.value = depots.value.filter((d) => nodes.value.includes(d));
  result.value = null;
}

function toggleDepot(node: string) {
  depots.value = depots.value.includes(node) ? depots.value.filter((d) => d !== node) : [...depots.value, node];
  result.value = null;
}

function setAccident(node: string) {
  accidentLocation.value = node;
  result.value = null;
}

function loadExample() {
  setGraph(PDF_ROUTE_EXAMPLE.graph);
  useServerGraph.value = false;
  accidentLocation.value = PDF_ROUTE_EXAMPLE.accidentLocation;
  depots.value = [...PDF_ROUTE_EXAMPLE.depots];
  result.value = null;
  error.value = null;
}

async function submit() {
  loading.value = true;
  error.value = null;
  try {
    result.value = await routesApi.optimalRoute(requestBody.value);
  } catch (e) {
    result.value = null;
    error.value = e;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section>
    <div class="page-head">
      <div>
        <h1>Rutas óptimas de grúas</h1>
        <p>
          Elige el distrito del siniestro y las bases de grúas. El servicio (Go, Dijkstra multi-fuente) devuelve la base
          más cercana y el camino mínimo.
        </p>
      </div>
      <span class="badge" :title="routesApi.baseUrl">POST /v1/routes/optimal</span>
    </div>

    <ErrorAlert v-if="loadError" :error="loadError" style="margin-bottom: 16px" />

    <div class="grid-2">
      <form class="card" @submit.prevent="submit">
        <div class="card-head">
          <h2>Datos de entrada</h2>
          <button type="button" class="btn btn-sm" @click="loadExample">Cargar ejemplo del enunciado</button>
        </div>
        <div class="card-body stack">
          <div class="field">
            <span class="small"><strong>Ubicación del accidente</strong> <span class="req">*</span></span>
            <div class="chips">
              <button
                v-for="n in nodes" :key="'a' + n" type="button"
                :class="['chip', { accident: accidentLocation === n }]"
                @click="setAccident(n)"
              >{{ n }}</button>
            </div>
          </div>

          <div class="field">
            <span class="small"><strong>Bases de grúas (depots)</strong> <span class="req">*</span> <span class="muted">· selección múltiple</span></span>
            <div class="chips">
              <button
                v-for="n in nodes" :key="'d' + n" type="button"
                :class="['chip', { on: depots.includes(n) }]"
                @click="toggleDepot(n)"
              >{{ n }}</button>
            </div>
          </div>

          <label class="row small">
            <input v-model="useServerGraph" type="checkbox" style="width: auto" />
            Usar el grafo de Lima configurado en el servidor (no enviar <code>graph</code>)
          </label>

          <details :open="!useServerGraph">
            <summary class="small" style="cursor: pointer">Grafo (JSON editable: nodo → vecino → distancia)</summary>
            <textarea
              class="mono"
              spellcheck="false"
              style="margin-top: 8px"
              :value="graphText"
              aria-label="Grafo JSON"
              @input="onGraphInput(($event.target as HTMLTextAreaElement).value)"
            />
            <span v-if="graphError" class="error-text">{{ graphError }}</span>
          </details>

          <div class="row">
            <button type="submit" class="btn btn-primary" :disabled="!canSubmit">
              {{ loading ? 'Calculando…' : 'Calcular ruta' }}
            </button>
          </div>

          <details>
            <summary class="small muted" style="cursor: pointer">Ver request</summary>
            <JsonViewer :value="requestBody" style="margin-top: 8px" />
          </details>
        </div>
      </form>

      <div class="stack">
        <div class="card">
          <div class="card-head">
            <h2>Resultado</h2>
            <span v-if="result" class="badge badge-ok">200 OK</span>
          </div>
          <div class="card-body stack">
            <ErrorAlert v-if="error" :error="error" />
            <template v-if="result">
              <div class="stats">
                <div class="stat"><div class="label">Base asignada</div><div class="value">{{ result.fromDepot }}</div></div>
                <div class="stat"><div class="label">Destino</div><div class="value">{{ result.to }}</div></div>
                <div class="stat"><div class="label">Distancia</div><div class="value">{{ result.distance }}</div></div>
              </div>
              <div class="path" aria-label="Ruta">
                <template v-for="(step, i) in result.path" :key="step">
                  <span v-if="i" class="arrow">→</span>
                  <span class="step">{{ step }}</span>
                </template>
              </div>
              <JsonViewer :value="result" />
            </template>
            <div v-else-if="!error" class="empty">El resultado aparecerá aquí.</div>
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <h2>Red de distritos</h2>
            <span class="muted small">● base &nbsp; <span style="color: var(--danger)">●</span> accidente</span>
          </div>
          <div class="card-body">
            <GraphCanvas :graph="graph" :depots="depots" :accident="accidentLocation" :path="result?.path" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
