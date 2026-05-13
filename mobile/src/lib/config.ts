import Constants from "expo-constants";

const fallbackApi = "http://191.252.208.228:3333/api";

export const apiBaseUrl = String(
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl || fallbackApi
).replace(/\/+$/, "");
