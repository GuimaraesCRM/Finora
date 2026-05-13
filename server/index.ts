import "dotenv/config";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient, type TransactionType } from "@prisma/client";
import { addDays, addMonths, addWeeks, addYears, differenceInCalendarDays, format, startOfMonth, subMonths } from "date-fns";
import { z } from "zod";

const prisma = new PrismaClient();
const app = express();
const port = Number(process.env.APP_PORT || 3333);
const jwtSecret = process.env.JWT_SECRET || "finora-local-secret";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, "../dist/client");

type AuthRequest = Request & { userId?: string };

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "8mb" }));

const centsSchema = z.coerce.number().finite().transform((value) => Math.round(value));
const moneySchema = z.coerce.number().finite().transform((value) => Math.round(value * 100));
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);
const emptyToNull = (value: unknown) => value === "" ? null : value;

const accountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["checking", "savings", "cash", "credit", "investment"]),
  initialBalance: moneySchema,
  creditLimit: moneySchema.optional().default(0),
  closingDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
  dueDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
  color: z.string().min(4).max(24).default("#0f8f88"),
  shared: z.boolean().optional().default(false),
});

const transactionSchema = z.object({
  accountId: z.string().min(1),
  transferAccountId: z.preprocess(emptyToNull, z.string().optional().nullable()),
  categoryId: z.preprocess(emptyToNull, z.string().optional().nullable()),
  type: z.enum(["income", "expense", "transfer"]),
  status: z.enum(["paid", "pending"]).default("paid"),
  description: z.string().min(1),
  amount: moneySchema,
  date: dateSchema,
  tags: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  installmentTotal: z.coerce.number().int().min(1).max(60).optional().default(1),
  invoiceMonth: z.preprocess(emptyToNull, monthSchema.optional().nullable()),
});

const attachmentSchema = z.object({
  fileName: z.string().min(1).max(240),
  mimeType: z.string().min(1).max(120),
  size: z.coerce.number().int().min(0).max(8 * 1024 * 1024),
  contentBase64: z.string().min(1),
});

const importTransactionSchema = z.object({
  accountId: z.string().optional(),
  rows: z.array(
    z.object({
      date: dateSchema,
      description: z.string().min(1),
      amount: z.coerce.number().finite(),
      type: z.enum(["income", "expense"]).optional(),
      categoryName: z.string().optional().default(""),
      tags: z.string().optional().default("importado"),
    })
  ).min(1).max(500),
});

const budgetSchema = z.object({
  categoryId: z.string().min(1),
  month: monthSchema,
  limit: moneySchema,
});

const goalSchema = z.object({
  name: z.string().min(1),
  target: moneySchema,
  saved: moneySchema,
  dueDate: dateSchema,
  color: z.string().min(4).max(24).default("#f97316"),
});

const recurringSchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string().optional().nullable(),
  type: z.enum(["income", "expense"]),
  description: z.string().min(1),
  amount: moneySchema,
  frequency: z.enum(["weekly", "monthly", "yearly"]),
  nextDate: dateSchema,
  active: z.boolean().optional().default(true),
});

const settingsSchema = z.object({
  currency: z.string().min(3).max(3),
});

const authCreateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  seedDemo: z.boolean().optional().default(true),
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "Finora API" });
});

app.get("/api/auth/status", async (_req, res) => {
  const count = await prisma.user.count();
  res.json({ setupRequired: count === 0 });
});

