<script>
  import "../assets/main.scss";
  import "bootstrap-icons/font/bootstrap-icons.css";
  import BaseToast from "$lib/components/base/BaseToast.svelte";

  let { children } = $props();
</script>

{@render children()}
<BaseToast />
