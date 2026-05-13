import React, { useEffect, useMemo, useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Modal, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePalette } from "../theme";
import type { Account, Category, Transaction } from "../types/api";
import { formatDate, today } from "../lib/utils";
import { Chip, LabeledField, PrimaryButton, SelectorModal } from "./ui";

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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [draftDate, setDraftDate] = useState(new Date());
  const [accountPicker, setAccountPicker] = useState(false);
  const [categoryPicker, setCategoryPicker] = useState(false);
  const [transferPicker, setTransferPicker] = useState(false);

  const account = accounts.find((item) => item.id === form.accountId);
  const transferAccount = accounts.find((item) => item.id === form.transferAccountId);
  const availableCategories = categories.filter((item) => item.type === (form.type === "income" ? "income" : "expense"));
  const category = availableCategories.find((item) => item.id === form.categoryId);

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
      return;
    }
    const next = blankForm(accounts, categories);
    setForm(next);
    setDraftDate(new Date(`${next.date}T12:00:00`));
  }, [visible, transaction, accounts, categories]);

  const accountOptions = useMemo(
    () => accounts.map((item) => ({ value: item.id, label: item.name, meta: accountMeta(item) })),
    [accounts]
  );

  const categoryOptions = useMemo(
    () => availableCategories.map((item) => ({ value: item.id, label: item.name })),
    [availableCategories]
  );

  const canSave = Boolean(
    form.description.trim() &&
    form.amount &&
    form.accountId &&
    (form.type === "transfer" ? form.transferAccountId : form.categoryId || availableCategories.length === 0)
  );

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

  function openDatePicker() {
    setDraftDate(new Date(`${form.date}T12:00:00`));
    setShowDatePicker(true);
  }

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={[styles.layer, { backgroundColor: "rgba(0,0,0,0.45)" }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={[styles.sheet, { backgroundColor: palette.surface }]}>
              <View style={styles.header}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.text, fontSize: 24, fontWeight: "900" }}>{form.id ? "Editar lancamento" : "Novo lancamento"}</Text>
                  <Text style={{ color: palette.muted, marginTop: 6 }}>Agora com fluxo de toque mais nativo e direto no iPhone.</Text>
                </View>
                <Pressable onPress={onClose} hitSlop={12}>
                  <Ionicons name="close" size={24} color={palette.text} />
                </Pressable>
              </View>

              <ScrollView
                contentContainerStyle={{ gap: 16, paddingBottom: 22 }}
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
              >
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  <Chip label="Despesa" active={form.type === "expense"} onPress={() => setForm((current) => ({ ...current, type: "expense", categoryId: firstCategory(categories, "expense"), transferAccountId: null }))} />
                  <Chip label="Receita" active={form.type === "income"} onPress={() => setForm((current) => ({ ...current, type: "income", categoryId: firstCategory(categories, "income"), transferAccountId: null }))} />
                  <Chip label="Transferencia" active={form.type === "transfer"} onPress={() => setForm((current) => ({ ...current, type: "transfer", categoryId: null, transferAccountId: accounts.find((item) => item.id !== current.accountId)?.id || null }))} />
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

                <SelectRow
                  label="Data"
                  value={formatDate(form.date)}
                  icon="calendar-outline"
                  onPress={openDatePicker}
                />

                <SelectRow
                  label={form.type === "transfer" ? "Conta de origem" : "Conta"}
                  value={account?.name || "Selecione a conta"}
                  icon="wallet-outline"
                  onPress={() => setAccountPicker(true)}
                />

                {form.type !== "transfer" ? (
                  <SelectRow
                    label="Categoria"
                    value={category?.name || "Selecione a categoria"}
                    icon="pricetag-outline"
                    onPress={() => setCategoryPicker(true)}
                  />
                ) : (
                  <SelectRow
                    label="Conta destino"
                    value={transferAccount?.name || "Selecione a conta destino"}
                    icon="swap-horizontal-outline"
                    onPress={() => setTransferPicker(true)}
                  />
                )}

                <View style={{ gap: 8 }}>
                  <Text style={{ color: palette.muted, fontWeight: "700" }}>Status</Text>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <StatusOption
                      label="Pago"
                      active={form.status === "paid"}
                      icon="checkmark-circle-outline"
                      onPress={() => setForm((current) => ({ ...current, status: "paid" }))}
                    />
                    <StatusOption
                      label="Pendente"
                      active={form.status === "pending"}
                      icon="time-outline"
                      onPress={() => setForm((current) => ({ ...current, status: "pending" }))}
                    />
                  </View>
                </View>

                <LabeledField label="Tags" value={form.tags} onChangeText={(tags) => setForm((current) => ({ ...current, tags }))} placeholder="casa, mercado, lazer" />
                <LabeledField label="Observacoes" value={form.notes} onChangeText={(notes) => setForm((current) => ({ ...current, notes }))} multiline placeholder="Observacoes do lancamento" />

                <PrimaryButton
                  label={saving ? "Salvando..." : form.id ? "Salvar alteracoes" : "Criar lancamento"}
                  onPress={save}
                  icon="save-outline"
                  disabled={saving || !canSave}
                />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <DatePickerSheet
        visible={showDatePicker}
        value={draftDate}
        onChange={setDraftDate}
        onCancel={() => setShowDatePicker(false)}
        onConfirm={() => {
          setForm((current) => ({ ...current, date: draftDate.toISOString().slice(0, 10) }));
          setShowDatePicker(false);
        }}
      />

      <SelectorModal
        visible={accountPicker}
        title="Escolha a conta"
        options={accountOptions}
        selectedValue={form.accountId}
        onSelect={(value) => {
          const nextTransfer = value === form.transferAccountId ? accounts.find((item) => item.id !== value)?.id || null : form.transferAccountId;
          setForm((current) => ({ ...current, accountId: value, transferAccountId: nextTransfer }));
        }}
        onClose={() => setAccountPicker(false)}
      />

      <SelectorModal
        visible={categoryPicker}
        title="Escolha a categoria"
        options={categoryOptions}
        selectedValue={form.categoryId}
        onSelect={(value) => setForm((current) => ({ ...current, categoryId: value }))}
        onClose={() => setCategoryPicker(false)}
      />

      <SelectorModal
        visible={transferPicker}
        title="Conta destino"
        options={accountOptions.filter((item) => item.value !== form.accountId)}
        selectedValue={form.transferAccountId}
        onSelect={(value) => setForm((current) => ({ ...current, transferAccountId: value }))}
        onClose={() => setTransferPicker(false)}
      />
    </>
  );
}

