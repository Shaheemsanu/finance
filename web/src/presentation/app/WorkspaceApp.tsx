import { useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, ArrowDownLeft, ArrowDownRight, ArrowUpRight, Banknote, BriefcaseBusiness, ChartNoAxesCombined, ChevronDown, CircleHelp, FileBarChart, FileText, HandCoins, LayoutDashboard, LogOut, Menu, Plus, Receipt, Search, Settings2, ShoppingBag, Users, WalletCards, X } from 'lucide-react'
import { authRepository, workspaceService } from '../../infrastructure/container'
import { isSupabaseConfigured } from '../../infrastructure/supabase/client'
import { AuthPage } from '../auth/AuthPage'
import { BusinessDialog, SiteDialog, TransactionDialog } from '../components/WorkspaceDialog'
import { useWorkspaceStore } from '../state/workspaceStore'
import { Money } from '../../domain/finance/money'
import type { FinancialTransaction, Payable, Site, SiteId, WorkspaceSnapshot } from '../../domain/finance/models'
import { getDashboardSummary } from '../../application/dashboard/getDashboardSummary'
import './workspace.css'

const primaryNav = [
  { label: 'Overview', path: '/', icon: LayoutDashboard },
  { label: 'Income', path: '/income', icon: ArrowDownLeft },
  { label: 'Expenses', path: '/expenses', icon: ArrowUpRight },
  { label: 'Money to get', path: '/receivables', icon: HandCoins },
  { label: 'Money to give', path: '/payables', icon: Receipt },
]
const manageNav = [
  { label: 'Customers', path: '/customers', icon: Users },
  { label: 'Employees', path: '/employees', icon: BriefcaseBusiness },
  { label: 'Vendors', path: '/vendors', icon: ShoppingBag },
  { label: 'Projects', path: '/projects', icon: Activity },
  { label: 'Invoices', path: '/invoices', icon: FileText },
  { label: 'Bank & cash', path: '/banking', icon: WalletCards },
  { label: 'Reports', path: '/reports', icon: FileBarChart },
]
const money = (value: Money, compact = false) => compact && value.minor >= 1000000000n ? `₹${(Number(value.minor) / 100000000).toFixed(1)}Cr` : compact && value.minor >= 10000000n ? `₹${(Number(value.minor) / 100000).toFixed(1)}L` : value.format()

export function WorkspaceApp() {
  const [email, setEmail] = useState<string | null>(isSupabaseConfigured ? null : 'demo@ledgerline.app')
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured)
  useEffect(() => {
    if (!authRepository) return
    const unsubscribe = authRepository.onAuthChange((nextEmail) => { setEmail(nextEmail); setAuthLoading(false) })
    authRepository.getUserEmail().then((nextEmail) => { setEmail(nextEmail); setAuthLoading(false) }).catch(() => { setEmail(null); setAuthLoading(false) })
    return unsubscribe
  }, [])
  if (authLoading) return <div className="app-loading"><span className="loading-mark"><ChartNoAxesCombined size={20} /></span><span>Preparing your workspace…</span></div>
  if (!email) return <AuthPage />
  return <WorkspaceShell email={email} />
}

