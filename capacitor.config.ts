import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.guimaraescrm.finora",
  appName: "Finora",
  webDir: "dist/client",
  bundledWebRuntime: false,
  server: {
    iosScheme: "capacitor",
  },
};

export default config;
