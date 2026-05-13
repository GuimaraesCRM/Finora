import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { AccountEditor } from "../components/AccountEditor";
import { EmptyState, GhostButton, MetricCard, Screen, SurfaceCard } from "../components/ui";
import { apiRequest } from "../lib/api";
import { useSession } from "../lib/session";
import { accountTypeLabel, formatMoney } from "../lib/utils";
import { usePalette } from "../theme";
import type { Account, NetWorthResponse } from "../types/api";

export function AccountsScreen() {
  const palette = usePalette();
  const session = useSession();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [netWorth, setNetWorth] = useState<NetWorthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [selected, setSelected] = useState<Account | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!session.token) return;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const [accountPayload, netWorthPayload] = await Promise.all([
        apiRequest<{ accounts: Account[] }>("/accounts", { token: session.token }),
        apiRequest<NetWorthResponse>("/net-worth", { token: session.token }),
      ]);
      setAccounts(accountPayload.accounts);
      setNetWorth(netWorthPayload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel carregar as contas.");
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [session.token]);

  useEffect(() => {
    load();
  }, [load, session.refreshTick]);

  useFocusEffect(
    useCallback(() => {
      if (!loading) load(true);
    }, [load, loading])
  );

  async function saveAccount(payload: {
    id?: string;
    name: string;
    type: Account["type"];
    initialBalance: number;
    creditLimit: number;
    closingDay: number | null;
    dueDay: number | null;
    color: string;
    shared: boolean;
  }) {
    if (!session.token) return;
    if (payload.id) {
      await apiRequest(`/accounts/${payload.id}`, {
        method: "PUT",
        token: session.token,
        body: payload,
      });
    } else {
      await apiRequest("/accounts", {
        method: "POST",
        token: session.token,
        body: payload,
      });
    }
    await load(true);
    session.bumpRefresh();
  }

  function removeAccount(account: Account) {
    Alert.alert("Excluir conta", `Deseja remover "${account.name}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            await apiRequest(`/accounts/${account.id}`, { method: "DELETE", token: session.token });
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
        title="Contas"
        subtitle="Estrutura financeira nativa do app, ligada ao mesmo cadastro do Finora."
        action={<GhostButton label="Nova" onPress={() => { setSelected(null); setEditorOpen(true); }} icon="add-outline" />}
      >
        {loading ? (
          <View style={{ paddingVertical: 64, alignItems: "center", gap: 14 }}>
            <ActivityIndicator size="large" color={palette.primary} />
            <Text style={{ color: palette.muted }}>Carregando contas...</Text>
          </View>
        ) : error ? (
          <EmptyState title="Falha ao carregar" body={error} />
        ) : (
          <>
            {netWorth && (
              <>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <MetricCard title="Patrimonio" value={formatMoney(netWorth.netWorth, session.user?.currency)} />
                  <MetricCard title="Ativos" value={formatMoney(netWorth.asset, session.user?.currency)} tone="good" />
                </View>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <MetricCard title="Dividas" value={formatMoney(netWorth.debt, session.user?.currency)} tone="bad" />
                  <MetricCard title="Contas" value={String(accounts.length)} hint="Cadastradas" />
                </View>
              </>
            )}

            {accounts.length ? (
              <View style={{ gap: 12 }}>
                {accounts.map((account) => (
                  <SurfaceCard key={account.id} style={{ padding: 18 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <View style={{ width: 14, height: 14, borderRadius: 999, backgroundColor: account.color }} />
                          <Text style={{ color: palette.text, fontWeight: "800", fontSize: 18, flexShrink: 1 }}>{account.name}</Text>
                        </View>
                        <Text style={{ color: palette.muted, marginTop: 8 }}>{accountTypeLabel(account.type)}</Text>
                        <Text style={{ color: (account.balance || 0) >= 0 ? palette.text : palette.bad, fontSize: 26, fontWeight: "900", marginTop: 16 }}>
                          {formatMoney(account.balance || 0, session.user?.currency)}
                        </Text>
                      </View>

                      <View style={{ alignItems: "flex-end", gap: 10 }}>
                        <MiniAction icon="create-outline" onPress={() => { setSelected(account); setEditorOpen(true); }} />
                        <MiniAction icon="trash-outline" onPress={() => removeAccount(account)} tone="bad" />
                      </View>
                    </View>

                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
                      {account.shared && <Pill label="Compartilhada" color={palette.primary} />}
                      {account.type === "credit" && <Pill label={`Limite ${formatMoney(account.creditLimit || 0, session.user?.currency)}`} color={palette.warning} />}
                      {account.type === "credit" && account.closingDay && <Pill label={`Fecha dia ${account.closingDay}`} color={palette.muted} />}
                      {account.type === "credit" && account.dueDay && <Pill label={`Vence dia ${account.dueDay}`} color={palette.muted} />}
                    </View>
                  </SurfaceCard>
                ))}
              </View>
            ) : (
              <EmptyState title="Nenhuma conta cadastrada" body="Crie sua primeira conta e o app passa a refletir o mesmo saldo do Finora web." />
            )}

            {!loading && !error && (
              <GhostButton label={refreshing ? "Atualizando" : "Atualizar contas"} onPress={() => load(true)} icon="refresh-outline" />
            )}
          </>
        )}
      </Screen>

      <AccountEditor
        visible={editorOpen}
        account={selected}
        onClose={() => {
          setEditorOpen(false);
          setSelected(null);
        }}
        onSubmit={async (payload) => {
          try {
            await saveAccount(payload);
          } catch (caught) {
            Alert.alert("Nao foi possivel salvar", caught instanceof Error ? caught.message : "Tente novamente.");
          }
        }}
      />
    </>
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: `${color}22` }}>
      <Text style={{ color, fontSize: 12, fontWeight: "800" }}>{label}</Text>
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
