import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Editor from '@toast-ui/editor'
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Eye, Image as ImageIcon, Save, Search, Send, Trash2, Upload, X } from 'lucide-react'
import { api } from '../lib/api'
import './editor-language.css'

type Category = { id: string; name: string; slug: string }
type Media = { id: string; originalName: string; url: string; mimeType: string; size: string; altText: string; caption: string; createdAt: string }
type MediaMeta = { page: number; limit: number; total: number; pages: number }
type Item = {
  id?: string
  type: 'POST' | 'PAGE'
  title: string
  slug: string
  excerpt: string
  category: string
  categoryId: string | null
  authorName: string
  sourceLabel: string
  sourceUrl?: string | null
  isFeatured: boolean
  markdown: string
  status: string
  tags: string[]
  seoTitle: string
  seoDescription: string
  scheduledAt: string | null
  coverMediaId: string | null
  coverMedia?: { id: string; url: string; altText: string } | null
  translations?: Translation[]
}
type Translation = { id?: string; language: 'EN'; title: string; excerpt: string; markdown: string; seoTitle: string | null; seoDescription: string | null; wordCount?: number }

const blank = (type: 'POST' | 'PAGE'): Item => ({
  type,
  title: '',
  slug: '',
  excerpt: '',
  category: 'General',
  categoryId: null,
  authorName: 'Editorial Desk',
  sourceLabel: '',
  sourceUrl: '',
  isFeatured: false,
  markdown: '',
  status: 'DRAFT',
  tags: [],
  seoTitle: '',
  seoDescription: '',
  scheduledAt: null,
  coverMediaId: null,
  coverMedia: null
})

