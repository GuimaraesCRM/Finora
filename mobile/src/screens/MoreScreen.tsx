import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { EmptyState, GhostButton, MetricCard, MonthSwitcher, ProgressLine, Screen, SectionTitle, SelectorModal, SurfaceCard } from "../components/ui";
import { apiRequest } from "../lib/api";
import { currentMonth, formatCompactMoney, formatDate, formatMoney, frequencyLabel, metricLabel, monthLabel, percent } from "../lib/utils";
import { useSession } from "../lib/session";
import { usePalette } from "../theme";
import type { Budget, Goal, NetWorthResponse, Recurring, ReportsResponse, User } from "../types/api";

const currencyOptions = [
  { value: "BRL", label: "Real (BRL)" },
  { value: "USD", label: "Dollar (USD)" },
  { value: "EUR", label: "Euro (EUR)" },
];

export function MoreScreen() {
  const palette = usePalette();
  const session = useSession();
  const [month, setMonth] = useState(currentMonth());
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [reports, setReports] = useState<ReportsResponse | null>(null);
  const [netWorth, setNetWorth] = useState<NetWorthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [currencyPicker, setCurrencyPicker] = useState(false);
  const [savingCurrency, setSavingCurrency] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!session.token) return;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const [budgetPayload, goalPayload, recurringPayload, reportPayload, netWorthPayload] = await Promise.all([
        apiRequest<{ budgets: Budget[] }>(`/budgets?month=${month}`, { token: session.token }),
        apiRequest<{ goals: Goal[] }>("/goals", { token: session.token }),
        apiRequest<{ recurring: Recurring[] }>("/recurring", { token: session.token }),
        apiRequest<ReportsResponse>(`/reports?month=${month}`, { token: session.token }),
        apiRequest<NetWorthResponse>("/net-worth", { token: session.token }),
      ]);
      setBudgets(budgetPayload.budgets);
      setGoals(goalPayload.goals);
      setRecurring(recurringPayload.recurring);
      setReports(reportPayload);
      setNetWorth(netWorthPayload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel carregar essa area.");
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

  const trendMax = useMemo(() => {
    if (!reports?.trend.length) return 0;
    return Math.max(...reports.trend.map((item) => Math.max(item.income, item.expense, Math.abs(item.balance))));
  }, [reports]);

  async function updateCurrency(currency: string) {
    if (!session.token || !session.user) return;
    setSavingCurrency(true);
    try {
      const payload = await apiRequest<{ user: User }>("/settings", {
        method: "PUT",
        token: session.token,
        body: { currency },
      });
      session.updateUser(payload.user);
      session.bumpRefresh();
    } catch (caught) {
      Alert.alert("Nao foi possivel atualizar", caught instanceof Error ? caught.message : "Tente novamente.");
    } finally {
      setSavingCurrency(false);
    }
  }

  async function runRecurring(item: Recurring) {
    if (!session.token) return;
    try {
      await apiRequest(`/recurring/${item.id}/run`, { method: "POST", token: session.token });
      await load(true);
      session.bumpRefresh();
    } catch (caught) {
      Alert.alert("Nao foi possivel lancar agora", caught instanceof Error ? caught.message : "Tente novamente.");
    }
  }

  return (
    <>
      <Screen
        title="Mais"
        subtitle="Configuracoes, relatorios e automacoes do app iPhone."
        action={<GhostButton label={refreshing ? "Atualizando" : "Atualizar"} onPress={() => load(true)} icon="refresh-outline" />}
      >
        <MonthSwitcher month={month} currency={session.user?.currency || "BRL"} onChange={setMonth} />

        {loading ? (
          <View style={{ paddingVertical: 64, alignItems: "center", gap: 14 }}>
            <ActivityIndicator size="large" color={palette.primary} />
            <Text style={{ color: palette.muted }}>Montando sua visao completa...</Text>
          </View>
        ) : error ? (
          <EmptyState title="Nao foi possivel carregar" body={error} />
        ) : (
          <>
            <SurfaceCard>
              <Text style={{ color: palette.text, fontSize: 22, fontWeight: "800" }}>{session.user?.name}</Text>
              <Text style={{ color: palette.muted, marginTop: 6 }}>{session.user?.email}</Text>
              <View style={{ flexDirection: "row", gap: 12, marginTop: 18 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.muted, fontSize: 13 }}>Moeda</Text>
                  <Text style={{ color: palette.text, fontWeight: "800", marginTop: 6 }}>{session.user?.currency}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.muted, fontSize: 13 }}>Periodo</Text>
                  <Text style={{ color: palette.text, fontWeight: "800", marginTop: 6, textTransform: "capitalize" }}>{monthLabel(month, session.user?.currency)}</Text>
                </View>
              </View>
              <View style={{ marginTop: 16 }}>
                <GhostButton label={savingCurrency ? "Salvando" : "Trocar moeda"} onPress={() => setCurrencyPicker(true)} icon="cash-outline" />
              </View>
            </SurfaceCard>

            {netWorth && (
              <>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <MetricCard title="Patrimonio" value={formatMoney(netWorth.netWorth, session.user?.currency)} />
                  <MetricCard title="Ativos" value={formatMoney(netWorth.asset, session.user?.currency)} tone="good" />
                </View>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <MetricCard title="Dividas" value={formatMoney(netWorth.debt, session.user?.currency)} tone="bad" />
                  <MetricCard title="Medias" value={reports ? formatCompactMoney(reports.averages.balance, session.user?.currency) : "-"} hint="Saldo medio" />
                </View>
              </>
            )}

            {reports && (
              <>
                <SectionTitle title="Comparativo" />
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <MetricCard title={metricLabel("income", session.user?.currency || "BRL")} value={signedMoney(reports.comparison.incomeDelta, session.user?.currency)} tone={reports.comparison.incomeDelta >= 0 ? "good" : "bad"} />
                  <MetricCard title={metricLabel("expense", session.user?.currency || "BRL")} value={signedMoney(reports.comparison.expenseDelta, session.user?.currency)} tone={reports.comparison.expenseDelta <= 0 ? "good" : "bad"} />
                </View>
                <MetricCard title={metricLabel("balance", session.user?.currency || "BRL")} value={signedMoney(reports.comparison.balanceDelta, session.user?.currency)} tone={reports.comparison.balanceDelta >= 0 ? "good" : "bad"} />

                <SectionTitle title="Tendencia" />
                <View style={{ gap: 10 }}>
                  {reports.trend.map((item) => (
                    <SurfaceCard key={item.month} style={{ padding: 16 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                        <Text style={{ color: palette.text, fontWeight: "800", textTransform: "capitalize" }}>{monthLabel(item.month, session.user?.currency)}</Text>
                        <Text style={{ color: palette.text, fontWeight: "800" }}>{formatMoney(item.balance, session.user?.currency)}</Text>
                      </View>
                      <View style={{ marginTop: 12, gap: 8 }}>
                        <LabelProgress label={metricLabel("income", session.user?.currency || "BRL")} color={palette.good} value={item.income} max={trendMax} currency={session.user?.currency || "BRL"} />
                        <LabelProgress label={metricLabel("expense", session.user?.currency || "BRL")} color={palette.bad} value={item.expense} max={trendMax} currency={session.user?.currency || "BRL"} />
                      </View>
                    </SurfaceCard>
                  ))}
                </View>
              </>
            )}

            <SectionTitle title="Orcamentos" />
            {budgets.length ? (
              <View style={{ gap: 10 }}>
                {budgets.map((budget) => {
                  const ratio = percent(budget.spent, budget.limit);
                  const over = budget.spent > budget.limit;
                  return (
                    <SurfaceCard key={budget.id} style={{ padding: 16 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: palette.text, fontWeight: "800" }}>{budget.category?.name || "Categoria"}</Text>
                          <Text style={{ color: palette.muted, marginTop: 6 }}>
                            {formatMoney(budget.spent, session.user?.currency)} de {formatMoney(budget.limit, session.user?.currency)}
                          </Text>
                        </View>
                        <Text style={{ color: over ? palette.bad : palette.primary, fontWeight: "800" }}>{Math.round(ratio)}%</Text>
                      </View>
                      <ProgressLine value={budget.spent} total={budget.limit} color={over ? palette.bad : palette.primary} />
                    </SurfaceCard>
                  );
                })}
              </View>
            ) : (
              <EmptyState title="Sem orcamentos neste mes" body="Os orcamentos criados no Finora web aparecem aqui automaticamente." />
            )}

            <SectionTitle title="Metas" />
            {goals.length ? (
              <View style={{ gap: 10 }}>
                {goals.map((goal) => (
                  <SurfaceCard key={goal.id} style={{ padding: 16 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: palette.text, fontWeight: "800" }}>{goal.name}</Text>
                        <Text style={{ color: palette.muted, marginTop: 6 }}>Vence em {formatDate(goal.dueDate)}</Text>
                      </View>
                      <Text style={{ color: palette.text, fontWeight: "800" }}>{Math.round(percent(goal.saved, goal.target))}%</Text>
                    </View>
                    <Text style={{ color: palette.muted, marginTop: 10 }}>
                      {formatMoney(goal.saved, session.user?.currency)} de {formatMoney(goal.target, session.user?.currency)}
                    </Text>
                    <ProgressLine value={goal.saved} total={goal.target} color={goal.color || palette.primary} />
                  </SurfaceCard>
                ))}
              </View>
            ) : (
              <EmptyState title="Nenhuma meta por aqui" body="As metas que voce criar no web tambem vao aparecer nesta tela." />
            )}

            <SectionTitle title="Recorrencias" />
            {recurring.length ? (
              <View style={{ gap: 10 }}>
                {recurring.map((item) => (
                  <SurfaceCard key={item.id} style={{ padding: 16 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: palette.text, fontWeight: "800" }}>{item.description}</Text>
                        <Text style={{ color: palette.muted, marginTop: 6 }}>
                          {frequencyLabel(item.frequency)} · {item.account?.name || "Conta"} · {item.category?.name || (item.type === "income" ? "Receita" : "Despesa")}
                        </Text>
                        <Text style={{ color: palette.muted, marginTop: 6 }}>Proxima em {formatDate(item.nextDate)}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 12 }}>
                        <Text style={{ color: item.type === "income" ? palette.good : palette.bad, fontWeight: "900" }}>
                          {item.type === "income" ? "+" : "-"}{formatMoney(item.amount, session.user?.currency)}
                        </Text>
                        <GhostButton label="Lancar agora" onPress={() => runRecurring(item)} icon="flash-outline" />
                      </View>
                    </View>
                  </SurfaceCard>
                ))}
              </View>
            ) : (
              <EmptyState title="Nenhuma recorrencia ativa" body="Recorrencias criadas no Finora web podem ser executadas por aqui tambem." />
            )}

            <GhostButton label="Sair da conta" onPress={() => session.logout()} icon="log-out-outline" />
          </>
        )}
      </Screen>

      <SelectorModal
        visible={currencyPicker}
        title="Escolha a moeda"
        options={currencyOptions}
        selectedValue={session.user?.currency}
        onSelect={(value) => updateCurrency(value)}
        onClose={() => setCurrencyPicker(false)}
      />
    </>
  );
}

function LabelProgress({
  label,
  color,
  value,
  max,
  currency,
}: {
  label: string;
  color: string;
  value: number;
  max: number;
  currency: string;
}) {
  const palette = usePalette();
  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
        <Text style={{ color: palette.muted, fontSize: 13 }}>{label}</Text>
        <Text style={{ color: palette.text, fontSize: 13, fontWeight: "700" }}>{formatMoney(value, currency)}</Text>
      </View>
      <ProgressLine value={value} total={max} color={color} />
    </View>
  );
}

function signedMoney(value: number, currency: string | undefined) {
  const formatted = formatMoney(Math.abs(value), currency);
  return `${value >= 0 ? "+" : "-"}${formatted}`;
}
