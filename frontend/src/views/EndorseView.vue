<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  endorseApi,
  PDF_ENDORSE_EXAMPLE,
  type FlatPayload,
  type TemplateInputField,
  type TemplateSummary,
  type TranslateResult,
} from '../api/endorse.api';
import { ApiError } from '../api/http';
import ErrorAlert from '../components/ErrorAlert.vue';
import JsonViewer from '../components/JsonViewer.vue';
import { coerceInput, parseFlatJson } from '../utils/json';

type Mode = 'form' | 'json';

const templates = ref<TemplateSummary[]>([]);
const templatesError = ref<unknown>(null);
const selectedKey = ref('');
const payload = ref<FlatPayload>({});
const mode = ref<Mode>('form');
const jsonText = ref('');
const jsonError = ref('');
const newFieldName = ref('');

const loading = ref(false);
const result = ref<TranslateResult | null>(null);
const error = ref<unknown>(null);

const keyOf = (t: Pick<TemplateSummary, 'producto' | 'tipoEndoso'>) => `${t.producto}::${t.tipoEndoso}`;
const selected = computed(() => templates.value.find((t) => keyOf(t) === selectedKey.value));

/** Campos que la plantilla consume + campos extra que el usuario agregó. */
const fields = computed<TemplateInputField[]>(() => {
  const known = (selected.value?.inputFields ?? []).filter((f) => f.name !== 'producto' && f.name !== 'tipoEndoso');
  const knownNames = new Set(['producto', 'tipoEndoso', ...known.map((f) => f.name)]);
  const extra = Object.keys(payload.value)
    .filter((k) => !knownNames.has(k))
    .map((name) => ({ name, required: false, defaultValue: null }));
  return [...known, ...extra];
});

const missingFields = computed(() => {
  const e = error.value;
  if (!(e instanceof ApiError) || e.code !== 'MISSING_REQUIRED_FIELDS') return new Set<string>();
  const missing = (e.details as { missing?: Array<{ field: string }> })?.missing ?? [];
  return new Set(missing.map((m) => m.field));
});

const extraFieldNames = computed(() => {
  const known = new Set(selected.value?.inputFields.map((f) => f.name) ?? []);
  return new Set(Object.keys(payload.value).filter((k) => !known.has(k)));
});

onMounted(loadTemplates);

async function loadTemplates() {
  templatesError.value = null;
  try {
    templates.value = await endorseApi.listTemplates();
    if (!selectedKey.value && templates.value.length) selectTemplate(keyOf(templates.value[0]));
  } catch (e) {
    templatesError.value = e;
  }
}

function selectTemplate(key: string) {
  selectedKey.value = key;
  const t = selected.value;
  if (!t) return;
  payload.value = { ...payload.value, producto: t.producto, tipoEndoso: t.tipoEndoso };
}

function setField(name: string, text: string) {
  payload.value = { ...payload.value, [name]: coerceInput(text, payload.value[name]) };
}

function removeField(name: string) {
  const { [name]: _removed, ...rest } = payload.value;
  void _removed;
  payload.value = rest;
}

function addField() {
  const name = newFieldName.value.trim();
  if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(name) || name in payload.value) return;
  payload.value = { ...payload.value, [name]: '' };
  newFieldName.value = '';
}

function loadExample() {
  payload.value = { ...PDF_ENDORSE_EXAMPLE };
  const match = templates.value.find(
    (t) => t.producto === PDF_ENDORSE_EXAMPLE.producto && t.tipoEndoso === PDF_ENDORSE_EXAMPLE.tipoEndoso,
  );
  if (match) selectedKey.value = keyOf(match);
  error.value = null;
}

function clearForm() {
  const t = selected.value;
  payload.value = t ? { producto: t.producto, tipoEndoso: t.tipoEndoso } : {};
  result.value = null;
  error.value = null;
}

// Sincroniza formulario <-> editor JSON.
watch(mode, (m) => {
  if (m === 'json') {
    jsonText.value = JSON.stringify(payload.value, null, 2);
    jsonError.value = '';
  }
});

function onJsonInput(text: string) {
  jsonText.value = text;
  const parsed = parseFlatJson(text);
  if (!parsed.ok) {
    jsonError.value = parsed.error;
    return;
  }
  jsonError.value = '';
  payload.value = parsed.value;
  const t = templates.value.find((x) => x.producto === parsed.value.producto && x.tipoEndoso === parsed.value.tipoEndoso);
  if (t) selectedKey.value = keyOf(t);
}

async function submit() {
  if (mode.value === 'json' && jsonError.value) return;
  loading.value = true;
  error.value = null;
  try {
    result.value = await endorseApi.translate(payload.value);
  } catch (e) {
    result.value = null;
    error.value = e;
  } finally {
    loading.value = false;
  }
}

