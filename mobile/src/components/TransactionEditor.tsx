import React, { useEffect, useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { usePalette } from "../theme";
import type { Account, Category, Transaction } from "../types/api";
import { accountTypeLabel, formatDate, today } from "../lib/utils";
import { Chip, LabeledField, PrimaryButton } from "./ui";

type Panel = "date" | "account" | "category" | "transfer" | null;

type TransactionFormValue = {
  id?: string;
  description: string;
  amount: string;
  date: string;
  type: "income" | "expense" | "transfer";
  status: "paid" | "pending";
  accountId: string;
  transferAccountId: string | null;
  categoryId: string | null;
  tags: string;
  notes: string;
};

export function TransactionEditor({
  visible,
  transaction,
  accounts,
  categories,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  transaction?: Transaction | null;
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
  onSubmit: (payload: {
    id?: string;
    accountId: string;
    transferAccountId: string | null;
    categoryId: string | null;
    type: "income" | "expense" | "transfer";
    status: "paid" | "pending";
    description: string;
    amount: number;
    date: string;
    tags: string;
    notes: string;
    installmentTotal: number;
    invoiceMonth: null;
  }) => Promise<void>;
}) {
  const palette = usePalette();
  const [form, setForm] = useState<TransactionFormValue>(() => blankForm(accounts, categories));
  const [saving, setSaving] = useState(false);
  const [openPanel, setOpenPanel] = useState<Panel>(null);
  const [draftDate, setDraftDate] = useState(new Date());

  const account = accounts.find((item) => item.id === form.accountId);
  const transferAccount = accounts.find((item) => item.id === form.transferAccountId);
  const availableCategories = categories.filter((item) => item.type === (form.type === "income" ? "income" : "expense"));
  const category = availableCategories.find((item) => item.id === form.categoryId);
  const transferOptions = accounts.filter((item) => item.id !== form.accountId);

  useEffect(() => {
    if (!visible) return;
    if (transaction) {
      setForm({
        id: transaction.id,
        description: transaction.description,
        amount: String(transaction.amount),
        date: transaction.date,
        type: transaction.type,
        status: transaction.status,
        accountId: transaction.accountId,
        transferAccountId: transaction.transferAccountId,
        categoryId: transaction.categoryId,
        tags: transaction.tags || "",
        notes: transaction.notes || "",
      });
      setDraftDate(new Date(`${transaction.date}T12:00:00`));
    } else {
      const initial = blankForm(accounts, categories);
      setForm(initial);
      setDraftDate(new Date(`${initial.date}T12:00:00`));
    }
    setOpenPanel(null);
  }, [visible, transaction, accounts, categories]);

  const canSave = Boolean(
    form.description.trim() &&
    form.amount &&
    form.accountId &&
    (form.type === "transfer" ? form.transferAccountId : form.categoryId || availableCategories.length === 0)
  );

  function togglePanel(panel: Exclude<Panel, null>) {
    setOpenPanel((current) => (current === panel ? null : panel));
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSubmit({
        id: form.id,
        accountId: form.accountId,
        transferAccountId: form.type === "transfer" ? form.transferAccountId : null,
        categoryId: form.type === "transfer" ? null : form.categoryId,
        type: form.type,
        status: form.status,
        description: form.description.trim(),
        amount: Number(String(form.amount).replace(",", ".")),
        date: form.date,
        tags: form.tags,
        notes: form.notes,
        installmentTotal: 1,
        invoiceMonth: null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function setType(type: TransactionFormValue["type"]) {
    setOpenPanel(null);
    setForm((current) => ({
      ...current,
      type,
      categoryId: type === "transfer" ? null : firstCategory(categories, type === "income" ? "income" : "expense"),
      transferAccountId: type === "transfer" ? accounts.find((item) => item.id !== current.accountId)?.id || null : null,
    }));
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }} edges={["top", "left", "right", "bottom"]}>
        <View style={[styles.header, { borderBottomColor: palette.border, backgroundColor: palette.surface }]}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.headerButton}>
            <Ionicons name="close" size={22} color={palette.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: palette.text, fontSize: 20, fontWeight: "900", textAlign: "center" }}>
              {form.id ? "Editar lancamento" : "Novo lancamento"}
            </Text>
          </View>
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 18, paddingBottom: 140, gap: 16 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Chip label="Despesa" active={form.type === "expense"} onPress={() => setType("expense")} />
            <Chip label="Receita" active={form.type === "income"} onPress={() => setType("income")} />
            <Chip label="Transferencia" active={form.type === "transfer"} onPress={() => setType("transfer")} />
          </View>

          <LabeledField
            label="Descricao"
            value={form.description}
            onChangeText={(description) => setForm((current) => ({ ...current, description }))}
            placeholder="Ex.: Mercado, aluguel, salario..."
          />

          <LabeledField
            label="Valor"
            value={form.amount}
            onChangeText={(amount) => setForm((current) => ({ ...current, amount }))}
            keyboardType="numeric"
            placeholder="0,00"
          />

          <ExpandableSelector
            label="Data"
            value={formatDate(form.date)}
            icon="calendar-outline"
            open={openPanel === "date"}
            onPress={() => togglePanel("date")}
          >
            <View style={styles.pickerPanel}>
              <DateTimePicker
                value={draftDate}
                mode="date"
                display="spinner"
                onChange={(_event, value) => {
                  if (!value) return;
                  setDraftDate(value);
                  setForm((current) => ({ ...current, date: value.toISOString().slice(0, 10) }));
                }}
              />
              <Text style={{ color: palette.muted, fontSize: 13 }}>A data muda na hora. Toque no titulo para recolher.</Text>
            </View>
          </ExpandableSelector>

          <ExpandableSelector
            label={form.type === "transfer" ? "Conta de origem" : "Conta"}
            value={account?.name || "Selecione a conta"}
            icon="wallet-outline"
            open={openPanel === "account"}
            onPress={() => togglePanel("account")}
          >
            <View style={{ gap: 10 }}>
              {accounts.map((item) => (
                <OptionRow
                  key={item.id}
                  label={item.name}
                  meta={accountTypeLabel(item.type)}
                  selected={item.id === form.accountId}
                  onPress={() => {
                    const nextTransfer = item.id === form.transferAccountId ? accounts.find((entry) => entry.id !== item.id)?.id || null : form.transferAccountId;
                    setForm((current) => ({ ...current, accountId: item.id, transferAccountId: nextTransfer }));
                    setOpenPanel(null);
                  }}
                />
              ))}
            </View>
          </ExpandableSelector>

          {form.type !== "transfer" ? (
            <ExpandableSelector
              label="Categoria"
              value={category?.name || "Selecione a categoria"}
              icon="pricetag-outline"
              open={openPanel === "category"}
              onPress={() => togglePanel("category")}
            >
              <View style={{ gap: 10 }}>
                {availableCategories.map((item) => (
                  <OptionRow
                    key={item.id}
                    label={item.name}
                    selected={item.id === form.categoryId}
                    color={item.color}
                    onPress={() => {
                      setForm((current) => ({ ...current, categoryId: item.id }));
                      setOpenPanel(null);
                    }}
                  />
                ))}
              </View>
            </ExpandableSelector>
          ) : (
            <ExpandableSelector
              label="Conta destino"
              value={transferAccount?.name || "Selecione a conta destino"}
              icon="swap-horizontal-outline"
              open={openPanel === "transfer"}
              onPress={() => togglePanel("transfer")}
            >
              <View style={{ gap: 10 }}>
                {transferOptions.map((item) => (
                  <OptionRow
                    key={item.id}
                    label={item.name}
                    meta={accountTypeLabel(item.type)}
                    selected={item.id === form.transferAccountId}
                    onPress={() => {
                      setForm((current) => ({ ...current, transferAccountId: item.id }));
                      setOpenPanel(null);
                    }}
                  />
                ))}
              </View>
            </ExpandableSelector>
          )}

          <View style={{ gap: 8 }}>
            <Text style={{ color: palette.muted, fontWeight: "700" }}>Status</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <StatusOption label="Pago" icon="checkmark-circle-outline" active={form.status === "paid"} onPress={() => setForm((current) => ({ ...current, status: "paid" }))} />
              <StatusOption label="Pendente" icon="time-outline" active={form.status === "pending"} onPress={() => setForm((current) => ({ ...current, status: "pending" }))} />
            </View>
          </View>

          <LabeledField label="Tags" value={form.tags} onChangeText={(tags) => setForm((current) => ({ ...current, tags }))} placeholder="casa, mercado, lazer" />
          <LabeledField label="Observacoes" value={form.notes} onChangeText={(notes) => setForm((current) => ({ ...current, notes }))} multiline placeholder="Observacoes do lancamento" />
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: palette.surface, borderTopColor: palette.border }]}>
          <PrimaryButton label={saving ? "Salvando..." : form.id ? "Salvar alteracoes" : "Criar lancamento"} onPress={save} icon="save-outline" disabled={saving || !canSave} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function ExpandableSelector({
  label,
  value,
  icon,
  open,
  onPress,
  children,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  open: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const palette = usePalette();

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: palette.muted, fontWeight: "700" }}>{label}</Text>
      <View style={[styles.expanderCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Pressable onPress={onPress} hitSlop={10} style={({ pressed }) => [styles.expanderHeader, { opacity: pressed ? 0.9 : 1 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
            <View style={[styles.iconBox, { backgroundColor: palette.primarySoft }]}>
              <Ionicons name={icon} size={18} color={palette.primary} />
            </View>
            <Text style={{ color: palette.text, fontSize: 16, fontWeight: "700", flex: 1 }}>{value}</Text>
          </View>
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={palette.text} />
        </Pressable>
        {open && <View style={styles.expanderBody}>{children}</View>}
      </View>
    </View>
  );
}

function OptionRow({
  label,
  meta,
  color,
  selected,
  onPress,
}: {
  label: string;
  meta?: string;
  color?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.optionRow,
        {
          backgroundColor: selected ? palette.primarySoft : palette.surfaceSoft,
          borderColor: selected ? palette.primary : palette.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
        {!!color && <View style={{ width: 12, height: 12, borderRadius: 999, backgroundColor: color }} />}
        <View style={{ flex: 1 }}>
          <Text style={{ color: palette.text, fontWeight: "800" }}>{label}</Text>
          {!!meta && <Text style={{ color: palette.muted, marginTop: 4, fontSize: 12 }}>{meta}</Text>}
        </View>
      </View>
      {selected && <Ionicons name="checkmark-circle" size={20} color={palette.primary} />}
    </Pressable>
  );
}

function StatusOption({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  const palette = usePalette();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [
        styles.statusOption,
        {
          backgroundColor: active ? palette.primarySoft : palette.surface,
          borderColor: active ? palette.primary : palette.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={18} color={active ? palette.primary : palette.muted} />
      <Text style={{ color: active ? palette.primary : palette.text, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

function blankForm(accounts: Account[], categories: Category[]): TransactionFormValue {
  return {
    description: "",
    amount: "",
    date: today(),
    type: "expense",
    status: "paid",
    accountId: accounts[0]?.id || "",
    transferAccountId: accounts[1]?.id || null,
    categoryId: firstCategory(categories, "expense"),
    tags: "",
    notes: "",
  };
}

function firstCategory(categories: Category[], type: "income" | "expense") {
  return categories.find((item) => item.type === type)?.id || null;
}

const styles = StyleSheet.create({
  header: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    paddingHorizontal: 12,
  },
  headerButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  expanderCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  expanderHeader: {
    minHeight: 62,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  expanderBody: {
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128,128,128,0.25)",
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  optionRow: {
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pickerPanel: {
    alignItems: "center",
    gap: 10,
  },
  statusOption: {
    minHeight: 56,
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
  },
});
