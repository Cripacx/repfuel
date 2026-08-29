<script lang="ts">
  import Modal from '$lib/components/Modal.svelte';
  import { m } from '$lib/i18n/index.js';

  let { onClose }: { onClose: () => void } = $props();
</script>

<Modal title={m().auth.installApp.title} {onClose}>
  <p class="muted">{m().auth.installApp.intro}</p>

  <h3>{m().auth.installApp.iosTitle}</h3>
  <p>{m().auth.installApp.iosStep1}</p>
  <p>{m().auth.installApp.iosStep2}</p>
  <p>{m().auth.installApp.iosStep3}</p>
  <p>{m().auth.installApp.iosStep4}</p>

  <h3>{m().auth.installApp.androidTitle}</h3>
  <p>{m().auth.installApp.androidStep1}</p>
  <p>{m().auth.installApp.androidStep2}</p>
  <p>{m().auth.installApp.androidStep3}</p>
</Modal>

<style>
  h3:not(:first-child) {
    margin-top: var(--space-8);
  }
</style>
