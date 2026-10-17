import { Money } from '../../domain/finance/money'
import type { Account, CreateBusinessInput, CreateSiteInput, CreateTransactionInput, FinancialTransaction, Payable, Site, SiteId, WorkspaceSnapshot } from '../../domain/finance/models'
import type { SiteScope, WorkspaceRepository } from '../../domain/finance/workspaceRepository'
import { supabase } from './client'

type SiteRow = { id: string; business_id: string; name: string; code: string; currency: string; status: Site['status'] }
type BusinessRow = { id: string; name: string }
type BusinessMemberRow = { business_id: string; role: 'owner' | 'admin' | 'member' }
type SiteMemberRow = { site_id: string }
type IncomeRow = { id: string; site_id: string; transaction_date: string; description: string | null; net_amount: string; amount_received: string; account_id: string | null; payment_method: string | null; platform: { name: string } | null; customer: { name: string } | null }
type ExpenseRow = { id: string; site_id: string; transaction_date: string; description: string | null; amount: string; account_id: string | null; category: { name: string } | null; vendor: { name: string } | null }
type BillRow = { id: string; site_id: string; due_date: string | null; total: string; amount_paid: string; vendor: { name: string } | null }
type AccountRow = { account_id: string; site_id: string; name: string; type: Account['type']; current_balance: string; currency: string }
const siteId = (value: string) => value as SiteId
const requireClient = () => {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}
const money = (value: string | number, currency: string) => Money.fromDecimal(String(value), currency)
const throwIfError = (error: { message: string } | null) => { if (error) throw new Error(error.message) }

