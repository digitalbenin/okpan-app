<script>
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import BaseInput from "$lib/components/base/BaseInput.svelte";
    import BaseModal from "$lib/components/base/BaseModal.svelte";
    import BaseSelect from "$lib/components/base/BaseSelect.svelte";
    import BaseRadio from "$lib/components/base/BaseRadio.svelte";
    import { addToast } from "$lib/components/base/BaseToast.svelte";

    let showModal = $state(false);
    let numberValue = $state(50);
    let textValue = $state("");

    const fruits = ["Apple", "Banana", "Orange", "Mango", "Pineapple"];
    const colors = ["Red", "Blue", "Green", "Yellow", "Purple"];
    const sizes = ["Small", "Medium", "Large"];
    const alignments = ["Left", "Center", "Right"];
    let selectedFruit = $state("");
    let selectedColor = $state("");
    let selectedSize = $state("Small");
    let selectedAlignment = $state("Left");

    $effect(() => {
        console.log("fruit", selectedFruit);
    });
    $effect(() => {
        console.log("color", selectedColor);
    });
    $effect(() => {
        console.log("size", selectedSize);
    });
    $effect(() => {
        console.log("alignment", selectedAlignment);
    });
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
                placeholder="custom style, no label"
                style="width: 20%;"
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
                label="Select Color (Label Left)"
                labelPosition="left"
                icon="palette"
                options={colors}
                bind:value={selectedColor}
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
</div>
