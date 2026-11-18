export async function fetchGzipAsset(url) {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw Error(`Resource unavailable: ${url}`);
  // Vite advertises the encoding. An offline server may serve the compressed bytes verbatim.
  if (response.headers.get('Content-Encoding')?.includes('gzip')) return response;
  return new Response(response.body.pipeThrough(new DecompressionStream('gzip')));
}