app.post("/api/auth/setup", async (req, res, next) => {
  try {
    const count = await prisma.user.count();
    if (count > 0) return res.status(409).json({ error: "O setup inicial já foi concluído. Crie uma nova conta pela tela de cadastro." });

    const user = await createUserWithDefaults(authCreateSchema.parse(req.body));
    res.json({ token: signToken(user.id), user: serializeUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const user = await createUserWithDefaults(authCreateSchema.parse(req.body));
    res.status(201).json({ token: signToken(user.id), user: serializeUser(user) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user) return res.status(401).json({ error: "E-mail ou senha inválidos." });

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "E-mail ou senha inválidos." });

    res.json({ token: signToken(user.id), user: serializeUser(user) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", auth, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId } });
  res.json({ user: serializeUser(user) });
});

app.get("/api/categories", auth, async (req: AuthRequest, res) => {
  const categories = await prisma.category.findMany({
    where: { userId: req.userId },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  res.json({ categories: categories.map(serializeCategory) });
});

app.get("/api/accounts", auth, async (req: AuthRequest, res) => {
  const accounts = await prisma.account.findMany({
    where: { userId: req.userId, archived: false },
    orderBy: { createdAt: "asc" },
  });
  const balances = await accountBalances(req.userId!);
  res.json({
    accounts: accounts.map((account) => ({
      ...serializeAccount(account),
      balance: centsToMoney(balances.get(account.id) ?? account.initialBalanceCents),
    })),
  });
});

app.post("/api/accounts", auth, async (req: AuthRequest, res, next) => {
  try {
    const body = accountSchema.parse(req.body);
    const account = await prisma.account.create({
      data: {
        userId: req.userId!,
        name: body.name,
        type: toAccountType(body.type),
        initialBalanceCents: body.initialBalance,
        creditLimitCents: body.creditLimit,
        closingDay: body.closingDay || null,
        dueDay: body.dueDay || null,
        color: body.color,
        shared: body.shared,
      },
    });
    res.status(201).json({ account: serializeAccount(account) });
  } catch (error) {
    next(error);
  }
});

app.put("/api/accounts/:id", auth, async (req: AuthRequest, res, next) => {
  try {
    const body = accountSchema.parse(req.body);
    const id = paramId(req);
    await assertOwner("account", id, req.userId!);
    const account = await prisma.account.update({
      where: { id },
      data: {
        name: body.name,
        type: toAccountType(body.type),
        initialBalanceCents: body.initialBalance,
        creditLimitCents: body.creditLimit,
        closingDay: body.closingDay || null,
        dueDay: body.dueDay || null,
        color: body.color,
        shared: body.shared,
      },
    });
    res.json({ account: serializeAccount(account) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/accounts/:id", auth, async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req);
    await assertOwner("account", id, req.userId!);
    const linked = await prisma.transaction.count({
      where: { userId: req.userId, OR: [{ accountId: id }, { transferAccountId: id }] },
    });
    const recurring = await prisma.recurring.count({ where: { userId: req.userId, accountId: id } });
    if (linked || recurring) return res.status(409).json({ error: "A conta possui vínculos. Arquive ou remova os vínculos antes." });
    await prisma.account.delete({ where: { id } });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/transactions", auth, async (req: AuthRequest, res) => {
  const month = typeof req.query.month === "string" ? req.query.month : currentMonth();
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const type = typeof req.query.type === "string" && req.query.type !== "all" ? req.query.type : "";
  const accountId = typeof req.query.accountId === "string" && req.query.accountId !== "all" ? req.query.accountId : "";
  const status = typeof req.query.status === "string" && req.query.status !== "all" ? req.query.status : "";
  const dateFrom = typeof req.query.dateFrom === "string" && req.query.dateFrom ? req.query.dateFrom : "";
  const dateTo = typeof req.query.dateTo === "string" && req.query.dateTo ? req.query.dateTo : "";
  const minAmount = typeof req.query.minAmount === "string" && req.query.minAmount ? Math.round(Number(req.query.minAmount) * 100) : null;
  const maxAmount = typeof req.query.maxAmount === "string" && req.query.maxAmount ? Math.round(Number(req.query.maxAmount) * 100) : null;
  const tag = typeof req.query.tag === "string" ? req.query.tag.trim() : "";
  const { gte, lt } = dateFrom || dateTo ? customDateBounds(dateFrom, dateTo, month) : monthBounds(month);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: req.userId,
      date: { gte, lt },
      ...(type ? { type: toTransactionType(type) } : {}),
      ...(status ? { status: status === "paid" ? "PAID" : "PENDING" } : {}),
      ...(accountId ? { accountId } : {}),
      ...((minAmount !== null || maxAmount !== null) ? { amountCents: { ...(minAmount !== null ? { gte: minAmount } : {}), ...(maxAmount !== null ? { lte: maxAmount } : {}) } } : {}),
      ...(tag ? { tags: { contains: tag } } : {}),
      ...(search
        ? {
            OR: [
              { description: { contains: search } },
              { tags: { contains: search } },
              { notes: { contains: search } },
              { category: { name: { contains: search } } },
            ],
          }
        : {}),
    },
    include: { account: true, transferAccount: true, category: true, attachments: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  res.json({ transactions: transactions.map(serializeTransaction) });
});

app.post("/api/transactions", auth, async (req: AuthRequest, res, next) => {
  try {
    const body = transactionSchema.parse(req.body);
    await validateTransactionLinks(req.userId!, body.accountId, body.transferAccountId, body.categoryId);
    const created = await createTransactionWithInstallments(req.userId!, body);
    res.status(201).json({
      transaction: serializeTransaction(created[0]),
      transactions: created.map(serializeTransaction),
    });
  } catch (error) {
    next(error);
  }
});

app.put("/api/transactions/:id", auth, async (req: AuthRequest, res, next) => {
  try {
    const body = transactionSchema.parse(req.body);
    const id = paramId(req);
    await assertOwner("transaction", id, req.userId!);
    await validateTransactionLinks(req.userId!, body.accountId, body.transferAccountId, body.categoryId);
    const transaction = await prisma.transaction.update({
      where: { id },
      data: transactionData(req.userId!, body),
      include: { account: true, transferAccount: true, category: true, attachments: true },
    });
    res.json({ transaction: serializeTransaction(transaction) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/transactions/:id", auth, async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req);
    await assertOwner("transaction", id, req.userId!);
    await prisma.transaction.delete({ where: { id } });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/transactions/:id/attachments", auth, async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req);
    await assertOwner("transaction", id, req.userId!);
    const body = attachmentSchema.parse(req.body);
    const attachment = await prisma.attachment.create({
      data: {
        userId: req.userId!,
        transactionId: id,
        fileName: body.fileName,
        mimeType: body.mimeType,
        size: body.size,
        contentBase64: body.contentBase64,
      },
    });
    res.status(201).json({ attachment: serializeAttachment(attachment, false) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/attachments/:id/download", auth, async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req);
    const attachment = await prisma.attachment.findFirst({ where: { id, userId: req.userId } });
    if (!attachment) throw new Error("not-found");
    const buffer = Buffer.from(attachment.contentBase64, "base64");
    res.setHeader("Content-Type", attachment.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(attachment.fileName)}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

app.post("/api/import/transactions", auth, async (req: AuthRequest, res, next) => {
  try {
    const body = importTransactionSchema.parse(req.body);
    const accounts = await prisma.account.findMany({ where: { userId: req.userId, archived: false }, orderBy: { createdAt: "asc" } });
    const accountId = body.accountId || accounts[0]?.id;
    if (!accountId) return res.status(400).json({ error: "Cadastre uma conta antes de importar." });
    await validateTransactionLinks(req.userId!, accountId, null, null);
    const categories = await prisma.category.findMany({ where: { userId: req.userId } });
    const created = [];

    for (const row of body.rows) {
      const type = row.type || (row.amount >= 0 ? "income" : "expense");
      const amount = Math.abs(row.amount);
      const category = guessCategory(categories, row.categoryName || row.description, type);
      const transaction = await prisma.transaction.create({
        data: {
          userId: req.userId!,
          accountId,
          categoryId: category?.id || null,
          type: toTransactionType(type),
          status: "PAID",
          description: row.description,
          amountCents: Math.round(amount * 100),
          date: parseDate(row.date),
          tags: row.tags || "importado",
          notes: "Importado via CSV",
        },
        include: { account: true, transferAccount: true, category: true, attachments: true },
      });
      created.push(transaction);
    }

    res.status(201).json({ imported: created.length, transactions: created.map(serializeTransaction) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/budgets", auth, async (req: AuthRequest, res) => {
  const month = typeof req.query.month === "string" ? req.query.month : currentMonth();
  const budgets = await prisma.budget.findMany({
    where: { userId: req.userId, month },
    include: { category: true },
    orderBy: { createdAt: "asc" },
  });
  const spentByCategory = await expenseTotalsByCategory(req.userId!, month);
  res.json({
    budgets: budgets.map((budget) => serializeBudget(budget, spentByCategory.get(budget.categoryId) || 0)),
  });
});

app.post("/api/budgets", auth, async (req: AuthRequest, res, next) => {
  try {
    const body = budgetSchema.parse(req.body);
    await validateCategory(req.userId!, body.categoryId, "EXPENSE");
    const budget = await prisma.budget.upsert({
      where: { userId_categoryId_month: { userId: req.userId!, categoryId: body.categoryId, month: body.month } },
      create: { userId: req.userId!, categoryId: body.categoryId, month: body.month, limitCents: body.limit },
      update: { limitCents: body.limit },
      include: { category: true },
    });
    res.status(201).json({ budget: serializeBudget(budget, 0) });
  } catch (error) {
    next(error);
  }
});

app.put("/api/budgets/:id", auth, async (req: AuthRequest, res, next) => {
  try {
    const body = budgetSchema.parse(req.body);
    const id = paramId(req);
    await assertOwner("budget", id, req.userId!);
    await validateCategory(req.userId!, body.categoryId, "EXPENSE");
    const budget = await prisma.budget.update({
      where: { id },
      data: { categoryId: body.categoryId, month: body.month, limitCents: body.limit },
      include: { category: true },
    });
    res.json({ budget: serializeBudget(budget, 0) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/budgets/:id", auth, async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req);
    await assertOwner("budget", id, req.userId!);
    await prisma.budget.delete({ where: { id } });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/goals", auth, async (req: AuthRequest, res) => {
  const goals = await prisma.goal.findMany({ where: { userId: req.userId }, orderBy: { dueDate: "asc" } });
  res.json({ goals: goals.map(serializeGoal) });
});

app.post("/api/goals", auth, async (req: AuthRequest, res, next) => {
  try {
    const body = goalSchema.parse(req.body);
    const goal = await prisma.goal.create({ data: goalData(req.userId!, body) });
    res.status(201).json({ goal: serializeGoal(goal) });
  } catch (error) {
    next(error);
  }
});

app.put("/api/goals/:id", auth, async (req: AuthRequest, res, next) => {
  try {
    const body = goalSchema.parse(req.body);
    const id = paramId(req);
    await assertOwner("goal", id, req.userId!);
    const goal = await prisma.goal.update({ where: { id }, data: goalData(req.userId!, body) });
    res.json({ goal: serializeGoal(goal) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/goals/:id", auth, async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req);
    await assertOwner("goal", id, req.userId!);
    await prisma.goal.delete({ where: { id } });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/recurring", auth, async (req: AuthRequest, res) => {
  const recurring = await prisma.recurring.findMany({
    where: { userId: req.userId },
    include: { account: true, category: true },
    orderBy: { nextDate: "asc" },
  });
  res.json({ recurring: recurring.map(serializeRecurring) });
});

app.post("/api/recurring", auth, async (req: AuthRequest, res, next) => {
  try {
    const body = recurringSchema.parse(req.body);
    await validateTransactionLinks(req.userId!, body.accountId, null, body.categoryId);
    const item = await prisma.recurring.create({
      data: recurringData(req.userId!, body),
      include: { account: true, category: true },
    });
    res.status(201).json({ recurring: serializeRecurring(item) });
  } catch (error) {
    next(error);
  }
});

app.put("/api/recurring/:id", auth, async (req: AuthRequest, res, next) => {
  try {
    const body = recurringSchema.parse(req.body);
    const id = paramId(req);
    await assertOwner("recurring", id, req.userId!);
    await validateTransactionLinks(req.userId!, body.accountId, null, body.categoryId);
    const item = await prisma.recurring.update({
      where: { id },
      data: recurringData(req.userId!, body),
      include: { account: true, category: true },
    });
    res.json({ recurring: serializeRecurring(item) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/recurring/:id/run", auth, async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req);
    await assertOwner("recurring", id, req.userId!);
    const item = await prisma.recurring.findUniqueOrThrow({ where: { id } });
    const nextDate = nextRecurringDate(item.nextDate, item.frequency);
    const transaction = await prisma.transaction.create({
      data: {
        userId: req.userId!,
        accountId: item.accountId,
        categoryId: item.categoryId,
        type: item.type,
        status: "PAID" as const,
        description: item.description,
        amountCents: item.amountCents,
        date: item.nextDate,
        tags: "recorrente",
      },
      include: { account: true, transferAccount: true, category: true, attachments: true },
    });
    await prisma.recurring.update({ where: { id: item.id }, data: { nextDate } });
    res.json({ transaction: serializeTransaction(transaction), nextDate: formatDateOnly(nextDate) });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/recurring/:id", auth, async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req);
    await assertOwner("recurring", id, req.userId!);
    await prisma.recurring.delete({ where: { id } });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/notifications", auth, async (req: AuthRequest, res) => {
  const month = typeof req.query.month === "string" ? req.query.month : currentMonth();
  const notifications = await buildNotifications(req.userId!, month);
  res.json({ notifications });
});

app.get("/api/net-worth", auth, async (req: AuthRequest, res) => {
  const accounts = await prisma.account.findMany({ where: { userId: req.userId, archived: false }, orderBy: { createdAt: "asc" } });
  const balances = await accountBalances(req.userId!);
  const items = accounts.map((account) => {
    const balanceCents = balances.get(account.id) ?? account.initialBalanceCents;
    const isDebt = account.type === "CREDIT" && balanceCents < 0;
    return {
      ...serializeAccount(account),
      balance: centsToMoney(balanceCents),
      asset: centsToMoney(isDebt ? 0 : Math.max(balanceCents, 0)),
      debt: centsToMoney(isDebt ? Math.abs(balanceCents) : 0),
    };
  });
  const assetCents = items.reduce((sum, item) => sum + Math.round(item.asset * 100), 0);
  const debtCents = items.reduce((sum, item) => sum + Math.round(item.debt * 100), 0);
  res.json({
    asset: centsToMoney(assetCents),
    debt: centsToMoney(debtCents),
    netWorth: centsToMoney(assetCents - debtCents),
    accounts: items,
  });
});

app.get("/api/dashboard", auth, async (req: AuthRequest, res) => {
  const month = typeof req.query.month === "string" ? req.query.month : currentMonth();
  const [accounts, transactions, budgets, goals, recurring, notifications] = await Promise.all([
    prisma.account.findMany({ where: { userId: req.userId, archived: false }, orderBy: { createdAt: "asc" } }),
    monthTransactions(req.userId!, month),
    prisma.budget.findMany({ where: { userId: req.userId, month }, include: { category: true } }),
    prisma.goal.findMany({ where: { userId: req.userId }, orderBy: { dueDate: "asc" } }),
    prisma.recurring.findMany({ where: { userId: req.userId, active: true }, include: { account: true, category: true }, orderBy: { nextDate: "asc" } }),
    buildNotifications(req.userId!, month),
  ]);

  const balances = await accountBalances(req.userId!);
  const paid = transactions.filter((item) => item.status === "PAID");
  const incomeCents = paid.filter((item) => item.type === "INCOME").reduce((sum, item) => sum + item.amountCents, 0);
  const expenseCents = paid.filter((item) => item.type === "EXPENSE").reduce((sum, item) => sum + item.amountCents, 0);
  const totalBalanceCents = accounts.reduce((sum, account) => sum + (balances.get(account.id) ?? account.initialBalanceCents), 0);
  const categoryTotals = categoryExpenseTotals(transactions);
  const spentByCategory = await expenseTotalsByCategory(req.userId!, month);

  res.json({
    metrics: {
      balance: centsToMoney(totalBalanceCents),
      income: centsToMoney(incomeCents),
      expense: centsToMoney(expenseCents),
      savingsRate: incomeCents > 0 ? Math.round(((incomeCents - expenseCents) / incomeCents) * 100) : 0,
      forecast: centsToMoney(totalBalanceCents + forecastCents(recurring, month)),
    },
    accounts: accounts.map((account) => ({ ...serializeAccount(account), balance: centsToMoney(balances.get(account.id) ?? 0) })),
    cashflow: cashflowSeries(transactions, month),
    categories: categoryTotals.map((item) => ({ ...item, value: centsToMoney(item.valueCents) })),
    budgets: budgets.map((budget) => serializeBudget(budget, spentByCategory.get(budget.categoryId) || 0)),
    goals: goals.map(serializeGoal),
    recurring: recurring.slice(0, 6).map(serializeRecurring),
    recent: transactions.slice(0, 8).map(serializeTransaction),
    notifications,
    health: financialHealth(incomeCents, expenseCents, notifications),
    cards: creditCardSummaries(accounts, transactions),
  });
});

app.get("/api/reports", auth, async (req: AuthRequest, res) => {
  const month = typeof req.query.month === "string" ? req.query.month : currentMonth();
  const months = Array.from({ length: 6 }, (_, index) => format(subMonths(parseMonth(month), 5 - index), "yyyy-MM"));
  const series = [];
  for (const entry of months) {
    const transactions = await monthTransactions(req.userId!, entry);
    const incomeCents = transactions.filter((item) => item.type === "INCOME").reduce((sum, item) => sum + item.amountCents, 0);
    const expenseCents = transactions.filter((item) => item.type === "EXPENSE").reduce((sum, item) => sum + item.amountCents, 0);
    series.push({ month: entry, income: centsToMoney(incomeCents), expense: centsToMoney(expenseCents), balance: centsToMoney(incomeCents - expenseCents) });
  }
  const current = await monthTransactions(req.userId!, month);
  const previousMonth = format(subMonths(parseMonth(month), 1), "yyyy-MM");
  const previous = await monthTransactions(req.userId!, previousMonth);
  const currentIncome = current.filter((item) => item.type === "INCOME").reduce((sum, item) => sum + item.amountCents, 0);
  const currentExpense = current.filter((item) => item.type === "EXPENSE").reduce((sum, item) => sum + item.amountCents, 0);
  const previousIncome = previous.filter((item) => item.type === "INCOME").reduce((sum, item) => sum + item.amountCents, 0);
  const previousExpense = previous.filter((item) => item.type === "EXPENSE").reduce((sum, item) => sum + item.amountCents, 0);
  const averages = {
    income: centsToMoney(series.reduce((sum, item) => sum + Math.round(item.income * 100), 0) / Math.max(series.length, 1)),
    expense: centsToMoney(series.reduce((sum, item) => sum + Math.round(item.expense * 100), 0) / Math.max(series.length, 1)),
    balance: centsToMoney(series.reduce((sum, item) => sum + Math.round(item.balance * 100), 0) / Math.max(series.length, 1)),
  };
  res.json({
    trend: series,
    comparison: {
      incomeDelta: centsToMoney(currentIncome - previousIncome),
      expenseDelta: centsToMoney(currentExpense - previousExpense),
      balanceDelta: centsToMoney((currentIncome - currentExpense) - (previousIncome - previousExpense)),
    },
    averages,
    topCategories: categoryExpenseTotals(current).slice(0, 8).map((item) => ({ ...item, value: centsToMoney(item.valueCents) })),
  });
});

app.put("/api/settings", auth, async (req: AuthRequest, res, next) => {
  try {
    const body = settingsSchema.parse(req.body);
    const user = await prisma.user.update({ where: { id: req.userId }, data: { currency: body.currency.toUpperCase() } });
    res.json({ user: serializeUser(user) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/export", auth, async (req: AuthRequest, res) => {
  const [user, accounts, categories, transactions, budgets, goals, recurring] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: req.userId } }),
    prisma.account.findMany({ where: { userId: req.userId } }),
    prisma.category.findMany({ where: { userId: req.userId } }),
    prisma.transaction.findMany({ where: { userId: req.userId }, include: { account: true, transferAccount: true, category: true, attachments: true } }),
    prisma.budget.findMany({ where: { userId: req.userId }, include: { category: true } }),
    prisma.goal.findMany({ where: { userId: req.userId } }),
    prisma.recurring.findMany({ where: { userId: req.userId }, include: { account: true, category: true } }),
  ]);
  res.json({
    exportedAt: new Date().toISOString(),
    user: serializeUser(user),
    accounts: accounts.map(serializeAccount),
    categories: categories.map(serializeCategory),
    transactions: transactions.map(serializeTransaction),
    budgets: budgets.map((budget) => serializeBudget(budget, 0)),
    goals: goals.map(serializeGoal),
    recurring: recurring.map(serializeRecurring),
  });
});

app.use(express.static(clientDist));
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  const indexPath = path.join(clientDist, "index.html");
  res.sendFile(indexPath, (error) => {
    if (error) next();
  });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ error: "Dados inválidos.", details: error.flatten() });
  }
  if (error instanceof Error && error.message === "same-account") {
    return res.status(400).json({ error: "Escolha contas diferentes para a transferência." });
  }
  if (error instanceof Error && error.message === "email-in-use") {
    return res.status(409).json({ error: "Este e-mail já está cadastrado." });
  }
  if (error instanceof Error && error.message === "not-found") {
    return res.status(404).json({ error: "Registro não encontrado." });
  }
  console.error(error);
  res.status(500).json({ error: "Erro interno do servidor." });
});

ensureDatabase()
  .then(() => {
    app.listen(port, "0.0.0.0", () => {
      console.log(`Finora API em http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Falha ao preparar o banco de dados", error);
    process.exit(1);
  });

function auth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Não autenticado." });

  try {
    const decoded = jwt.verify(token, jwtSecret) as { sub: string };
    req.userId = decoded.sub;
    next();
  } catch {
    res.status(401).json({ error: "Sessão expirada." });
  }
}

function paramId(req: Request) {
  const value = req.params.id;
  if (Array.isArray(value)) return value[0];
  return value;
}

function signToken(userId: string) {
  return jwt.sign({}, jwtSecret, { subject: userId, expiresIn: "30d" });
}

async function createUserWithDefaults(body: z.infer<typeof authCreateSchema>) {
  const email = body.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("email-in-use");

  const passwordHash = await bcrypt.hash(body.password, 12);
  const user = await prisma.user.create({
    data: {
      name: body.name,
      email,
      passwordHash,
    },
  });

  await createDefaultCategories(user.id);
  if (body.seedDemo) await createDemoData(user.id);
  return user;
}

async function createDefaultCategories(userId: string) {
  const expense = [
    ["Moradia", "#0f8f88"],
    ["Alimentação", "#f97316"],
    ["Transporte", "#3266c7"],
    ["Saúde", "#168a4a"],
    ["Educação", "#7257c5"],
    ["Lazer", "#e05c9f"],
    ["Assinaturas", "#c98214"],
    ["Compras", "#d84a3a"],
    ["Impostos", "#64748b"],
    ["Outros", "#697570"],
  ];
  const income = [
    ["Salário", "#168a4a"],
    ["Freelance", "#0f8f88"],
    ["Investimentos", "#7257c5"],
    ["Reembolso", "#3266c7"],
    ["Outros", "#697570"],
  ];

  await prisma.category.createMany({
    data: [
      ...expense.map(([name, color]) => ({ userId, name, color, type: "EXPENSE" as const })),
      ...income.map(([name, color]) => ({ userId, name, color, type: "INCOME" as const })),
    ],
  });
}

async function createDemoData(userId: string) {
  const categories = await prisma.category.findMany({ where: { userId } });
  const category = (name: string) => categories.find((item) => item.name === name)?.id;
  const month = currentMonth();
  const previous = format(subMonths(parseMonth(month), 1), "yyyy-MM");

  const [main, card, investments] = await prisma.$transaction([
    prisma.account.create({ data: { userId, name: "Conta principal", type: "CHECKING", initialBalanceCents: 420000, color: "#0f8f88" } }),
    prisma.account.create({ data: { userId, name: "Cartão de crédito", type: "CREDIT", initialBalanceCents: 0, color: "#d84a3a" } }),
    prisma.account.create({ data: { userId, name: "Investimentos", type: "INVESTMENT", initialBalanceCents: 850000, color: "#7257c5" } }),
  ]);

  await prisma.transaction.createMany({
    data: [
      demoTx(userId, main.id, category("Salário"), "INCOME", "Salário", 720000, `${month}-05`),
      demoTx(userId, main.id, category("Moradia"), "EXPENSE", "Aluguel", 185000, `${month}-06`),
      demoTx(userId, card.id, category("Alimentação"), "EXPENSE", "Mercado", 61275, `${month}-07`),
      { ...demoTx(userId, main.id, category("Investimentos"), "TRANSFER", "Aplicação mensal", 90000, `${month}-09`), transferAccountId: investments.id },
      demoTx(userId, card.id, category("Saúde"), "EXPENSE", "Academia", 13990, `${month}-11`),
      demoTx(userId, main.id, category("Assinaturas"), "EXPENSE", "Internet", 11990, `${month}-14`),
      demoTx(userId, main.id, category("Freelance"), "INCOME", "Freelance", 145000, `${month}-18`),
      demoTx(userId, main.id, category("Salário"), "INCOME", "Salário", 720000, `${previous}-05`),
      demoTx(userId, main.id, category("Moradia"), "EXPENSE", "Aluguel", 185000, `${previous}-06`),
      demoTx(userId, card.id, category("Alimentação"), "EXPENSE", "Mercado", 72020, `${previous}-10`),
    ],
  });

  await prisma.budget.createMany({
    data: [
      { userId, categoryId: category("Alimentação")!, month, limitCents: 120000 },
      { userId, categoryId: category("Lazer")!, month, limitCents: 65000 },
      { userId, categoryId: category("Assinaturas")!, month, limitCents: 28000 },
      { userId, categoryId: category("Transporte")!, month, limitCents: 50000 },
    ],
  });

  await prisma.goal.createMany({
    data: [
      { userId, name: "Reserva de emergência", targetCents: 3000000, savedCents: 1250000, dueDate: addMonths(new Date(), 12), color: "#0f8f88" },
      { userId, name: "Viagem", targetCents: 900000, savedCents: 280000, dueDate: addMonths(new Date(), 7), color: "#f97316" },
    ],
  });

  await prisma.recurring.createMany({
    data: [
      { userId, accountId: main.id, categoryId: category("Moradia"), type: "EXPENSE", description: "Aluguel", amountCents: 185000, frequency: "MONTHLY", nextDate: parseDate(`${month}-05`) },
      { userId, accountId: main.id, categoryId: category("Salário"), type: "INCOME", description: "Salário", amountCents: 720000, frequency: "MONTHLY", nextDate: addMonths(parseDate(`${month}-05`), 1) },
    ],
  });
}

function demoTx(userId: string, accountId: string, categoryId: string | undefined, type: TransactionType, description: string, amountCents: number, date: string) {
  return { userId, accountId, categoryId, type, description, amountCents, date: parseDate(date), status: "PAID" as const };
}

async function assertOwner(model: "account" | "transaction" | "budget" | "goal" | "recurring", id: string, userId: string) {
  const delegates = {
    account: prisma.account,
    transaction: prisma.transaction,
    budget: prisma.budget,
    goal: prisma.goal,
    recurring: prisma.recurring,
  } as const;
  const item = await (delegates[model] as any).findFirst({ where: { id, userId } });
  if (!item) throw new Error("not-found");
}

async function validateTransactionLinks(userId: string, accountId: string, transferAccountId?: string | null, categoryId?: string | null) {
  const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
  if (!account) throw new Error("not-found");
  if (transferAccountId) {
    const target = await prisma.account.findFirst({ where: { id: transferAccountId, userId } });
    if (!target) throw new Error("not-found");
    if (target.id === accountId) throw new Error("same-account");
  }
  if (categoryId) {
    const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!category) throw new Error("not-found");
  }
}

async function validateCategory(userId: string, categoryId: string, type: "EXPENSE" | "INCOME") {
  const category = await prisma.category.findFirst({ where: { id: categoryId, userId, type } });
  if (!category) throw new Error("not-found");
}

async function monthTransactions(userId: string, month: string) {
  const { gte, lt } = monthBounds(month);
  return prisma.transaction.findMany({
    where: { userId, date: { gte, lt } },
    include: { account: true, transferAccount: true, category: true, attachments: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
}

async function accountBalances(userId: string) {
  const accounts = await prisma.account.findMany({ where: { userId } });
  const balances = new Map(accounts.map((account) => [account.id, account.initialBalanceCents]));
  const transactions = await prisma.transaction.findMany({ where: { userId, status: "PAID" } });

  for (const item of transactions) {
    if (item.type === "INCOME") balances.set(item.accountId, (balances.get(item.accountId) || 0) + item.amountCents);
    if (item.type === "EXPENSE") balances.set(item.accountId, (balances.get(item.accountId) || 0) - item.amountCents);
    if (item.type === "TRANSFER") {
      balances.set(item.accountId, (balances.get(item.accountId) || 0) - item.amountCents);
      if (item.transferAccountId) balances.set(item.transferAccountId, (balances.get(item.transferAccountId) || 0) + item.amountCents);
    }
  }
  return balances;
}

async function expenseTotalsByCategory(userId: string, month: string) {
  const transactions = await monthTransactions(userId, month);
  const totals = new Map<string, number>();
  transactions
    .filter((item) => item.type === "EXPENSE")
    .forEach((item) => {
      if (item.categoryId) totals.set(item.categoryId, (totals.get(item.categoryId) || 0) + item.amountCents);
    });
  return totals;
}

function categoryExpenseTotals(transactions: Awaited<ReturnType<typeof monthTransactions>>) {
  const totals = new Map<string, { name: string; color: string; valueCents: number }>();
  transactions
    .filter((item) => item.type === "EXPENSE")
    .forEach((item) => {
      const key = item.category?.id || "uncategorized";
      const current = totals.get(key) || { name: item.category?.name || "Sem categoria", color: item.category?.color || "#697570", valueCents: 0 };
      current.valueCents += item.amountCents;
      totals.set(key, current);
    });
  return Array.from(totals.values()).sort((a, b) => b.valueCents - a.valueCents);
}

function cashflowSeries(transactions: Awaited<ReturnType<typeof monthTransactions>>, month: string) {
  const days = new Date(parseMonth(month).getFullYear(), parseMonth(month).getMonth() + 1, 0).getDate();
  let running = 0;
  const chronological = [...transactions].reverse().filter((item) => item.status === "PAID");
  return Array.from({ length: days }, (_, index) => {
    const day = index + 1;
    const date = `${month}-${String(day).padStart(2, "0")}`;
    chronological
      .filter((item) => formatDateOnly(item.date) === date)
      .forEach((item) => {
        if (item.type === "INCOME") running += item.amountCents;
        if (item.type === "EXPENSE") running -= item.amountCents;
      });
    return { date, balance: centsToMoney(running) };
  });
}

function forecastCents(recurring: Array<{ type: TransactionType; amountCents: number; nextDate: Date }>, month: string) {
  const today = new Date();
  const { lt } = monthBounds(month);
  return recurring
    .filter((item) => item.nextDate >= today && item.nextDate < lt)
    .reduce((sum, item) => sum + (item.type === "INCOME" ? item.amountCents : -item.amountCents), 0);
}

async function buildNotifications(userId: string, month: string) {
  const notifications: Array<{ id: string; type: string; tone: string; title: string; body: string }> = [];
  const [budgets, recurring, goals] = await Promise.all([
    prisma.budget.findMany({ where: { userId, month }, include: { category: true } }),
    prisma.recurring.findMany({ where: { userId, active: true }, include: { account: true, category: true }, orderBy: { nextDate: "asc" } }),
    prisma.goal.findMany({ where: { userId }, orderBy: { dueDate: "asc" } }),
  ]);
  const spentByCategory = await expenseTotalsByCategory(userId, month);

  budgets.forEach((budget) => {
    const spent = spentByCategory.get(budget.categoryId) || 0;
    const percent = budget.limitCents > 0 ? (spent / budget.limitCents) * 100 : 0;
    if (percent >= 100) {
      notifications.push({
        id: `budget-over-${budget.id}`,
        type: "budget",
        tone: "danger",
        title: `${budget.category.name} estourou o orçamento`,
        body: `${Math.round(percent)}% usado neste mês.`,
      });
    } else if (percent >= 85) {
      notifications.push({
        id: `budget-near-${budget.id}`,
        type: "budget",
        tone: "warning",
        title: `${budget.category.name} perto do limite`,
        body: `${Math.round(percent)}% usado neste mês.`,
      });
    }
  });

  const today = new Date();
  recurring
    .filter((item) => differenceInCalendarDays(item.nextDate, today) >= 0 && differenceInCalendarDays(item.nextDate, today) <= 7)
    .slice(0, 6)
    .forEach((item) => {
      notifications.push({
        id: `recurring-${item.id}`,
        type: "recurring",
        tone: item.type === "INCOME" ? "good" : "warning",
        title: `${item.description} vence em breve`,
        body: `${formatDateOnly(item.nextDate)} em ${item.account.name}.`,
      });
    });

  goals
    .filter((goal) => differenceInCalendarDays(goal.dueDate, today) <= 30 && goal.savedCents < goal.targetCents)
    .slice(0, 4)
    .forEach((goal) => {
      notifications.push({
        id: `goal-${goal.id}`,
        type: "goal",
        tone: "warning",
        title: `Meta ${goal.name} precisa de atenção`,
        body: `Prazo em ${formatDateOnly(goal.dueDate)}.`,
      });
    });

  return notifications.slice(0, 12);
}

function financialHealth(incomeCents: number, expenseCents: number, notifications: Array<{ tone: string }>) {
  const savingsRate = incomeCents > 0 ? (incomeCents - expenseCents) / incomeCents : 0;
  const dangerCount = notifications.filter((item) => item.tone === "danger").length;
  const warningCount = notifications.filter((item) => item.tone === "warning").length;
  const score = Math.max(0, Math.min(100, Math.round(55 + savingsRate * 65 - dangerCount * 12 - warningCount * 5)));
  return {
    score,
    label: score >= 80 ? "Excelente" : score >= 60 ? "Estável" : score >= 40 ? "Atenção" : "Crítico",
  };
}

function creditCardSummaries(accounts: Array<{ id: string; type: string; name: string; creditLimitCents: number; dueDay: number | null; closingDay: number | null }>, transactions: Awaited<ReturnType<typeof monthTransactions>>) {
  return accounts
    .filter((account) => account.type === "CREDIT")
    .map((account) => {
      const spentCents = transactions
        .filter((item) => item.accountId === account.id && item.type === "EXPENSE")
        .reduce((sum, item) => sum + item.amountCents, 0);
      return {
        id: account.id,
        name: account.name,
        invoice: centsToMoney(spentCents),
        limit: centsToMoney(account.creditLimitCents || 0),
        available: centsToMoney(Math.max(0, (account.creditLimitCents || 0) - spentCents)),
        dueDay: account.dueDay,
        closingDay: account.closingDay,
      };
    });
}

function guessCategory(categories: Array<{ id: string; name: string; type: string }>, text: string, type: "income" | "expense") {
  const normalized = normalize(text);
  const typed = categories.filter((item) => item.type === toCategoryType(type));
  const direct = typed.find((item) => normalized.includes(normalize(item.name)));
  if (direct) return direct;
  const rules: Array<[string, string[]]> = [
    ["alimentação", ["mercado", "restaurante", "ifood", "padaria", "supermercado"]],
    ["transporte", ["uber", "99", "combust", "posto", "metro", "ônibus", "onibus"]],
    ["moradia", ["aluguel", "condom", "energia", "luz", "água", "agua"]],
    ["saúde", ["farmacia", "farmácia", "medico", "médico", "academia", "consulta"]],
    ["assinaturas", ["netflix", "spotify", "internet", "prime", "assinatura"]],
    ["salário", ["salario", "salário", "folha", "pagamento"]],
  ];
  for (const [categoryName, keywords] of rules) {
    if (keywords.some((keyword) => normalized.includes(normalize(keyword)))) {
      const found = typed.find((item) => normalize(item.name) === normalize(categoryName));
      if (found) return found;
    }
  }
  return typed.find((item) => normalize(item.name) === "outros") || typed[0];
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function toCategoryType(type: "income" | "expense") {
  return type === "income" ? "INCOME" : "EXPENSE";
}

async function createTransactionWithInstallments(userId: string, body: z.infer<typeof transactionSchema>) {
  const total = body.type === "expense" ? Math.max(1, body.installmentTotal || 1) : 1;
  const groupId = total > 1 ? uid() : null;
  const transactions = [];
  for (let index = 0; index < total; index += 1) {
    const date = addMonths(parseDate(body.date), index);
    const data = transactionData(userId, {
      ...body,
      date: formatDateOnly(date),
      description: total > 1 ? `${body.description} (${index + 1}/${total})` : body.description,
      installmentTotal: total,
    });
    transactions.push(
      await prisma.transaction.create({
        data: {
          ...data,
          installmentGroupId: groupId,
          installmentNumber: total > 1 ? index + 1 : null,
          installmentTotal: total > 1 ? total : null,
          invoiceMonth: body.invoiceMonth || invoiceMonthForDate(date),
        },
        include: { account: true, transferAccount: true, category: true, attachments: true },
      })
    );
  }
  return transactions;
}

function transactionData(userId: string, body: z.infer<typeof transactionSchema>) {
  return {
    userId,
    accountId: body.accountId,
    transferAccountId: body.type === "transfer" ? body.transferAccountId || null : null,
    categoryId: body.categoryId || null,
    type: toTransactionType(body.type),
    status: body.status === "paid" ? ("PAID" as const) : ("PENDING" as const),
    description: body.description,
    amountCents: body.amount,
    date: parseDate(body.date),
    tags: body.tags || "",
    notes: body.notes || "",
    invoiceMonth: body.invoiceMonth || invoiceMonthForDate(parseDate(body.date)),
  };
}

function goalData(userId: string, body: z.infer<typeof goalSchema>) {
  return {
    userId,
    name: body.name,
    targetCents: body.target,
    savedCents: body.saved,
    dueDate: parseDate(body.dueDate),
    color: body.color,
  };
}

function recurringData(userId: string, body: z.infer<typeof recurringSchema>) {
  return {
    userId,
    accountId: body.accountId,
    categoryId: body.categoryId || null,
    type: toTransactionType(body.type),
    description: body.description,
    amountCents: body.amount,
    frequency: body.frequency.toUpperCase() as "WEEKLY" | "MONTHLY" | "YEARLY",
    nextDate: parseDate(body.nextDate),
    active: body.active,
  };
}

function nextRecurringDate(date: Date, frequency: "WEEKLY" | "MONTHLY" | "YEARLY") {
  if (frequency === "WEEKLY") return addWeeks(date, 1);
  if (frequency === "MONTHLY") return addMonths(date, 1);
  return addYears(date, 1);
}

function toAccountType(type: string) {
  return type.toUpperCase() as "CHECKING" | "SAVINGS" | "CASH" | "CREDIT" | "INVESTMENT";
}

function toTransactionType(type: string) {
  return type.toUpperCase() as "INCOME" | "EXPENSE" | "TRANSFER";
}

function serializeUser(user: { id: string; name: string; email: string; currency: string }) {
  return { id: user.id, name: user.name, email: user.email, currency: user.currency };
}

function serializeAccount(account: any) {
  return {
    id: account.id,
    name: account.name,
    type: String(account.type).toLowerCase(),
    initialBalance: centsToMoney(account.initialBalanceCents),
    creditLimit: centsToMoney(account.creditLimitCents || 0),
    closingDay: account.closingDay,
    dueDay: account.dueDay,
    color: account.color,
    shared: Boolean(account.shared),
  };
}

function serializeCategory(category: any) {
  return {
    id: category.id,
    name: category.name,
    type: String(category.type).toLowerCase(),
    color: category.color,
  };
}

function serializeTransaction(transaction: any) {
  return {
    id: transaction.id,
    accountId: transaction.accountId,
    transferAccountId: transaction.transferAccountId,
    categoryId: transaction.categoryId,
    type: String(transaction.type).toLowerCase(),
    status: String(transaction.status).toLowerCase(),
    description: transaction.description,
    amount: centsToMoney(transaction.amountCents),
    date: formatDateOnly(transaction.date),
    tags: transaction.tags,
    notes: transaction.notes,
    installmentGroupId: transaction.installmentGroupId,
    installmentNumber: transaction.installmentNumber,
    installmentTotal: transaction.installmentTotal,
    invoiceMonth: transaction.invoiceMonth,
    account: transaction.account ? serializeAccount(transaction.account) : null,
    transferAccount: transaction.transferAccount ? serializeAccount(transaction.transferAccount) : null,
    category: transaction.category ? serializeCategory(transaction.category) : null,
    attachments: Array.isArray(transaction.attachments) ? transaction.attachments.map((item: any) => serializeAttachment(item, false)) : [],
  };
}

function serializeAttachment(attachment: any, includeContent = false) {
  return {
    id: attachment.id,
    transactionId: attachment.transactionId,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    createdAt: attachment.createdAt,
    ...(includeContent ? { contentBase64: attachment.contentBase64 } : {}),
  };
}

function serializeBudget(budget: any, spentCents: number) {
  return {
    id: budget.id,
    categoryId: budget.categoryId,
    month: budget.month,
    limit: centsToMoney(budget.limitCents),
    spent: centsToMoney(spentCents),
    category: budget.category ? serializeCategory(budget.category) : null,
  };
}

function serializeGoal(goal: any) {
  return {
    id: goal.id,
    name: goal.name,
    target: centsToMoney(goal.targetCents),
    saved: centsToMoney(goal.savedCents),
    dueDate: formatDateOnly(goal.dueDate),
    color: goal.color,
  };
}

function serializeRecurring(item: any) {
  return {
    id: item.id,
    accountId: item.accountId,
    categoryId: item.categoryId,
    type: String(item.type).toLowerCase(),
    description: item.description,
    amount: centsToMoney(item.amountCents),
    frequency: String(item.frequency).toLowerCase(),
    nextDate: formatDateOnly(item.nextDate),
    active: item.active,
    account: item.account ? serializeAccount(item.account) : null,
    category: item.category ? serializeCategory(item.category) : null,
  };
}

function monthBounds(month: string) {
  const start = parseMonth(month);
  return { gte: start, lt: addMonths(start, 1) };
}

function customDateBounds(dateFrom: string, dateTo: string, fallbackMonth: string) {
  const month = monthBounds(fallbackMonth);
  return {
    gte: dateFrom ? parseDate(dateFrom) : month.gte,
    lt: dateTo ? addDays(parseDate(dateTo), 1) : month.lt,
  };
}

function parseMonth(month: string) {
  const [year, index] = month.split("-").map(Number);
  return startOfMonth(new Date(year, index - 1, 1));
}

function parseDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateOnly(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function currentMonth() {
  return format(new Date(), "yyyy-MM");
}

function invoiceMonthForDate(date: Date) {
  return format(date, "yyyy-MM");
}

function centsToMoney(cents: number) {
  return Math.round(cents) / 100;
}

function uid() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function ensureDatabase() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "currency" TEXT NOT NULL DEFAULT 'BRL',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "Account" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "initialBalanceCents" INTEGER NOT NULL DEFAULT 0,
      "creditLimitCents" INTEGER NOT NULL DEFAULT 0,
      "closingDay" INTEGER,
      "dueDay" INTEGER,
      "color" TEXT NOT NULL DEFAULT '#0f8f88',
      "archived" BOOLEAN NOT NULL DEFAULT false,
      "shared" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "Category" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "color" TEXT NOT NULL DEFAULT '#0f8f88',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "Transaction" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "accountId" TEXT NOT NULL,
      "transferAccountId" TEXT,
      "categoryId" TEXT,
      "type" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PAID',
      "description" TEXT NOT NULL,
      "amountCents" INTEGER NOT NULL,
      "date" DATETIME NOT NULL,
      "tags" TEXT NOT NULL DEFAULT '',
      "notes" TEXT NOT NULL DEFAULT '',
      "installmentGroupId" TEXT,
      "installmentNumber" INTEGER,
      "installmentTotal" INTEGER,
      "invoiceMonth" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "Transaction_transferAccountId_fkey" FOREIGN KEY ("transferAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "Attachment" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "transactionId" TEXT NOT NULL,
      "fileName" TEXT NOT NULL,
      "mimeType" TEXT NOT NULL,
      "size" INTEGER NOT NULL,
      "contentBase64" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Attachment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "Budget" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "categoryId" TEXT NOT NULL,
      "month" TEXT NOT NULL,
      "limitCents" INTEGER NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Budget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "Budget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "Goal" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "targetCents" INTEGER NOT NULL,
      "savedCents" INTEGER NOT NULL,
      "dueDate" DATETIME NOT NULL,
      "color" TEXT NOT NULL DEFAULT '#f97316',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "Recurring" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "accountId" TEXT NOT NULL,
      "categoryId" TEXT,
      "type" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "amountCents" INTEGER NOT NULL,
      "frequency" TEXT NOT NULL,
      "nextDate" DATETIME NOT NULL,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Recurring_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "Recurring_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "Recurring_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,
    `CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId")`,
    `CREATE INDEX IF NOT EXISTS "Category_userId_type_idx" ON "Category"("userId", "type")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Category_userId_name_type_key" ON "Category"("userId", "name", "type")`,
    `CREATE INDEX IF NOT EXISTS "Transaction_userId_date_idx" ON "Transaction"("userId", "date")`,
    `CREATE INDEX IF NOT EXISTS "Transaction_accountId_idx" ON "Transaction"("accountId")`,
    `CREATE INDEX IF NOT EXISTS "Transaction_categoryId_idx" ON "Transaction"("categoryId")`,
    `CREATE INDEX IF NOT EXISTS "Attachment_userId_idx" ON "Attachment"("userId")`,
    `CREATE INDEX IF NOT EXISTS "Attachment_transactionId_idx" ON "Attachment"("transactionId")`,
    `CREATE INDEX IF NOT EXISTS "Budget_userId_month_idx" ON "Budget"("userId", "month")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Budget_userId_categoryId_month_key" ON "Budget"("userId", "categoryId", "month")`,
    `CREATE INDEX IF NOT EXISTS "Goal_userId_idx" ON "Goal"("userId")`,
    `CREATE INDEX IF NOT EXISTS "Recurring_userId_nextDate_idx" ON "Recurring"("userId", "nextDate")`,
  ];

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  await ensureColumn("Account", "creditLimitCents", `INTEGER NOT NULL DEFAULT 0`);
  await ensureColumn("Account", "closingDay", `INTEGER`);
  await ensureColumn("Account", "dueDay", `INTEGER`);
  await ensureColumn("Account", "shared", `BOOLEAN NOT NULL DEFAULT false`);
  await ensureColumn("Transaction", "installmentGroupId", `TEXT`);
  await ensureColumn("Transaction", "installmentNumber", `INTEGER`);
  await ensureColumn("Transaction", "installmentTotal", `INTEGER`);
  await ensureColumn("Transaction", "invoiceMonth", `TEXT`);
}

async function ensureColumn(table: string, column: string, definition: string) {
  const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("${table}")`);
  if (!columns.some((item) => item.name === column)) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
  }
}
