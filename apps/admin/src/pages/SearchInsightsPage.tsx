import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, BarChart3, CheckCircle2, ExternalLink, FileJson, Link2, LoaderCircle, RefreshCw, SearchCheck, Unplug } from 'lucide-react'
import { api } from '../lib/api'

type Metric = { clicks: number; impressions: number; ctr: number; position: number }
type MetricRow = Metric & { keys: string[] }
type Property = { siteUrl: string; permissionLevel: string }
type Status = { configured: boolean; connected: boolean; selectedProperty: string | null }
type DateRange = { startDate: string; endDate: string }
type InsightActivity = { stage: 'connection' | 'property' | 'report' | 'disconnect'; title: string; detail: string }
type Report = {
  generatedAt: string; property: string; range: { startDate: string; endDate: string }; rowLimits: { queries: number; pages: number }
  summary: Metric; previousSummary: Metric; daily: MetricRow[]; queries: MetricRow[]; pages: MetricRow[]; countries: MetricRow[]; devices: MetricRow[]; searchAppearances: MetricRow[]
  sitemaps: Array<{ path: string; submitted?: string; lastDownloaded?: string; isPending?: boolean; warnings?: number; errors?: number; contents: Array<{ type?: string; submitted?: number; indexed?: number }> }>
  inspections: Array<{ url: string; verdict?: string; coverageState?: string; indexingState?: string; robotsTxtState?: string; pageFetchState?: string; lastCrawlTime?: string; googleCanonical?: string; userCanonical?: string; sitemaps: string[]; error?: string }>
  notices: Array<{ section: string; message: string }>
}

const number = new Intl.NumberFormat()
const percentage = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 2 })
const dateOnly = (date: Date) => date.toISOString().slice(0, 10)
const defaultDates = () => { const end = new Date(); const start = new Date(end); start.setMonth(start.getMonth() - 3); return { startDate: dateOnly(start), endDate: dateOnly(end) } }
const change = (now: number, previous: number) => previous ? ((now - previous) / previous) : null
const formatDate = (value?: string) => value ? new Date(value).toLocaleString() : '—'

