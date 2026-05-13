import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { TransactionEditor } from "../components/TransactionEditor";
import { Chip, EmptyState, GhostButton, LabeledField, MonthSwitcher, Screen, SurfaceCard } from "../components/ui";
import { apiRequest } from "../lib/api";
import { useSession } from "../lib/session";
import { currentMonth, formatDate, signedAmount } from "../lib/utils";
import { usePalette } from "../theme";
import type { Account, Category, Transaction } from "../types/api";

type TransactionFilter = "all" | "income" | "expense" | "transfer";

export function TransactionsScreen() {
  const palette = usePalette();
  const session = useSession();
  const [month, setMonth] = useState(currentMonth());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TransactionFilter>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [selected, setSelected] = useState<Transaction | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!session.token) return;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const [transactionPayload, accountPayload, categoryPayload] = await Promise.all([
        apiRequest<{ transactions: Transaction[] }>(`/transactions?month=${month}`, { token: session.token }),
        apiRequest<{ accounts: Account[] }>("/accounts", { token: session.token }),
        apiRequest<{ categories: Category[] }>("/categories", { token: session.token }),
      ]);
      setTransactions(transactionPayload.transactions);
      setAccounts(accountPayload.accounts);
      setCategories(categoryPayload.categories);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel carregar os lancamentos.");
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [month, session.token]);

  useEffect(() => {
    load();
  }, [load, session.refreshTick]);

  useFocusEffect(
    useCallback(() => {
      if (!loading) load(true);
    }, [load, loading])
  );

  const visibleTransactions = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return transactions.filter((item) => {
      if (filter !== "all" && item.type !== filter) return false;
      if (!normalized) return true;
      const haystack = [
        item.description,
        item.account?.name,
        item.category?.name,
        item.transferAccount?.name,
        item.tags,
        item.notes,
      ].join(" ").toLowerCase();
      return haystack.includes(normalized);
    });
  }, [transactions, filter, search]);

  async function submitTransaction(payload: {
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
  }) {
    if (!session.token) return;
    if (payload.id) {
      await apiRequest(`/transactions/${payload.id}`, {
        method: "PUT",
        token: session.token,
        body: payload,
      });
    } else {
      await apiRequest("/transactions", {
        method: "POST",
        token: session.token,
        body: payload,
      });
    }
    await load(true);
    session.bumpRefresh();
  }

  function createTransaction() {
    setSelected(null);
    setEditorOpen(true);
  }

  function editTransaction(transaction: Transaction) {
    setSelected(transaction);
    setEditorOpen(true);
  }

  function deleteTransaction(transaction: Transaction) {
    Alert.alert("Excluir lancamento", `Deseja remover "${transaction.description}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            await apiRequest(`/transactions/${transaction.id}`, {
              method: "DELETE",
              token: session.token,
            });
            await load(true);
            session.bumpRefresh();
          } catch (caught) {
            Alert.alert("Nao foi possivel excluir", caught instanceof Error ? caught.message : "Tente novamente.");
          }
        },
      },
    ]);
  }

  return (
    <>
      <Screen
        title="Lancamentos"
        subtitle="Fluxo nativo para criar, editar e acompanhar movimentacoes."
        action={<GhostButton label="Novo" onPress={createTransaction} icon="add-outline" />}
      >
        <MonthSwitcher month={month} currency={session.user?.currency || "BRL"} onChange={setMonth} />

        <LabeledField label="Buscar" value={search} onChangeText={setSearch} placeholder="Descricao, conta, categoria ou tag" />

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Chip label="Todos" active={filter === "all"} onPress={() => setFilter("all")} />
          <Chip label="Despesas" active={filter === "expense"} onPress={() => setFilter("expense")} />
          <Chip label="Receitas" active={filter === "income"} onPress={() => setFilter("income")} />
          <Chip label="Transferencias" active={filter === "transfer"} onPress={() => setFilter("transfer")} />
        </View>

        {loading ? (
          <View style={{ paddingVertical: 64, alignItems: "center", gap: 14 }}>
            <ActivityIndicator size="large" color={palette.primary} />
            <Text style={{ color: palette.muted }}>Carregando lancamentos...</Text>
          </View>
        ) : error ? (
          <EmptyState title="Falha ao carregar" body={error} />
        ) : visibleTransactions.length ? (
          <View style={{ gap: 10 }}>
            {visibleTransactions.map((transaction) => (
              <SurfaceCard key={transaction.id} style={{ padding: 16 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Text style={{ color: palette.text, fontWeight: "800", fontSize: 16, flexShrink: 1 }}>{transaction.description}</Text>
                      <TagBadge label={transaction.status === "paid" ? "Pago" : "Pendente"} tone={transaction.status === "paid" ? "good" : "warning"} />
                    </View>
                    <Text style={{ color: palette.muted, marginTop: 8, fontSize: 13 }}>
                      {formatDate(transaction.date)} · {transaction.account?.name || "Conta"} · {detailLabel(transaction)}
                    </Text>
                    {!!transaction.tags && <Text style={{ color: palette.muted, marginTop: 6, fontSize: 12 }}>#{transaction.tags.replaceAll(",", " #")}</Text>}
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 12 }}>
                    <Text style={{ color: amountColor(transaction.type, palette), fontWeight: "900", fontSize: 16 }}>
                      {signedAmount(transaction, session.user?.currency || "BRL")}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <MiniAction icon="create-outline" onPress={() => editTransaction(transaction)} />
                      <MiniAction icon="trash-outline" onPress={() => deleteTransaction(transaction)} tone="bad" />
                    </View>
                  </View>
                </View>
              </SurfaceCard>
            ))}
          </View>
        ) : (
          <EmptyState title="Nenhum lancamento encontrado" body="Use o botao Novo para registrar uma movimentacao neste mes." />
        )}

        {!loading && !error && (
          <GhostButton label={refreshing ? "Atualizando" : "Atualizar lista"} onPress={() => load(true)} icon="refresh-outline" />
        )}
      </Screen>

      <TransactionEditor
        visible={editorOpen}
        transaction={selected}
        accounts={accounts}
        categories={categories}
        onClose={() => {
          setEditorOpen(false);
          setSelected(null);
        }}
        onSubmit={async (payload) => {
          try {
            await submitTransaction(payload);
          } catch (caught) {
            Alert.alert("Nao foi possivel salvar", caught instanceof Error ? caught.message : "Tente novamente.");
          }
        }}
      />
    </>
  );
}

function TagBadge({ label, tone = "default" }: { label: string; tone?: "default" | "good" | "warning" }) {
  const palette = usePalette();
  const color = tone === "good" ? palette.good : tone === "warning" ? palette.warning : palette.primary;

  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: `${color}20` }}>
      <Text style={{ color, fontSize: 11, fontWeight: "800" }}>{label}</Text>
    </View>
  );
}

function MiniAction({
  icon,
  onPress,
  tone = "default",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  tone?: "default" | "bad";
}) {
  const palette = usePalette();
  const color = tone === "bad" ? palette.bad : palette.text;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: 34,
        height: 34,
        borderRadius: 12,
        backgroundColor: palette.surfaceSoft,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Ionicons name={icon} size={17} color={color} />
    </Pressable>
  );
}

function detailLabel(transaction: Transaction) {
  if (transaction.type === "transfer") {
    return transaction.transferAccount?.name ? `Transferencia para ${transaction.transferAccount.name}` : "Transferencia";
  }
  return transaction.category?.name || (transaction.type === "income" ? "Receita" : "Despesa");
}

function amountColor(type: Transaction["type"], palette: ReturnType<typeof usePalette>) {
  if (type === "income") return palette.good;
  if (type === "expense") return palette.bad;
  return palette.text;
}
