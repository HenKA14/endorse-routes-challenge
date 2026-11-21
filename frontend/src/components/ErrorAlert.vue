<script setup lang="ts">
import { computed } from 'vue';
import { ApiError } from '../api/http';

const props = defineProps<{ error: unknown }>();

const info = computed(() => {
  const e = props.error;
  if (e instanceof ApiError) {
    const missing = (e.details as { missing?: Array<{ field: string; target: string }> } | undefined)?.missing;
    return { title: e.status ? `${e.status} · ${e.code ?? 'ERROR'}` : (e.code ?? 'ERROR'), message: e.message, missing };
  }
  return { title: 'Error', message: e instanceof Error ? e.message : String(e), missing: undefined };
});
</script>

<template>
  <div class="alert alert-error" role="alert">
    <strong>{{ info.title }}</strong>
    <div>{{ info.message }}</div>
    <ul v-if="info.missing?.length">
      <li v-for="m in info.missing" :key="m.field + m.target">
        <code>{{ m.field }}</code> <span class="muted">→ {{ m.target }}</span>
      </li>
    </ul>
  </div>
</template>
