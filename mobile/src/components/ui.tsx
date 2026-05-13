import React, { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { usePalette } from "../theme";
import type { CurrencyCode } from "../types/api";
import { formatMoney, monthLabel } from "../lib/utils";

export function Screen({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  const palette = usePalette();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: 120, gap: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
            {!!subtitle && <Text style={[styles.subtitle, { color: palette.muted }]}>{subtitle}</Text>}
          </View>
          {action}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function SurfaceCard({ children, style }: { children: ReactNode; style?: object }) {
  const palette = usePalette();

  return <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border, shadowColor: palette.shadow }, style]}>{children}</View>;
}

export function MetricCard({ title, value, tone = "default", hint }: { title: string; value: string; tone?: "default" | "good" | "bad"; hint?: string }) {
  const palette = usePalette();
  const toneColor = tone === "good" ? palette.good : tone === "bad" ? palette.bad : palette.primary;

  return (
    <SurfaceCard style={{ flex: 1, minWidth: 150 }}>
      <Text style={{ color: palette.muted, fontSize: 13, fontWeight: "700" }}>{title}</Text>
      <Text style={{ color: palette.text, fontSize: 28, fontWeight: "800", marginTop: 14 }}>{value}</Text>
      {!!hint && <Text style={{ color: toneColor, marginTop: 8, fontSize: 13, fontWeight: "700" }}>{hint}</Text>}
    </SurfaceCard>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  const palette = usePalette();
  return (
    <View style={[styles.rowBetween, { marginBottom: 10 }]}>
      <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800" }}>{title}</Text>
      {action}
    </View>
  );
}

export function PrimaryButton({ label, onPress, icon, disabled = false }: { label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap; disabled?: boolean }) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: disabled ? palette.border : palette.primary,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      {!!icon && <Ionicons name={icon} size={18} color="#fff" />}
      <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

export function GhostButton({ label, onPress, icon }: { label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  const palette = usePalette();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor: palette.surfaceSoft, opacity: pressed ? 0.85 : 1 }]}>
      {!!icon && <Ionicons name={icon} size={18} color={palette.text} />}
      <Text style={{ color: palette.text, fontSize: 15, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: active ? palette.primary : palette.surfaceSoft,
      }}
    >
      <Text style={{ color: active ? "#fff" : palette.text, fontWeight: "800", fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function LabeledField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline = false,
  right,
}: {
  label: string;
  value: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "numeric";
  multiline?: boolean;
  right?: ReactNode;
}) {
  const palette = usePalette();
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: palette.muted, fontWeight: "700" }}>{label}</Text>
      <View style={[styles.field, { backgroundColor: palette.surfaceStrong, borderColor: palette.border, minHeight: multiline ? 96 : 54 }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette.muted}
          keyboardType={keyboardType}
          multiline={multiline}
          style={{ flex: 1, color: palette.text, fontSize: 16, minHeight: multiline ? 80 : 22 }}
        />
        {right}
      </View>
    </View>
  );
}

export function InfoRow({ title, value, valueColor }: { title: string; value: string; valueColor?: string }) {
  const palette = usePalette();
  return (
    <View style={styles.rowBetween}>
      <Text style={{ color: palette.muted, fontSize: 14 }}>{title}</Text>
      <Text style={{ color: valueColor || palette.text, fontSize: 14, fontWeight: "700" }}>{value}</Text>
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  const palette = usePalette();
  return (
    <SurfaceCard>
      <Text style={{ color: palette.text, fontSize: 16, fontWeight: "800" }}>{title}</Text>
      {!!body && <Text style={{ color: palette.muted, fontSize: 14, marginTop: 8 }}>{body}</Text>}
    </SurfaceCard>
  );
}

export function MonthSwitcher({ month, currency, onChange }: { month: string; currency: CurrencyCode; onChange: (value: string) => void }) {
  const palette = usePalette();
  return (
    <SurfaceCard style={{ paddingVertical: 12, paddingHorizontal: 14 }}>
      <View style={styles.rowBetween}>
        <Pressable onPress={() => onChange(shift(month, -1))} style={styles.iconCircle}>
          <Ionicons name="chevron-back" size={18} color={palette.text} />
        </Pressable>
        <Text style={{ color: palette.text, fontSize: 16, fontWeight: "800", textTransform: "capitalize" }}>{monthLabel(month, currency)}</Text>
        <Pressable onPress={() => onChange(shift(month, 1))} style={styles.iconCircle}>
          <Ionicons name="chevron-forward" size={18} color={palette.text} />
        </Pressable>
      </View>
    </SurfaceCard>
  );
}

export function SelectorModal({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: Array<{ value: string; label: string; meta?: string }>;
  selectedValue?: string | null;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const palette = usePalette();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.modalLayer, { backgroundColor: "rgba(0,0,0,0.45)" }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[styles.modalCard, { backgroundColor: palette.surface }]}>
          <View style={[styles.rowBetween, { marginBottom: 14 }]}>
            <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800" }}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={palette.text} />
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="always">
            {options.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => {
                  onSelect(option.value);
                  onClose();
                }}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.optionRow,
                  {
                    backgroundColor: option.value === selectedValue ? palette.primarySoft : palette.surfaceSoft,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.text, fontWeight: "700" }}>{option.label}</Text>
                  {!!option.meta && <Text style={{ color: palette.muted, fontSize: 12, marginTop: 4 }}>{option.meta}</Text>}
                </View>
                {option.value === selectedValue && <Ionicons name="checkmark-circle" size={20} color={palette.primary} />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function ProgressLine({ value, total, color }: { value: number; total: number; color: string }) {
  const palette = usePalette();
  const width = (total > 0 ? `${Math.max(0, Math.min(100, (value / total) * 100))}%` : "0%") as `${number}%`;
  return (
    <View style={{ height: 10, backgroundColor: palette.surfaceSoft, borderRadius: 999, overflow: "hidden", marginTop: 10 }}>
      <View style={{ width, height: "100%", backgroundColor: color }} />
    </View>
  );
}

function shift(month: string, offset: number) {
  const date = new Date(`${month}-01T00:00:00`);
  date.setMonth(date.getMonth() + offset);
  return date.toISOString().slice(0, 7);
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 2,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  button: {
    minHeight: 54,
    borderRadius: 18,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  field: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  modalLayer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 18,
    paddingBottom: 34,
  },
  optionRow: {
    minHeight: 58,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});
