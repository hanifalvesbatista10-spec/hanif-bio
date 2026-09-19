// Utilitários de vídeo da área de membros (YouTube por enquanto).

export function youtubeId(url = "") {
  const value = String(url).trim();
  if (!value) return null;
  const patterns = [
    /[?&]v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
    /youtube\.com\/live\/([\w-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// URL usada pelo player do aluno. Links que não são do YouTube seguem como vieram.
export function toEmbedUrl(url = "") {
  const id = youtubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : url;
}

export function watchUrl(url = "") {
  const id = youtubeId(url);
  return id ? `https://www.youtube.com/watch?v=${id}` : url;
}

// Consulta o oEmbed público do YouTube: confirma que o vídeo existe e pode ser incorporado.
// Retorna { state: "ok" | "unavailable" | "invalid" | "unknown", title, thumbnail }.
export async function checkYoutubeVideo(url) {
  const id = youtubeId(url);
  if (!id) return { state: "invalid" };
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`
    );
    if (response.ok) {
      const data = await response.json();
      return { state: "ok", title: data.title, thumbnail: data.thumbnail_url };
    }
    // 401 = privado ou incorporação desativada; 404 = removido/inexistente.
    if (response.status === 401 || response.status === 404 || response.status === 403) {
      return { state: "unavailable", status: response.status };
    }
    return { state: "unknown", status: response.status };
  } catch {
    return { state: "unknown" };
  }
}
