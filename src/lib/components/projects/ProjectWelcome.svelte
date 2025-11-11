<script>
  import { page as pageData } from "$app/state";
  const projectId = $derived(pageData.data.project.id);
  const baseUrl = $derived(`/projects/${projectId}`);
</script>

<div class="container-fluid py-4">
  <div class="row">
    <div class="col-12 col-lg-10">
      <h2 class="fw-semibold mb-2">Where do you want to start?</h2>
      <p class="text-muted">
        Start your project with the right foot. This platform helps you research
        and connect data about cultural objects from diverse institutions,
        bringing knowledge and heritage together in one place.
      </p>
    </div>
  </div>

  <div class="row g-4 mx-3 mt-1">
    <!-- Define data structure -->
    <div class="col-12 col-md-4">
      <div
        class="h-100 border rounded p-3 bg-white d-flex flex-column justify-content-between"
      >
        <div class="mb-3 text-muted">
          <i
            class="bi bi-grid-3x3-gap-fill fs-1 mb-3 d-block"
            style="color:#dddddd"
          ></i>
          <div class="mb-3">
            <div class="h4 mb-0">Define your data structure</div>
          </div>
          <p class="text-muted">
            How do you want to describe the objects you import? Define the
            ontology and vocabularies for your research project.
          </p>
        </div>
        <div>
          <a
            class="btn btn-primary"
            href={`${baseUrl}/data-structure/research-fields`}
            >Define data structure</a
          >
        </div>
      </div>
    </div>

    <!-- Create an institution -->
    <div class="col-12 col-md-4">
      <div
        class="h-100 border rounded p-3 bg-white d-flex flex-column justify-content-between"
      >
        <div class="mb-3 text-muted">
          <i class="bi bi-bank fs-1 d-block mb-3" style="color:#dddddd"></i>
          <div class="mb-3">
            <div class="h4 mb-0">Create an institution</div>
          </div>
          <p class="text-muted">
            Add institutions, museums or archives where the data about your
            collection are coming from.
          </p>
        </div>
        <div>
          <a class="btn btn-primary" href={`${baseUrl}/institutions/add`}
            >Create institution</a
          >
        </div>
      </div>
    </div>

    <!-- Import data -->
    <div class="col-12 col-md-4">
      <div
        class="h-100 border rounded p-3 bg-white d-flex flex-column justify-content-between"
      >
        <div class="mb-3">
          <i class="bi bi-box fs-1 d-block mb-3" style="color:#dddddd"></i>
          <div class="mb-3">
            <div class="h4 mb-0">Import data</div>
          </div>
          <p class="text-muted">
            Start batch importing data about your research objects from CSV,
            JSON or XML files.
          </p>
        </div>
        <div>
          <a class="btn btn-primary" href={`${baseUrl}/import-data`}>Import data</a>
        </div>
      </div>
    </div>
  </div>
</div>
