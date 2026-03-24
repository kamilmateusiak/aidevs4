export async function fetchPage(args: unknown): Promise<string> {
  const { url } = args as { url: string };

  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchPage failed: ${res.status} ${res.statusText}`);

  return await res.text();
}
