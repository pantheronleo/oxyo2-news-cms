import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Pencil, Plus, Save, Search, Trash2, X } from 'lucide-react'
import { api } from '../lib/api'

type Category = { id?: string; name: string; nameZh: string; slug: string; description: string; descriptionZh: string; color: string; sortOrder: number; isActive: boolean; _count?: { contents: number } }
const blank: Category = { name: '', nameZh: '', slug: '', description: '', descriptionZh: '', color: '#2521E1', sortOrder: 0, isActive: true }
const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function CategoriesPage() {
  const [items, setItems] = useState<Category[]>([])
  const [draft, setDraft] = useState<Category>(blank)
  const [isCreating, setIsCreating] = useState(false)
  const [filter, setFilter] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => api<{ data: Category[] }>('/admin/categories').then(r => setItems(r.data))
  useEffect(() => { load() }, [])

  const save = async (item: Category) => {
    setError(''); setNotice(''); setBusy(true)
    try {
      const body = { ...item, slug: item.slug || slugify(item.name) }
      const r = await api<{ data: Category }>(item.id ? `/admin/categories/${item.id}` : '/admin/categories', { method: item.id ? 'PUT' : 'POST', body: JSON.stringify(body) })
      setNotice(item.id ? `Saved ${r.data.name}.` : `Created ${r.data.name}. It is now available to content editors and the news site.`)
      if (!item.id) { setDraft(blank); setIsCreating(false) }
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save category') } finally { setBusy(false) }
  }

  const remove = async (item: Category) => {
    if (!item.id || !confirm(`Delete “${item.name}”? Categories already used by posts are protected.`)) return
    setError(''); setNotice('')
    try { await api(`/admin/categories/${item.id}`, { method: 'DELETE' }); setNotice(`Deleted ${item.name}.`); await load() } catch (e) { setError(e instanceof Error ? e.message : 'Could not delete category') }
  }

  const move = async (index: number, direction: -1 | 1) => {
    const next = [...items]; const target = index + direction
    if (target < 0 || target >= next.length) return
    const current = next[index]; const sibling = next[target]
    if (!current || !sibling) return
    next[index] = sibling; next[target] = current
    const ordered = next.map((item, i) => ({ ...item, sortOrder: (i + 1) * 10 }))
    setItems(ordered)
    try { const result = await api<{ data: Category[] }>('/admin/categories/reorder', { method: 'POST', body: JSON.stringify({ items: ordered.map(({ id, sortOrder }) => ({ id, sortOrder })) }) }); setItems(result.data) } catch (e) { setError(e instanceof Error ? e.message : 'Could not reorder categories'); await load() }
  }

  const filtered = items.filter(i => `${i.name} ${i.nameZh} ${i.slug} ${i.description} ${i.descriptionZh}`.toLowerCase().includes(filter.toLowerCase()))

  return <>
    <div className="title-row category-title-row"><div><span className="eyebrow">Taxonomy</span><h1>Categories</h1><p>Organise newsroom topics, public navigation labels, and their Chinese translations.</p></div><button className="primary" disabled={busy} onClick={() => { setIsCreating(true); setDraft(blank) }}><Plus />New category</button></div>
    {error && <div className="alert">{error}</div>}{notice && <div className="notice">{notice}</div>}
    {isCreating && <section className="category-create-card" aria-labelledby="new-category-heading"><div className="category-create-head"><div><span className="eyebrow">New topic</span><h2 id="new-category-heading">Create a category</h2><p>English is used for the URL slug. Add Chinese labels for the Chinese-first news site.</p></div><button className="ghost icon-only" title="Cancel category creation" onClick={() => { setIsCreating(false); setDraft(blank) }}><X /></button></div><CategoryFields value={draft} onChange={setDraft} prefix="new" /><div className="category-create-actions"><button className="secondary" onClick={() => { setIsCreating(false); setDraft(blank) }}>Cancel</button><button className="primary" disabled={busy || !draft.name.trim()} onClick={() => save(draft)}><Plus />Create category</button></div></section>}
    <section className="panel category-panel"><div className="category-panel-head"><div><span className="eyebrow">Your taxonomy</span><h2>{items.length} categories</h2></div><label className="search category-search"><Search /><input placeholder="Search categories…" value={filter} onChange={e => setFilter(e.target.value)} /></label></div><div className="category-list">{filtered.map(item => <CategoryRow key={item.id} item={item} index={items.findIndex(i => i.id === item.id)} total={items.length} busy={busy} onSave={save} onMove={move} onDelete={remove} />)}{!filtered.length && <div className="empty">No categories match this search.</div>}</div></section>
  </>
}

function CategoryFields({ value, onChange, prefix }: { value: Category; onChange: (category: Category) => void; prefix: string }) {
  const update = (next: Partial<Category>) => onChange({ ...value, ...next })
  return <div className="category-fields"><label><span>English name <i>Required</i></span><input aria-label={`${prefix} English category name`} placeholder="Business" value={value.name} onChange={e => update({ name: e.target.value, slug: value.slug || slugify(e.target.value) })} /></label><label><span>Chinese name <em>Optional</em></span><input aria-label={`${prefix} Chinese category name`} placeholder="商业" value={value.nameZh} onChange={e => update({ nameZh: e.target.value })} /></label><label><span>URL slug</span><input aria-label={`${prefix} category slug`} placeholder="business" value={value.slug} onChange={e => update({ slug: slugify(e.target.value) })} /></label><label className="category-color-field"><span>Colour</span><input aria-label={`${prefix} category colour`} type="color" value={value.color} onChange={e => update({ color: e.target.value })} /></label><label className="category-wide"><span>English description <em>Optional</em></span><input aria-label={`${prefix} English description`} placeholder="Business, markets, and practical context" value={value.description} onChange={e => update({ description: e.target.value })} /></label><label className="category-wide"><span>Chinese description <em>Optional</em></span><input aria-label={`${prefix} Chinese description`} placeholder="商业、市场与实用资讯" value={value.descriptionZh} onChange={e => update({ descriptionZh: e.target.value })} /></label><label className="category-active"><input type="checkbox" checked={value.isActive} onChange={e => update({ isActive: e.target.checked })} /><span>{value.isActive ? 'Visible on the news site' : 'Hidden from the news site'}</span></label></div>
}

function CategoryRow({ item, index, total, busy, onSave, onMove, onDelete }: { item: Category; index: number; total: number; busy: boolean; onSave: (item: Category) => Promise<void>; onMove: (index: number, direction: -1 | 1) => void; onDelete: (item: Category) => void }) {
  const [draft, setDraft] = useState(item)
  const [isEditing, setIsEditing] = useState(false)
  useEffect(() => setDraft(item), [item])
  const used = draft._count?.contents ?? 0
  return <article className={`category-row ${draft.isActive ? '' : 'disabled'} ${isEditing ? 'editing' : ''}`}><div className="category-row-head"><span className="category-dot" style={{ background: draft.color }} /><div className="category-identity"><b>{draft.name || 'Untitled category'}</b><small>{draft.nameZh ? `${draft.nameZh} · ` : ''}/{draft.slug || 'new-category'}</small></div><span className="usage-pill">{used} {used === 1 ? 'post' : 'posts'}</span><span className={`category-status ${draft.isActive ? 'active' : ''}`}>{draft.isActive ? 'Visible' : 'Hidden'}</span><div className="row-actions"><button className="ghost icon-only" title="Move up" disabled={busy || index <= 0} onClick={() => onMove(index, -1)}><ArrowUp /></button><button className="ghost icon-only" title="Move down" disabled={busy || index >= total - 1} onClick={() => onMove(index, 1)}><ArrowDown /></button><button className="secondary" disabled={busy} onClick={() => setIsEditing(true)}><Pencil />Edit</button><button className="danger icon-only" title={used ? 'Move posts before deleting' : 'Delete'} disabled={busy || used > 0} onClick={() => onDelete(draft)}><Trash2 /></button></div></div>{isEditing && <><CategoryFields value={draft} onChange={setDraft} prefix={draft.name || 'category'} /><div className="category-edit-actions"><button className="ghost" disabled={busy} onClick={() => { setDraft(item); setIsEditing(false) }}>Cancel</button><button className="primary" disabled={busy || !draft.name.trim()} onClick={async () => { await onSave(draft); setIsEditing(false) }}><Save />Save changes</button></div></>}</article>
}
