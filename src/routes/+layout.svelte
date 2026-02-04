<script>
  import "../assets/main.scss";
  import "bootstrap-icons/font/bootstrap-icons.css";
  import BaseToast from "$lib/components/base/BaseToast.svelte";
  import { onMount } from "svelte";
  import { invalidateAll } from "$app/navigation";

  let { children } = $props();

  onMount(() => {
    if (window.api && window.api.onDataChanged) {
      const removeListener = window.api.onDataChanged(() => {
        console.log("Data changed from backend, invalidating all...");
        invalidateAll();
      });
      return removeListener;
    }
  });
</script>

{@render children()}
<BaseToast />
