import { useEffect, useState } from 'react'
import './App.css'

type ListingSummary = {
  id: number
  title: string
  slug: string
  status: string
  updated_at: string
}

type HostListingForm = {
  type: string
  title: string
  slug: string
  short_description: string
  description: string
  city: string
  area: string
  address: string
  tags: string[]
  data: Record<string, unknown>
  booking_mode: string
}

type BookingItem = {
  id: number
  listing_id: number
  guest_name: string
  guest_email: string
  check_in: string
  check_out: string
  guests: number
  status: string
  amount_paise: number
  created_at: string
}

type Tab = 'dashboard' | 'listings' | 'bookings'

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL ?? ''

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: { ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed: ${res.status}`)
  }
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return res.json()
  return res.text()
}

function App() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [me, setMe] = useState<{ id: number; username: string; role: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [listings, setListings] = useState<ListingSummary[]>([])
  const [bookings, setBookings] = useState<BookingItem[]>([])
  const [loading, setLoading] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<HostListingForm>({
    type: 'stay',
    title: '',
    slug: '',
    short_description: '',
    description: '',
    city: 'nashik',
    area: '',
    address: '',
    tags: [],
    data: { priceMin: 800, priceMax: 2500, amenities: ['WiFi', 'Hot water'] },
    booking_mode: 'instant',
  })
  const [dataJsonText, setDataJsonText] = useState('{}')
  const [uploadListingId, setUploadListingId] = useState<number | null>(null)

  const isAuthed = !!me

  async function refreshMe() {
    try {
      const data = await apiFetch('/api/v1/admin/auth/me')
      if (data.role !== 'host' && data.role !== 'admin') throw new Error('Not a host account')
      setMe(data)
    } catch {
      setMe(null)
    }
  }

  async function refreshListings() {
    const data = await apiFetch('/api/v1/host/listings')
    setListings(data.items ?? [])
  }

  async function refreshBookings() {
    const data = await apiFetch('/api/v1/host/bookings')
    setBookings(data.items ?? [])
  }

  async function refreshAll() {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([refreshListings(), refreshBookings()])
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refreshMe() }, [])

  useEffect(() => {
    if (isAuthed) refreshAll()
  }, [isAuthed])

  async function onLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await apiFetch('/api/v1/admin/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
      setPassword('')
      await refreshMe()
    } catch (e: any) {
      setError(e?.message || 'Login failed')
    }
  }

  async function onLogout() {
    await apiFetch('/api/v1/admin/auth/logout', { method: 'POST' })
    setMe(null)
  }

  function openCreate() {
    setEditingId(null)
    setForm({
      type: 'stay', title: '', slug: '', short_description: '', description: '',
      city: 'nashik', area: '', address: '', tags: [],
      data: { priceMin: 800, priceMax: 2500, amenities: ['WiFi', 'Hot water'] },
      booking_mode: 'instant',
    })
    setDataJsonText(JSON.stringify({ priceMin: 800, priceMax: 2500, amenities: ['WiFi', 'Hot water'] }, null, 2))
    setEditorOpen(true)
  }

  function openEdit(item: ListingSummary) {
    setEditingId(item.id)
    setForm((f) => ({ ...f, title: item.title, slug: item.slug }))
    setDataJsonText('{}')
    setEditorOpen(true)
  }

  async function save() {
    setError(null)
    try {
      const data = JSON.parse(dataJsonText)
      const payload = { ...form, data }
      if (editingId == null) {
        await apiFetch('/api/v1/host/listings', { method: 'POST', body: JSON.stringify(payload) })
      } else {
        await apiFetch(`/api/v1/host/listings/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload) })
      }
      setEditorOpen(false)
      await refreshAll()
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    }
  }

  async function uploadPhoto(listingId: number, file: File) {
    setError(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      await apiFetch(`/api/v1/host/listings/${listingId}/media`, { method: 'POST', body: fd })
      await refreshListings()
    } catch (e: any) {
      setError(e?.message || 'Upload failed')
    }
  }

  const upcoming = bookings.filter((b) => b.status === 'confirmed' || b.status === 'pending_payment').slice(0, 5)

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <div className="brand">Kumbh Host</div>
          <div className="sub">Manage your homestay listings & bookings</div>
        </div>
        <div className="topbarRight">
          {me ? (<><div className="pill">{me.username}</div><button className="btn" onClick={onLogout}>Logout</button></>) : null}
        </div>
      </header>

      {error ? <div className="alert">{error}</div> : null}

      {!isAuthed ? (
        <main className="card">
          <h1>Host sign in</h1>
          <p className="muted">Use the credentials provided by KumbhGuide admin.</p>
          <form className="form" onSubmit={onLogin}>
            <label><div className="label">Username</div><input value={username} onChange={(e) => setUsername(e.target.value)} /></label>
            <label><div className="label">Password</div><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <button className="btn primary" type="submit">Login</button>
          </form>
          <p className="hint">API: <code>{API_BASE_URL || '(set VITE_API_BASE_URL)'}</code></p>
        </main>
      ) : (
        <main className="content">
          <div className="tabs">
            <button className={`tab ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>Dashboard</button>
            <button className={`tab ${tab === 'listings' ? 'active' : ''}`} onClick={() => setTab('listings')}>My listings</button>
            <button className={`tab ${tab === 'bookings' ? 'active' : ''}`} onClick={() => setTab('bookings')}>Bookings</button>
          </div>

          {tab === 'dashboard' && (
            <>
              <h1>Dashboard</h1>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 16 }}>
                <div className="card"><div className="label">Listings</div><div style={{ fontSize: 28, fontWeight: 700 }}>{listings.length}</div></div>
                <div className="card"><div className="label">Active bookings</div><div style={{ fontSize: 28, fontWeight: 700 }}>{bookings.filter((b) => b.status === 'confirmed').length}</div></div>
                <div className="card"><div className="label">Pending payment</div><div style={{ fontSize: 28, fontWeight: 700 }}>{bookings.filter((b) => b.status === 'pending_payment').length}</div></div>
              </div>
              <h2 style={{ marginTop: 24 }}>Upcoming check-ins</h2>
              {upcoming.length === 0 ? <p className="muted">No upcoming bookings.</p> : (
                <ul>{upcoming.map((b) => (
                  <li key={b.id}>{b.guest_name} · {b.check_in} → {b.check_out} · {b.status}</li>
                ))}</ul>
              )}
            </>
          )}

          {tab === 'listings' && (
            <>
              <div className="row">
                <h1>My listings</h1>
                <div className="rowRight">
                  <button className="btn" onClick={refreshAll} disabled={loading}>Refresh</button>
                  <button className="btn primary" onClick={openCreate}>Add homestay</button>
                </div>
              </div>
              <div className="tableWrap">
                <table className="table">
                  <thead><tr><th>Title</th><th>Slug</th><th>Status</th><th>Updated</th><th></th></tr></thead>
                  <tbody>
                    {listings.map((l) => (
                      <tr key={l.id}>
                        <td>{l.title}</td>
                        <td className="mono">{l.slug}</td>
                        <td><span className={`badge ${l.status}`}>{l.status}</span></td>
                        <td className="mono">{new Date(l.updated_at).toISOString().slice(0, 10)}</td>
                        <td className="actions">
                          <button className="btn small" onClick={() => openEdit(l)}>Edit</button>
                          <button className="btn small" onClick={() => setUploadListingId(l.id)}>Photos</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'bookings' && (
            <>
              <div className="row"><h1>Bookings inbox</h1><button className="btn" onClick={refreshBookings}>Refresh</button></div>
              <div className="tableWrap">
                <table className="table">
                  <thead><tr><th>Guest</th><th>Dates</th><th>Guests</th><th>Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {bookings.map((b) => (
                      <tr key={b.id}>
                        <td>{b.guest_name}<br /><span className="muted">{b.guest_email}</span></td>
                        <td className="mono">{b.check_in} → {b.check_out}</td>
                        <td>{b.guests}</td>
                        <td className="mono">₹{(b.amount_paise / 100).toLocaleString('en-IN')}</td>
                        <td><span className={`badge ${b.status}`}>{b.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {editorOpen && (
            <div className="modalBackdrop">
              <div className="modal">
                <div className="modalHeader">
                  <div className="modalTitle">{editingId ? `Edit #${editingId}` : 'New homestay'}</div>
                  <button className="btn small" onClick={() => setEditorOpen(false)}>Close</button>
                </div>
                <div className="grid">
                  <label className="span2"><div className="label">Title</div><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
                  <label className="span2"><div className="label">Slug</div><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></label>
                  <label className="span2"><div className="label">Short description</div><input value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} /></label>
                  <label><div className="label">Area</div><input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></label>
                  <label><div className="label">Booking mode</div>
                    <select value={form.booking_mode} onChange={(e) => setForm({ ...form, booking_mode: e.target.value })}>
                      <option value="instant">instant</option>
                      <option value="enquiry">enquiry</option>
                    </select>
                  </label>
                  <label className="span2"><div className="label">Stay data (JSON)</div><textarea rows={8} className="mono" value={dataJsonText} onChange={(e) => setDataJsonText(e.target.value)} /></label>
                </div>
                <div className="modalFooter"><button className="btn primary" onClick={save}>Save draft</button></div>
              </div>
            </div>
          )}

          {uploadListingId != null && (
            <div className="modalBackdrop">
              <div className="modal">
                <div className="modalHeader">
                  <div className="modalTitle">Upload photo — listing #{uploadListingId}</div>
                  <button className="btn small" onClick={() => setUploadListingId(null)}>Close</button>
                </div>
                <div style={{ padding: 14 }}>
                  <input type="file" accept="image/*" onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void uploadPhoto(uploadListingId, f)
                  }} />
                </div>
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  )
}

export default App