export function SearchInsightsPage() {
  const [status, setStatus] = useState<Status | null>(null); const [properties, setProperties] = useState<Property[]>([]); const [report, setReport] = useState<Report | null>(null)
  const initialDates = useRef(defaultDates()); const [dates, setDates] = useState<DateRange>(initialDates.current); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [message, setMessage] = useState(''); const [activity, setActivity] = useState<InsightActivity | null>({ stage: 'connection', title: 'Connecting to Search Console', detail: 'Checking the saved Google connection and available property.' })
  const requestReport = useCallback(async (range: DateRange) => {
    const result = await api<{ data: Report }>(`/admin/search-console/report?startDate=${encodeURIComponent(range.startDate)}&endDate=${encodeURIComponent(range.endDate)}`)
    setReport(result.data)
  }, [])
  const loadReport = useCallback(async (range: DateRange) => {
    setRefreshing(true); setMessage(''); setActivity({ stage: 'report', title: 'Loading live Search Console data', detail: 'Collecting performance, sitemap status, and priority URL inspections. This can take a moment.' })
    try { await requestReport(range) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load Google Search Console data. Your previous report is still available.') }
    finally { setRefreshing(false); setActivity(null) }
  }, [requestReport])
  const load = useCallback(async () => {
    setLoading(true); setMessage(''); setActivity({ stage: 'connection', title: 'Connecting to Search Console', detail: 'Checking the saved Google connection and available property.' })
    try {
      const result = await api<{ data: Status }>('/admin/search-console/status'); setStatus(result.data)
      if (result.data.configured && result.data.connected) {
        setActivity({ stage: 'property', title: 'Confirming your Search Console property', detail: 'Loading the properties this Google account can access.' })
        const propertyResult = await api<{ data: Property[] }>('/admin/search-console/properties'); setProperties(propertyResult.data)
        if (result.data.selectedProperty) { setActivity({ stage: 'report', title: 'Loading your first live report', detail: 'Collecting performance, sitemap status, and priority URL inspections.' }); await requestReport(initialDates.current) }
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load Search Console settings.') }
    finally { setLoading(false); setActivity(null) }
  }, [requestReport])
  useEffect(() => { void load() }, [load])
  const chooseProperty = async (siteUrl: string) => {
    setRefreshing(true); setMessage(''); setActivity({ stage: 'property', title: 'Switching Search Console property', detail: 'Saving the selected property before requesting its live report.' })
    try { const result = await api<{ data: Status }>('/admin/search-console/property', { method: 'PUT', body: JSON.stringify({ siteUrl }) }); setStatus(result.data); setActivity({ stage: 'report', title: 'Loading the selected property', detail: 'Collecting performance, sitemap status, and priority URL inspections.' }); await requestReport(dates) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not select the Search Console property.') }
    finally { setRefreshing(false); setActivity(null) }
  }
  const disconnect = async () => {
    if (!confirm('Disconnect Google Search Console? The encrypted server connection file will be removed.')) return
    setRefreshing(true); setMessage(''); setActivity({ stage: 'disconnect', title: 'Disconnecting Search Console', detail: 'Removing the encrypted server-side connection.' })
    try { await api('/admin/search-console/connection', { method: 'DELETE' }); setStatus(current => current ? { ...current, connected: false, selectedProperty: null } : current); setProperties([]); setReport(null) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not disconnect Google Search Console.') }
    finally { setRefreshing(false); setActivity(null) }
  }
  const applyDates = () => { void loadReport(dates) }
  const exportHref = `/api/admin/search-console/export?startDate=${encodeURIComponent(dates.startDate)}&endDate=${encodeURIComponent(dates.endDate)}`
  if (loading) return <InsightsLoadingScreen activity={activity} />
  return <>
    <div className="title-row"><div><span className="eyebrow">Search visibility</span><h1>Search Insights</h1><p>Live Google Search Console data for ThePaperLeaf. Nothing is stored in the CMS database.</p></div>{status?.configured && status.connected && <div className="insights-actions"><button className="secondary" disabled={refreshing || !status.selectedProperty} onClick={() => void loadReport(dates)}>{refreshing ? <LoaderCircle className="spin" /> : <RefreshCw />}{refreshing ? 'Loading…' : 'Refresh'}</button><a className="primary" href={exportHref}><FileJson />Download AI context JSON</a></div>}</div>
    {message && <div className="alert"><AlertCircle />{message}</div>}
    {!status?.configured && <section className="panel insights-setup"><SearchCheck /><div><h2>Server configuration required</h2><p>Add the Google OAuth Web client ID, client secret, token encryption key, and private token-file path to the API environment. The callback URI is shown in the deployment guide.</p></div></section>}
    {status?.configured && !status.connected && <section className="panel insights-setup"><Link2 /><div><h2>Connect Google Search Console</h2><p>Authorize the Google account that has Full user or Owner access. The CMS requests read-only Search Console access only.</p></div><button className="primary" onClick={() => { window.location.assign('/api/admin/search-console/oauth/connect') }}>Connect Google</button></section>}
    {status?.configured && status.connected && <>
      {refreshing && <InsightsLoadingNotice activity={activity} />}
      <section className="panel insights-controls" aria-busy={refreshing}><label>Search Console property<select value={status.selectedProperty ?? ''} disabled={refreshing} onChange={event => void chooseProperty(event.target.value)}><option value="">Choose a property…</option>{properties.map(property => <option value={property.siteUrl} key={property.siteUrl}>{property.siteUrl} · {property.permissionLevel.replace('site', '')}</option>)}</select></label><label>Start date<input type="date" max={dates.endDate} value={dates.startDate} disabled={refreshing} onChange={event => setDates(current => ({ ...current, startDate: event.target.value }))}/></label><label>End date<input type="date" min={dates.startDate} max={dateOnly(new Date())} value={dates.endDate} disabled={refreshing} onChange={event => setDates(current => ({ ...current, endDate: event.target.value }))}/></label><button className="secondary" disabled={refreshing || !status.selectedProperty} onClick={applyDates}>{refreshing ? <LoaderCircle className="spin" /> : <BarChart3 />}{refreshing ? 'Loading…' : 'Apply range'}</button><button className="ghost danger-link" disabled={refreshing} onClick={() => void disconnect()}><Unplug />Disconnect</button></section>
      {!status.selectedProperty && <section className="panel insights-setup"><Link2 /><div><h2>Select a property</h2><p>Choose the ThePaperLeaf property available to this Google account before loading its report.</p></div></section>}
      {report && <InsightsReport report={report} />}
    </>}
  </>
}

function InsightsLoadingScreen({ activity }: { activity: InsightActivity | null }) {
  return <section className="insights-loading-page" aria-busy="true" aria-live="polite"><div className="insights-loading-card"><div className="insights-loading-icon"><LoaderCircle className="spin" /></div><div><span className="eyebrow">Search visibility</span><h1>{activity?.title ?? 'Preparing Search Insights'}</h1><p>{activity?.detail ?? 'Loading your Google Search Console workspace.'}</p></div><LoadingSteps stage={activity?.stage} /><small>Google can take longer to return sitemap and URL-inspection data. Please keep this page open.</small></div></section>
}

function InsightsLoadingNotice({ activity }: { activity: InsightActivity | null }) {
  return <section className="insights-loading-notice" role="status" aria-live="polite"><LoaderCircle className="spin" /><div><b>{activity?.title ?? 'Updating Search Insights'}</b><span>{activity?.detail ?? 'Your existing report remains visible while the latest data loads.'}</span></div><span className="insights-loading-pulse" aria-hidden="true"><i /><i /><i /></span></section>
}

function LoadingSteps({ stage }: { stage?: InsightActivity['stage'] }) {
  const steps = [{ id: 'connection', label: 'Connection' }, { id: 'property', label: 'Property' }, { id: 'report', label: 'Live report' }]
  const active = Math.max(0, steps.findIndex(step => step.id === stage))
  return <ol className="insights-loading-steps">{steps.map((step, index) => <li className={index < active ? 'complete' : index === active ? 'active' : ''} key={step.id}><span>{index < active ? '✓' : index + 1}</span>{step.label}</li>)}</ol>
}

function InsightsReport({ report }: { report: Report }) {
  const cards = [{ label: 'Clicks', current: report.summary.clicks, prior: report.previousSummary.clicks, format: (value: number) => number.format(value) }, { label: 'Impressions', current: report.summary.impressions, prior: report.previousSummary.impressions, format: (value: number) => number.format(value) }, { label: 'CTR', current: report.summary.ctr, prior: report.previousSummary.ctr, format: (value: number) => percentage.format(value) }, { label: 'Average position', current: report.summary.position, prior: report.previousSummary.position, format: (value: number) => value.toFixed(1) }]
  return <>
    <div className="insights-report-note"><span><CheckCircle2 />Live report for <b>{report.property}</b></span><small>{report.range.startDate} → {report.range.endDate} · Generated {formatDate(report.generatedAt)}</small></div>
    <section className="insight-stat-grid">{cards.map(card => { const delta = change(card.current, card.prior); return <article className="stat" key={card.label}><span><BarChart3 /></span><strong>{card.format(card.current)}</strong><p>{card.label}</p><small className={delta !== null && delta < 0 ? 'negative' : 'positive'}>{delta === null ? 'No prior data' : `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(1)}% vs prior period`}</small></article> })}</section>
    {report.notices.length > 0 && <section className="alert insights-notices"><AlertCircle /><div><b>Some Google data could not be retrieved.</b>{report.notices.map(notice => <small key={`${notice.section}:${notice.message}`}>{notice.section}: {notice.message}</small>)}</div></section>}
    <section className="panel insight-chart"><div><span className="eyebrow">Trend</span><h2>Daily clicks</h2></div><TrendChart rows={report.daily} /></section>
    <section className="insights-tables"><MetricTable title="Top search queries" rows={report.queries} limit={report.rowLimits.queries} /><MetricTable title="Top pages" rows={report.pages} limit={report.rowLimits.pages} /><MetricTable title="Countries" rows={report.countries} /><MetricTable title="Devices" rows={report.devices} /><MetricTable title="Search appearance" rows={report.searchAppearances} /></section>
    <section className="insights-lower"><Sitemaps rows={report.sitemaps} /><Inspections rows={report.inspections} /></section>
    <section className="panel api-limit-note"><b>API coverage</b><p>Search Analytics, submitted sitemaps, properties, and priority URL inspection are available live. Google does not expose Page Indexing, Core Web Vitals, or Links reports through this API.</p></section>
  </>
}

function TrendChart({ rows }: { rows: MetricRow[] }) {
  const data = useMemo(() => [...rows].sort((a, b) => a.keys[0]!.localeCompare(b.keys[0]!)), [rows]); const maximum = Math.max(1, ...data.map(row => row.clicks))
  const points = data.map((row, index) => `${data.length > 1 ? index / (data.length - 1) * 760 + 20 : 400},${170 - row.clicks / maximum * 140}`).join(' ')
  return <div className="trend-chart">{data.length ? <svg viewBox="0 0 800 190" role="img" aria-label="Daily clicks trend"><line x1="20" y1="170" x2="780" y2="170" /><polyline points={points} /></svg> : <p>No daily performance rows are available for this range.</p>}<small>{data[0]?.keys[0] ?? ''}<b>{maximum} peak clicks</b>{data.at(-1)?.keys[0] ?? ''}</small></div>
}

function MetricTable({ title, rows, limit }: { title: string; rows: MetricRow[]; limit?: number }) {
  const [sort, setSort] = useState<keyof Metric>('clicks'); const [descending, setDescending] = useState(true); const [page, setPage] = useState(0); const pageSize = 25
  const sorted = useMemo(() => [...rows].sort((left, right) => (left[sort] - right[sort]) * (descending ? -1 : 1)), [rows, sort, descending]); const visible = sorted.slice(page * pageSize, page * pageSize + pageSize); const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const sortBy = (next: keyof Metric) => { setPage(0); if (next === sort) setDescending(value => !value); else { setSort(next); setDescending(true) } }
  return <section className="panel metric-table"><div className="metric-table-head"><div><span className="eyebrow">Performance</span><h2>{title}</h2></div><small>{number.format(rows.length)}{limit ? ` of up to ${number.format(limit)}` : ''} rows</small></div><div className="metric-grid"><div className="metric-grid-head"><span>Dimension</span>{(['clicks', 'impressions', 'ctr', 'position'] as const).map(column => <button key={column} onClick={() => sortBy(column)}>{column}{sort === column ? (descending ? ' ↓' : ' ↑') : ''}</button>)}</div>{visible.map((row, index) => <div className="metric-grid-row" key={`${row.keys.join('|')}:${index}`}><span title={row.keys.join(', ')}>{row.keys.join(', ') || '—'}</span><b>{number.format(row.clicks)}</b><b>{number.format(row.impressions)}</b><b>{percentage.format(row.ctr)}</b><b>{row.position.toFixed(1)}</b></div>)}{!visible.length && <div className="empty">No rows available.</div>}</div>{rows.length > pageSize && <div className="metric-pagination"><button className="ghost" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous</button><small>Page {page + 1} of {totalPages}</small><button className="ghost" disabled={page >= totalPages - 1} onClick={() => setPage(value => value + 1)}>Next</button></div>}</section>
}

function Sitemaps({ rows }: { rows: Report['sitemaps'] }) { return <section className="panel sitemap-panel"><span className="eyebrow">Coverage input</span><h2>Sitemaps</h2>{rows.map(row => <article key={row.path}><a href={row.path} target="_blank" rel="noreferrer">{row.path}<ExternalLink /></a><small>Submitted {formatDate(row.submitted)} · Downloaded {formatDate(row.lastDownloaded)} · {row.errors ?? 0} errors · {row.warnings ?? 0} warnings</small></article>)}{!rows.length && <p>No submitted sitemaps were returned by Google.</p>}</section> }
function Inspections({ rows }: { rows: Report['inspections'] }) { return <section className="panel inspection-panel"><span className="eyebrow">Google index</span><h2>Priority URL inspection</h2>{rows.map(row => <article key={row.url} className={row.error || row.verdict === 'FAIL' ? 'attention' : ''}><a href={row.url} target="_blank" rel="noreferrer">{row.url}<ExternalLink /></a><b>{row.error ?? row.verdict ?? 'No result'}</b><small>{row.error ?? row.coverageState ?? row.indexingState ?? 'Google returned no index status.'}</small></article>)}</section> }
