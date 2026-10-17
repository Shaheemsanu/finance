import type { Money } from './money'

export type SiteId = string & { readonly __brand: 'SiteId' }
export type TransactionId = string & { readonly __brand: 'TransactionId' }
export type TransactionType = 'income' | 'expense'
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'overdue'

export interface Site {
  id: SiteId
  businessId: string
  name: string
  code: string
  currency: string
  status: 'active' | 'inactive' | 'archived'
  color: string
}

export interface FinancialTransaction {
  id: TransactionId
  siteId: SiteId
  type: TransactionType
  date: string
  description: string
  party: string
  category: string
  source?: string
  accountId?: string
  amount: Money
  received: Money
  status: PaymentStatus
}

export interface Payable {
  id: string
  siteId: SiteId
  party: string
  description: string
  dueDate: string
  total: Money
  paid: Money
}

export interface Account {
  id: string
  siteId: SiteId
  name: string
  type: 'bank' | 'cash' | 'upi' | 'other'
  currentBalance: Money
}

export interface WorkspaceSnapshot {
  businessId: string | null
  businessName: string | null
  sites: Site[]
  transactions: FinancialTransaction[]
  payables: Payable[]
  accounts: Account[]
}

export interface CreateSiteInput {
  businessId: string
  name: string
  code: string
  currency: string
}

export interface CreateBusinessInput {
  name: string
  currency: string
}

export interface CreateTransactionInput {
  siteId: SiteId
  type: TransactionType
  date: string
  description: string
  party: string
  category: string
  source?: string
  accountId?: string
  amount: Money
  received: Money
}
