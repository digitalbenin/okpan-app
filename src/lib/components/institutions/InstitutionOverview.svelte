<script>
  import { getContext } from "svelte";
  import BaseBadge from "$lib/components/base/BaseBadge.svelte";

  // Get institution data from context
  const institution = getContext("institution");

  function getStatusBadgeClass(status) {
    if (status === "in progress") {
      return "bg-warning text-dark";
    } else if (status === "completed") {
      return "bg-success text-white";
    }
    return "bg-secondary text-white";
  }
</script>

<div class="container-fluid mt-4">
  <!-- Breadcrumb Navigation -->
  <div class="mb-3">
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb">
        <li class="breadcrumb-item">
          <a href="/" class="text-decoration-none">Home</a>
        </li>
        <li class="breadcrumb-item active">{institution.name.content}</li>
      </ol>
    </nav>
  </div>

  <!-- Title Row with Edit Button and Status Badge -->
  <div class="row mb-4 align-items-center">
    <div class="col">
      <div class="d-flex align-items-center">
        <button class="btn btn-sm btn-outline-secondary me-3">
          <i class="bi bi-pencil"></i>
        </button>
        <h1 class="m-0 d-inline-block">{institution.name.content}</h1>
        <BaseBadge
          text={institution.status === "in progress"
            ? "In progress"
            : institution.status}
          class="ms-3 {getStatusBadgeClass(institution.status)}"
        />
      </div>
    </div>
  </div>

  <!-- Institution Details -->
  <div
    class="row mb-4 border-bottom py-3"
    style="border-color: #e9ecef !important;"
  >
    <div class="col-md-6">
      <div class="mb-2">
        <strong class="text-secondary">Location</strong>
      </div>
      <div>
        <a
          href="https://maps.google.com/?q={institution.location.content}"
          target="_blank"
          class="text-primary text-decoration-none"
        >
          {institution.location.content}, {institution.country.content}
        </a>
        {#if institution.location.content}
          <div class="text-muted small mt-1">
            (Map coordinates would go here)
          </div>
        {/if}
      </div>
    </div>

    <div class="col-md-6">
      <div class="mb-2">
        <strong class="text-secondary">Links</strong>
      </div>
      <div class="d-flex flex-column gap-2">
        {#if institution.links && institution.links.length > 0}
          {#each institution.links as link}
            <a
              href={link.url}
              target="_blank"
              class="text-primary text-decoration-none"
            >
              {link.label}
            </a>
          {/each}
        {:else}
          <span class="text-muted">No links available</span>
        {/if}
      </div>
    </div>
  </div>
</div>
