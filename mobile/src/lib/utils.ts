import type { CurrencyCode, Transaction } from "../types/api";

export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function shiftMonth(month: string, offset: number) {
  const date = new Date(`${month}-01T00:00:00`);
  date.setMonth(date.getMonth() + offset);
  return date.toISOString().slice(0, 7);
}

export function monthLabel(month: string, currency: CurrencyCode = "BRL") {
  return new Intl.DateTimeFormat(currency === "BRL" ? "pt-BR" : "en-US", { month: "long", year: "numeric" })
    .format(new Date(`${month}-01T00:00:00`));
}

export function formatMoney(value: number, currency: CurrencyCode = "BRL") {
  return new Intl.NumberFormat(currency === "BRL" ? "pt-BR" : "en-US", {
    style: "currency",
    currency,
  }).format(Number(value || 0));
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

export function formatCompactMoney(value: number, currency: CurrencyCode = "BRL") {
  return new Intl.NumberFormat(currency === "BRL" ? "pt-BR" : "en-US", {
    notation: "compact",
    style: "currency",
    currency,
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}

export function signedAmount(item: Transaction, currency: CurrencyCode) {
  if (item.type === "income") return `+${formatMoney(item.amount, currency)}`;
  if (item.type === "transfer") return formatMoney(item.amount, currency);
  return `-${formatMoney(item.amount, currency)}`;
}

export function transactionTypeLabel(type: string) {
  return {
    income: "Receita",
    expense: "Despesa",
    transfer: "Transferencia",
  }[type] || type;
}

export function accountTypeLabel(type: string) {
  return {
    checking: "Conta corrente",
    savings: "Poupanca",
    cash: "Dinheiro",
    credit: "Cartao",
    investment: "Investimento",
  }[type] || type;
}

export function frequencyLabel(type: string) {
  return {
    weekly: "Semanal",
    monthly: "Mensal",
    yearly: "Anual",
  }[type] || type;
}

export function metricLabel(type: "income" | "expense" | "balance", currency: CurrencyCode) {
  const localized = currency === "BRL"
    ? { income: "Entradas", expense: "Saidas", balance: "Saldo" }
    : { income: "Income", expense: "Expense", balance: "Balance" };
  return localized[type];
}

export function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, (value / total) * 100));
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}
