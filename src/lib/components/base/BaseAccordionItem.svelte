<script lang="ts">
  import { Accordion } from "bits-ui";

  let { title, content, ...restProps } = $props();
</script>

<Accordion.Item {...restProps}>
  <Accordion.Header>
    <Accordion.Trigger>{title}</Accordion.Trigger>
  </Accordion.Header>
  <Accordion.Content>
    {content}
  </Accordion.Content>
</Accordion.Item>