const display = (v: unknown) => (v === null || v === undefined ? '' : String(v));
</script>

<template>
  <section>
    <div class="page-head">
      <div>
        <h1>Traductor de endosos</h1>
        <p>
          Envía el JSON plano de un endoso y obtén el JSON estructurado que consume el core. La estructura, el orden y
          los valores por defecto salen de la plantilla configurada en BD para el producto y el tipo de endoso.
        </p>
      </div>
      <span class="badge" :title="endorseApi.baseUrl">POST /v1/endorse/translate</span>
    </div>

    <ErrorAlert v-if="templatesError" :error="templatesError" style="margin-bottom: 16px" />

    <div class="grid-2">
      <form class="card" @submit.prevent="submit">
        <div class="card-head">
          <h2>Datos de entrada</h2>
          <div class="tabs" role="tablist">
            <button type="button" :class="{ active: mode === 'form' }" @click="mode = 'form'">Formulario</button>
            <button type="button" :class="{ active: mode === 'json' }" @click="mode = 'json'">JSON</button>
          </div>
        </div>

        <div class="card-body stack">
          <label class="field">
            Plantilla <span class="hint">(producto · tipo de endoso)</span>
            <select :value="selectedKey" @change="selectTemplate(($event.target as HTMLSelectElement).value)">
              <option v-if="!templates.length" value="">Cargando plantillas…</option>
              <option v-for="t in templates" :key="keyOf(t)" :value="keyOf(t)">
                {{ t.producto }} · {{ t.tipoEndoso }} (v{{ t.version }})
              </option>
            </select>
          </label>

          <template v-if="mode === 'form'">
            <div class="form-grid">
              <label
                v-for="f in fields"
                :key="f.name"
                class="field"
                :class="{ invalid: missingFields.has(f.name) }"
              >
                <span class="row">
                  <span>{{ f.name }} <span v-if="f.required" class="req" title="Obligatorio">*</span></span>
                  <span class="spacer" />
                  <button
                    v-if="extraFieldNames.has(f.name)"
                    type="button"
                    class="btn-ghost btn-sm btn"
                    :aria-label="`Quitar ${f.name}`"
                    @click="removeField(f.name)"
                  >✕</button>
                </span>
                <input
                  :value="display(payload[f.name])"
                  :placeholder="f.defaultValue !== null && f.defaultValue !== undefined ? `Default: ${JSON.stringify(f.defaultValue)}` : ''"
                  @input="setField(f.name, ($event.target as HTMLInputElement).value)"
                />
              </label>
            </div>
            <div class="row">
              <input
                v-model="newFieldName"
                placeholder="Agregar campo (ej. responsableAtencion)"
                style="max-width: 320px"
                @keydown.enter.prevent="addField"
              />
              <button type="button" class="btn btn-sm" @click="addField">Agregar</button>
            </div>
            <p class="muted small" style="margin: 0">
              <span class="req">*</span> obligatorio según la plantilla. Los campos vacíos usan el valor por defecto
              configurado.
            </p>
          </template>

          <template v-else>
            <textarea
              class="mono"
              spellcheck="false"
              :value="jsonText"
              aria-label="JSON de entrada"
              @input="onJsonInput(($event.target as HTMLTextAreaElement).value)"
            />
            <span v-if="jsonError" class="error-text">{{ jsonError }}</span>
          </template>

          <div class="row">
            <button type="submit" class="btn btn-primary" :disabled="loading || (mode === 'json' && !!jsonError)">
              {{ loading ? 'Traduciendo…' : 'Traducir' }}
            </button>
            <button type="button" class="btn" @click="loadExample">Cargar ejemplo del enunciado</button>
            <span class="spacer" />
            <button type="button" class="btn btn-ghost" @click="clearForm">Limpiar</button>
          </div>
        </div>
      </form>

      <div class="card">
        <div class="card-head">
          <h2>JSON para el core</h2>
          <div v-if="result" class="row">
            <span class="badge badge-ok">200 OK</span>
            <span class="badge badge-accent">Plantilla #{{ result.templateId }} · v{{ result.templateVersion }}</span>
            <span class="badge">{{ result.elapsedMs }} ms</span>
          </div>
        </div>
        <div class="card-body stack">
          <ErrorAlert v-if="error" :error="error" />
          <JsonViewer v-if="result" :value="result.payload" />
          <div v-else-if="!error" class="empty">El JSON traducido aparecerá aquí.</div>
          <p v-if="result?.requestId" class="muted small" style="margin: 0">X-Request-Id: {{ result.requestId }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