function WorkspaceShell({ email }: { email: string }) {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const siteScope = useWorkspaceStore((state) => state.siteScope)
  const setSiteScope = useWorkspaceStore((state) => state.setSiteScope)
  const [siteDialogOpen, setSiteDialogOpen] = useState(false)
  const [businessDialogOpen, setBusinessDialogOpen] = useState(false)
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const snapshotQuery = useQuery({ queryKey: ['workspace', siteScope], queryFn: () => workspaceService.load(siteScope), retry: 1 })
  const snapshot = snapshotQuery.data
  useEffect(() => {
    if (snapshot && siteScope !== 'all' && !snapshot.sites.some((site) => site.id === siteScope)) setSiteScope('all')
  }, [snapshot, siteScope, setSiteScope])
  const selectedSite = snapshot?.sites.find((site) => site.id === siteScope)
  const currentTitle = [...primaryNav, ...manageNav].find((item) => item.path === location.pathname)?.label ?? 'Settings'
  const signOut = useMutation({ mutationFn: async () => authRepository?.signOut(), onSuccess: () => queryClient.clear() })
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['workspace'] }) }
  const roleLabel = isSupabaseConfigured ? 'Connected workspace' : 'Local demo workspace'

  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <Link to="/" className="brand"><span className="brand-symbol"><ChartNoAxesCombined size={18} /></span><span>ledgerline</span></Link>
      <div className="side-section-label">WORKSPACE</div>
      <nav className="side-nav">{primaryNav.map((item) => <NavLink end={item.path === '/'} to={item.path} key={item.path} className={({ isActive }) => `nav-link ${isActive ? 'nav-active' : ''}`} onClick={() => setMobileOpen(false)}><item.icon size={17} strokeWidth={1.8} /><span>{item.label}</span>{item.path === '/receivables' && snapshot && <span className="nav-count">{countReceivables(snapshot, siteScope)}</span>}</NavLink>)}</nav>
      <div className="side-section-label side-manage-label">MANAGE</div>
      <nav className="side-nav">{manageNav.map((item) => <NavLink to={item.path} key={item.path} className={({ isActive }) => `nav-link ${isActive ? 'nav-active' : ''}`} onClick={() => setMobileOpen(false)}><item.icon size={17} strokeWidth={1.8} /><span>{item.label}</span></NavLink>)}</nav>
      <NavLink to="/settings" className="nav-link settings-link"><Settings2 size={17} /><span>Settings</span></NavLink>
      <div className="sidebar-user"><span className="user-avatar">{email.slice(0, 1).toUpperCase()}</span><span className="user-copy"><strong>{email}</strong><small>{roleLabel}</small></span><button className="user-menu" title="Sign out" aria-label="Sign out" onClick={() => isSupabaseConfigured ? signOut.mutate() : setNotice('Demo workspace changes are saved in this browser.')}><LogOut size={15} /></button></div>
    </aside>
    {mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
    <main className="main-area">
      <header className="topbar"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={18} /></button><div className="breadcrumb">Workspace <span>/</span> <strong>{currentTitle}</strong></div><div className="top-actions"><span className={`connection-state ${isSupabaseConfigured ? 'connected' : ''}`}><i />{isSupabaseConfigured ? 'Supabase' : 'Demo mode'}</span><button className="icon-button help-button" title="Help" aria-label="Help" onClick={() => setNotice('Financial data is isolated by site. All Sites aggregates each authorized site once.')}><CircleHelp size={17} /></button><button className="button export-button" onClick={() => snapshot && exportCsv(snapshot, siteScope)}><ArrowDownRight size={15} />Export</button></div></header>
      <div className="workspace-content">
        {snapshotQuery.isPending && <div className="loading-panel"><span className="spinner" />Loading site data…</div>}
        {snapshotQuery.isError && <div className="error-panel"><strong>Could not load the workspace.</strong><span>{snapshotQuery.error.message}</span><button className="button" onClick={() => void snapshotQuery.refetch()}>Try again</button></div>}
        {snapshot && <>
          {!snapshot.businessId && <section className="onboarding-banner"><div><p className="eyebrow">GET STARTED</p><h2>Create your business workspace</h2><p>Sites, transactions, and reports stay within this business.</p></div><button className="button primary" onClick={() => setBusinessDialogOpen(true)}><Plus size={15} />Create business</button></section>}
          {snapshot.businessId && snapshot.sites.length === 0 && <section className="onboarding-banner"><div><p className="eyebrow">FIRST SITE</p><h2>Add your first site</h2><p>Each site has independent financial records and balances.</p></div><button className="button primary" onClick={() => setSiteDialogOpen(true)}><Plus size={15} />Add site</button></section>}
          {snapshot.businessId && snapshot.sites.length > 0 && <>
            <div className="page-heading"><div><p className="eyebrow">{siteScope === 'all' ? 'BUSINESS OVERVIEW' : 'SITE OVERVIEW'}</p><h1>{location.pathname === '/' ? siteScope === 'all' ? `Good morning, ${firstName(email)}.` : selectedSite?.name ?? 'Site overview' : currentTitle}</h1><p>{location.pathname === '/' ? siteScope === 'all' ? 'Your financial picture, across every site.' : 'A focused view of this site’s financial activity.' : pageDescription(location.pathname)}</p></div><div className="page-actions"><SitePicker sites={snapshot.sites} selected={siteScope} onSelect={setSiteScope} /><button className="button primary" onClick={() => setTransactionDialogOpen(true)}><Plus size={16} />New transaction</button></div></div>
            <Routes>
              <Route path="/" element={<Dashboard snapshot={snapshot} siteScope={siteScope} onNavigate={navigate} />} />
              <Route path="/:module" element={<ModulePage snapshot={snapshot} siteScope={siteScope} path={location.pathname} />} />
            </Routes>
          </>}
        </>}
      </div>
    </main>
    {snapshot && <>
      {snapshot.businessId && <SiteDialog open={siteDialogOpen} onOpenChange={setSiteDialogOpen} businessId={snapshot.businessId} currency={selectedSite?.currency ?? 'INR'} onCreated={(siteId) => { setSiteScope(siteId); refresh(); setNotice('Site created. Its financial data is separate.') }} />}
      <BusinessDialog open={businessDialogOpen} onOpenChange={setBusinessDialogOpen} onCreated={() => { refresh(); setNotice('Business workspace created.') }} />
      <TransactionDialog open={transactionDialogOpen} onOpenChange={setTransactionDialogOpen} sites={snapshot.sites} accounts={snapshot.accounts} currentSite={siteScope} onCreated={() => { refresh(); setNotice('Transaction saved.') }} />
    </>}
    {notice && <div className="toast" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss"><X size={14} /></button></div>}
  </div>
}

function SitePicker({ sites, selected, onSelect }: { sites: Site[]; selected: SiteId | 'all'; onSelect: (id: SiteId | 'all') => void }) {
  const active = sites.find((site) => site.id === selected)
  return <DropdownMenu.Root><DropdownMenu.Trigger className="site-picker"><i className="site-dot" style={{ background: active?.color ?? '#28724e' }} />{active?.name ?? 'All sites'}<ChevronDown size={15} /></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content align="end" className="site-menu"><DropdownMenu.Item className="site-option" onSelect={() => onSelect('all')}><i className="site-dot" />All sites{selected === 'all' && <span className="selected-check">✓</span>}</DropdownMenu.Item>{sites.map((site) => <DropdownMenu.Item key={site.id} className="site-option" onSelect={() => onSelect(site.id)}><i className="site-dot" style={{ background: site.color }} />{site.name}{selected === site.id && <span className="selected-check">✓</span>}</DropdownMenu.Item>)}</DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>
}

function Dashboard({ snapshot, siteScope, onNavigate }: { snapshot: WorkspaceSnapshot; siteScope: SiteId | 'all'; onNavigate: (to: string) => void }) {
  const summary = getDashboardSummary(snapshot, siteScope)
  const positive = summary.profit.compare(Money.zero(summary.profit.currency)) >= 0
  return <>
    <section className="metric-grid">
      <Metric label="Income" value={money(summary.income, true)} icon={<ArrowDownLeft size={15} />} note="Recorded revenue" tone="green" />
      <Metric label="Expenses" value={money(summary.expenses, true)} icon={<ArrowUpRight size={15} />} note="Business spending" tone="orange" />
      <Metric label="Net profit" value={money(summary.profit, true)} icon={<ChartNoAxesCombined size={15} />} note="Income less expenses" tone={positive ? 'green' : 'red'} />
      <Metric label="Money to get" value={money(summary.receivables, true)} icon={<HandCoins size={15} />} note="Unreceived income" tone="blue" />
      <Metric label="Money to give" value={money(summary.payables, true)} icon={<Receipt size={15} />} note="Outstanding bills" tone="orange" />
      <Metric label="Bank balance" value={money(summary.bankBalance, true)} icon={<Banknote size={15} />} note="Based on recorded activity" tone="green" />
      <Metric label="Cash balance" value={money(summary.cashBalance, true)} icon={<WalletCards size={15} />} note="Cash account openings" tone="blue" />
    </section>
    {siteScope === 'all' && summary.sitePerformance.length > 0 && <section className="panel site-performance"><header className="panel-heading"><div><h2>Site performance</h2><p>Compare profit across your authorized sites</p></div><button className="text-button" onClick={() => onNavigate('/reports')}>View report <ArrowUpRight size={14} /></button></header><div className="site-performance-grid">{summary.sitePerformance.map((item) => <button className="site-performance-item" key={item.site.id} onClick={() => onNavigate(`/reports?site=${item.site.id}`)}><span className="site-performance-name"><i className="site-dot" style={{ background: item.site.color }} />{item.site.name}</span><strong>{money(item.profit, true)}</strong><small>{money(item.income, true)} income · {money(item.expenses, true)} expenses</small></button>)}</div></section>}
    <section className="dashboard-grid"><article className="panel chart-panel"><header className="panel-heading"><div><h2>Income & expenses</h2><p>Monthly totals for the last six months</p></div><span className="chart-units">INR</span></header><div className="chart-legend"><span><i className="legend-income" />Income</span><span><i className="legend-expense" />Expenses</span></div><div className="chart-frame"><ResponsiveContainer width="100%" height="100%"><BarChart data={summary.monthly} margin={{ top: 10, right: 6, left: -18, bottom: 0 }} barGap={5}><CartesianGrid stroke="#edf0eb" vertical={false} /><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#8c958d', fontSize: 10 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: '#9aa29b', fontSize: 9 }} tickFormatter={(value) => compactNumber(Number(value))} /><Tooltip formatter={(value) => [money(Money.fromDecimal(String(Number(value).toFixed(2))), false)]} contentStyle={{ border: '1px solid #e5e9e2', borderRadius: 7, fontSize: 11, boxShadow: '0 8px 20px #1e2d2014' }} /><Bar dataKey={(entry) => Number(entry.income.minor) / 100} name="Income" fill="#438664" radius={[3, 3, 0, 0]} maxBarSize={17} /><Bar dataKey={(entry) => Number(entry.expenses.minor) / 100} name="Expenses" fill="#ddb087" radius={[3, 3, 0, 0]} maxBarSize={17} /></BarChart></ResponsiveContainer></div></article>
      <article className="panel breakdown-panel"><header className="panel-heading"><div><h2>Expense mix</h2><p>Where business spending goes</p></div><button className="icon-button" onClick={() => onNavigate('/expenses')} aria-label="View expenses"><ArrowUpRight size={15} /></button></header>{summary.categories.length ? <><div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={summary.categories.map((item) => ({ name: item.name, value: Number(item.total.minor) }))} dataKey="value" nameKey="name" innerRadius={53} outerRadius={72} paddingAngle={2} stroke="none">{summary.categories.map((item, index) => <Cell key={item.name} fill={['#438664','#a4b77f','#d9a474','#8b9f9a','#c78377'][index % 5]} />)}</Pie><Tooltip formatter={(value) => [money(MoneyFromMinor(BigInt(Number(value)), 'INR'))]} /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{money(summary.expenses, true)}</strong><span>Total spend</span></div></div><div className="category-list">{summary.categories.map((item, index) => <div className="category-line" key={item.name}><i style={{ background: ['#438664','#a4b77f','#d9a474','#8b9f9a','#c78377'][index % 5] }} /><span>{item.name}</span><strong>{money(item.total, true)}</strong></div>)}</div></> : <EmptyState title="No expenses yet" message="Add expenses to see category breakdowns." />}</article></section>
    <section className="panel transactions-panel"><header className="panel-heading"><div><h2>Recent transactions</h2><p>Latest recorded activity</p></div><button className="text-button" onClick={() => onNavigate('/income')}>See transactions <ArrowUpRight size={14} /></button></header><TransactionTable rows={summary.recent} sites={snapshot.sites} includeSite={siteScope === 'all'} /></section>
  </>
}

function MoneyFromMinor(minor: bigint, currency: string) {
  return Money.fromDecimal(`${minor / 100n}.${String(minor % 100n).padStart(2, '0')}`, currency)
}

function Metric({ label, value, icon, note, tone }: { label: string; value: string; icon: React.ReactNode; note: string; tone: string }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}>{icon}</span></div><strong>{value}</strong><small>{note}</small></article>
}

