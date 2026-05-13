import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { apiRequest } from "../lib/api";
import { useSession } from "../lib/session";
import { currentMonth, formatCompactMoney, formatDate, formatMoney, signedAmount } from "../lib/utils";
import type { DashboardResponse, NotificationItem, Transaction } from "../types/api";
import { usePalette } from "../theme";
import { EmptyState, GhostButton, MetricCard, MonthSwitcher, ProgressLine, Screen, SectionTitle, SurfaceCard } from "../components/ui";

export function DashboardScreen() {
  const palette = usePalette();
  const session = useSession();
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!session.token) return;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const payload = await apiRequest<DashboardResponse>(`/dashboard?month=${month}`, { token: session.token });
      setData(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel carregar o resumo.");
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

  return (
    <Screen
      title={`Ola, ${session.user?.name?.split(" ")[0] || "voce"}`}
      subtitle="Seu Finora nativo, sincronizado com o mesmo backend do web."
      action={<GhostButton label={refreshing ? "Atualizando" : "Atualizar"} onPress={() => load(true)} icon="sync-outline" />}
    >
      <MonthSwitcher month={month} currency={session.user?.currency || "BRL"} onChange={setMonth} />

      {loading ? (
        <View style={{ paddingVertical: 64, alignItems: "center", gap: 14 }}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={{ color: palette.muted }}>Carregando seus numeros...</Text>
        </View>
      ) : error ? (
        <EmptyState title="Nao deu para carregar o resumo" body={error} />
      ) : data ? (
        <>
          <SurfaceCard style={{ padding: 20 }}>
            <Text style={{ color: palette.muted, fontWeight: "700" }}>Saude financeira</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 12 }}>
              <View>
                <Text style={{ color: palette.text, fontSize: 40, fontWeight: "900" }}>{data.health?.score ?? 0}</Text>
                <Text style={{ color: palette.primary, fontWeight: "800", marginTop: 6 }}>{data.health?.label || "Em acompanhamento"}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: palette.muted, fontSize: 13 }}>Taxa de poupanca</Text>
                <Text style={{ color: palette.text, fontSize: 22, fontWeight: "800", marginTop: 6 }}>{data.metrics.savingsRate}%</Text>
              </View>
            </View>
            <ProgressLine value={data.health?.score ?? 0} total={100} color={palette.primary} />
          </SurfaceCard>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <MetricCard title="Saldo total" value={formatMoney(data.metrics.balance, session.user?.currency)} hint="Posicao consolidada" />
            <MetricCard title="Previsto" value={formatMoney(data.metrics.forecast, session.user?.currency)} tone="good" hint="Com recorrencias" />
          </View>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <MetricCard title="Entradas" value={formatMoney(data.metrics.income, session.user?.currency)} tone="good" />
            <MetricCard title="Saidas" value={formatMoney(data.metrics.expense, session.user?.currency)} tone="bad" />
          </View>

          <SectionTitle title="Contas" />
          {data.accounts.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {data.accounts.map((account) => (
                <SurfaceCard key={account.id} style={{ width: 220, padding: 18 }}>
                  <View style={{ width: 38, height: 6, borderRadius: 999, backgroundColor: account.color }} />
                  <Text style={{ color: palette.text, fontSize: 17, fontWeight: "800", marginTop: 16 }}>{account.name}</Text>
                  <Text style={{ color: palette.muted, marginTop: 4 }}>{labelAccountType(account.type)}</Text>
                  <Text style={{ color: (account.balance || 0) >= 0 ? palette.text : palette.bad, fontSize: 24, fontWeight: "900", marginTop: 18 }}>
                    {formatMoney(account.balance || 0, session.user?.currency)}
                  </Text>
                  {account.type === "credit" && (
                    <Text style={{ color: palette.muted, marginTop: 10, fontSize: 13 }}>
                      Limite {formatCompactMoney(account.creditLimit || 0, session.user?.currency)}
                    </Text>
                  )}
                </SurfaceCard>
              ))}
            </ScrollView>
          ) : (
            <EmptyState title="Nenhuma conta criada ainda" body="Crie sua primeira conta na aba Contas." />
          )}

          <SectionTitle title="Alertas" />
          {data.notifications.length ? (
            <View style={{ gap: 10 }}>
              {data.notifications.map((item) => (
                <NotificationCard key={item.id} item={item} />
              ))}
            </View>
          ) : (
            <EmptyState title="Tudo sob controle" body="Nenhum alerta importante para este mes." />
          )}

          <SectionTitle title="Categorias" />
          {data.categories.length ? (
            <View style={{ gap: 12 }}>
              {data.categories.slice(0, 6).map((item, index) => (
                <SurfaceCard key={`${item.name}-${index}`} style={{ padding: 16 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                      <View style={{ width: 12, height: 12, borderRadius: 999, backgroundColor: item.color }} />
                      <Text style={{ color: palette.text, fontWeight: "700", flex: 1 }}>{item.name}</Text>
                    </View>
                    <Text style={{ color: palette.text, fontWeight: "800" }}>{formatMoney(item.value, session.user?.currency)}</Text>
                  </View>
                  <ProgressLine value={item.value} total={data.categories[0]?.value || item.value} color={item.color} />
                </SurfaceCard>
              ))}
            </View>
          ) : (
            <EmptyState title="Sem despesas categorizadas" body="As categorias vao aparecer assim que voce lancar gastos." />
          )}

          {!!data.cards?.length && (
            <>
              <SectionTitle title="Cartoes" />
              <View style={{ gap: 12 }}>
                {data.cards.map((card) => (
                  <SurfaceCard key={card.id}>
                    <Text style={{ color: palette.text, fontSize: 17, fontWeight: "800" }}>{card.name}</Text>
                    <Text style={{ color: palette.muted, marginTop: 6 }}>Fatura aberta {formatMoney(card.invoice, session.user?.currency)}</Text>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 14 }}>
                      <InfoBlock label="Disponivel" value={formatMoney(card.available, session.user?.currency)} />
                      <InfoBlock label="Fecha" value={card.closingDay ? `Dia ${card.closingDay}` : "-"} />
                      <InfoBlock label="Vence" value={card.dueDay ? `Dia ${card.dueDay}` : "-"} />
                    </View>
                  </SurfaceCard>
                ))}
              </View>
            </>
          )}

          <SectionTitle title="Lancamentos recentes" />
          {data.recent.length ? (
            <View style={{ gap: 10 }}>
              {data.recent.map((transaction) => (
                <RecentTransactionRow key={transaction.id} transaction={transaction} currency={session.user?.currency || "BRL"} />
              ))}
            </View>
          ) : (
            <EmptyState title="Ainda sem lancamentos no periodo" body="Use a aba Lancamentos para registrar movimentacoes." />
          )}
        </>
      ) : null}
    </Screen>
  );
}

