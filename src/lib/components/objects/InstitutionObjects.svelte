<script>
  import { getContext } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import BaseImage from "$lib/components/base/BaseImage.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import SidePanel from "$lib/components/common/SidePanel.svelte";
  import ObjectDetail from "$lib/components/objects/ObjectDetail.svelte";
  import BaseModal from "$lib/components/base/BaseModal.svelte";
  import {
    updateObjectResearchFields,
    updateObjectStatus,
    getObjectById,
    deleteObject,
  } from "$lib/stores/ObjectsUtils.js";

  // Get data from context
  const objects = getContext("objects") || [];
  // const assets = getContext("assets") || []; // No longer needed here

  // Mutable array of objects that can be updated
  let objectsList = $state(objects);

  // Function to get object title from mapped ontology field
  function getObjectTitle(object) {
    if (object.objectsOntologyFields) {
      const titleField = object.objectsOntologyFields.find(
        (field) =>
          field.ontologyField?.name?.content?.toLowerCase() === "object id"
      );
      if (titleField && titleField.value) {
        return titleField.value;
      }
    }
    // Fallback to the object's ID if no mapped field is found or value is empty
    return object.id || "Unknown ID";
  }

  // Function to get object type (designation) from mapped ontology field
  function getObjectType(object) {
    if (object.objectsOntologyFields) {
      const designationField = object.objectsOntologyFields.find(
        (field) =>
          field.ontologyField?.name?.content?.toLowerCase() === "designation"
      );
      // Return the value if found, otherwise null
      return designationField?.value || null;
    }
    return null; // Return null if objectsOntologyFields doesn't exist
  }

  // Placeholder function to get object status
  function getObjectStatus(object) {
    // Use the status field directly from the object data
    return object.status || "unknown status";
  }

  // Function to find image URL from the object's linked assets
  function getObjectImageUrl(object) {
    if (!object.objectsAssets || object.objectsAssets.length === 0) {
      return null; // No linked assets
    }

    const firstObjectAsset = object.objectsAssets[0];
    if (!firstObjectAsset || !firstObjectAsset.asset) {
      return null; // Malformed object asset link
    }

    const asset = firstObjectAsset.asset;
    let imageUrl = null;

    if (asset.formats) {
      try {
        // Parse formats if it's a string (safer check)
        const formats =
          typeof asset.formats === "string"
            ? JSON.parse(asset.formats)
            : asset.formats;

        // Prefer thumbnail or small format for the card view
        imageUrl = formats.thumbnail || formats.sm || formats.original || null;
      } catch (e) {
        console.error("Error parsing asset formats:", e);
        // Fallback to path if formats parsing fails
        imageUrl = asset.path || null;
      }
    } else {
      // Fallback to path if formats field doesn't exist
      imageUrl = asset.path || null;
    }

    // Prefix with media protocol if a URL/path was found
    return imageUrl ? `media://${imageUrl}` : null;
  }

  // Placeholder for status filter
  let statusFilter = $state("all"); // 'all', 'completed', 'in progress'

  // Placeholder for display mode
  let displayMode = $state("grid"); // 'grid' or 'list'

  // Computed property for filtered objects (implement actual filtering later)
  let filteredObjects = $derived(objectsList); // Now derived from mutable objectsList

  // Selected object state
  let selectedObjectId = $state(null);
  let selectedObject = $state(null);
  let isDeleteModalOpen = $state(false);
  let objectIdToDelete = $state(null);
  let closeContentTimeout = null;

  // Function to find object by ID
  function findObjectById(id) {
    return (
      objectsList.find((object) => String(object.id) === String(id)) || null
    );
  }

  // Function to show object detail panel
  async function showObjectDetail(objectId, updateUrl = true) {
    // Clear any pending timeout to remove content
    if (closeContentTimeout) {
      clearTimeout(closeContentTimeout);
      closeContentTimeout = null;
    }

    // First get the basic object from our local list
    const basicObject = findObjectById(objectId);
    const newObjectId = basicObject ? String(basicObject.id) : null;

    if (!newObjectId) {
      closeObjectDetail(true); // Close if object not found
      return;
    }

    if (newObjectId !== selectedObjectId) {
      // Set the ID immediately to show loading state
      selectedObjectId = newObjectId;

      try {
        // Then fetch the complete object data with research fields
        const response = await getObjectById(newObjectId);

        if (response.error) {
          console.error("Error fetching object details:", response.error);
          alert(`Error loading object details: ${response.error}`);
          // Fall back to basic object data
          selectedObject = basicObject;
        } else {
          // Use the complete object data
          selectedObject = response.result;
          console.log("Loaded complete object data:", selectedObject);
        }

        if (updateUrl) {
          const currentPath = $page.url.pathname;
          const currentParams = new URLSearchParams($page.url.search);
          currentParams.set("objectId", newObjectId);
          goto(`${currentPath}?${currentParams.toString()}`, {
            keepfocus: true,
            noscroll: true,
            replaceState: false,
          });
        }
      } catch (error) {
        console.error("Exception loading object details:", error);
        // Fall back to basic object data
        selectedObject = basicObject;
      }
    }
  }

  // Function to close object detail panel
  function closeObjectDetail(updateUrl = true) {
    if (selectedObjectId !== null) {
      //const idToRemove = selectedObjectId;
      selectedObjectId = null; // Start panel closing animation immediately

      // Clear any existing timeout before setting a new one
      if (closeContentTimeout) {
        clearTimeout(closeContentTimeout);
      }

      // Set timeout to remove the content *after* the animation
      closeContentTimeout = setTimeout(() => {
        if (selectedObjectId === null) {
          selectedObject = null;
        }
        closeContentTimeout = null;
      }, 310); // Matches CSS transition duration + small buffer

      if (updateUrl) {
        const currentPath = $page.url.pathname;
        const currentParams = new URLSearchParams($page.url.search);
        currentParams.delete("objectId");
        const newSearch = currentParams.toString();
        const newUrl = `${currentPath}${newSearch ? "?" + newSearch : ""}`;
        goto(newUrl, {
          keepfocus: true,
          noscroll: true,
          replaceState: false,
        });
      }
    }
  }

  // URL Synchronization
  $effect(() => {
    const urlObjectId = $page.url.searchParams.get("objectId");

    // Convert null/undefined to string for comparison if needed
    const currentSelectedIdStr = selectedObjectId
      ? String(selectedObjectId)
      : null;
    const currentUrlIdStr = urlObjectId ? String(urlObjectId) : null;

    if (currentUrlIdStr && currentUrlIdStr !== currentSelectedIdStr) {
      // URL has an ID, and it's different from the current state -> Open/switch panel
      showObjectDetail(currentUrlIdStr, false); // Don't push state again if triggered by URL
    } else if (!currentUrlIdStr && currentSelectedIdStr) {
      // URL has no ID, but state does -> Close panel
      closeObjectDetail(false); // Don't push state again if triggered by URL
    }
    // If URL and state match, or both are null, do nothing.
  });

  // Keyboard handler for accessible clicks
  function handleObjectKeyPress(event, objectId) {
    if (event.key === "Enter" || event.key === " ") {
      showObjectDetail(objectId);
    }
  }

  // Function to handle saving object changes
  async function handleObjectSave(saveData) {
    const { objectId, changes, statusChange } = saveData;

    if (!objectId) {
      console.error("Invalid save data: Missing objectId");
      return;
    }

    console.log(
      `Saving ${changes?.length || 0} field changes for object ${objectId}`,
      statusChange ? `and status change to "${statusChange}"` : ""
    );

    // Find the object to update
    if (!selectedObject) {
      console.error("No selected object found");
      return;
    }

    try {
      let fieldUpdateSuccess = true;
      let statusUpdateSuccess = true;

      // Save field changes to the database if there are any
      if (changes && changes.length > 0) {
        const fieldResult = await updateObjectResearchFields(objectId, changes);

        if (fieldResult.error) {
          console.error("Error saving field changes:", fieldResult.error);
          fieldUpdateSuccess = false;
        } else {
          console.log("Database field update successful:", fieldResult);

          // Create updated research fields by applying changes
          const updatedFields =
            selectedObject.objectsResearchFields?.map((field) => {
              const change = changes.find((c) => c.id === field.id);
              if (change) {
                // Create a new field object with updated value
                return { ...field, value: change.value };
              }
              return field;
            }) || [];

          // Create new object with updated fields
          selectedObject = {
            ...selectedObject,
            objectsResearchFields: updatedFields,
          };
        }
      }

      // Update status if changed using our new function
      if (statusChange) {
        console.log(`Updating status to: ${statusChange}`);

        const statusResult = await updateObjectStatus(objectId, statusChange);

        if (statusResult.error) {
          console.error("Error updating status:", statusResult.error);
          statusUpdateSuccess = false;
        } else {
          console.log("Status update successful:", statusResult);

          // Update the selected object's status
          selectedObject = {
            ...selectedObject,
            status: statusChange,
          };
        }
      }

      // Update object in the list
      const index = objectsList.findIndex((obj) => obj.id === objectId);
      if (index !== -1) {
        // Create a new list with the updated object
        const newList = [...objectsList];
        newList[index] = selectedObject;
        objectsList = newList;
      }

      // Show success message
      if (fieldUpdateSuccess && statusUpdateSuccess) {
        console.log(
          `Object "${getObjectTitle(selectedObject)}" updated successfully!`
        );
      } else {
        console.warn(
          `Object "${getObjectTitle(selectedObject)}" updated with some errors.`
        );
      }
    } catch (error) {
      console.error("Error during save:", error);
    }
  }

  // Function to handle object deletion request (opens modal)
  async function handleObjectDelete(objectId) {
    if (!objectId) {
      console.error("Invalid delete request: Missing objectId");
      return;
    }
    // Set the ID and open the modal
    objectIdToDelete = objectId;
    isDeleteModalOpen = true;
  }

  // Function called when deletion is confirmed in the modal
  async function confirmDelete() {
    if (!objectIdToDelete) {
      console.error("Cannot confirm delete: objectIdToDelete is null");
      isDeleteModalOpen = false;
      return;
    }

    console.log(`Confirmed deletion for object ${objectIdToDelete}`);
    const result = await deleteObject(objectIdToDelete);

    if (result.error) {
      console.error("Error deleting object:", result.error);
    } else {
      console.log("Object deleted successfully:", result);
      // Remove the deleted object from the local list IMMEDIATELY
      objectsList = objectsList.filter((obj) => obj.id !== objectIdToDelete);

      // Close the detail panel
      closeObjectDetail(true);
    }

    // Reset state
    isDeleteModalOpen = false;
    objectIdToDelete = null;
  }
