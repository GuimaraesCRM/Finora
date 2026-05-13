export type CurrencyCode = "BRL" | "USD" | "EUR" | string;

export interface User {
  id: string;
  name: string;
  email: string;
  currency: CurrencyCode;
}

export interface Category {
  id: string;
  name: string;
  type: "income" | "expense";
  color: string;
}

export interface Account {
  id: string;
  name: string;
  type: "checking" | "savings" | "cash" | "credit" | "investment";
  initialBalance: number;
  creditLimit: number;
  closingDay: number | null;
  dueDay: number | null;
  color: string;
  shared: boolean;
  balance?: number;
}

export interface Attachment {
  id: string;
  transactionId: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface Transaction {
  id: string;
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
  installmentGroupId?: string | null;
  installmentNumber?: number | null;
  installmentTotal?: number | null;
  invoiceMonth?: string | null;
  account?: Account | null;
  transferAccount?: Account | null;
  category?: Category | null;
  attachments?: Attachment[];
}

export interface NotificationItem {
  id: string;
  type: string;
  tone: "good" | "warning" | "danger" | string;
  title: string;
  body: string;
}

export interface DashboardResponse {
  metrics: {
    balance: number;
    income: number;
    expense: number;
    savingsRate: number;
    forecast: number;
  };
  accounts: Account[];
  cashflow: Array<{ date: string; balance: number }>;
  categories: Array<{ name: string; color: string; value: number }>;
  budgets: Budget[];
  goals: Goal[];
  recurring: Recurring[];
  recent: Transaction[];
  notifications: NotificationItem[];
  health?: { score: number; label: string };
  cards?: Array<{ id: string; name: string; invoice: number; limit: number; available: number; dueDay: number | null; closingDay: number | null }>;
}

export interface Budget {
  id: string;
  categoryId: string;
  month: string;
  limit: number;
  spent: number;
  category?: Category | null;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  saved: number;
  dueDate: string;
  color: string;
}

export interface Recurring {
  id: string;
  accountId: string;
  categoryId: string | null;
  type: "income" | "expense";
  description: string;
  amount: number;
  frequency: "weekly" | "monthly" | "yearly";
  nextDate: string;
  active: boolean;
  account?: Account | null;
  category?: Category | null;
}

export interface NetWorthResponse {
  asset: number;
  debt: number;
  netWorth: number;
  accounts: Array<Account & { balance: number; asset: number; debt: number }>;
}

export interface ReportsResponse {
  trend: Array<{ month: string; income: number; expense: number; balance: number }>;
  comparison: { incomeDelta: number; expenseDelta: number; balanceDelta: number };
  averages: { income: number; expense: number; balance: number };
  topCategories: Array<{ name: string; color: string; value: number }>;
}