export class SupabaseWorkspaceRepository implements WorkspaceRepository {
  async loadSnapshot(scope: SiteScope = 'all'): Promise<WorkspaceSnapshot> {
    const client = requireClient()
    const [sitesResult, membershipsResult, siteMembershipsResult] = await Promise.all([
      client.from('sites').select('id,business_id,name,code,currency,status').order('name'),
      client.from('business_users').select('business_id,role'),
      client.from('site_users').select('site_id'),
    ])
    for (const result of [sitesResult, membershipsResult, siteMembershipsResult]) throwIfError(result.error)
    const allSites = (sitesResult.data ?? []) as unknown as SiteRow[]
    const memberships = (membershipsResult.data ?? []) as unknown as BusinessMemberRow[]
    const siteMemberships = (siteMembershipsResult.data ?? []) as unknown as SiteMemberRow[]
    const adminBusinessIds = new Set(memberships.filter((member) => member.role === 'owner' || member.role === 'admin').map((member) => member.business_id))
    const businessIds = memberships.map((member) => member.business_id)
    const siteMemberIds = new Set(siteMemberships.map((member) => member.site_id))
    const allowedSites = allSites.filter((site) => businessIds.includes(site.business_id) && (adminBusinessIds.has(site.business_id) || siteMemberIds.has(site.id)))
    const siteRows = scope === 'all' ? allowedSites : allowedSites.filter((site) => site.id === scope)
    const allowedIds = siteRows.map((site) => site.id)
    const wantedIds = scope === 'all' ? allowedIds : allowedIds.filter((id) => id === scope)
    if (scope !== 'all' && wantedIds.length === 0) throw new Error('You do not have access to this site')
    const [incomeResult, expensesResult, billsResult, accountsResult] = await Promise.all([
      client.from('income').select('id,site_id,transaction_date,description,net_amount,amount_received,account_id,platform:platforms(name),customer:customers(name)').in('site_id', wantedIds),
      client.from('expenses').select('id,site_id,transaction_date,description,amount,account_id,category:expense_categories(name),vendor:vendors(name)').in('site_id', wantedIds),
      client.from('bills').select('id,site_id,due_date,total,amount_paid,vendor:vendors(name)').in('site_id', wantedIds),
      client.from('account_balances').select('account_id,site_id,name,type,current_balance,currency').in('site_id', wantedIds),
    ])
    for (const result of [incomeResult, expensesResult, billsResult, accountsResult]) throwIfError(result.error)
    const businessesResult = businessIds.length
      ? await client.from('businesses').select('id,name').in('id', businessIds).order('created_at')
      : { data: [], error: null }
    throwIfError(businessesResult.error)
    const businessRows = (businessesResult.data ?? []) as unknown as BusinessRow[]
    const currencyBySite = new Map(siteRows.map((site) => [site.id, site.currency]))
    const transactions: FinancialTransaction[] = [
      ...((incomeResult.data ?? []) as unknown as IncomeRow[]).map((row) => {
        const currency = currencyBySite.get(row.site_id) ?? 'INR'
        const amount = money(row.net_amount, currency)
        const received = money(row.amount_received, currency)
        return { id: row.id as FinancialTransaction['id'], siteId: siteId(row.site_id), type: 'income' as const, date: row.transaction_date, description: row.description ?? 'Income', party: row.customer?.name ?? 'Unassigned', category: 'Income', source: row.platform?.name ?? 'Other', accountId: row.account_id ?? undefined, amount, received, status: received.compare(amount) === 0 ? 'paid' as const : received.compare(Money.zero(currency)) === 0 ? 'pending' as const : 'partial' as const }
      }),
      ...((expensesResult.data ?? []) as unknown as ExpenseRow[]).map((row) => {
        const currency = currencyBySite.get(row.site_id) ?? 'INR'
        const amount = money(row.amount, currency)
        return { id: row.id as FinancialTransaction['id'], siteId: siteId(row.site_id), type: 'expense' as const, date: row.transaction_date, description: row.description ?? 'Expense', party: row.vendor?.name ?? 'Unassigned', category: row.category?.name ?? 'Other', accountId: row.account_id ?? undefined, amount, received: Money.zero(currency), status: 'paid' as const }
      }),
    ]
    const payables: Payable[] = ((billsResult.data ?? []) as unknown as BillRow[]).map((row) => {
      const currency = currencyBySite.get(row.site_id) ?? 'INR'
      return { id: row.id, siteId: siteId(row.site_id), party: row.vendor?.name ?? 'Vendor', description: 'Vendor bill', dueDate: row.due_date ?? '', total: money(row.total, currency), paid: money(row.amount_paid, currency) }
    })
    const accounts: Account[] = ((accountsResult.data ?? []) as unknown as AccountRow[]).map((row) => ({
      id: row.account_id, siteId: siteId(row.site_id), name: row.name, type: row.type, currentBalance: money(row.current_balance, row.currency),
    }))
    return {
      businessId: businessRows[0]?.id ?? null,
      businessName: businessRows[0]?.name ?? null,
      sites: siteRows.map((row) => ({ id: siteId(row.id), businessId: row.business_id, name: row.name, code: row.code, currency: row.currency, status: row.status, color: '#438664' })),
      transactions: transactions.filter((transaction) => scope === 'all' || transaction.siteId === scope),
      payables,
      accounts: accounts.filter((account) => scope === 'all' || account.siteId === scope),
    }
  }

  async createBusiness(input: CreateBusinessInput): Promise<string> {
    const { data, error } = await requireClient().rpc('create_business', { business_name: input.name.trim(), business_currency: input.currency })
    throwIfError(error)
    return data
  }

  async createSite(input: CreateSiteInput): Promise<void> {
    const { error } = await requireClient().from('sites').insert({ business_id: input.businessId, name: input.name, code: input.code, currency: input.currency })
    throwIfError(error)
  }

  async createTransaction(input: CreateTransactionInput): Promise<void> {
    const { error } = await requireClient().rpc('record_financial_transaction', {
      target_site: input.siteId,
      transaction_type: input.type,
      transaction_day: input.date,
      transaction_description: input.description,
      amount: input.amount.toDecimal(),
      received_amount: input.type === 'income' ? input.received.toDecimal() : '0.00',
      source_name: input.source ?? null,
      category_name: input.category,
      target_account: input.accountId ?? null,
    })
    if (error?.code === 'PGRST202') throw new Error('Apply the Supabase migration 0002_record_financial_transaction.sql to enable transaction writes.')
    throwIfError(error)
  }
}
