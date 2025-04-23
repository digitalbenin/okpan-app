<script>
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import BaseInput from "$lib/components/base/BaseInput.svelte";
    import BaseModal from "$lib/components/base/BaseModal.svelte";
    import BaseSelect from "$lib/components/base/BaseSelect.svelte";
    import BaseRadio from "$lib/components/base/BaseRadio.svelte";
    import BaseToggle from "$lib/components/base/BaseToggle.svelte";
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import BaseTextArea from "$lib/components/base/BaseTextArea.svelte";
    import { addToast } from "$lib/components/base/BaseToast.svelte";

    let showModal = $state(false);
    let numberValue = $state(50);
    let textValue = $state("");
    let toggleValue1 = $state(true);
    let toggleValue2 = $state(false);
    let description = $state("");

    const fruits = ["Apple", "Banana", "Orange", "Mango", "Pineapple"];
    const colors = ["Red", "Blue", "Green", "Yellow", "Purple"];
    const sizes = ["Small", "Medium", "Large"];
    const alignments = ["Left", "Center", "Right"];
    let selectedFruit = $state("Apple");
    let selectedColors = $state(["Red", "Blue"]);
    let selectedSize = $state("Medium");
    let selectedAlignment = $state("Center");

    $inspect("fruit:", selectedFruit);
    $inspect("colors:", selectedColors);
    $inspect("size:", selectedSize);
    $inspect("alignment:", selectedAlignment);
    $inspect("description:", description);
</script>

