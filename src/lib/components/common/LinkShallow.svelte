<script>
  import { goto, preloadData, pushState } from "$app/navigation";
  const { children, href } = $props();
</script>

<a
  {href}
  onclick={async (e) => {
    if (
      innerWidth < 640 || // bail if the screen is too small
      e.shiftKey || // or the link is opened in a new window
      e.metaKey ||
      e.ctrlKey // or a new tab (mac: metaKey, win/linux: ctrlKey)
      // should also consider clicking with a mouse scroll wheel
    )
      return;

    // prevent navigation
    e.preventDefault();

    const { href } = e.currentTarget;

    // run `load` functions (or rather, get the result of the `load` functions
    // that are already running because of `data-sveltekit-preload-data`)
    const result = await preloadData(href);

    if (result.type === "loaded" && result.status === 200) {
      pushState(href, { selected: result.data });
    } else {
      // something bad happened! try navigating
      goto(href);
    }
  }}
>
  {@render children?.()}
</a>
