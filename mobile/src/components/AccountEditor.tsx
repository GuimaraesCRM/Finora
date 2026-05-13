import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePalette } from "../theme";
import type { Account } from "../types/api";
import { Chip, LabeledField, PrimaryButton } from "./ui";

type AccountDraft = {
  id?: string;
  name: string;
  type: Account["type"];
  initialBalance: string;
  creditLimit: string;
  closingDay: string;
  dueDay: string;
  color: string;
  shared: boolean;
};

const accountTypes: Array<{ value: Account["type"]; label: string }> = [
  { value: "checking", label: "Corrente" },
  { value: "savings", label: "Poupanca" },
  { value: "cash", label: "Dinheiro" },
  { value: "credit", label: "Cartao" },
  { value: "investment", label: "Invest." },
];

export function AccountEditor({
  visible,
  account,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  account?: Account | null;
  onClose: () => void;
  onSubmit: (payload: {
    id?: string;
    name: string;
    type: Account["type"];
    initialBalance: number;
    creditLimit: number;
    closingDay: number | null;
    dueDay: number | null;
    color: string;
    shared: boolean;
  }) => Promise<void>;
}) {
  const palette = usePalette();
  const [form, setForm] = useState<AccountDraft>(blankAccount());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (account) {
      setForm({
        id: account.id,
        name: account.name,
        type: account.type,
        initialBalance: String(account.initialBalance ?? 0),
        creditLimit: String(account.creditLimit ?? 0),
        closingDay: account.closingDay ? String(account.closingDay) : "",
        dueDay: account.dueDay ? String(account.dueDay) : "",
        color: account.color || "#0f8f88",
        shared: Boolean(account.shared),
      });
      return;
    }
    setForm(blankAccount());
  }, [visible, account]);

  async function submit() {
    setSaving(true);
    try {
      await onSubmit({
        id: form.id,
        name: form.name.trim(),
        type: form.type,
        initialBalance: Number(form.initialBalance || 0),
        creditLimit: Number(form.creditLimit || 0),
        closingDay: form.type === "credit" && form.closingDay ? Number(form.closingDay) : null,
        dueDay: form.type === "credit" && form.dueDay ? Number(form.dueDay) : null,
        color: form.color.trim() || "#0f8f88",
        shared: form.shared,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.layer, { backgroundColor: "rgba(0,0,0,0.42)" }]}>
        <View style={[styles.sheet, { backgroundColor: palette.surface }]}>
          <View style={styles.header}>
            <View>
              <Text style={{ color: palette.text, fontSize: 22, fontWeight: "800" }}>{form.id ? "Editar conta" : "Nova conta"}</Text>
              <Text style={{ color: palette.muted, marginTop: 6 }}>Conta nativa do app iPhone do Finora</Text>
            </View>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color={palette.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
            <LabeledField label="Nome da conta" value={form.name} onChangeText={(name) => setForm((current) => ({ ...current, name }))} placeholder="Ex.: Nubank, Carteira, Reserva..." />

            <View style={{ gap: 8 }}>
              <Text style={{ color: palette.muted, fontWeight: "700" }}>Tipo</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {accountTypes.map((item) => (
                  <Chip key={item.value} label={item.label} active={form.type === item.value} onPress={() => setForm((current) => ({ ...current, type: item.value }))} />
                ))}
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <LabeledField label="Saldo inicial" value={form.initialBalance} onChangeText={(initialBalance) => setForm((current) => ({ ...current, initialBalance }))} keyboardType="numeric" placeholder="0,00" />
              </View>
              <View style={{ flex: 1 }}>
                <LabeledField label="Cor" value={form.color} onChangeText={(color) => setForm((current) => ({ ...current, color }))} placeholder="#0f8f88" />
              </View>
            </View>

            {form.type === "credit" && (
              <>
                <LabeledField label="Limite" value={form.creditLimit} onChangeText={(creditLimit) => setForm((current) => ({ ...current, creditLimit }))} keyboardType="numeric" placeholder="0,00" />
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <LabeledField label="Fechamento" value={form.closingDay} onChangeText={(closingDay) => setForm((current) => ({ ...current, closingDay }))} keyboardType="numeric" placeholder="Dia" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <LabeledField label="Vencimento" value={form.dueDay} onChangeText={(dueDay) => setForm((current) => ({ ...current, dueDay }))} keyboardType="numeric" placeholder="Dia" />
                  </View>
                </View>
              </>
            )}

            <View style={[styles.switchRow, { backgroundColor: palette.surfaceStrong, borderColor: palette.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.text, fontWeight: "800" }}>Conta compartilhada</Text>
                <Text style={{ color: palette.muted, marginTop: 4, fontSize: 13 }}>Mantem a mesma logica do Finora web para contas em familia ou casal.</Text>
              </View>
              <Switch
                value={form.shared}
                onValueChange={(shared) => setForm((current) => ({ ...current, shared }))}
                trackColor={{ false: palette.border, true: palette.primary }}
                thumbColor="#ffffff"
              />
            </View>

            <PrimaryButton label={saving ? "Salvando..." : "Salvar conta"} onPress={submit} icon="save-outline" disabled={saving || !form.name.trim()} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function blankAccount(): AccountDraft {
  return {
    name: "",
    type: "checking",
    initialBalance: "0",
    creditLimit: "0",
    closingDay: "",
    dueDay: "",
    color: "#0f8f88",
    shared: false,
  };
}

const styles = StyleSheet.create({
  layer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 18,
    maxHeight: "92%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 18,
  },
  switchRow: {
    minHeight: 78,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
});