function ModulePage({ snapshot, siteScope, path }: { snapshot: WorkspaceSnapshot; siteScope: SiteId | 'all'; path: string }) {
  const [search, setSearch] = useState('')
  const transactions = snapshot.transactions.filter((item) => siteScope === 'all' || item.siteId === siteScope)
  const type = path === '/expenses' ? 'expense' : path === '/income' || path === '/receivables' ? 'income' : null
  const filteredTransactions = transactions.filter((item) => (type ? item.type === type : true) && (path !== '/receivables' || item.amount.compare(item.received) > 0) && `${item.description} ${item.party} ${item.category} ${item.source ?? ''}`.toLowerCase().includes(search.toLowerCase()))
  const payables = snapshot.payables.filter((item) => (siteScope === 'all' || item.siteId === siteScope) && item.total.compare(item.paid) > 0)
  const pageName = path.slice(1).replaceAll('-', ' ')
  const moduleTitles: Record<string, string> = { customers: 'Customers', employees: 'Employees', vendors: 'Vendors', projects: 'Projects', invoices: 'Invoices', banking: 'Bank & cash', reports: 'Financial reports', settings: 'Workspace settings' }
  const title = moduleTitles[pageName] ?? (path === '/receivables' ? 'Money to get' : path === '/payables' ? 'Money to give' : path === '/income' ? 'Income' : 'Expenses')
  const showPayables = path === '/payables'
  const showAccounts = path === '/banking'
  const accountRows = snapshot.accounts.filter((account) => siteScope === 'all' || account.siteId === siteScope)
  const peopleRows = path === '/customers' ? [...new Set(transactions.filter((item) => item.type === 'income').map((item) => item.party))] : path === '/vendors' ? [...new Set(transactions.filter((item) => item.type === 'expense').map((item) => item.party))] : []
  return <section className="panel module-panel"><header className="panel-heading module-heading"><div><h2>{title}</h2><p>{showPayables ? `${payables.length} outstanding bills` : showAccounts ? `${accountRows.length} accounts across selected sites` : `${filteredTransactions.length} matching records`}</p></div><label className="search-box"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search records…" /></label></header>{showPayables ? <PayablesTable items={payables} sites={snapshot.sites} includeSite={siteScope === 'all'} /> : showAccounts ? <AccountsTable accounts={accountRows} sites={snapshot.sites} /> : (path === '/customers' || path === '/vendors') ? <PeopleTable names={peopleRows} type={path === '/customers' ? 'Customer' : 'Vendor'} transactions={transactions} /> : path === '/reports' ? <ReportsTable snapshot={snapshot} siteScope={siteScope} /> : <TransactionTable rows={filteredTransactions} sites={snapshot.sites} includeSite={siteScope === 'all'} />}</section>
}

