import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  Edit3,
  FileText,
  Flag,
  LayoutDashboard,
  Loader2,
  LogIn,
  LogOut,
  Menu,
  Moon,
  PiggyBank,
  Play,
  Plus,
  Printer,
  ReceiptText,
  RefreshCw,
  Save,
  Settings,
  Sun,
  Target,
  Trash2,
  Upload,
  UserPlus,
  Wallet,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiRequest, apiUrl, nativeApp } from "./api.js";
import "./styles.css";

const navItems = [
  { id: "dashboard", label: "Resumo", icon: LayoutDashboard },
  { id: "transactions", label: "Lançamentos", icon: ReceiptText },
  { id: "accounts", label: "Contas", icon: Wallet },
  { id: "budgets", label: "Orçamentos", icon: Target },
  { id: "goals", label: "Metas", icon: Flag },
  { id: "recurring", label: "Recorrentes", icon: RefreshCw },
  { id: "reports", label: "Relatórios", icon: CircleDollarSign },
  { id: "networth", label: "Patrimônio", icon: PiggyBank },
  { id: "settings", label: "Ajustes", icon: Settings },
];

const accountTypes = [
  ["checking", "Conta corrente"],
  ["savings", "Poupança"],
  ["cash", "Dinheiro"],
  ["credit", "Cartão"],
  ["investment", "Investimento"],
];

const frequencies = [
  ["weekly", "Semanal"],
  ["monthly", "Mensal"],
  ["yearly", "Anual"],
];

const monthNames = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const palette = ["#0f8f88", "#f97316", "#7257c5", "#d84a3a", "#3266c7", "#168a4a", "#c98214", "#e05c9f"];

