<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import RoutineEditor from '$lib/components/RoutineEditor.svelte';
</script>

<RoutineEditor
  routine={null}
  onSaved={(routine) => {
    void goto(resolve('/routines/[id]', { id: routine.id }));
  }}
/>