function NotificationCard({ item }: { item: NotificationItem }) {
  const palette = usePalette();
  const toneColor = item.tone === "danger" ? palette.bad : item.tone === "warning" ? palette.warning : palette.good;

  return (
    <SurfaceCard style={{ borderColor: toneColor }}>
      <Text style={{ color: toneColor, fontWeight: "800" }}>{item.title}</Text>
      <Text style={{ color: palette.muted, marginTop: 6, lineHeight: 20 }}>{item.body}</Text>
    </SurfaceCard>
  );
}

function RecentTransactionRow({ transaction, currency }: { transaction: Transaction; currency: string }) {
  const palette = usePalette();
  const amountColor = transaction.type === "income" ? palette.good : transaction.type === "expense" ? palette.bad : palette.text;

  return (
    <SurfaceCard style={{ padding: 16 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: palette.text, fontWeight: "800" }}>{transaction.description}</Text>
          <Text style={{ color: palette.muted, marginTop: 6, fontSize: 13 }}>
            {formatDate(transaction.date)} · {transaction.account?.name || "Conta"} · {transaction.category?.name || labelTransactionType(transaction.type)}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: amountColor, fontWeight: "900", fontSize: 16 }}>{signedAmount(transaction, currency)}</Text>
          <Text style={{ color: palette.muted, marginTop: 6, fontSize: 12 }}>{transaction.status === "paid" ? "Pago" : "Pendente"}</Text>
        </View>
      </View>
    </SurfaceCard>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  const palette = usePalette();
  return (
    <View>
      <Text style={{ color: palette.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: palette.text, marginTop: 6, fontWeight: "800" }}>{value}</Text>
    </View>
  );
}

function labelAccountType(type: string) {
  return {
    checking: "Conta corrente",
    savings: "Poupanca",
    cash: "Dinheiro",
    credit: "Cartao de credito",
    investment: "Investimento",
  }[type] || type;
}

function labelTransactionType(type: string) {
  return {
    income: "Receita",
    expense: "Despesa",
    transfer: "Transferencia",
  }[type] || type;
}
