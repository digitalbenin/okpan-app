<script>
  import { IconInfoCircle } from "@tabler/icons-svelte";

  let { title, description, icon: IconComponent = IconInfoCircle } = $props();
</script>

<div class="bg-white border rounded-4 p-3">
  <div class="d-flex gap-3 align-items-start">
    <div class="d-flex align-items-center mt-1">
      <IconComponent size={16} stroke={2} />
    </div>
    <div>
      <p class="fw-semibold mb-1 text-body">{title}</p>
      <p class="mb-0 text-secondary fs-7">{description}</p>
    </div>
  </div>
</div>
