/** Renders a JSON-LD block; values are JSON-encoded so nothing can break out of the script tag. */
export function JsonLd({ schema }: { schema: Record<string, unknown> | Record<string, unknown>[] }) {
  const payload = JSON.stringify(schema).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: payload }} />;
}