function TransactionTable({ rows, sites, includeSite }: { rows: FinancialTransaction[]; sites: Site[]; includeSite: boolean }) {
  if (!rows.length) return <EmptyState title="No transactions found" message="Change your search or add a transaction to this site." />
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>Transaction</th><th>Customer / vendor</th>{includeSite && <th>Site</th>}<th>Date</th><th>Status</th><th className="amount-cell">Amount</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><span className={`transaction-symbol ${row.type}`}>{row.type === 'income' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}</span><span className="transaction-description"><strong>{row.description}</strong><small>{row.source ?? row.category}</small></span></td><td>{row.party || '—'}</td>{includeSite && <td><span className="site-name"><i className="site-dot" style={{ background: sites.find((site) => site.id === row.siteId)?.color }} />{sites.find((site) => site.id === row.siteId)?.name ?? '—'}</span></td>}<td>{formatDate(row.date)}</td><td><span className={`status-pill ${row.status}`}>{row.status === 'partial' ? 'Part paid' : row.status}</span></td><td className={`amount-cell ${row.type}`}>{row.type === 'income' ? '+' : '−'}{money(row.amount)}</td></tr>)}</tbody></table></div>
}

function PayablesTable({ items, sites, includeSite }: { items: Payable[]; sites: Site[]; includeSite: boolean }) {
  if (!items.length) return <EmptyState title="All caught up" message="There are no outstanding bills for this view." />
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>Bill</th><th>Payee</th>{includeSite && <th>Site</th>}<th>Due date</th><th>Status</th><th className="amount-cell">Outstanding</th></tr></thead><tbody>{items.map((item) => { const balance = item.total.subtract(item.paid); return <tr key={item.id}><td><span className="transaction-symbol expense"><Receipt size={14} /></span><span className="transaction-description"><strong>{item.description}</strong><small>Bill</small></span></td><td>{item.party}</td>{includeSite && <td>{sites.find((site) => site.id === item.siteId)?.name ?? '—'}</td>}<td>{formatDate(item.dueDate)}</td><td><span className={`status-pill ${item.paid.minor ? 'partial' : 'pending'}`}>{item.paid.minor ? 'Part paid' : 'Pending'}</span></td><td className="amount-cell">{money(balance)}</td></tr> })}</tbody></table></div>
}

