import { Money } from '../../domain/finance/money'
import type { Account, CreateBusinessInput, CreateSiteInput, CreateTransactionInput, FinancialTransaction, Payable, Site, SiteId, WorkspaceSnapshot } from '../../domain/finance/models'
import type { SiteScope, WorkspaceRepository } from '../../domain/finance/workspaceRepository'

const storageKey = 'ledgerline.workspace.v1'
const asSiteId = (value: string) => value as SiteId
const money = (value: string) => Money.fromDecimal(value, 'INR')
const dateAt = (monthOffset: number, day: number) => {
  const now = new Date()
  const date = new Date(now.getFullYear(), now.getMonth() + monthOffset, day)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const sites: Site[] = [
  { id: asSiteId('site-north'), businessId: 'demo-business', name: 'Northstar Studio', code: 'NS', currency: 'INR', status: 'active', color: '#438664' },
  { id: asSiteId('site-field'), businessId: 'demo-business', name: 'Fieldwork Co.', code: 'FW', currency: 'INR', status: 'active', color: '#d19860' },
  { id: asSiteId('site-atelier'), businessId: 'demo-business', name: 'Atelier Objects', code: 'AO', currency: 'INR', status: 'active', color: '#849678' },
]

function makeTransaction(id: string, siteId: string, type: 'income' | 'expense', description: string, party: string, category: string, amount: string, date: string, received?: string, source?: string): FinancialTransaction {
  const total = money(amount)
  return { id: id as FinancialTransaction['id'], siteId: asSiteId(siteId), type, date, description, party, category, source, accountId: siteId === 'site-north' ? 'n-bank' : siteId === 'site-field' ? 'f-bank' : 'a-bank', amount: total, received: type === 'income' ? money(received ?? amount) : Money.zero(), status: type === 'expense' || received === undefined || received === amount ? 'paid' : received === '0' ? 'pending' : 'partial' }
}

const seedSnapshot = (): WorkspaceSnapshot => {
  const transactions = [
    makeTransaction('t01','site-north','income','Brand identity · final payment','Morrow & Co.','Client work','485000',dateAt(0,16),undefined,'Direct'),
    makeTransaction('t02','site-field','income','Product design · milestone 2','Kindred Goods','Client work','268000',dateAt(0,14),'160000','Upwork'),
    makeTransaction('t03','site-north','expense','Creative Cloud · annual plan','Adobe','Software','53900',dateAt(0,12)),
    makeTransaction('t04','site-atelier','income','Spring collection · wholesale','The Modern House','Product sales','325000',dateAt(0,10),undefined,'Direct'),
    makeTransaction('t05','site-field','expense','Contract illustration · project 04','R. Narayan','Contractors','72000',dateAt(0,8)),
    makeTransaction('t06','site-north','income','Monthly content retainer','Onda Studio','Retainer','185000',dateAt(0,6),undefined,'Referral'),
    makeTransaction('t07','site-atelier','expense','Workshop rent · June','Millhouse Properties','Rent','96000',dateAt(0,4)),
    makeTransaction('t08','site-field','income','Web refresh · discovery','Lumen Works','Client work','142000',dateAt(-1,27),undefined,'Website'),
    makeTransaction('t09','site-north','expense','Freelance copywriting','M. Iyer','Contractors','43000',dateAt(-1,24)),
    makeTransaction('t10','site-atelier','income','Custom shelving · deposit','Juniper Home','Product sales','214000',dateAt(-1,19),'110000','Instagram'),
    makeTransaction('t11','site-field','expense','Workspace membership','Common Ground','Office','38500',dateAt(-1,15)),
    makeTransaction('t12','site-north','income','Campaign production','Meridian Health','Client work','375000',dateAt(-1,11),undefined,'Direct'),
    makeTransaction('t13','site-field','income','Landing page build','Morrow & Co.','Client work','195000',dateAt(-2,23),undefined,'Referral'),
    makeTransaction('t14','site-atelier','expense','Materials · oak and brass','Cedar Supply','Materials','124000',dateAt(-2,18)),
    makeTransaction('t15','site-north','expense','Studio lease · monthly','Foundry House','Rent','128000',dateAt(-2,10)),
    makeTransaction('t16','site-atelier','income','Dining table · final balance','Hearth & Hill','Product sales','294000',dateAt(-3,20),undefined,'Direct'),
    makeTransaction('t17','site-field','expense','Photography · campaign','S. Kapoor','Contractors','58000',dateAt(-3,17)),
    makeTransaction('t18','site-north','income','Quarterly brand partnership','Onda Studio','Retainer','225000',dateAt(-4,8),undefined,'Direct'),
    makeTransaction('t19','site-atelier','expense','Courier and delivery','Parcel Collective','Shipping','24500',dateAt(-4,4)),
    makeTransaction('t20','site-field','income','UX audit','Sora Health','Client work','118000',dateAt(-5,7),undefined,'Upwork'),
  ]
  const accounts: Account[] = [
    { id: 'n-bank', siteId: asSiteId('site-north'), name: 'Studio current', type: 'bank', currentBalance: money('615000') },
    { id: 'n-cash', siteId: asSiteId('site-north'), name: 'Studio cash', type: 'cash', currentBalance: money('18000') },
    { id: 'f-bank', siteId: asSiteId('site-field'), name: 'Business checking', type: 'bank', currentBalance: money('382000') },
    { id: 'f-cash', siteId: asSiteId('site-field'), name: 'Petty cash', type: 'cash', currentBalance: money('12000') },
    { id: 'a-bank', siteId: asSiteId('site-atelier'), name: 'Workshop account', type: 'bank', currentBalance: money('527000') },
    { id: 'a-cash', siteId: asSiteId('site-atelier'), name: 'Workshop float', type: 'cash', currentBalance: money('26000') },
  ]
  for (const transaction of transactions) {
    const account = accounts.find((item) => item.id === transaction.accountId)
    if (account) account.currentBalance = account.currentBalance.add(transaction.type === 'income' ? transaction.received : money(`-${transaction.amount.toDecimal()}`))
  }
  const payables: Payable[] = [
    { id: 'p01', siteId: asSiteId('site-north'), party: 'Foundry House', description: 'Studio lease · July', dueDate: dateAt(0,28), total: money('128000'), paid: Money.zero() },
    { id: 'p02', siteId: asSiteId('site-field'), party: 'R. Narayan', description: 'Illustration · project 05', dueDate: dateAt(0,24), total: money('54000'), paid: money('18000') },
    { id: 'p03', siteId: asSiteId('site-atelier'), party: 'Cedar Supply', description: 'Material order · oak', dueDate: dateAt(0,30), total: money('86500'), paid: Money.zero() },
  ]
  return { businessId: 'demo-business', businessName: 'Aarav Creative', sites, transactions, payables, accounts }
}

function deserializeSnapshot(raw: string): WorkspaceSnapshot {
  const data = JSON.parse(raw) as Omit<WorkspaceSnapshot, 'transactions' | 'payables' | 'accounts'> & {
    transactions: Array<Omit<FinancialTransaction, 'amount' | 'received'> & { amount: string; received: string }>
    payables: Array<Omit<Payable, 'total' | 'paid'> & { total: string; paid: string }>
    accounts: Array<Omit<Account, 'currentBalance'> & { currentBalance?: string; openingBalance?: string }>
  }
  return {
    ...data,
    businessId: data.businessId ?? 'demo-business',
    businessName: data.businessName ?? 'Aarav Creative',
    transactions: data.transactions.map((item) => ({ ...item, siteId: asSiteId(item.siteId), amount: Money.fromDecimal(item.amount), received: Money.fromDecimal(item.received) })),
    payables: data.payables.map((item) => ({ ...item, siteId: asSiteId(item.siteId), total: Money.fromDecimal(item.total), paid: Money.fromDecimal(item.paid) })),
    accounts: data.accounts.map((item) => ({ ...item, siteId: asSiteId(item.siteId), currentBalance: Money.fromDecimal(item.currentBalance ?? item.openingBalance ?? '0') })),
  }
}

function serializeSnapshot(snapshot: WorkspaceSnapshot): string {
  return JSON.stringify(snapshot, (_key, value: unknown) => value instanceof Money ? value.toDecimal() : value)
}

export class DemoWorkspaceRepository implements WorkspaceRepository {
  private snapshot: WorkspaceSnapshot | null = null

  async loadSnapshot(scope: SiteScope = 'all'): Promise<WorkspaceSnapshot> {
    if (!this.snapshot) {
      try {
        const raw = localStorage.getItem(storageKey)
        this.snapshot = raw ? deserializeSnapshot(raw) : seedSnapshot()
      } catch {
        this.snapshot = seedSnapshot()
      }
    }
    const sites = [...this.snapshot.sites]
    const selected = (siteId: SiteId) => scope === 'all' || siteId === scope
    return {
      businessId: this.snapshot.businessId,
      businessName: this.snapshot.businessName,
      sites,
      transactions: this.snapshot.transactions.filter((item) => selected(item.siteId)),
      payables: this.snapshot.payables.filter((item) => selected(item.siteId)),
      accounts: this.snapshot.accounts.filter((item) => selected(item.siteId)),
    }
  }

  async createBusiness(input: CreateBusinessInput): Promise<string> {
    const snapshot = await this.loadSnapshot()
    if (!input.name.trim()) throw new Error('Business name is required')
    const businessId = crypto.randomUUID()
    snapshot.businessId = businessId
    snapshot.businessName = input.name.trim()
    snapshot.sites = snapshot.sites.map((site) => ({ ...site, businessId }))
    this.save(snapshot)
    return businessId
  }

  async createSite(input: CreateSiteInput): Promise<void> {
    const snapshot = await this.loadSnapshot()
    if (snapshot.sites.some((site) => site.name.toLowerCase() === input.name.trim().toLowerCase() || site.code.toLowerCase() === input.code.trim().toLowerCase())) {
      throw new Error('A site with this name or code already exists')
    }
    snapshot.sites.push({ id: asSiteId(crypto.randomUUID()), businessId: input.businessId, name: input.name.trim(), code: input.code.trim().toUpperCase(), currency: input.currency, status: 'active', color: ['#438664','#d19860','#849678','#728ba2','#bb7776'][snapshot.sites.length % 5] })
    this.save(snapshot)
  }

  async createTransaction(input: CreateTransactionInput): Promise<void> {
    const snapshot = await this.loadSnapshot()
    if (!snapshot.sites.some((site) => site.id === input.siteId)) throw new Error('Select a site you have access to')
    const account = input.accountId ? snapshot.accounts.find((item) => item.id === input.accountId && item.siteId === input.siteId) : undefined
    if (input.accountId && !account) throw new Error('Account does not belong to the selected site')
    if (input.amount.isNegative() || input.amount.compare(Money.zero(input.amount.currency)) === 0) throw new Error('Amount must be greater than zero')
    if (input.type === 'income' && (input.received.isNegative() || input.received.compare(input.amount) > 0)) throw new Error('Received amount must be between zero and the total')
    if (account) account.currentBalance = account.currentBalance.add(input.type === 'income' ? input.received : money(`-${input.amount.toDecimal()}`))
    snapshot.transactions.push({ ...input, id: crypto.randomUUID() as FinancialTransaction['id'], status: input.type === 'expense' || input.received.compare(input.amount) === 0 ? 'paid' : input.received.compare(Money.zero(input.amount.currency)) === 0 ? 'pending' : 'partial' })
    this.save(snapshot)
  }

  private save(snapshot: WorkspaceSnapshot): void {
    this.snapshot = snapshot
    localStorage.setItem(storageKey, serializeSnapshot(snapshot))
  }
}
