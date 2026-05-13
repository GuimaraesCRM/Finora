const host = window.location.hostname;
const protocol = window.location.protocol;
const sameOriginApi = `${window.location.origin}/api`;
const devApi = `${protocol}//${host}:3333/api`;

export const apiUrl = window.location.port === "5173" ? devApi : sameOriginApi;

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(payload.error || "Falha na comunicação com o servidor.");
  return payload;
}
