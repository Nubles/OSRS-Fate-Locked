export const ephemeral = (content: string, components: unknown[] = []) => ({
  type: 4,
  data: { content, components, flags: 64, allowed_mentions: { parse: [] } },
});

export const linkButton = (label: string, url: string) => ({
  type: 2,
  style: 5,
  label,
  url,
});