function AccountsTable({ accounts, sites }: { accounts: WorkspaceSnapshot['accounts']; sites: Site[] }) {
  if (!accounts.length) return <EmptyState title="No accounts connected" message="Add bank, cash, UPI, and other accounts in your workspace settings." />
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>Account</th><th>Type</th><th>Site</th><th className="amount-cell">Current balance</th></tr></thead><tbody>{accounts.map((account) => <tr key={account.id}><td><span className="transaction-symbol income"><WalletCards size={14} /></span><span className="transaction-description"><strong>{account.name}</strong><small>{account.type.toUpperCase()} · {sites.find((site) => site.id === account.siteId)?.currency ?? 'INR'}</small></span></td><td>{account.type}</td><td>{sites.find((site) => site.id === account.siteId)?.name ?? '—'}</td><td className="amount-cell">{money(account.currentBalance)}</td></tr>)}</tbody></table></div>
}

function PeopleTable({ names, type, transactions }: { names: string[]; type: string; transactions: FinancialTransaction[] }) {
  if (!names.length) return <EmptyState title={`No ${type.toLowerCase()} records`} message="They will appear here as you record site transactions." />
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>{type}</th><th>Transactions</th><th className="amount-cell">Recorded total</th></tr></thead><tbody>{names.map((name) => { const rows = transactions.filter((item) => item.party === name); const amount = rows.reduce((sum, row) => sum.add(row.amount), Money.zero()); return <tr key={name}><td><span className="person-cell"><span className="user-avatar">{name.slice(0, 1).toUpperCase()}</span><strong>{name}</strong></span></td><td>{rows.length}</td><td className="amount-cell">{money(amount)}</td></tr> })}</tbody></table></div>
}

