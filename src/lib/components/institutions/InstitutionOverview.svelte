<script>
  import { getContext } from "svelte";

  const institution = getContext("institution");
</script>

<div class="container-fluid mt-2">
  <div class="row">
    <div class="col">
      <h1>{institution.name.content}</h1>
    </div>
  </div>
  <div class="row">
    <div class="col-6">
      <div class="d-flex gap-5">
        <div>Location</div>
        <div>{institution.location.content}, {institution.country.content}</div>
      </div>
    </div>

    <div class="col-6">
      <div>
        <div>Links</div>
      </div>
    </div>
  </div>
</div>
