import { describe, expect, it } from 'vitest'
import { getDashboardSummary } from './getDashboardSummary'
import { Money } from '../../domain/finance/money'
import type { Site, SiteId, WorkspaceSnapshot } from '../../domain/finance/models'

const site = (id: string, name: string): Site => ({ id: id as SiteId, businessId: 'b1', name, code: name.slice(0, 2).toUpperCase(), currency: 'INR', status: 'active', color: '#438664' })
const amount = (value: string) => Money.fromDecimal(value)

const snapshot: WorkspaceSnapshot = {
  businessId: 'b1',
  businessName: 'Studio',
  sites: [site('s1', 'Site One'), site('s2', 'Site Two')],
  transactions: [
    { id: 'i1' as never, siteId: 's1' as SiteId, type: 'income', date: '2026-10-10', description: 'Work', party: 'Client', category: 'Services', source: 'Direct', amount: amount('100.00'), received: amount('40.00'), status: 'partial' },
    { id: 'e1' as never, siteId: 's1' as SiteId, type: 'expense', date: '2026-10-11', description: 'Tools', party: 'Vendor', category: 'Software', amount: amount('20.00'), received: Money.zero(), status: 'paid' },
    { id: 'i2' as never, siteId: 's2' as SiteId, type: 'income', date: '2026-10-12', description: 'Other work', party: 'Client 2', category: 'Services', source: 'Referral', amount: amount('60.00'), received: amount('60.00'), status: 'paid' },
  ],
  payables: [],
  accounts: [],
}

describe('getDashboardSummary', () => {
  it('aggregates each site transaction once on All Sites', () => {
    const summary = getDashboardSummary(snapshot, 'all')
    expect(summary.income.toDecimal()).toBe('160.00')
    expect(summary.expenses.toDecimal()).toBe('20.00')
    expect(summary.profit.toDecimal()).toBe('140.00')
    expect(summary.receivables.toDecimal()).toBe('60.00')
    expect(summary.sitePerformance).toHaveLength(2)
  })

  it('isolates selected site totals', () => {
    const summary = getDashboardSummary(snapshot, 's1' as SiteId)
    expect(summary.income.toDecimal()).toBe('100.00')
    expect(summary.expenses.toDecimal()).toBe('20.00')
    expect(summary.sitePerformance).toHaveLength(1)
    expect(summary.sitePerformance[0].site.name).toBe('Site One')
  })
})