function ReportsTable({ snapshot, siteScope }: { snapshot: WorkspaceSnapshot; siteScope: SiteId | 'all' }) {
  const summary = getDashboardSummary(snapshot, siteScope)
  return <div className="reports-content"><div className="report-kpis"><div><span>Revenue</span><strong>{money(summary.income)}</strong></div><div><span>Expenses</span><strong>{money(summary.expenses)}</strong></div><div><span>Net profit</span><strong>{money(summary.profit)}</strong></div></div><div className="report-columns"><div><h3>Income by source</h3>{summary.incomeBySource.map((item) => <div className="report-row" key={item.name}><span>{item.name}</span><strong>{money(item.total)}</strong></div>)}</div><div><h3>Expenses by category</h3>{summary.categories.map((item) => <div className="report-row" key={item.name}><span>{item.name}</span><strong>{money(item.total)}</strong></div>)}</div></div></div>
}

function EmptyState({ title, message }: { title: string; message: string }) { return <div className="empty-state"><span><FileBarChart size={19} /></span><strong>{title}</strong><p>{message}</p></div> }
function pageDescription(path: string) { return ({ '/income': 'Income recorded for the selected site scope.', '/expenses': 'Business spending recorded in your workspace.', '/receivables': 'Amounts still due from customers and other income sources.', '/payables': 'Unpaid and partially paid vendor bills.', '/banking': 'Accounts and balances associated with your sites.', '/reports': 'Income, expenses and profitability by source and category.', '/customers': 'Customer activity derived from recorded income.', '/vendors': 'Vendor activity derived from recorded expenses.', '/employees': 'Employee records are managed per site.', '/projects': 'Project activity is scoped to the selected site.', '/invoices': 'Invoice balances and status by site.', '/settings': 'Business and site configuration.' } as Record<string,string>)[path] ?? 'Financial activity for your business.' }
function firstName(email: string) { return email.split('@')[0].split(/[._-]/)[0].replace(/^./, (character) => character.toUpperCase()) }
function countReceivables(snapshot: WorkspaceSnapshot, scope: SiteId | 'all') { return snapshot.transactions.filter((item) => item.type === 'income' && (scope === 'all' || item.siteId === scope) && item.amount.compare(item.received) > 0).length }
function formatDate(value: string) { if (!value) return '—'; return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`)) }
function compactNumber(value: number) { return value >= 10000000 ? `₹${(value / 10000000).toFixed(1)}Cr` : value >= 100000 ? `₹${(value / 100000).toFixed(0)}L` : value >= 1000 ? `₹${(value / 1000).toFixed(0)}k` : `₹${value}` }
function exportCsv(snapshot: WorkspaceSnapshot, scope: SiteId | 'all') { const siteNames = new Map(snapshot.sites.map((site) => [site.id, site.name])); const rows = [['site','type','date','description','party','category','amount','received','status'], ...snapshot.transactions.filter((item) => scope === 'all' || item.siteId === scope).map((item) => [siteNames.get(item.siteId) ?? '',item.type,item.date,item.description,item.party,item.category,item.amount.toDecimal(),item.received.toDecimal(),item.status])]; const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"','""')}"`).join(',')).join('\r\n'); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = 'ledgerline-transactions.csv'; link.click(); URL.revokeObjectURL(link.href) }