</script>

<div class="container-fluid">
  <!-- Control Row 1: Display, Search, Actions -->
  <div class="d-flex justify-content-between align-items-center mb-3">
    <div class="d-flex align-items-center gap-2">
      <span class="me-2">Display as:</span>
      <div class="btn-group" role="group" aria-label="Display mode">
        <BaseButton
          icon="grid-3x3-gap-fill"
          class="btn btn-sm {displayMode === 'grid'
            ? 'btn-primary'
            : 'btn-outline-secondary'}"
          onClick={() => (displayMode = "grid")}
        />
        <BaseButton
          icon="list-ul"
          class="btn btn-sm {displayMode === 'list'
            ? 'btn-primary'
            : 'btn-outline-secondary'}"
          onClick={() => (displayMode = "list")}
        />
      </div>
    </div>
    <div class="d-flex align-items-center gap-2">
      <!-- Search Input REMOVED -->

      <!-- Action Buttons -->
      <BaseButton
        text="Add new object"
        icon="plus-lg"
        class="btn btn-sm btn-primary"
        disabled
        onClick={() => {
          /* TODO: Implement add action */
        }}
      />
      <BaseButton
        text="Import data"
        icon="upload"
        class="btn btn-sm btn-primary"
        disabled
        onClick={() => {
          /* TODO: Implement import action */
        }}
      />
    </div>
  </div>

  <!-- Control Row 2: Filter -->
  <!-- <div class="mb-4">
    <BaseButton
      text="Filter by status"
      icon="filter"
      iconPosition="right"
      class="btn btn-sm btn-dark"
      onClick={() => {
        /* TODO: Implement filter action */
      }}
    />
   
  </div> -->

  <!-- Grid/List Content -->
  {#if displayMode === "grid"}
    <div
      class="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 row-cols-xl-5 g-4"
    >
      {#each filteredObjects as object (object.id)}
        <div class="col">
          <div
            class="card h-100"
            role="button"
            tabindex="0"
            style="cursor: pointer;"
            onclick={() => showObjectDetail(object.id)}
            onkeydown={(event) => handleObjectKeyPress(event, object.id)}
          >
            <BaseImage
              src={getObjectImageUrl(object)}
              alt={getObjectTitle(object)}
              ratio="1/1"
              objectFit="cover"
              class="card-img-top"
            />
            <div class="card-body">
              <h6 class="card-title text-truncate">
                {getObjectTitle(object)}
              </h6>
              {#if getObjectType(object)}
                <p class="card-text small text-muted mb-1">
                  {getObjectType(object)}
                </p>
              {/if}
              <!-- Status Badge -->
              {#if getObjectStatus(object).toLowerCase() === "completed"}
                <span class="badge bg-success">Completed</span>
              {:else if getObjectStatus(object).toLowerCase() === "in progress"}
                <span class="badge bg-warning text-dark">in progress</span>
              {:else}
                <span class="badge bg-secondary">{getObjectStatus(object)}</span
                >
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <!-- List View -->
    <div class="table-responsive">
      <table class="table table-hover align-middle">
        <thead>
          <tr>
            <th scope="col" style="width: 80px;"
              ><button class="btn btn-sm btn-dark">Preview</button></th
            >
            <th scope="col"
              ><button class="btn btn-sm btn-dark">Object ID</button></th
            >
            <th scope="col"
              ><button class="btn btn-sm btn-dark">Designation</button></th
            >
            <th scope="col"
              ><button class="btn btn-sm btn-dark">Status</button></th
            >
          </tr>
        </thead>
        <tbody>
          {#if filteredObjects.length === 0}
            <tr>
              <td colspan="4" class="text-center text-muted py-4"
                >No objects found.</td
              >
            </tr>
          {:else}
            {#each filteredObjects as object (object.id)}
              <tr
                role="button"
                tabindex="0"
                style="cursor: pointer;"
                onclick={() => showObjectDetail(object.id)}
                onkeydown={(event) => handleObjectKeyPress(event, object.id)}
              >
                <td>
                  <BaseImage
                    src={getObjectImageUrl(object)}
                    alt={getObjectTitle(object)}
                    width="60"
                    height="60"
                    objectFit="cover"
                    ratio="1/1"
                  />
                </td>
                <td>{getObjectTitle(object)}</td>
                <td>{getObjectType(object) || "-"}</td>
                <td>
                  {#if getObjectStatus(object).toLowerCase() === "completed"}
                    <span class="badge bg-success">Completed</span>
                  {:else if getObjectStatus(object).toLowerCase() === "in progress"}
                    <span class="badge bg-warning text-dark">in progress</span>
                  {:else}
                    <span class="badge bg-secondary"
                      >{getObjectStatus(object)}</span
                    >
                  {/if}
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  {/if}

  {#if filteredObjects.length === 0 && displayMode === "grid"}
    <div class="alert alert-info mt-4">
      No objects found.
      <!-- TODO: Add guidance or link to add/import -->
    </div>
  {/if}
</div>

<!-- Side Panel for Object Detail -->
<SidePanel
  isOpen={!!selectedObjectId}
  on:close={() => closeObjectDetail(true)}
  position="right"
  aria-labelledby="objectDetailTitle"
>
  <div slot="header" class="d-flex align-items-center justify-content-between">
    <div class="d-flex align-items-center gap-2">
      <BaseButton
        icon="chevron-right"
        onClick={() => closeObjectDetail(true)}
        class="btn btn-light"
        aria-label="Close object detail"
      />
      <h5 id="objectDetailTitle" class="mb-0 text-break">
        {selectedObject ? getObjectTitle(selectedObject) : "Object Detail"}
      </h5>
    </div>
  </div>

  {#if selectedObject}
    <ObjectDetail
      object={selectedObject}
      onSave={handleObjectSave}
      onDelete={handleObjectDelete}
    />
  {:else}
    <p>Loading...</p>
  {/if}
</SidePanel>

{#snippet header()}
  Confirm Deletion
{/snippet}

{#snippet body()}
  Are you sure you want to delete this object? This action cannot be undone.
{/snippet}

{#snippet actions()}
  <div class="d-flex justify-content-end gap-2">
    <BaseButton
      text="Cancel"
      class="btn btn-secondary btn-sm"
      onClick={() => {
        isDeleteModalOpen = false;
        objectIdToDelete = null;
      }}
    />
    <BaseButton
      text="Confirm Delete"
      class="btn btn-danger btn-sm"
      onClick={confirmDelete}
    />
  </div>
{/snippet}

<!-- Render the modal directly here, passing snippets as props -->
{#if isDeleteModalOpen}
  <BaseModal
    bind:isOpen={isDeleteModalOpen}
    size="md"
    {header}
    {body}
    {actions}
  />
{/if}
