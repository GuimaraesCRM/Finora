const trimSlash = (value) => String(value || "").replace(/\/+$/, "");

function isNativeApp() {
  return window.location.protocol === "capacitor:" || window.location.protocol === "ionic:";
}

function resolveApiUrl() {
  const envApi = trimSlash(import.meta.env.VITE_API_BASE_URL);
  if (envApi) return envApi;

  const host = window.location.hostname;
  const protocol = window.location.protocol;
  const sameOriginApi = `${window.location.origin}/api`;
  const devApi = `${protocol}//${host}:3333/api`;

  if (isNativeApp()) return "http://191.252.208.228:3333/api";
  return window.location.port === "5173" ? devApi : sameOriginApi;
}

export const apiUrl = resolveApiUrl();
export const nativeApp = isNativeApp();

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
