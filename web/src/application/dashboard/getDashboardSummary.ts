import { Money } from '../../domain/finance/money'
import type { FinancialTransaction, Site, SiteId, WorkspaceSnapshot } from '../../domain/finance/models'

export interface DashboardSummary {
  income: Money
  expenses: Money
  profit: Money
  receivables: Money
  payables: Money
  bankBalance: Money
  cashBalance: Money
  recent: FinancialTransaction[]
  categories: Array<{ name: string; total: Money }>
  incomeBySource: Array<{ name: string; total: Money }>
  sitePerformance: Array<{ site: Site; income: Money; expenses: Money; profit: Money }>
  monthly: Array<{ month: string; income: Money; expenses: Money }>
}

export function getDashboardSummary(snapshot: WorkspaceSnapshot, siteId: SiteId | 'all'): DashboardSummary {
  const sites = siteId === 'all' ? snapshot.sites : snapshot.sites.filter((site) => site.id === siteId)
  const siteIds = new Set(sites.map((site) => site.id))
  const transactions = snapshot.transactions.filter((transaction) => siteIds.has(transaction.siteId))
  const payables = snapshot.payables.filter((payable) => siteIds.has(payable.siteId))
  const currency = sites[0]?.currency ?? 'INR'
  const zero = () => Money.zero(currency)
  const total = (items: Money[]) => items.reduce((sum, item) => sum.add(item), zero())
  const incomeItems = transactions.filter((transaction) => transaction.type === 'income')
  const expenseItems = transactions.filter((transaction) => transaction.type === 'expense')
  const income = total(incomeItems.map((transaction) => transaction.amount))
  const expenses = total(expenseItems.map((transaction) => transaction.amount))
  const receivables = total(incomeItems.map((transaction) => transaction.amount.subtract(transaction.received)))
  const duePayables = total(payables.map((payable) => payable.total.subtract(payable.paid)))
  const accounts = snapshot.accounts.filter((account) => siteIds.has(account.siteId))
  const bankBalance = total(accounts.filter((account) => account.type === 'bank' || account.type === 'upi').map((account) => account.currentBalance))
  const cashBalance = total(accounts.filter((account) => account.type === 'cash').map((account) => account.currentBalance))
  const categories = new Map<string, Money>()
  const sources = new Map<string, Money>()
  for (const transaction of expenseItems) {
    categories.set(transaction.category, (categories.get(transaction.category) ?? zero()).add(transaction.amount))
  }
  for (const transaction of incomeItems) {
    const source = transaction.source || 'Other'
    sources.set(source, (sources.get(source) ?? zero()).add(transaction.amount))
  }
  const bySite = sites.map((site) => {
    const siteTransactions = transactions.filter((transaction) => transaction.siteId === site.id)
    const siteIncome = total(siteTransactions.filter((transaction) => transaction.type === 'income').map((transaction) => transaction.amount))
    const siteExpenses = total(siteTransactions.filter((transaction) => transaction.type === 'expense').map((transaction) => transaction.amount))
    return { site, income: siteIncome, expenses: siteExpenses, profit: siteIncome.subtract(siteExpenses) }
  })
  const now = new Date()
  const monthly = Array.from({ length: 6 }, (_, index) => {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1)
    const monthTransactions = transactions.filter((transaction) => {
      const date = new Date(`${transaction.date}T00:00:00`)
      return date.getFullYear() === monthDate.getFullYear() && date.getMonth() === monthDate.getMonth()
    })
    return {
      month: new Intl.DateTimeFormat('en', { month: 'short' }).format(monthDate),
      income: total(monthTransactions.filter((transaction) => transaction.type === 'income').map((transaction) => transaction.amount)),
      expenses: total(monthTransactions.filter((transaction) => transaction.type === 'expense').map((transaction) => transaction.amount)),
    }
  })
  return {
    income,
    expenses,
    profit: income.subtract(expenses),
    receivables,
    payables: duePayables,
    bankBalance,
    cashBalance,
    recent: [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8),
    categories: [...categories].map(([name, value]) => ({ name, total: value })).sort((a, b) => b.total.compare(a.total)).slice(0, 5),
    incomeBySource: [...sources].map(([name, value]) => ({ name, total: value })).sort((a, b) => b.total.compare(a.total)),
    sitePerformance: bySite,
    monthly,
  }
}