export function EditorPage() {
  const { id, kind = 'posts' } = useParams()
  const type = kind === 'pages' ? 'PAGE' : 'POST'
  const navigate = useNavigate()
  const [item, setItem] = useState<Item>(blank(type))
  const [english, setEnglish] = useState<Translation>({ language: 'EN', title: '', excerpt: '', markdown: '', seoTitle: '', seoDescription: '' })
  const [activeLanguage, setActiveLanguage] = useState<'zh-CN' | 'en'>('zh-CN')
  const [categories, setCategories] = useState<Category[]>([])
  const [media, setMedia] = useState<Media[]>([])
  const [mediaMeta, setMediaMeta] = useState<MediaMeta>({ page: 1, limit: 12, total: 0, pages: 0 })
  const [mediaSearch, setMediaSearch] = useState('')
  const [mediaPage, setMediaPage] = useState(1)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [previewMedia, setPreviewMedia] = useState<Media | null>(null)
  const [saved, setSaved] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const host = useRef<HTMLDivElement>(null)
  const editor = useRef<Editor | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const fileInput = useRef<HTMLInputElement>(null)

  const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100)
  const patch = (next: Partial<Item>) => {
    setItem(current => ({ ...current, ...next }))
    setSaved(false)
  }
  const patchLanguage = (next: Partial<Translation | Item>) => {
    if (activeLanguage === 'en') setEnglish(current => ({ ...current, ...next } as Translation))
    else patch(next as Partial<Item>)
    setSaved(false)
  }
  const languageItem = activeLanguage === 'en' ? english : item
  const switchLanguage = (language: 'zh-CN' | 'en') => {
    if (language === activeLanguage) return
    const markdown = editor.current?.getMarkdown() ?? ''
    if (activeLanguage === 'en') setEnglish(current => ({ ...current, markdown }))
    else setItem(current => ({ ...current, markdown }))
    setActiveLanguage(language)
    window.setTimeout(() => editor.current?.setMarkdown(language === 'en' ? english.markdown : item.markdown), 0)
  }

  const save = async (status = item.status, silent = false) => {
    if (!languageItem.title.trim()) {
      if (!silent) setError('Add a title before saving.')
      return
    }
    setBusy(true)
    setError('')
    try {
      if (activeLanguage === 'en') {
        if (!id) throw new Error('Save the Chinese primary article before adding its English version.')
        const body = { ...english, markdown: editor.current?.getMarkdown() ?? '' }
        const r = await api<{ data: Translation }>(`/admin/content/${id}/translations/en`, { method: 'PUT', body: JSON.stringify(body) })
        setEnglish(r.data); setSaved(true); return
      }
      const category = categories.find(c => c.id === item.categoryId)
      const body = {
        ...item,
        status,
        category: category?.name || item.category || 'General',
        markdown: editor.current?.getMarkdown() ?? '',
        slug: item.slug || slug(item.title),
        sourceLabel: item.sourceLabel || null,
        sourceUrl: item.sourceUrl || null,
        coverMediaId: item.coverMediaId || null
      }
      const r = await api<{ data: Item }>(id ? `/admin/content/${id}` : '/admin/content', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(body)
      })
      setItem({
        ...r.data,
        sourceLabel: r.data.sourceLabel ?? '',
        sourceUrl: r.data.sourceUrl ?? '',
        category: r.data.category ?? 'General',
        categoryId: r.data.categoryId ?? null,
        coverMediaId: r.data.coverMediaId ?? r.data.coverMedia?.id ?? null
      })
      setSaved(true)
      if (!id) navigate(`/${kind}/${r.data.id}`, { replace: true })
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!host.current) return
    editor.current = new Editor({
      el: host.current,
      height: '540px',
      initialEditType: 'wysiwyg',
      previewStyle: 'vertical',
      usageStatistics: false,
      toolbarItems: [
        ['heading', 'bold', 'italic', 'strike'],
        ['hr', 'quote'],
        ['ul', 'ol', 'task', 'indent', 'outdent'],
        ['table', 'image', 'link'],
        ['code', 'codeblock']
      ]
    })
    editor.current.on('change', () => {
      setSaved(false)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        if (id) save('DRAFT', true)
      }, 1500)
    })
    return () => {
      window.clearTimeout(timer.current)
      editor.current?.destroy()
    }
  }, [])

  useEffect(() => {
    api<{ data: Category[] }>('/admin/categories').then(r => setCategories(r.data))
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => {
      api<{ data: Media[]; meta: MediaMeta }>(`/admin/media?limit=12&page=${mediaPage}&search=${encodeURIComponent(mediaSearch)}`).then(r => {
        const images = r.data.filter(m => m.mimeType.startsWith('image/'))
        setMedia(images)
        setMediaMeta(r.meta)
        setPreviewMedia(current => current && images.some(m => m.id === current.id) ? current : images[0] ?? null)
      })
    }, 200)
    return () => window.clearTimeout(t)
  }, [mediaSearch, mediaPage])

  useEffect(() => {
    setMediaPage(1)
  }, [mediaSearch])

  useEffect(() => {
    if (!id) return
    api<{ data: Item }>(`/admin/content/${id}`).then(r => {
      setItem({
        ...r.data,
        seoTitle: r.data.seoTitle ?? '',
        seoDescription: r.data.seoDescription ?? '',
        sourceLabel: r.data.sourceLabel ?? '',
        sourceUrl: r.data.sourceUrl ?? '',
        category: r.data.category ?? 'General',
        categoryId: r.data.categoryId ?? null,
        authorName: r.data.authorName ?? 'Editorial Desk',
        isFeatured: Boolean(r.data.isFeatured),
        coverMediaId: r.data.coverMediaId ?? r.data.coverMedia?.id ?? null
      })
      const translation = r.data.translations?.find(value => value.language === 'EN')
      if (translation) setEnglish({ ...translation, language: 'EN', seoTitle: translation.seoTitle ?? '', seoDescription: translation.seoDescription ?? '' })
      editor.current?.setMarkdown(r.data.markdown ?? '')
      setSaved(true)
    })
  }, [id])

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (saved) return
      e.preventDefault()
    }
    addEventListener('beforeunload', warn)
    return () => removeEventListener('beforeunload', warn)
  }, [saved])

  const uploadCover = (file: File) => {
    setError('')
    setUploading(true)
    const data = new FormData()
    data.append('file', file)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/admin/media')
    xhr.withCredentials = true
    xhr.onload = () => {
      setUploading(false)
      if (xhr.status < 300) {
        const value = JSON.parse(xhr.responseText).data as Media
        setMedia(current => [value, ...current])
        patch({ coverMediaId: value.id, coverMedia: { id: value.id, url: value.url, altText: value.altText } })
      } else {
        setError(JSON.parse(xhr.responseText).error?.message ?? 'Upload failed')
      }
    }
    xhr.onerror = () => {
      setUploading(false)
      setError('Upload failed')
    }
    api('/admin/auth/me').then((r: any) => {
      xhr.setRequestHeader('x-csrf-token', r.csrfToken)
      xhr.send(data)
    })
  }

  const selectedCover = media.find(m => m.id === item.coverMediaId) || null
  const preview = () => {
    const html = editor.current?.getHTML() ?? ''
    const w = open('', 'cms-preview')
    w?.document.write(`<title>${languageItem.title}</title><style>body{font:18px/1.7 system-ui;max-width:760px;margin:60px auto;padding:20px;color:#24332d}img{max-width:100%}.meta{color:#6f7b73;font-size:14px;text-transform:uppercase;letter-spacing:.08em}</style><p class="meta">${item.category} · ${item.authorName}</p><h1>${languageItem.title}</h1>${html}`)
    w?.document.close()
  }

  return <>
    <div className="editor-top">
      <button className="ghost" onClick={() => navigate(`/${kind}`)}><ArrowLeft />Back</button>
      <div className="save-state">{saved ? <><Check />Saved</> : <>Unsaved changes</>}</div>
      <button className="ghost" onClick={preview}><Eye />Preview</button>
      <button className="secondary" disabled={busy} onClick={() => save(item.status)}><Save />Save</button>
      <button className="primary" disabled={busy} onClick={() => save('PUBLISHED')}><Send />Publish</button>
    </div>
    {error && <div className="alert">{error}</div>}
    <div className="editor-layout">
      <section className="editor-main">
        <div className="editor-language-tabs" role="tablist"><button type="button" className={activeLanguage === 'zh-CN' ? 'active' : ''} onClick={() => switchLanguage('zh-CN')}>中文 · Primary</button><button type="button" className={activeLanguage === 'en' ? 'active' : ''} onClick={() => switchLanguage('en')} disabled={!id}>English{english.title ? '' : ' · Add translation'}</button></div>
        <input className="title-input" aria-label="Title" placeholder="Untitled masterpiece" value={languageItem.title} onChange={e => {
          if (activeLanguage === 'en') patchLanguage({ title: e.target.value })
          else { setItem({ ...item, title: e.target.value, slug: item.slug || slug(e.target.value) }); setSaved(false) }
        }} />
        {activeLanguage === 'zh-CN' && <input className="slug-input" aria-label="Slug" value={item.slug} onChange={e => {
          setItem({ ...item, slug: slug(e.target.value) })
          setSaved(false)
        }} placeholder="content-slug" />}
        <div ref={host} />
      </section>
      <aside className="inspector">
        <h3>Publishing</h3>
        <label>Status<select value={item.status} onChange={e => patch({ status: e.target.value })}><option>DRAFT</option><option>SCHEDULED</option><option>PUBLISHED</option><option>ARCHIVED</option></select></label>
        {item.status === 'SCHEDULED' && <label>Publish at<input type="datetime-local" value={item.scheduledAt?.slice(0, 16) ?? ''} onChange={e => patch({ scheduledAt: new Date(e.target.value).toISOString() })} /></label>}
        <hr />
        <h3>News metadata</h3>
        <label>Category<select value={item.categoryId ?? ''} onChange={e => {
          const c = categories.find(c => c.id === e.target.value)
          patch({ categoryId: e.target.value || null, category: c?.name || 'General' })
        }}><option value="">General</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Author<input value={item.authorName} onChange={e => patch({ authorName: e.target.value })} placeholder="Editorial Desk" /></label>
        <label>Source label<input value={item.sourceLabel} onChange={e => patch({ sourceLabel: e.target.value })} placeholder="CMS Newsroom" /></label>
        <label>Source URL<input type="url" value={item.sourceUrl ?? ''} onChange={e => patch({ sourceUrl: e.target.value })} placeholder="https://publisher.example/article" /></label>
        <label className="check-row"><input type="checkbox" checked={item.isFeatured} onChange={e => patch({ isFeatured: e.target.checked })} /><span>Feature this story</span></label>
        <hr />
        <h3>Thumbnail</h3>
        <div className="cover-box">{selectedCover ? <img src={selectedCover.url} alt={selectedCover.altText} /> : item.coverMedia?.url ? <img src={item.coverMedia.url} alt={item.coverMedia.altText} /> : <span><ImageIcon />No thumbnail selected</span>}</div>
        <div className="cover-actions">
          <button className="secondary" type="button" onClick={() => setPickerOpen(true)}><Search />Choose from media</button>
          <button className="secondary" type="button" disabled={uploading} onClick={() => fileInput.current?.click()}><Upload />{uploading ? 'Uploading…' : 'Upload thumbnail'}</button>
          {item.coverMediaId && <button className="ghost" type="button" onClick={() => patch({ coverMediaId: null })}><Trash2 />Clear</button>}
        </div>
        <input ref={fileInput} hidden type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={e => e.target.files?.[0] && uploadCover(e.target.files[0])} />
        <hr />
        <h3>Details</h3>
        <label>Excerpt<textarea rows={4} value={languageItem.excerpt} onChange={e => patchLanguage({ excerpt: e.target.value })} /></label>
        <label>Tags<input value={item.tags.join(', ')} onChange={e => patch({ tags: e.target.value.split(',').map(v => v.trim()).filter(Boolean) })} placeholder="design, news" /></label>
        <hr />
        <h3>SEO</h3>
        <label>SEO title<input value={languageItem.seoTitle ?? ''} onChange={e => patchLanguage({ seoTitle: e.target.value })} /></label>
        <label>Description<textarea rows={3} value={languageItem.seoDescription ?? ''} onChange={e => patchLanguage({ seoDescription: e.target.value })} /></label>
        <a className="media-link" href="/media" target="_blank"><ImageIcon />Open media library</a>
      </aside>
    </div>
    {pickerOpen && <div className="modal-backdrop" onClick={() => setPickerOpen(false)}>
      <section className="media-picker-modal" onClick={e => e.stopPropagation()} aria-label="Choose thumbnail">
        <div className="modal-head">
          <div><span className="eyebrow">Media library</span><h2>Choose thumbnail</h2></div>
          <button className="ghost icon-only" onClick={() => setPickerOpen(false)}><X /></button>
        </div>
        <label className="search media-picker-search"><Search /><input placeholder="Search image name or alt text…" value={mediaSearch} onChange={e => setMediaSearch(e.target.value)} /></label>
        <div className="media-picker-body">
          <div className="media-picker-grid">
            {media.map(m => <button key={m.id} type="button" className={m.id === item.coverMediaId ? 'active' : ''} onClick={() => setPreviewMedia(m)} onDoubleClick={() => { patch({ coverMediaId: m.id, coverMedia: { id: m.id, url: m.url, altText: m.altText } }); setPickerOpen(false) }}><img src={m.url} alt={m.altText || m.originalName} /><span>{m.originalName}</span></button>)}
            {!media.length && <div className="empty">No images found. Try another search or upload a thumbnail.</div>}
          </div>
          <aside className="media-picker-preview">
            {previewMedia ? <>
              <img src={previewMedia.url} alt={previewMedia.altText || previewMedia.originalName} />
              <h3>{previewMedia.originalName}</h3>
              <p>{previewMedia.altText || 'No alt text set yet.'}</p>
              {previewMedia.caption && <small>{previewMedia.caption}</small>}
              <button className="primary wide" onClick={() => { patch({ coverMediaId: previewMedia.id, coverMedia: { id: previewMedia.id, url: previewMedia.url, altText: previewMedia.altText } }); setPickerOpen(false) }}>Use this thumbnail</button>
            </> : <div className="empty">Select an image to preview it.</div>}
          </aside>
        </div>
        <div className="picker-pagination">
          <button className="secondary" disabled={mediaPage <= 1} onClick={() => setMediaPage(page => Math.max(1, page - 1))}><ChevronLeft />Previous</button>
          <span>Page {mediaMeta.page} of {Math.max(1, mediaMeta.pages)} · {mediaMeta.total} files</span>
          <button className="secondary" disabled={mediaPage >= mediaMeta.pages} onClick={() => setMediaPage(page => page + 1)}>Next<ChevronRight /></button>
        </div>
      </section>
    </div>}
  </>
}