function App() {
  const [token, setToken] = useState(localStorage.getItem("finora-token") || "");
  const [user, setUser] = useState(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState(localStorage.getItem("finora-section") || "dashboard");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [data, setData] = useState(emptyData());
  const [toast, setToast] = useState("");
  const [filters, setFilters] = useState({ search: "", type: "all", accountId: "all", status: "all", dateFrom: "", dateTo: "", minAmount: "", maxAmount: "", tag: "" });
  const [theme, setTheme] = useState(localStorage.getItem("finora-theme") || "light");
  const [seenNotificationSignature, setSeenNotificationSignature] = useState("");
  const [notificationPanelStyle, setNotificationPanelStyle] = useState(null);
  const notificationWrapRef = useRef(null);

  const currency = user?.currency || "BRL";
  const expenseCategories = data.categories.filter((item) => item.type === "expense");
  const incomeCategories = data.categories.filter((item) => item.type === "income");
  const mobileDockItems = useMemo(() => navItems.filter((item) => ["dashboard", "transactions", "accounts", "reports"].includes(item.id)), []);
  const notificationStorageKey = user?.id ? `finora-notifications-seen:${user.id}` : "";
  const notificationSignature = useMemo(
    () => data.notifications.map((item) => `${item.id}:${item.title}:${item.body}:${item.tone}`).join("|"),
    [data.notifications],
  );
  const unreadNotifications = notificationSignature && notificationSignature !== seenNotificationSignature ? data.notifications.length : 0;

  useEffect(() => {
    boot();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem("finora-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (token) loadData();
  }, [token, month, filters.type, filters.accountId]);

  useEffect(() => {
    localStorage.setItem("finora-section", section);
  }, [section]);

  useEffect(() => {
    setSeenNotificationSignature(notificationStorageKey ? localStorage.getItem(notificationStorageKey) || "" : "");
  }, [notificationStorageKey]);

  useEffect(() => {
    if (!notificationsOpen) return undefined;

    markNotificationsSeen();
    positionNotificationPanel();

    function handlePointerDown(event) {
      if (notificationWrapRef.current && !notificationWrapRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") setNotificationsOpen(false);
    }

    window.addEventListener("resize", positionNotificationPanel);
    window.addEventListener("scroll", positionNotificationPanel, true);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", positionNotificationPanel);
      window.removeEventListener("scroll", positionNotificationPanel, true);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [notificationsOpen, notificationSignature, notificationStorageKey]);

  async function boot() {
    try {
      const status = await apiRequest("/auth/status");
      setSetupRequired(status.setupRequired);
      if (token && !status.setupRequired) {
        const me = await apiRequest("/auth/me", { token });
        setUser(me.user);
      }
    } catch (error) {
      showToast(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadData(nextFilters = filters) {
    try {
      const query = new URLSearchParams({
        month,
        type: nextFilters.type,
        accountId: nextFilters.accountId,
        search: nextFilters.search,
        status: nextFilters.status || "all",
        dateFrom: nextFilters.dateFrom || "",
        dateTo: nextFilters.dateTo || "",
        minAmount: nextFilters.minAmount || "",
        maxAmount: nextFilters.maxAmount || "",
        tag: nextFilters.tag || "",
      });
      const [dashboard, categories, transactions, accounts, budgets, goals, recurring, reports, notifications, netWorth] = await Promise.all([
        apiRequest(`/dashboard?month=${month}`, { token }),
        apiRequest("/categories", { token }),
        apiRequest(`/transactions?${query}`, { token }),
        apiRequest("/accounts", { token }),
        apiRequest(`/budgets?month=${month}`, { token }),
        apiRequest("/goals", { token }),
        apiRequest("/recurring", { token }),
        apiRequest(`/reports?month=${month}`, { token }),
        apiRequest(`/notifications?month=${month}`, { token }),
        apiRequest("/net-worth", { token }),
      ]);
      setData({
        dashboard,
        categories: categories.categories,
        transactions: transactions.transactions,
        accounts: accounts.accounts,
        budgets: budgets.budgets,
        goals: goals.goals,
        recurring: recurring.recurring,
        reports,
        notifications: notifications.notifications,
        netWorth,
      });
    } catch (error) {
      showToast(error.message);
      if (String(error.message).includes("Sessão")) logout();
    }
  }

  function showToast(message) {
    setToast(message);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(""), 2800);
  }

  function saveSession(payload) {
    localStorage.setItem("finora-token", payload.token);
    setToken(payload.token);
    setUser(payload.user);
    setSetupRequired(false);
  }

  function logout() {
    localStorage.removeItem("finora-token");
    setToken("");
    setUser(null);
    setNotificationsOpen(false);
    setData(emptyData());
  }

  function markNotificationsSeen(signature = notificationSignature) {
    setSeenNotificationSignature(signature);
    if (notificationStorageKey) {
      localStorage.setItem(notificationStorageKey, signature);
    }
  }

  function positionNotificationPanel() {
    if (!notificationWrapRef.current) return;
    const rect = notificationWrapRef.current.getBoundingClientRect();
    const gutter = 12;
    const maxWidth = Math.min(360, window.innerWidth - gutter * 2);
    const left = Math.min(Math.max(rect.right - maxWidth, gutter), window.innerWidth - gutter - maxWidth);
    const top = rect.bottom + 10;
    const maxHeight = Math.max(180, window.innerHeight - top - gutter);
    setNotificationPanelStyle({
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      right: "auto",
      width: `${maxWidth}px`,
      maxHeight: `${maxHeight}px`,
      overflow: "auto",
    });
  }

  async function mutate(path, options, message) {
    await apiRequest(path, { ...options, token });
    await loadData();
    showToast(message);
  }

  async function downloadBackup() {
    const backup = await apiRequest("/export", { token });
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `finora-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const appContext = {
    token,
    user,
    currency,
    month,
    setMonth,
    data,
    filters,
    setFilters,
    expenseCategories,
    incomeCategories,
    mutate,
    loadData,
    showToast,
    setUser,
    downloadBackup,
    theme,
    setTheme,
    apiUrl,
    nativeApp,
  };

  if (loading) return <FullLoader />;
  if (setupRequired) return <AuthScreen mode="setup" onDone={saveSession} showToast={showToast} theme={theme} setTheme={setTheme} />;
  if (!token || !user) return <AuthScreen mode="login" onDone={saveSession} showToast={showToast} theme={theme} setTheme={setTheme} />;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="brand brand-stack">
          <img className="brand-logo" src="/finora-logo.png" alt="Finora" />
          <span className="brand-subtitle">{user.name}</span>
        </div>
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={`nav-item ${section === item.id ? "active" : ""}`} onClick={() => { setSection(item.id); setMenuOpen(false); }}>
                <Icon size={20} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-card">
          <span>Saldo previsto</span>
          <strong>{money(data.dashboard.metrics.forecast, currency)}</strong>
          <small>Fim do mês selecionado</small>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="icon-button mobile-only" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu size={20} /></button>
          <div className="topbar-title">
            <p className="eyebrow">{monthLabel(month, currency)}</p>
            <h1>{navItems.find((item) => item.id === section)?.label}</h1>
          </div>
          <div className="topbar-actions">
            <div className="topbar-primary-actions">
              <MonthPicker value={month} onChange={setMonth} currency={currency} />
              <button className="primary-button" onClick={() => setSection("transactions")}><Plus size={18} /> Novo</button>
            </div>
            <div className="topbar-utility-actions" aria-label="Ações rápidas">
              <div className="notification-wrap" ref={notificationWrapRef}>
                <button className="icon-button utility-button" onClick={() => setNotificationsOpen((current) => !current)} aria-label="Notificações">
                  <Bell size={20} />
                  {unreadNotifications > 0 && <span className="badge">{unreadNotifications}</span>}
                </button>
                {notificationsOpen && <NotificationsPanel notifications={data.notifications} style={notificationPanelStyle} />}
              </div>
              <button className="icon-button utility-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Alternar tema">
                {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button className="icon-button utility-button" onClick={logout} aria-label="Sair"><LogOut size={20} /></button>
            </div>
          </div>
        </header>

        {section === "dashboard" && <Dashboard {...appContext} />}
        {section === "transactions" && <Transactions {...appContext} />}
        {section === "accounts" && <Accounts {...appContext} />}
        {section === "budgets" && <Budgets {...appContext} />}
        {section === "goals" && <Goals {...appContext} />}
        {section === "recurring" && <Recurring {...appContext} />}
        {section === "reports" && <Reports {...appContext} />}
        {section === "networth" && <NetWorth {...appContext} />}
        {section === "settings" && <SettingsView {...appContext} />}
      </main>

      <nav className="mobile-dock" aria-label="Navegação rápida">
        {mobileDockItems.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} className={`mobile-dock-item ${section === item.id ? "active" : ""}`} onClick={() => setSection(item.id)}>
              <Icon size={19} />
              <span>{item.label}</span>
            </button>
          );
        })}
        <button className={`mobile-dock-item ${menuOpen ? "active" : ""}`} onClick={() => setMenuOpen(true)}>
          <Menu size={19} />
          <span>Mais</span>
        </button>
      </nav>

      {menuOpen && <button className="scrim" onClick={() => setMenuOpen(false)} aria-label="Fechar menu" />}
      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
    </div>
  );
}

function AuthScreen({ mode, onDone, showToast, theme, setTheme }) {
  const [screen, setScreen] = useState(mode);
  const [form, setForm] = useState({ name: "", email: "", password: "", seedDemo: true });
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const isSetup = screen === "setup";
  const isCreate = screen === "setup" || screen === "register";

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setErrorMessage("");
    try {
      const endpoint = isSetup ? "/auth/setup" : isCreate ? "/auth/register" : "/auth/login";
      const payload = await apiRequest(endpoint, {
        method: "POST",
        body: isCreate ? form : { email: form.email, password: form.password },
      });
      onDone(payload);
    } catch (error) {
      setErrorMessage(error.message);
      showToast(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-topline">
          <div className="brand auth-brand brand-stack">
            <img className="brand-logo brand-logo-auth" src="/finora-logo.png" alt="Finora" />
            <span className="brand-subtitle">Controle financeiro pessoal</span>
          </div>
          <button className="icon-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Alternar tema">
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
        <h1>{isSetup ? "Crie seu primeiro acesso" : isCreate ? "Criar nova conta" : "Entrar no Finora"}</h1>
        <p>{isCreate ? "Cada pessoa tem login próprio e dados totalmente separados." : "Entre com o e-mail e senha cadastrados."}</p>
        {errorMessage && <div className="auth-error">{errorMessage}</div>}
        <form className="stacked-form" onSubmit={submit}>
          {isCreate && <Field label="Nome" value={form.name} onChange={(name) => setForm({ ...form, name })} required />}
          <Field label="E-mail" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} required />
          <Field label="Senha" type="password" value={form.password} onChange={(password) => setForm({ ...form, password })} required minLength={8} />
          {isCreate && (
            <label className="check-row">
              <input type="checkbox" checked={form.seedDemo} onChange={(event) => setForm({ ...form, seedDemo: event.target.checked })} />
              <span>Começar com dados de exemplo</span>
            </label>
          )}
          <button className="primary-button" disabled={busy}>
            {busy ? <Loader2 className="spin" size={18} /> : isCreate ? <UserPlus size={18} /> : <LogIn size={18} />}
            Continuar
          </button>
        </form>
        {!isSetup && (
          <button className="link-button" type="button" onClick={() => setScreen(screen === "login" ? "register" : "login")}>
            {screen === "login" ? "Criar uma conta nova" : "Já tenho conta"}
          </button>
        )}
      </section>
    </main>
  );
}

function Dashboard({ data, currency }) {
  const metrics = data.dashboard.metrics;
  return (
    <>
      <div className="metric-grid">
        <Metric title="Saldo total" value={money(metrics.balance, currency)} icon={Wallet} />
        <Metric title={labelFor("income", currency)} value={money(metrics.income, currency)} tone="good" icon={ArrowUpRight} />
        <Metric title={labelFor("expense", currency)} value={money(metrics.expense, currency)} tone="bad" icon={ArrowDownRight} />
        <Metric title="Saúde financeira" value={`${data.dashboard.health?.score ?? 0}/100`} hint={data.dashboard.health?.label || "Calculando"} icon={PiggyBank} />
      </div>
      <div className="insight-strip">
        <article>
          <strong>Previsão de fechamento</strong>
          <span>{money(metrics.forecast, currency)}</span>
        </article>
        <article>
          <strong>Taxa de economia</strong>
          <span>{metrics.savingsRate}%</span>
        </article>
        <article>
          <strong>Alertas ativos</strong>
          <span>{data.dashboard.notifications?.length || 0}</span>
        </article>
      </div>
      <div className="dashboard-grid">
        <Panel title="Fluxo do mês" subtitle="Saldo acumulado por dia">
          <ChartFrame>
            <ResponsiveContainer width="100%" height={310}>
              <AreaChart data={data.dashboard.cashflow}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(date) => date.slice(8)} stroke="var(--muted)" />
                <YAxis tickFormatter={(value) => compact(value, currency)} stroke="var(--muted)" />
                <Tooltip content={<ChartTooltip currency={currency} labels={{ balance: labelFor("balance", currency) }} labelFormatter={formatDate} />} />
                <Area type="monotone" dataKey="balance" name={labelFor("balance", currency)} stroke="#0f8f88" fill="#d8f2ef" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartFrame>
        </Panel>
        <Panel title="Categorias" subtitle="Maiores saídas">
          <ChartFrame compact>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data.dashboard.categories} dataKey="value" nameKey="name" innerRadius={70} outerRadius={105}>
                  {data.dashboard.categories.map((entry, index) => <Cell key={entry.name} fill={entry.color || palette[index % palette.length]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip currency={currency} />} />
              </PieChart>
            </ResponsiveContainer>
          </ChartFrame>
          <MiniList items={data.dashboard.categories.slice(0, 5).map((item) => ({ title: item.name, value: money(item.value, currency), color: item.color }))} />
        </Panel>
        <Panel title="Próximos" subtitle="Recorrências ativas">
          <CompactList items={data.dashboard.recurring.map((item) => ({ title: item.description, meta: `${formatDate(item.nextDate)} · ${frequencyLabel(item.frequency)}`, value: `${item.type === "income" ? "+" : "-"}${money(item.amount, currency)}` }))} />
        </Panel>
        <Panel title="Cartões" subtitle="Faturas do mês">
          <CompactList items={(data.dashboard.cards || []).map((card) => ({ title: card.name, meta: `Venc. dia ${card.dueDay || "-"} · Fecha dia ${card.closingDay || "-"}`, value: money(card.invoice, currency) }))} emptyText="Nenhum cartão cadastrado." />
        </Panel>
        <Panel title="Alertas" subtitle="Orçamentos, metas e vencimentos">
          <NotificationList notifications={data.dashboard.notifications || []} />
        </Panel>
        <Panel title="Últimos lançamentos" subtitle="Movimentações recentes">
          <TransactionTable transactions={data.dashboard.recent} currency={currency} />
        </Panel>
      </div>
    </>
  );
}

function Transactions({ data, currency, expenseCategories, incomeCategories, filters, setFilters, loadData, mutate, showToast }) {
  const blank = () => ({ id: "", type: "expense", description: "", amount: "", date: today(), categoryId: expenseCategories[0]?.id || "", accountId: data.accounts[0]?.id || "", transferAccountId: data.accounts[1]?.id || "", status: "paid", tags: "", notes: "", installmentTotal: 1, invoiceMonth: "" });
  const [form, setForm] = useState(blank());
  const [open, setOpen] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState(null);
  const categories = form.type === "income" ? incomeCategories : expenseCategories;

  useEffect(() => {
    setForm((current) => ({
      ...current,
      accountId: current.accountId || data.accounts[0]?.id || "",
      transferAccountId: current.transferAccountId || data.accounts[1]?.id || "",
      categoryId: current.categoryId || categories[0]?.id || "",
    }));
  }, [data.accounts.length, categories.length]);

  async function submit(event) {
    event.preventDefault();
    const body = {
      ...form,
      amount: Number(form.amount),
      transferAccountId: form.type === "transfer" ? (form.transferAccountId || null) : null,
      categoryId: form.type === "transfer" ? null : (form.categoryId || null),
      invoiceMonth: form.invoiceMonth || null,
    };
    const response = await apiRequest(form.id ? `/transactions/${form.id}` : "/transactions", { method: form.id ? "PUT" : "POST", body, token: localStorage.getItem("finora-token") });
    const transactionId = response.transaction?.id;
    if (attachmentFile && transactionId) {
      const contentBase64 = await fileToBase64(attachmentFile);
      await apiRequest(`/transactions/${transactionId}/attachments`, {
        method: "POST",
        token: localStorage.getItem("finora-token"),
        body: {
          fileName: attachmentFile.name,
          mimeType: attachmentFile.type || "application/octet-stream",
          size: attachmentFile.size,
          contentBase64,
        },
      });
    }
    await loadData();
    showToast(form.id ? "Lançamento atualizado." : "Lançamento criado.");
    setForm(blank());
    setAttachmentFile(null);
    setOpen(false);
    // mutate normally shows a toast; this path needs the created id for attachment upload.
    window.setTimeout(() => {}, 0);
  }

  async function remove(id) {
    if (!confirm("Excluir este lançamento?")) return;
    await mutate(`/transactions/${id}`, { method: "DELETE" }, "Lançamento excluído.");
  }

  async function downloadAttachment(attachment) {
    const response = await fetch(`${apiUrl}/attachments/${attachment.id}/download`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("finora-token")}` },
    });
    if (!response.ok) throw new Error("Não foi possível baixar o anexo.");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = attachment.fileName;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function create() {
    setForm(blank());
    setOpen(true);
  }

  function edit(item) {
    setForm({ id: item.id, type: item.type, description: item.description, amount: item.amount, date: item.date, categoryId: item.categoryId || "", accountId: item.accountId, transferAccountId: item.transferAccountId || "", status: item.status, tags: item.tags || "", notes: item.notes || "", installmentTotal: item.installmentTotal || 1, invoiceMonth: item.invoiceMonth || "" });
    setAttachmentFile(null);
    setOpen(true);
  }

  function searchNow(nextSearch) {
    const nextFilters = { ...filters, search: nextSearch };
    setFilters(nextFilters);
    loadData(nextFilters);
  }

  return (
    <>
      <Panel title="Lançamentos" subtitle={`${data.transactions.length} registros`} action={<button className="primary-button" onClick={create}><Plus size={18} /> Novo lançamento</button>}>
        <div className="filters">
          <Field label="Buscar" value={filters.search} onChange={(search) => setFilters({ ...filters, search })} onBlur={() => loadData(filters)} onKeyDown={(event) => { if (event.key === "Enter") searchNow(event.currentTarget.value); }} />
          <Select label="Tipo" value={filters.type} onChange={(type) => setFilters({ ...filters, type })} options={[["all", "Todos"], ["expense", "Despesas"], ["income", "Receitas"], ["transfer", "Transferências"]]} />
          <Select label="Conta" value={filters.accountId} onChange={(accountId) => setFilters({ ...filters, accountId })} options={[["all", "Todas"], ...data.accounts.map((item) => [item.id, item.name])]} />
        </div>
        <details className="advanced-filters">
          <summary>Busca avançada</summary>
          <div className="filters advanced">
            <Select label="Status" value={filters.status} onChange={(status) => setFilters({ ...filters, status })} options={[["all", "Todos"], ["paid", "Pago"], ["pending", "Pendente"]]} />
            <Field label="De" type="date" value={filters.dateFrom} onChange={(dateFrom) => setFilters({ ...filters, dateFrom })} />
            <Field label="Até" type="date" value={filters.dateTo} onChange={(dateTo) => setFilters({ ...filters, dateTo })} />
            <Field label="Valor mínimo" type="number" step="0.01" value={filters.minAmount} onChange={(minAmount) => setFilters({ ...filters, minAmount })} />
            <Field label="Valor máximo" type="number" step="0.01" value={filters.maxAmount} onChange={(maxAmount) => setFilters({ ...filters, maxAmount })} />
            <Field label="Tag" value={filters.tag} onChange={(tag) => setFilters({ ...filters, tag })} />
          </div>
          <button className="ghost-button" type="button" onClick={() => loadData(filters)}>Aplicar filtros</button>
        </details>
        <div className="transaction-list">
          {data.transactions.length ? data.transactions.map((item) => (
            <article className="transaction-item" key={item.id}>
              <div>
                <strong>{item.description}</strong>
                <span>{formatDate(item.date)} · {typeLabel(item.type)} · {item.category?.name || "Sem categoria"} · {item.account?.name}</span>
                {item.installmentTotal > 1 && <span>Parcela {item.installmentNumber}/{item.installmentTotal}</span>}
                {!!item.attachments?.length && <span>{item.attachments.length} anexo(s)</span>}
              </div>
              <div className="transaction-side">
                <strong className={item.type === "income" ? "amount-good" : "amount-bad"}>{signedAmount(item, currency)}</strong>
                <div className="row-actions">
                  <button className="mini-button" onClick={() => edit(item)} aria-label="Editar"><Edit3 size={16} /></button>
                  {!!item.attachments?.length && <button className="mini-button" onClick={() => downloadAttachment(item.attachments[0]).catch((error) => showToast(error.message))} aria-label="Baixar anexo"><FileText size={16} /></button>}
                  <button className="mini-button" onClick={() => remove(item.id)} aria-label="Excluir"><Trash2 size={16} /></button>
                </div>
              </div>
            </article>
          )) : <Empty text="Nenhum lançamento neste filtro." />}
        </div>
      </Panel>

      <Modal open={open} title={form.id ? "Editar lançamento" : "Novo lançamento"} subtitle="Receitas, despesas e transferências" onClose={() => setOpen(false)}>
        <form className="stacked-form" onSubmit={submit}>
          <Segmented value={form.type} onChange={(type) => setForm({ ...form, type, categoryId: (type === "income" ? incomeCategories[0]?.id : expenseCategories[0]?.id) || "" })} options={[["expense", "Despesa"], ["income", "Receita"], ["transfer", "Transferência"]]} />
          <Field label="Descrição" value={form.description} onChange={(description) => setForm({ ...form, description })} required />
          <div className="field-row">
            <Field label="Valor" type="number" step="0.01" value={form.amount} onChange={(amount) => setForm({ ...form, amount })} required />
            <Field label="Data" type="date" value={form.date} onChange={(date) => setForm({ ...form, date })} required />
          </div>
          <div className="field-row">
            {form.type !== "transfer" && <Select label="Categoria" value={form.categoryId} onChange={(categoryId) => setForm({ ...form, categoryId })} options={categories.map((item) => [item.id, item.name])} />}
            <Select label="Conta" value={form.accountId} onChange={(accountId) => setForm({ ...form, accountId })} options={data.accounts.map((item) => [item.id, item.name])} />
          </div>
          {form.type === "transfer" && <Select label="Conta destino" value={form.transferAccountId} onChange={(transferAccountId) => setForm({ ...form, transferAccountId })} options={data.accounts.map((item) => [item.id, item.name])} />}
          <div className="field-row">
            <Select label="Status" value={form.status} onChange={(status) => setForm({ ...form, status })} options={[["paid", "Pago"], ["pending", "Pendente"]]} />
            <Field label="Tags" value={form.tags} onChange={(tags) => setForm({ ...form, tags })} />
          </div>
          {form.type === "expense" && !form.id && (
            <div className="field-row">
              <Field label="Parcelas" type="number" min="1" max="60" value={form.installmentTotal} onChange={(installmentTotal) => setForm({ ...form, installmentTotal })} />
              <Field label="Mês da fatura" type="month" value={form.invoiceMonth} onChange={(invoiceMonth) => setForm({ ...form, invoiceMonth })} />
            </div>
          )}
          <label>Observações<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
          <label>Anexo
            <input type="file" onChange={(event) => setAttachmentFile(event.target.files?.[0] || null)} />
          </label>
          {attachmentFile && <span className="file-hint">{attachmentFile.name}</span>}
          <div className="form-actions">
            <button className="primary-button"><Save size={18} /> Salvar</button>
            <button className="ghost-button" type="button" onClick={() => setOpen(false)}><X size={18} /> Cancelar</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function Accounts({ data, currency, mutate }) {
  const blank = () => ({ id: "", name: "", type: "checking", initialBalance: 0, creditLimit: 0, closingDay: "", dueDay: "", color: "#0f8f88", shared: false });
  const [form, setForm] = useState(blank());
  const [open, setOpen] = useState(false);

  async function submit(event) {
    event.preventDefault();
    await mutate(form.id ? `/accounts/${form.id}` : "/accounts", {
      method: form.id ? "PUT" : "POST",
      body: {
        ...form,
        initialBalance: Number(form.initialBalance || 0),
        creditLimit: Number(form.creditLimit || 0),
        closingDay: form.type === "credit" && form.closingDay ? Number(form.closingDay) : null,
        dueDay: form.type === "credit" && form.dueDay ? Number(form.dueDay) : null,
      },
    }, form.id ? "Conta atualizada." : "Conta criada.");
    setForm(blank());
    setOpen(false);
  }

  function edit(account) {
    setForm(account);
    setOpen(true);
  }

  async function remove(account) {
    if (!confirm(`Excluir a conta "${account.name}"?`)) return;
    await mutate(`/accounts/${account.id}`, { method: "DELETE" }, "Conta removida da lista. Se havia vínculos, ela foi arquivada automaticamente.");
    if (form.id === account.id) {
      setForm(blank());
      setOpen(false);
    }
  }

  return (
    <>
      <Panel title="Minhas contas" subtitle="Saldos calculados pelo banco" action={<button className="primary-button" onClick={() => { setForm(blank()); setOpen(true); }}><Plus size={18} /> Nova conta</button>}>
        <div className="account-grid">
          {data.accounts.map((account) => (
            <article className="account-card" style={{ "--card-color": account.color }} key={account.id}>
              <div className="card-head">
                <div><strong>{account.name}</strong><span>{accountTypeLabel(account.type)}</span></div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="mini-button" onClick={() => edit(account)} aria-label="Editar"><Edit3 size={16} /></button>
                  <button className="mini-button" onClick={() => remove(account)} aria-label="Excluir"><Trash2 size={16} /></button>
                </div>
              </div>
              <b>{money(account.balance, currency)}</b>
              {account.type === "credit" && <span>Limite {money(account.creditLimit, currency)} · Venc. dia {account.dueDay || "-"}</span>}
              {account.shared && <span>Conta familiar</span>}
            </article>
          ))}
        </div>
      </Panel>
      <Modal open={open} title={form.id ? "Editar conta" : "Nova conta"} subtitle="Banco, carteira, cartão ou investimento" onClose={() => setOpen(false)}>
        <form className="stacked-form" onSubmit={submit}>
          <Field label="Nome" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
          <div className="field-row">
            <Select label="Tipo" value={form.type} onChange={(type) => setForm({ ...form, type })} options={accountTypes} />
            <Field label="Saldo inicial" type="number" step="0.01" value={form.initialBalance} onChange={(initialBalance) => setForm({ ...form, initialBalance })} />
          </div>
          {form.type === "credit" && (
            <div className="field-row">
              <Field label="Limite do cartão" type="number" step="0.01" value={form.creditLimit || ""} onChange={(creditLimit) => setForm({ ...form, creditLimit })} />
              <Field label="Dia de fechamento" type="number" min="1" max="31" value={form.closingDay || ""} onChange={(closingDay) => setForm({ ...form, closingDay })} />
              <Field label="Dia de vencimento" type="number" min="1" max="31" value={form.dueDay || ""} onChange={(dueDay) => setForm({ ...form, dueDay })} />
            </div>
          )}
          <label className="check-row">
            <input type="checkbox" checked={Boolean(form.shared)} onChange={(event) => setForm({ ...form, shared: event.target.checked })} />
            <span>Marcar como conta familiar/compartilhada</span>
          </label>
          <Field label="Cor" type="color" value={form.color} onChange={(color) => setForm({ ...form, color })} />
          <div className="form-actions">
            <button className="primary-button"><Save size={18} /> Salvar</button>
            <button className="ghost-button" type="button" onClick={() => setOpen(false)}><X size={18} /> Cancelar</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function Budgets({ data, currency, expenseCategories, month, mutate }) {
  const blank = () => ({ id: "", categoryId: expenseCategories[0]?.id || "", month, limit: "" });
  const [form, setForm] = useState(blank());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setForm((current) => ({ ...current, month, categoryId: current.categoryId || expenseCategories[0]?.id || "" }));
  }, [month, expenseCategories.length]);

  async function submit(event) {
    event.preventDefault();
    await mutate(form.id ? `/budgets/${form.id}` : "/budgets", { method: form.id ? "PUT" : "POST", body: { ...form, limit: Number(form.limit) } }, "Orçamento salvo.");
    setForm(blank());
    setOpen(false);
  }

  function edit(budget) {
    setForm({ id: budget.id, categoryId: budget.categoryId, month: budget.month, limit: budget.limit });
    setOpen(true);
  }

  async function remove(budget) {
    if (!window.confirm(`Excluir o orçamento de ${budget.category?.name || "categoria"}?`)) return;
    await mutate(`/budgets/${budget.id}`, { method: "DELETE" }, "Orçamento excluído.");
    if (form.id === budget.id) {
      setForm(blank());
      setOpen(false);
    }
  }

  return (
    <>
      <Panel title="Orçamentos" subtitle={`${data.budgets.length} ativos`} action={<button className="primary-button" onClick={() => { setForm(blank()); setOpen(true); }}><Plus size={18} /> Novo orçamento</button>}>
        <ProgressList items={data.budgets.map((budget) => ({ id: budget.id, title: budget.category?.name, meta: `${money(budget.spent, currency)} de ${money(budget.limit, currency)}`, percent: budget.limit ? (budget.spent / budget.limit) * 100 : 0, color: budget.category?.color, onEdit: () => edit(budget), onDelete: () => remove(budget) }))} />
      </Panel>
      <Modal open={open} title={form.id ? "Editar orçamento" : "Novo orçamento"} subtitle="Limites mensais por categoria" onClose={() => setOpen(false)}>
        <form className="stacked-form" onSubmit={submit}>
          <Select label="Categoria" value={form.categoryId} onChange={(categoryId) => setForm({ ...form, categoryId })} options={expenseCategories.map((item) => [item.id, item.name])} />
          <div className="field-row">
            <Field label="Limite" type="number" step="0.01" value={form.limit} onChange={(limit) => setForm({ ...form, limit })} required />
            <Field label="Mês" type="month" value={form.month} onChange={(monthValue) => setForm({ ...form, month: monthValue })} required />
          </div>
          <div className="form-actions">
            <button className="primary-button"><Save size={18} /> Salvar</button>
            <button className="ghost-button" type="button" onClick={() => setOpen(false)}><X size={18} /> Cancelar</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function Goals({ data, currency, mutate }) {
  const blank = () => ({ id: "", name: "", target: "", saved: "", dueDate: today(), color: "#f97316" });
  const [form, setForm] = useState(blank());
  const [open, setOpen] = useState(false);

  async function submit(event) {
    event.preventDefault();
    await mutate(form.id ? `/goals/${form.id}` : "/goals", { method: form.id ? "PUT" : "POST", body: { ...form, target: Number(form.target), saved: Number(form.saved) } }, "Meta salva.");
    setForm(blank());
    setOpen(false);
  }

  function edit(goal) {
    setForm(goal);
    setOpen(true);
  }

  async function remove(goal) {
    if (!window.confirm(`Excluir a meta "${goal.name}"?`)) return;
    await mutate(`/goals/${goal.id}`, { method: "DELETE" }, "Meta excluída.");
    if (form.id === goal.id) {
      setForm(blank());
      setOpen(false);
    }
  }

  return (
    <>
      <Panel title="Metas" subtitle="Progresso, prazo e aporte" action={<button className="primary-button" onClick={() => { setForm(blank()); setOpen(true); }}><Plus size={18} /> Nova meta</button>}>
        <ProgressList items={data.goals.map((goal) => ({ id: goal.id, title: goal.name, meta: `${money(goal.saved, currency)} de ${money(goal.target, currency)} · ${formatDate(goal.dueDate)}`, percent: goal.target ? (goal.saved / goal.target) * 100 : 0, color: goal.color, onEdit: () => edit(goal), onDelete: () => remove(goal) }))} />
      </Panel>
      <Modal open={open} title={form.id ? "Editar meta" : "Nova meta"} subtitle="Reserva, viagem, compra ou quitação" onClose={() => setOpen(false)}>
        <form className="stacked-form" onSubmit={submit}>
          <Field label="Nome" value={form.name} onChange={(name) => setForm({ ...form, name })} required />
          <div className="field-row">
            <Field label="Objetivo" type="number" step="0.01" value={form.target} onChange={(target) => setForm({ ...form, target })} required />
            <Field label="Guardado" type="number" step="0.01" value={form.saved} onChange={(saved) => setForm({ ...form, saved })} required />
          </div>
          <div className="field-row">
            <Field label="Prazo" type="date" value={form.dueDate} onChange={(dueDate) => setForm({ ...form, dueDate })} required />
            <Field label="Cor" type="color" value={form.color} onChange={(color) => setForm({ ...form, color })} />
          </div>
          <div className="form-actions">
            <button className="primary-button"><Save size={18} /> Salvar</button>
            <button className="ghost-button" type="button" onClick={() => setOpen(false)}><X size={18} /> Cancelar</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function Recurring({ data, currency, expenseCategories, incomeCategories, mutate }) {
  const blank = () => ({ id: "", type: "expense", description: "", amount: "", accountId: data.accounts[0]?.id || "", categoryId: expenseCategories[0]?.id || "", frequency: "monthly", nextDate: today(), active: true });
  const [form, setForm] = useState(blank());
  const [open, setOpen] = useState(false);
  const categories = form.type === "income" ? incomeCategories : expenseCategories;

  async function submit(event) {
    event.preventDefault();
    await mutate(form.id ? `/recurring/${form.id}` : "/recurring", { method: form.id ? "PUT" : "POST", body: { ...form, amount: Number(form.amount) } }, "Recorrência salva.");
    setForm(blank());
    setOpen(false);
  }

  async function run(id) {
    await mutate(`/recurring/${id}/run`, { method: "POST" }, "Lançamento recorrente gerado.");
  }

  function edit(item) {
    setForm({ ...item, amount: item.amount });
    setOpen(true);
  }

  async function remove(item) {
    if (!window.confirm(`Excluir a recorrência "${item.description}"?`)) return;
    await mutate(`/recurring/${item.id}`, { method: "DELETE" }, "Recorrência excluída.");
    if (form.id === item.id) {
      setForm(blank());
      setOpen(false);
    }
  }

  return (
    <>
      <Panel title="Recorrentes" subtitle="Geração manual de lançamentos" action={<button className="primary-button" onClick={() => { setForm(blank()); setOpen(true); }}><Plus size={18} /> Nova recorrência</button>}>
        <div className="compact-list">
          {data.recurring.length ? data.recurring.map((item) => (
            <article className="compact-item" key={item.id}>
              <div><strong>{item.description}</strong><span>{formatDate(item.nextDate)} · {frequencyLabel(item.frequency)} · {item.account?.name}</span></div>
              <div className="row-actions">
                <b>{signedAmount(item, currency)}</b>
                <button className="mini-button" onClick={() => run(item.id)} aria-label="Gerar"><Play size={16} /></button>
                <button className="mini-button" onClick={() => edit(item)} aria-label="Editar"><Edit3 size={16} /></button>
                <button className="mini-button" onClick={() => remove(item)} aria-label="Excluir"><Trash2 size={16} /></button>
              </div>
            </article>
          )) : <Empty text="Nenhuma recorrência cadastrada." />}
        </div>
      </Panel>
      <Modal open={open} title={form.id ? "Editar recorrência" : "Nova recorrência"} subtitle="Contas fixas e receitas previsíveis" onClose={() => setOpen(false)}>
        <form className="stacked-form" onSubmit={submit}>
          <Segmented value={form.type} onChange={(type) => setForm({ ...form, type, categoryId: (type === "income" ? incomeCategories[0]?.id : expenseCategories[0]?.id) || "" })} options={[["expense", "Despesa"], ["income", "Receita"]]} />
          <Field label="Descrição" value={form.description} onChange={(description) => setForm({ ...form, description })} required />
          <div className="field-row">
            <Field label="Valor" type="number" step="0.01" value={form.amount} onChange={(amount) => setForm({ ...form, amount })} required />
            <Field label="Próxima data" type="date" value={form.nextDate} onChange={(nextDate) => setForm({ ...form, nextDate })} required />
          </div>
          <div className="field-row">
            <Select label="Categoria" value={form.categoryId} onChange={(categoryId) => setForm({ ...form, categoryId })} options={categories.map((item) => [item.id, item.name])} />
            <Select label="Frequência" value={form.frequency} onChange={(frequency) => setForm({ ...form, frequency })} options={frequencies} />
          </div>
          <Select label="Conta" value={form.accountId} onChange={(accountId) => setForm({ ...form, accountId })} options={data.accounts.map((item) => [item.id, item.name])} />
          <div className="form-actions">
            <button className="primary-button"><Save size={18} /> Salvar</button>
            <button className="ghost-button" type="button" onClick={() => setOpen(false)}><X size={18} /> Cancelar</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function Reports({ data, currency }) {
  const reportData = useMemo(
    () => data.reports.trend.map((item) => ({
      ...item,
      incomeLabel: item.income,
      expenseLabel: item.expense,
    })),
    [data.reports.trend]
  );

  return (
    <div className="report-grid">
      <Panel title="Comparação" subtitle="Mês atual contra mês anterior">
        <div className="report-metrics">
          <Metric title={labelFor("income", currency)} value={signedDelta(data.reports.comparison?.incomeDelta || 0, currency)} icon={ArrowUpRight} />
          <Metric title={labelFor("expense", currency)} value={signedDelta(data.reports.comparison?.expenseDelta || 0, currency)} icon={ArrowDownRight} />
          <Metric title={labelFor("balance", currency)} value={signedDelta(data.reports.comparison?.balanceDelta || 0, currency)} icon={Wallet} />
        </div>
      </Panel>
      <Panel title="Médias" subtitle="Últimos seis meses">
        <div className="mini-list">
          <div><i style={{ background: "#168a4a" }} /><span>{labelFor("income", currency)}</span><strong>{money(data.reports.averages?.income || 0, currency)}</strong></div>
          <div><i style={{ background: "#d84a3a" }} /><span>{labelFor("expense", currency)}</span><strong>{money(data.reports.averages?.expense || 0, currency)}</strong></div>
          <div><i style={{ background: "#0f8f88" }} /><span>{labelFor("balance", currency)}</span><strong>{money(data.reports.averages?.balance || 0, currency)}</strong></div>
        </div>
        <button className="ghost-button print-button" onClick={() => window.print()}><Printer size={18} /> Exportar PDF</button>
      </Panel>
      <Panel title="Evolução mensal" subtitle="Entradas, saídas e resultado">
        <ChartFrame>
          <ResponsiveContainer width="100%" height={330}>
            <BarChart data={reportData}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="month" tickFormatter={(value) => monthShort(value, currency)} stroke="var(--muted)" />
              <YAxis tickFormatter={(value) => compact(value, currency)} stroke="var(--muted)" />
              <Tooltip content={<ChartTooltip currency={currency} labels={{ income: labelFor("income", currency), expense: labelFor("expense", currency), balance: labelFor("balance", currency) }} labelFormatter={(value) => monthLabel(value, currency)} />} />
              <Legend formatter={(value) => labelFor(value, currency)} />
              <Bar dataKey="income" name={labelFor("income", currency)} fill="#168a4a" radius={[5, 5, 0, 0]} />
              <Bar dataKey="expense" name={labelFor("expense", currency)} fill="#d84a3a" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
      </Panel>
      <Panel title="Top categorias" subtitle="Maiores saídas">
        <ProgressList items={data.reports.topCategories.map((item) => ({ title: item.name, meta: money(item.value, currency), percent: data.reports.topCategories[0]?.value ? (item.value / data.reports.topCategories[0].value) * 100 : 0, color: item.color }))} />
      </Panel>
    </div>
  );
}

function NetWorth({ data, currency }) {
  const netWorth = data.netWorth;
  return (
    <div className="dashboard-grid">
      <Panel title="Patrimônio líquido" subtitle="Ativos menos dívidas">
        <div className="metric-grid compact-metrics">
          <Metric title="Ativos" value={money(netWorth.asset, currency)} tone="good" icon={ArrowUpRight} />
          <Metric title="Dívidas" value={money(netWorth.debt, currency)} tone="bad" icon={ArrowDownRight} />
          <Metric title="Patrimônio" value={money(netWorth.netWorth, currency)} icon={PiggyBank} />
        </div>
      </Panel>
      <Panel title="Composição" subtitle="Contas, investimentos e cartões">
        <ProgressList items={(netWorth.accounts || []).map((account) => ({
          id: account.id,
          title: account.name,
          meta: `${accountTypeLabel(account.type)} · ${money(account.balance, currency)}`,
          percent: netWorth.asset ? Math.abs(account.balance) / Math.max(netWorth.asset, 1) * 100 : 0,
          color: account.color,
        }))} />
      </Panel>
      <Panel title="Modo familiar" subtitle="Contas marcadas como compartilhadas">
        <CompactList
          items={(netWorth.accounts || []).filter((account) => account.shared).map((account) => ({
            title: account.name,
            meta: "Conta familiar/compartilhada",
            value: money(account.balance, currency),
          }))}
          emptyText="Nenhuma conta familiar marcada."
        />
      </Panel>
    </div>
  );
}

function SettingsView({ user, setUser, currency, theme, setTheme, downloadBackup, data, loadData, showToast, apiUrl, nativeApp }) {
  const [currencyForm, setCurrencyForm] = useState(currency);
  const [importAccountId, setImportAccountId] = useState("");

  async function save(event) {
    event.preventDefault();
    const response = await apiRequest("/settings", { method: "PUT", body: { currency: currencyForm }, token: localStorage.getItem("finora-token") });
    setUser(response.user);
  }

  async function importCsv(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (isPdfFile(file)) {
        const accountId = importAccountId || data.accounts[0]?.id;
        const contentBase64 = await fileToBase64(file);
        const response = await apiRequest("/import/pdf", {
          method: "POST",
          token: localStorage.getItem("finora-token"),
          body: { accountId, fileName: file.name, contentBase64 },
        });
        await loadData();
        showToast(`${response.imported} lanÃ§amento(s) importado(s).`);
        return;
      }
      const rows = await parseTransactionsFile(file);
      const accountId = importAccountId || data.accounts[0]?.id;
      await apiRequest("/import/transactions", {
        method: "POST",
        token: localStorage.getItem("finora-token"),
        body: { accountId, rows },
      });
      await loadData();
      showToast(`${rows.length} lançamento(s) importado(s).`);
    } catch (error) {
      showToast(error.message);
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="settings-grid">
      <Panel title="Preferências" subtitle="Moeda e aparência">
        <form className="stacked-form" onSubmit={save}>
          <Select label="Moeda" value={currencyForm} onChange={setCurrencyForm} options={[["BRL", "Real brasileiro"], ["USD", "Dólar americano"], ["EUR", "Euro"]]} />
          <label>Tema
            <div className="theme-picker">
              <button type="button" className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}><Sun size={18} /> Claro</button>
              <button type="button" className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}><Moon size={18} /> Escuro</button>
            </div>
          </label>
          <button className="primary-button"><Save size={18} /> Salvar moeda</button>
        </form>
      </Panel>
      <Panel title="Dados" subtitle="Backup e servidor">
        <div className="data-actions">
          <button className="ghost-button" onClick={downloadBackup}><Download size={18} /> Exportar JSON</button>
          <Select label="Conta para importar" value={importAccountId || data.accounts[0]?.id || ""} onChange={setImportAccountId} options={data.accounts.map((item) => [item.id, item.name])} />
          <label className="ghost-button file-import">
            <Upload size={18} /> Importar CSV/OFX/PDF
            <input type="file" accept=".csv,.ofx,.txt,.pdf" onChange={importCsv} />
          </label>
          <span className="file-hint">PDF com texto funciona automaticamente. PDF escaneado ainda precisa de OCR.</span>
          <a className="ghost-button" href={`${apiUrl}/health`} target="_blank" rel="noreferrer"><ChevronRight size={18} /> Ver API</a>
          <div className="info-box">
            <strong>Acesso pelo celular</strong>
            <span>Com o servidor ativo, abra no telefone usando o IP da sua máquina e a porta 3333.</span>
          </div>
          {nativeApp && (
            <div className="info-box">
              <strong>API do app</strong>
              <span>{apiUrl}</span>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

function MonthPicker({ value, onChange, currency }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(value.slice(0, 4)));
  const pickerRef = useRef(null);
  const selectedMonth = Number(value.slice(5, 7));

  useEffect(() => {
    setYear(Number(value.slice(0, 4)));
  }, [value]);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function pick(monthIndex) {
    onChange(`${year}-${String(monthIndex + 1).padStart(2, "0")}`);
    setOpen(false);
  }

  return (
    <div className="month-picker" ref={pickerRef}>
      <button className="month-trigger" type="button" onClick={() => setOpen(!open)}>
        <CalendarDays size={18} />
        <span>{monthLabel(value, currency)}</span>
      </button>
      {open && (
        <div className="month-popover">
          <div className="month-head">
            <button className="mini-button" type="button" onClick={() => setYear(year - 1)} aria-label="Ano anterior"><ChevronLeft size={16} /></button>
            <strong>{year}</strong>
            <button className="mini-button" type="button" onClick={() => setYear(year + 1)} aria-label="Próximo ano"><ChevronRight size={16} /></button>
          </div>
          <div className="month-grid">
            {monthNames.map((name, index) => (
              <button key={name} type="button" className={year === Number(value.slice(0, 4)) && index + 1 === selectedMonth ? "active" : ""} onClick={() => pick(index)}>
                {name}
              </button>
            ))}
          </div>
          <div className="month-footer">
            <button type="button" className="ghost-button" onClick={() => { onChange(new Date().toISOString().slice(0, 7)); setOpen(false); }}>Mês atual</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Modal({ open, title, subtitle, onClose, children }) {
  if (!open) return null;
  return (
    <div className="modal-layer" role="dialog" aria-modal="true">
      <button className="modal-backdrop" onClick={onClose} aria-label="Fechar popup" />
      <section className="modal-card">
        <div className="modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

function Metric({ title, value, hint = "", tone = "", icon: Icon }) {
  return (
    <article className={`metric-card ${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
      <Icon size={22} />
    </article>
  );
}

function Panel({ title, subtitle, children, action }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        {action && <div className="panel-action">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function ChartFrame({ children, compact: isCompact }) {
  return <div className={`chart-frame ${isCompact ? "compact" : ""}`}>{children}</div>;
}

function Field({ label, value, onChange, ...props }) {
  return <label>{label}<input value={value} onChange={(event) => onChange(event.target.value)} {...props} /></label>;
}

function Select({ label, value, onChange, options }) {
  return (
    <label>{label}
      <select value={value || ""} onChange={(event) => onChange(event.target.value)}>
        {options.map(([id, labelText]) => <option key={id} value={id}>{labelText}</option>)}
      </select>
    </label>
  );
}

function Segmented({ value, onChange, options }) {
  return (
    <div className="segmented">
      {options.map(([id, label]) => (
        <button className={value === id ? "active" : ""} type="button" key={id} onClick={() => onChange(id)}>{label}</button>
      ))}
    </div>
  );
}

function ProgressList({ items }) {
  return (
    <div className="progress-list">
      {items.length ? items.map((item) => (
        <article className="progress-item" key={item.id || item.title}>
          <div className="progress-title">
            <div><strong>{item.title}</strong><span>{item.meta}</span></div>
            {(item.onEdit || item.onDelete) && (
              <div className="row-actions">
                {item.onEdit && <button className="mini-button" onClick={item.onEdit} aria-label="Editar"><Edit3 size={16} /></button>}
                {item.onDelete && <button className="mini-button" onClick={item.onDelete} aria-label="Excluir"><Trash2 size={16} /></button>}
              </div>
            )}
          </div>
          <div className="progress-bar"><div style={{ width: `${Math.min(item.percent, 100)}%`, background: item.color || "#0f8f88" }} /></div>
        </article>
      )) : <Empty text="Nada cadastrado ainda." />}
    </div>
  );
}

function MiniList({ items }) {
  return <div className="mini-list">{items.map((item) => <div key={item.title}><i style={{ background: item.color }} /><span>{item.title}</span><strong>{item.value}</strong></div>)}</div>;
}

function CompactList({ items, emptyText = "Sem itens próximos." }) {
  return <div className="compact-list">{items.length ? items.map((item) => <article className="compact-item" key={`${item.title}-${item.meta}`}><div><strong>{item.title}</strong><span>{item.meta}</span></div><b>{item.value}</b></article>) : <Empty text={emptyText} />}</div>;
}

function NotificationList({ notifications }) {
  if (!notifications.length) return <Empty text="Nenhum alerta agora." />;
  return (
    <div className="notification-list">
      {notifications.slice(0, 6).map((item) => (
        <article className={`notification-item ${item.tone}`} key={item.id}>
          <strong>{item.title}</strong>
          <span>{item.body}</span>
        </article>
      ))}
    </div>
  );
}

function NotificationsPanel({ notifications, style }) {
  return (
    <div className="notification-panel" style={style}>
      <div className="notification-panel-head">
        <strong>Notificações</strong>
        <span>{notifications.length}</span>
      </div>
      <NotificationList notifications={notifications} />
    </div>
  );
}

function TransactionTable({ transactions, currency }) {
  if (!transactions.length) return <Empty text="Nenhum lançamento registrado." />;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Conta</th><th>Valor</th></tr></thead>
        <tbody>{transactions.map((item) => <tr key={item.id}><td>{formatDate(item.date)}</td><td>{item.description}</td><td>{item.category?.name || "-"}</td><td>{item.account?.name || "-"}</td><td className="right">{signedAmount(item, currency)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function ChartTooltip({ active, payload, label, currency, labels = {}, labelFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label && <strong>{labelFormatter ? labelFormatter(label) : label}</strong>}
      {payload.map((entry) => (
        <div key={entry.dataKey || entry.name}>
          <span><i style={{ background: entry.color }} />{labels[entry.dataKey] || entry.name}</span>
          <b>{money(entry.value, currency)}</b>
        </div>
      ))}
    </div>
  );
}

function Empty({ text }) {
  return <div className="empty-state">{text}</div>;
}

function FullLoader() {
  return <div className="full-loader"><Loader2 className="spin" size={28} /> Carregando Finora</div>;
}

function emptyData() {
  return {
    dashboard: { metrics: { balance: 0, income: 0, expense: 0, savingsRate: 0, forecast: 0 }, cashflow: [], categories: [], recurring: [], recent: [] },
    categories: [],
    transactions: [],
    accounts: [],
    budgets: [],
    goals: [],
    recurring: [],
    reports: { trend: [], topCategories: [], comparison: { incomeDelta: 0, expenseDelta: 0, balanceDelta: 0 }, averages: { income: 0, expense: 0, balance: 0 } },
    notifications: [],
    netWorth: { asset: 0, debt: 0, netWorth: 0, accounts: [] },
  };
}

function money(value, currency = "BRL") {
  return new Intl.NumberFormat(localeFor(currency), { style: "currency", currency }).format(Number(value || 0));
}

function compact(value, currency = "BRL") {
  return new Intl.NumberFormat(localeFor(currency), { notation: "compact", style: "currency", currency, maximumFractionDigits: 1 }).format(Number(value || 0));
}

function localeFor(currency) {
  return currency === "BRL" ? "pt-BR" : "en-US";
}

function labelFor(key, currency) {
  const pt = { income: "Entradas", expense: "Saídas", balance: "Saldo" };
  const en = { income: "Income", expense: "Expense", balance: "Balance" };
  return (currency === "BRL" ? pt : en)[key] || key;
}

function signedAmount(item, currency) {
  if (item.type === "income") return `+${money(item.amount, currency)}`;
  if (item.type === "transfer") return money(item.amount, currency);
  return `-${money(item.amount, currency)}`;
}

function signedDelta(value, currency) {
  const prefix = Number(value) > 0 ? "+" : "";
  return `${prefix}${money(value, currency)}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function monthLabel(value, currency = "BRL") {
  return new Intl.DateTimeFormat(currency === "BRL" ? "pt-BR" : "en-US", { month: "long", year: "numeric" }).format(new Date(`${value}-01T00:00:00`));
}

function monthShort(value, currency = "BRL") {
  return new Intl.DateTimeFormat(currency === "BRL" ? "pt-BR" : "en-US", { month: "short" }).format(new Date(`${value}-01T00:00:00`));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function typeLabel(type) {
  return { income: "Receita", expense: "Despesa", transfer: "Transferência" }[type] || type;
}

function frequencyLabel(type) {
  return { weekly: "Semanal", monthly: "Mensal", yearly: "Anual" }[type] || type;
}

function accountTypeLabel(type) {
  return Object.fromEntries(accountTypes)[type] || type;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function isPdfFile(file) {
  const normalizedName = String(file?.name || "").toLowerCase();
  return normalizedName.endsWith(".pdf");
}

async function parseTransactionsFile(file) {
  const normalizedName = String(file?.name || "").toLowerCase();
  const text = await file.text();
  const normalizedText = String(text || "").trim();
  if (!normalizedText) throw new Error("Arquivo vazio.");
  if (normalizedName.endsWith(".ofx") || normalizedText.includes("<OFX>") || normalizedText.includes("<STMTTRN>")) {
    return parseOfxTransactions(normalizedText);
  }
  return parseCsvTransactions(normalizedText);
}

function parseCsvTransactions(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) throw new Error("Arquivo vazio.");
  const separator = lines[0].includes(";") ? ";" : ",";
  const header = lines[0].split(separator).map((item) => normalizeText(item));
  const dataLines = header.some((item) => ["data", "date"].includes(item)) ? lines.slice(1) : lines;
  const idx = (names, fallback) => {
    const found = header.findIndex((item) => names.includes(item));
    return found >= 0 ? found : fallback;
  };
  const dateIndex = idx(["data", "date"], 0);
  const descriptionIndex = idx(["descricao", "descrição", "description", "historico", "memo"], 1);
  const amountIndex = idx(["valor", "amount", "quantia"], 2);
  const categoryIndex = idx(["categoria", "category"], 3);

  return dataLines.map((line) => {
    const cells = line.split(separator).map((item) => item.trim().replace(/^"|"$/g, ""));
    const rawAmount = String(cells[amountIndex] || "0").replace(/\./g, "").replace(",", ".");
    const amount = Number(rawAmount);
    return {
      date: normalizeDate(cells[dateIndex]),
      description: cells[descriptionIndex] || "Importado",
      amount,
      type: amount >= 0 ? "income" : "expense",
      categoryName: cells[categoryIndex] || "",
      tags: "importado",
    };
  }).filter((row) => row.date && Number.isFinite(row.amount));
}

function parseOfxTransactions(text) {
  const matches = [...text.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)];
  if (!matches.length) throw new Error("Nenhuma transação encontrada no OFX.");

  return matches.map((match) => {
    const block = match[1];
    const amount = Number(readOfxValue(block, "TRNAMT").replace(",", "."));
    const description = readOfxValue(block, "MEMO") || readOfxValue(block, "NAME") || "Importado OFX";
    return {
      date: normalizeDate(readOfxValue(block, "DTPOSTED")),
      description,
      amount,
      type: amount >= 0 ? "income" : "expense",
      categoryName: "",
      tags: "importado,ofx",
    };
  }).filter((row) => row.date && Number.isFinite(row.amount));
}

function readOfxValue(block, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const inline = block.match(new RegExp(`<${escapedKey}>([^\\r\\n<]+)`, "i"));
  return inline ? inline[1].trim() : "";
}

async function parsePdfTransactions(file) {
  const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
  if (!pdfWorkerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    pdfWorkerConfigured = true;
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument({ data: bytes }).promise;
  const lines = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    lines.push(...extractPdfLines(textContent));
  }

  await document.destroy();

  const fullText = lines.join("\n");
  const rows = parsePdfStatementLines(lines, {
    inferredYear: inferPdfYear(file.name, fullText),
    expenseByDefault: inferPdfExpenseDefault(file.name, fullText),
  });

  if (!rows.length) {
    throw new Error("Nao consegui identificar lancamentos no PDF. PDFs em imagem ainda nao sao suportados.");
  }

  return rows;
}

function extractPdfLines(textContent) {
  const positioned = textContent.items
    .filter((item) => typeof item?.str === "string" && item.str.trim())
    .map((item) => ({
      text: item.str.replace(/\s+/g, " ").trim(),
      x: item.transform?.[4] || 0,
      y: item.transform?.[5] || 0,
    }))
    .sort((left, right) => (Math.abs(right.y - left.y) <= 2 ? left.x - right.x : right.y - left.y));

  const lines = [];
  for (const item of positioned) {
    const current = lines[lines.length - 1];
    if (!current || Math.abs(current.y - item.y) > 2) {
      lines.push({ y: item.y, items: [item] });
    } else {
      current.items.push(item);
    }
  }

  return lines
    .map((line) => line.items.sort((left, right) => left.x - right.x).map((item) => item.text).join(" ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function parsePdfStatementLines(lines, options = {}) {
  const inferredYear = options.inferredYear || new Date().getFullYear();
  const expenseByDefault = Boolean(options.expenseByDefault);
  const rows = [];
  const seen = new Set();

  for (const rawLine of lines) {
    const line = String(rawLine || "").replace(/\s+/g, " ").trim();
    if (!line || shouldSkipPdfLine(line)) continue;

    const dateMatch = line.match(/\b(\d{2}[\/.-]\d{2}(?:[\/.-]\d{2,4})?)\b/);
    if (!dateMatch) continue;

    const amountMatches = [...line.matchAll(/(?:[-+]\s*)?(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}(?:\s*[-+])?(?:\s*(?:CR|DB|C|D))?/gi)];
    if (!amountMatches.length) continue;

    const amountPosition = expenseByDefault || amountMatches.length === 1 ? amountMatches.length - 1 : Math.max(0, amountMatches.length - 2);
    const amountMatch = amountMatches[amountPosition];
    const description = line
      .slice((dateMatch.index || 0) + dateMatch[0].length, amountMatch.index || line.length)
      .replace(/\s+/g, " ")
      .replace(/^[\s\-:]+|[\s\-:]+$/g, "")
      .trim();

    if (!description || shouldSkipPdfDescription(description)) continue;

    const amount = parsePdfAmount(amountMatch[0], description, expenseByDefault);
    if (!Number.isFinite(amount) || amount === 0) continue;

    const date = normalizePdfDate(dateMatch[1], inferredYear);
    const key = `${date}|${description}|${amount.toFixed(2)}`;
    if (seen.has(key)) continue;

    seen.add(key);
    rows.push({
      date,
      description,
      amount,
      type: amount >= 0 ? "income" : "expense",
      categoryName: "",
      tags: "importado,pdf",
    });
  }

  return rows;
}

function shouldSkipPdfLine(line) {
  const normalized = normalizeText(line);
  return [
    "saldo anterior",
    "saldo final",
    "saldo disponivel",
    "saldo atual",
    "resumo da fatura",
    "pagamento minimo",
    "data de vencimento",
    "limite disponivel",
    "extrato consolidado",
    "demonstrativo",
  ].some((snippet) => normalized.includes(snippet));
}

function shouldSkipPdfDescription(description) {
  const normalized = normalizeText(description);
  return [
    "saldo anterior",
    "saldo final",
    "saldo do dia",
    "saldo disponivel",
    "total",
    "subtotal",
    "resumo",
    "vencimento",
    "limite",
  ].some((snippet) => normalized === snippet || normalized.startsWith(`${snippet} `));
}

function parsePdfAmount(value, description, expenseByDefault) {
  const upperValue = String(value || "").toUpperCase();
  const digits = upperValue.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "");
  const numeric = Number(digits.replace(",", ".").replace(/[-+]/g, ""));
  if (!Number.isFinite(numeric)) return NaN;

  const isDebit = /^\s*-/.test(upperValue) || /-\s*(?:DB|D)?\s*$/i.test(upperValue) || /\bDB\b|\bD\b/.test(upperValue);
  const isCredit = /^\s*\+/.test(upperValue) || /\+\s*(?:CR|C)?\s*$/i.test(upperValue) || /\bCR\b|\bC\b/.test(upperValue);
  if (isDebit && !isCredit) return -Math.abs(numeric);
  if (isCredit && !isDebit) return Math.abs(numeric);

  const normalizedDescription = normalizeText(description);
  if ([
    "credito",
    "credit",
    "recebido",
    "deposito",
    "pix recebido",
    "estorno",
    "reembolso",
    "salario",
  ].some((snippet) => normalizedDescription.includes(snippet))) {
    return Math.abs(numeric);
  }

  if ([
    "debito",
    "debit",
    "compra",
    "pagamento",
    "saque",
    "tarifa",
    "pix enviado",
    "transferencia enviada",
    "boleto",
  ].some((snippet) => normalizedDescription.includes(snippet))) {
    return -Math.abs(numeric);
  }

  return expenseByDefault ? -Math.abs(numeric) : numeric;
}

function normalizePdfDate(value, fallbackYear) {
  const match = String(value || "").trim().match(/^(\d{2})[\/.-](\d{2})(?:[\/.-](\d{2,4}))?$/);
  if (!match) return normalizeDate(value);
  const year = match[3] ? normalizeYear(match[3]) : fallbackYear;
  return `${year}-${match[2]}-${match[1]}`;
}

function normalizeYear(value) {
  const year = Number(value);
  if (year < 100) return year >= 70 ? 1900 + year : 2000 + year;
  return year;
}

function inferPdfYear(fileName, text) {
  const source = `${fileName || ""}\n${String(text || "").slice(0, 4000)}`;
  const years = [...source.matchAll(/\b(20\d{2})\b/g)].map((match) => Number(match[1])).filter((year) => year >= 2000 && year <= 2099);
  return years[0] || new Date().getFullYear();
}

function inferPdfExpenseDefault(fileName, text) {
  const normalized = normalizeText(`${fileName || ""}\n${text || ""}`);
  return [
    "resumo da fatura",
    "cartao de credito",
    "cartao",
    "fatura",
    "vencimento",
    "limite disponivel",
  ].some((snippet) => normalized.includes(snippet));
}

function normalizeDate(value) {
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{8}(?:\d{6})?(?:\.\d+)?(?:\[[^\]]+\])?$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  const match = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  throw new Error(`Data inválida no CSV: ${raw}`);
}

function normalizeText(value) {
  return String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

createRoot(document.getElementById("root")).render(<App />);