<div class="container py-5">
    <h1 class="mb-5">UI Components Kitchen Sink</h1>

    <!-- BUTTONS -->

    <section class="mb-5">
        <h2 class="mb-4">Buttons</h2>
        <div class="d-flex gap-3 flex-wrap">
            <BaseButton text="Default Button" class="btn btn-primary" />
            <BaseButton
                text="With Icon"
                icon="star"
                class="btn btn-secondary"
            />
            <BaseButton
                text="Icon Right"
                icon="arrow-right"
                iconPosition="right"
                class="btn btn-success"
            />
            <BaseButton text="Loading" loading={true} class="btn btn-warning" />
            <BaseButton
                text="Disabled"
                disabled={true}
                class="btn btn-danger"
            />
        </div>
    </section>

    <!-- INPUTS -->

    <section class="mb-5">
        <h2 class="mb-4">Inputs</h2>
        <div class="d-flex flex-column gap-4">
            <BaseInput
                label="Text Input (Label Top)"
                placeholder="Enter some text..."
                bind:value={textValue}
            />

            <BaseInput
                type="text"
                label="Text Input (Label Left)"
                labelPosition="left"
                placeholder="Enter some text..."
            />

            <BaseInput
                type="number"
                label="Number Input - custom class"
                placeholder="Enter a number"
                class="w-auto"
                min={0}
                max={100}
                bind:value={numberValue}
            />

            <BaseInput
                type="text"
                placeholder="no label, disabled"
                style="width: 20%;"
                disabled={true}
            />
        </div>
    </section>

    <!-- TEXT AREAS -->

    <section class="mb-5">
        <h2 class="mb-4">Text Areas</h2>
        <div class="d-flex flex-column gap-4">
            <BaseTextArea
                label="Description (Label Top)"
                placeholder="Enter a description..."
                bind:value={description}
                rows={4}
                maxLength={200}
            />

            <BaseTextArea
                placeholder="No label, disabled state"
                disabled={true}
                resize="none"
                style="width: 50%;"
            />
        </div>
    </section>

    <!-- SELECTS -->

    <section class="mb-5">
        <h2 class="mb-4">Selects</h2>
        <div class="d-flex flex-column gap-4">
            <BaseSelect
                label="Select Fruit (Label Top)"
                options={fruits}
                bind:value={selectedFruit}
                class="w-auto"
            />

            <BaseSelect
                label="Select Color (Multiple, Label Left)"
                labelPosition="left"
                icon="palette"
                options={colors}
                multiple={true}
                bind:value={selectedColors}
            />
        </div>
    </section>

    <!-- RADIO GROUPS -->

    <section class="mb-5">
        <h2 class="mb-4">Radio Groups</h2>
        <div class="d-flex flex-column gap-4">
            <BaseRadio
                label="Size (Label Top)"
                options={sizes}
                bind:value={selectedSize}
            />

            <BaseRadio
                label="Alignment (Label Left)"
                labelPosition="left"
                options={alignments}
                bind:value={selectedAlignment}
            />

            <BaseRadio
                label="Vertical Layout (Same as first group)"
                options={sizes}
                orientation="vertical"
                class="w-auto"
                bind:value={selectedSize}
            />
        </div>
    </section>

    <!-- TOGGLES -->

    <section class="mb-5">
        <h2 class="mb-4">Toggles</h2>
        <div class="d-flex flex-column gap-3">
            <BaseToggle
                bind:value={toggleValue1}
                label="Default Toggle (Label Left)"
            />

            <BaseToggle
                bind:value={toggleValue2}
                label="Label on Right"
                labelPosition="right"
            />

            <BaseToggle
                bind:value={toggleValue1}
                label="Disabled Toggle (label on top)"
                labelPosition="top"
                disabled={true}
                class="mt-3"
            />
        </div>
    </section>

    <!-- MODALS -->

    <section class="mb-5">
        <h2 class="mb-4">Modal</h2>
        <BaseButton
            text="Open Modal"
            onClick={() => (showModal = true)}
            class="btn btn-primary"
        />
        <BaseModal bind:isOpen={showModal}>
            {#snippet header()}
                Example Modal
            {/snippet}

            {#snippet body()}
                <p>This is an example modal content.</p>
            {/snippet}

            {#snippet actions()}
                <div class="d-flex gap-2">
                    <BaseButton
                        text="Cancel"
                        onClick={() => {
                            console.log("cancel");
                            showModal = false;
                        }}
                        class="btn btn-secondary"
                    />
                    <BaseButton
                        text="Save"
                        onClick={() => {
                            console.log("save");
                            showModal = false;
                        }}
                        class="btn btn-primary"
                    />
                </div>
            {/snippet}
        </BaseModal>
    </section>

    <!-- TOAST -->

    <section class="mb-5">
        <h2 class="mb-4">Toast</h2>
        <div class="d-flex gap-3 flex-wrap">
            <BaseButton
                text="Show Success Toast"
                onClick={() =>
                    addToast({
                        data: {
                            title: "Success Example",
                            description: "This is a success message",
                            type: "success",
                        },
                    })}
                class="btn btn-success"
            />
            <BaseButton
                text="Show Error Toast"
                onClick={() =>
                    addToast({
                        data: {
                            title: "Error Example",
                            description: "This is an error message",
                            type: "error",
                        },
                    })}
                class="btn btn-danger"
            />
            <BaseButton
                text="Show Info Toast"
                onClick={() =>
                    addToast({
                        data: {
                            title: "Info Example",
                            description: "This is an info message",
                            type: "info",
                        },
                    })}
                class="btn btn-info"
            />
        </div>
    </section>

    <!-- IMAGES -->

    <section class="mb-5">
        <h2 class="mb-4">Images</h2>
        <div class="d-flex flex-row gap-3 flex-wrap justify-content-between">
            <div class="d-flex flex-column gap-1">
                <p>Image with ratio = 16/9</p>
                <BaseImage
                    src="https://picsum.photos/400"
                    alt="Placeholder"
                    width="300"
                    ratio="16/9"
                    class="mb-3"
                />
            </div>
            <div class="d-flex flex-column gap-1">
                <p>Image with no src, ratio = 4/3</p>
                <BaseImage
                    alt="Placeholder"
                    width="300"
                    ratio="4/3"
                    class="mb-3"
                />
            </div>
            <div class="d-flex flex-column gap-1">
                <p>Image not present</p>
                <BaseImage
                    src="https://fake.url"
                    alt="Placeholder"
                    width="300"
                    ratio="16/9"
                    class="mb-3"
                />
            </div>
        </div>
    </section>
</div>