function SelectRow({
  label,
  value,
  icon,
  onPress,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  const palette = usePalette();

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: palette.muted, fontWeight: "700" }}>{label}</Text>
      <Pressable
        onPress={onPress}
        hitSlop={10}
        style={({ pressed }) => [
          styles.selector,
          {
            backgroundColor: palette.surfaceStrong,
            borderColor: palette.border,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
          <View style={[styles.selectorIcon, { backgroundColor: palette.primarySoft }]}>
            <Ionicons name={icon} size={18} color={palette.primary} />
          </View>
          <Text style={{ color: palette.text, fontSize: 16, fontWeight: "700", flex: 1 }}>{value}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={palette.text} />
      </Pressable>
    </View>
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
          backgroundColor: active ? palette.primarySoft : palette.surfaceStrong,
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

function DatePickerSheet({
  visible,
  value,
  onChange,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  value: Date;
  onChange: (value: Date) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const palette = usePalette();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={[styles.layer, { backgroundColor: "rgba(0,0,0,0.45)" }]}>
        <Pressable style={{ flex: 1 }} onPress={onCancel} />
        <View style={[styles.sheet, { backgroundColor: palette.surface, maxHeight: 360 }]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: palette.text, fontSize: 22, fontWeight: "900" }}>Escolha a data</Text>
              <Text style={{ color: palette.muted, marginTop: 6 }}>Confirme antes de voltar para o lancamento.</Text>
            </View>
            <Pressable onPress={onCancel} hitSlop={12}>
              <Ionicons name="close" size={24} color={palette.text} />
            </Pressable>
          </View>

          <View style={{ alignItems: "center", marginTop: 8 }}>
            <DateTimePicker
              value={value}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(_event, nextValue) => {
                if (nextValue) onChange(nextValue);
              }}
            />
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
            <View style={{ flex: 1 }}>
              <Pressable
                onPress={onCancel}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { backgroundColor: palette.surfaceSoft, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <Text style={{ color: palette.text, fontWeight: "800" }}>Cancelar</Text>
              </Pressable>
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Confirmar" onPress={onConfirm} icon="checkmark-outline" />
            </View>
          </View>
        </View>
      </View>
    </Modal>
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

function accountMeta(item: Account) {
  if (item.type === "credit") return "Cartao";
  if (item.type === "checking") return "Conta corrente";
  if (item.type === "savings") return "Poupanca";
  if (item.type === "investment") return "Investimento";
  return "Dinheiro";
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
    alignItems: "flex-start",
  },
  selector: {
    minHeight: 62,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  selectorIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
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
  secondaryButton: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
});
