import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Save, Search, Trash2 } from 'lucide-react'
import { api } from '../lib/api'

type Category = { id?: string; name: string; slug: string; description: string; color: string; sortOrder: number; isActive: boolean; _count?: { contents: number } }
const blank: Category = { name: '', slug: '', description: '', color: '#2521E1', sortOrder: 0, isActive: true }
const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function CategoriesPage() {
  const [items, setItems] = useState<Category[]>([])
  const [draft, setDraft] = useState<Category>(blank)
  const [filter, setFilter] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => api<{ data: Category[] }>('/admin/categories').then(r => setItems(r.data))
  useEffect(() => { load() }, [])

  const save = async (item: Category) => {
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const body = { ...item, slug: item.slug || slugify(item.name) }
      const r = await api<{ data: Category }>(item.id ? `/admin/categories/${item.id}` : '/admin/categories', { method: item.id ? 'PUT' : 'POST', body: JSON.stringify(body) })
      setNotice(`Saved ${r.data.name}. Linked posts now use the latest category label.`)
      setDraft(blank)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save category')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (item: Category) => {
    if (!item.id || !confirm(`Delete “${item.name}”? Categories already used by posts are protected.`)) return
    setError('')
    setNotice('')
    try {
      await api(`/admin/categories/${item.id}`, { method: 'DELETE' })
      setNotice(`Deleted ${item.name}.`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete category')
    }
  }

  const move = async (index: number, direction: -1 | 1) => {
    const next = [...items]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    const current = next[index]
    const sibling = next[target]
    if (!current || !sibling) return
    next[index] = sibling
    next[target] = current
    const ordered = next.map((item, i) => ({ ...item, sortOrder: (i + 1) * 10 }))
    setItems(ordered)
    await api<{ data: Category[] }>('/admin/categories/reorder', { method: 'POST', body: JSON.stringify({ items: ordered.map(({ id, sortOrder }) => ({ id, sortOrder })) }) }).then(r => setItems(r.data))
  }

  const filtered = items.filter(i => `${i.name} ${i.slug} ${i.description}`.toLowerCase().includes(filter.toLowerCase()))

  return (
    <>
      <div className="title-row">
        <div>
          <span className="eyebrow">Taxonomy</span>
          <h1>Categories</h1>
          <p>Create, rename, reorder, disable, and safely delete the topics used by the news website navigation.</p>
        </div>
        <button className="primary" disabled={busy || !draft.name.trim()} onClick={() => save(draft)}><Plus />Add category</button>
      </div>
      {error && <div className="alert">{error}</div>}
      {notice && <div className="notice">{notice}</div>}
      <section className="panel category-panel">
        <div className="category-editor">
          <input aria-label="Category name" placeholder="Name" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value, slug: draft.slug || slugify(e.target.value) })} />
          <input aria-label="Category slug" placeholder="slug" value={draft.slug} onChange={e => setDraft({ ...draft, slug: slugify(e.target.value) })} />
          <input aria-label="Description" placeholder="Description" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
          <input aria-label="Color" type="color" value={draft.color} onChange={e => setDraft({ ...draft, color: e.target.value })} />
          <label className="check-row"><input type="checkbox" checked={draft.isActive} onChange={e => setDraft({ ...draft, isActive: e.target.checked })} /><span>Active</span></label>
        </div>
        <label className="search media-search"><Search /><input placeholder="Search categories…" value={filter} onChange={e => setFilter(e.target.value)} /></label>
        <div className="category-list">
          {filtered.map(item => {
            const originalIndex = items.findIndex(i => i.id === item.id)
            return <CategoryRow key={item.id} item={item} index={originalIndex} total={items.length} onSave={save} onMove={move} onDelete={remove} />
          })}
          {!filtered.length && <div className="empty">No categories match this search.</div>}
        </div>
      </section>
    </>
  )
}

function CategoryRow({ item, index, total, onSave, onMove, onDelete }: { item: Category; index: number; total: number; onSave: (item: Category) => void; onMove: (index: number, direction: -1 | 1) => void; onDelete: (item: Category) => void }) {
  const [draft, setDraft] = useState(item)
  useEffect(() => setDraft(item), [item])
  const used = draft._count?.contents ?? 0

  return (
    <div className={`category-row ${draft.isActive ? '' : 'disabled'}`}>
      <span className="category-dot" style={{ background: draft.color }} />
      <input aria-label={`${draft.name} name`} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
      <input aria-label={`${draft.name} slug`} value={draft.slug} onChange={e => setDraft({ ...draft, slug: slugify(e.target.value) })} />
      <input aria-label={`${draft.name} description`} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
      <input aria-label={`${draft.name} color`} type="color" value={draft.color} onChange={e => setDraft({ ...draft, color: e.target.value })} />
      <span className="usage-pill">{used} {used === 1 ? 'post' : 'posts'}</span>
      <label className="check-row"><input type="checkbox" checked={draft.isActive} onChange={e => setDraft({ ...draft, isActive: e.target.checked })} /><span>{draft.isActive ? 'Active' : 'Disabled'}</span></label>
      <div className="row-actions">
        <button className="ghost icon-only" title="Move up" disabled={index <= 0} onClick={() => onMove(index, -1)}><ArrowUp /></button>
        <button className="ghost icon-only" title="Move down" disabled={index >= total - 1} onClick={() => onMove(index, 1)}><ArrowDown /></button>
        <button className="secondary icon-only" title="Save" onClick={() => onSave(draft)}><Save /></button>
        <button className="danger icon-only" title={used ? 'Move posts before deleting' : 'Delete'} disabled={used > 0} onClick={() => onDelete(draft)}><Trash2 /></button>
      </div>
    </div>
  )
}
