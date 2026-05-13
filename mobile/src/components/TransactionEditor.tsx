import React, { useEffect, useMemo, useState } from "react";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePalette } from "../theme";
import type { Account, Category, Transaction } from "../types/api";
import { today } from "../lib/utils";
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
  const [showDate, setShowDate] = useState(false);
  const [accountPicker, setAccountPicker] = useState(false);
  const [categoryPicker, setCategoryPicker] = useState(false);
  const [transferPicker, setTransferPicker] = useState(false);

  const account = accounts.find((item) => item.id === form.accountId);
  const transferAccount = accounts.find((item) => item.id === form.transferAccountId);
  const availableCategories = categories.filter((item) => item.type === (form.type === "income" ? "income" : "expense"));
  const category = availableCategories.find((item) => item.id === form.categoryId);

  useEffect(() => {
    if (visible) {
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
      } else {
        setForm(blankForm(accounts, categories));
      }
    }
  }, [visible, transaction, accounts, categories]);

  const accountOptions = useMemo(
    () => accounts.map((item) => ({ value: item.id, label: item.name, meta: item.type })),
    [accounts]
  );

  const categoryOptions = useMemo(
    () => availableCategories.map((item) => ({ value: item.id, label: item.name })),
    [availableCategories]
  );

  async function save() {
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
        amount: Number(form.amount || 0),
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

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={[styles.layer, { backgroundColor: "rgba(0,0,0,0.42)" }]}>
          <View style={[styles.sheet, { backgroundColor: palette.surface }]}>
            <View style={styles.header}>
              <View>
                <Text style={{ color: palette.text, fontSize: 22, fontWeight: "800" }}>{form.id ? "Editar lancamento" : "Novo lancamento"}</Text>
                <Text style={{ color: palette.muted, marginTop: 6 }}>Versao mobile nativa do Finora</Text>
              </View>
              <Pressable onPress={onClose}>
                <Ionicons name="close" size={24} color={palette.text} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 20 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Chip label="Despesa" active={form.type === "expense"} onPress={() => setForm((current) => ({ ...current, type: "expense", categoryId: firstCategory(categories, "expense"), transferAccountId: null }))} />
                <Chip label="Receita" active={form.type === "income"} onPress={() => setForm((current) => ({ ...current, type: "income", categoryId: firstCategory(categories, "income"), transferAccountId: null }))} />
                <Chip label="Transferencia" active={form.type === "transfer"} onPress={() => setForm((current) => ({ ...current, type: "transfer", categoryId: null }))} />
              </View>

              <LabeledField label="Descricao" value={form.description} onChangeText={(description) => setForm((current) => ({ ...current, description }))} placeholder="Ex.: Mercado, aluguel, salario..." />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <LabeledField label="Valor" value={form.amount} onChangeText={(amount) => setForm((current) => ({ ...current, amount }))} keyboardType="numeric" placeholder="0,00" />
                </View>
                <View style={{ flex: 1, gap: 8 }}>
                  <Text style={{ color: palette.muted, fontWeight: "700" }}>Data</Text>
                  <Pressable
                    onPress={() => setShowDate(true)}
                    style={[styles.selector, { backgroundColor: palette.surfaceStrong, borderColor: palette.border }]}
                  >
                    <Text style={{ color: palette.text, fontSize: 16 }}>{form.date}</Text>
                    <Ionicons name="calendar-outline" size={18} color={palette.text} />
                  </Pressable>
                </View>
              </View>

              <View style={{ gap: 8 }}>
                <Text style={{ color: palette.muted, fontWeight: "700" }}>Conta</Text>
                <Pressable onPress={() => setAccountPicker(true)} style={[styles.selector, { backgroundColor: palette.surfaceStrong, borderColor: palette.border }]}>
                  <Text style={{ color: palette.text, fontSize: 16 }}>{account?.name || "Selecione"}</Text>
                  <Ionicons name="chevron-forward" size={18} color={palette.text} />
                </Pressable>
              </View>

              {form.type !== "transfer" ? (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: palette.muted, fontWeight: "700" }}>Categoria</Text>
                  <Pressable onPress={() => setCategoryPicker(true)} style={[styles.selector, { backgroundColor: palette.surfaceStrong, borderColor: palette.border }]}>
                    <Text style={{ color: palette.text, fontSize: 16 }}>{category?.name || "Selecione"}</Text>
                    <Ionicons name="chevron-forward" size={18} color={palette.text} />
                  </Pressable>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: palette.muted, fontWeight: "700" }}>Conta destino</Text>
                  <Pressable onPress={() => setTransferPicker(true)} style={[styles.selector, { backgroundColor: palette.surfaceStrong, borderColor: palette.border }]}>
                    <Text style={{ color: palette.text, fontSize: 16 }}>{transferAccount?.name || "Selecione"}</Text>
                    <Ionicons name="chevron-forward" size={18} color={palette.text} />
                  </Pressable>
                </View>
              )}

              <View style={[styles.statusRow, { backgroundColor: palette.surfaceStrong, borderColor: palette.border }]}>
                <Text style={{ color: palette.text, fontSize: 15, fontWeight: "700" }}>Pago</Text>
                <Switch
                  value={form.status === "paid"}
                  onValueChange={(next) => setForm((current) => ({ ...current, status: next ? "paid" : "pending" }))}
                  trackColor={{ false: palette.border, true: palette.primary }}
                  thumbColor="#ffffff"
                />
              </View>

              <LabeledField label="Tags" value={form.tags} onChangeText={(tags) => setForm((current) => ({ ...current, tags }))} placeholder="casa, mercado, lazer" />
              <LabeledField label="Observacoes" value={form.notes} onChangeText={(notes) => setForm((current) => ({ ...current, notes }))} multiline placeholder="Algo importante sobre esse lancamento" />

              <PrimaryButton label={saving ? "Salvando..." : "Salvar lancamento"} onPress={save} icon="save-outline" disabled={saving || !form.description.trim() || !form.amount || !form.accountId} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {showDate && (
        <DateTimePicker
          value={new Date(`${form.date}T00:00:00`)}
          mode="date"
          display="default"
          onChange={(_event, date) => {
            setShowDate(false);
            if (date) {
              setForm((current) => ({ ...current, date: date.toISOString().slice(0, 10) }));
            }
          }}
        />
      )}

      <SelectorModal visible={accountPicker} title="Escolha a conta" options={accountOptions} selectedValue={form.accountId} onSelect={(value) => setForm((current) => ({ ...current, accountId: value }))} onClose={() => setAccountPicker(false)} />
      <SelectorModal visible={categoryPicker} title="Escolha a categoria" options={categoryOptions} selectedValue={form.categoryId} onSelect={(value) => setForm((current) => ({ ...current, categoryId: value }))} onClose={() => setCategoryPicker(false)} />
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
  selector: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusRow: {
    minHeight: 60,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
