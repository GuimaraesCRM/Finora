import { useColorScheme } from "react-native";

const lightPalette = {
  background: "#f4f7f6",
  surface: "#ffffff",
  surfaceSoft: "#eef5f2",
  surfaceStrong: "#f7fbf9",
  text: "#18211f",
  muted: "#6b7873",
  border: "#d8e3de",
  primary: "#0f8f88",
  primarySoft: "#d7f2ef",
  good: "#14884a",
  bad: "#d84a3a",
  warning: "#c98316",
  shadow: "rgba(24, 33, 31, 0.08)",
};

const darkPalette = {
  background: "#0d1312",
  surface: "#151d1b",
  surfaceSoft: "#1d2925",
  surfaceStrong: "#202f2a",
  text: "#edf6f1",
  muted: "#9bafa8",
  border: "#2a3a35",
  primary: "#2dd4bf",
  primarySoft: "rgba(45, 212, 191, 0.15)",
  good: "#4ade80",
  bad: "#fb7185",
  warning: "#fbbf24",
  shadow: "rgba(0, 0, 0, 0.28)",
};

export function usePalette() {
  return useColorScheme() === "dark" ? darkPalette : lightPalette;
}
