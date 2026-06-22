import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { Check, X, Pencil, Copy, ExternalLink, Plus, Trash2, Download, FileText } from 'lucide-react'
import Modal from '../../components/Modal'
import { exportCsv } from '../../utils/exportCsv'

function DocsModal({ seller, open, onClose }) {
  const docs = seller?.documents || {}
  const kennelCert = docs.kennelCert
  const sireCerts = docs.sireCerts || []
  const damCerts = docs.damCerts || []
  const hasAny = kennelCert || sireCerts.length > 0 || damCerts.length > 0

  const DocLink = ({ url, label }) => (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2.5 border border-divider hover:border-sienna hover:bg-cream transition-colors group">
      <FileText className="w-4 h-4 text-muted group-hover:text-sienna flex-shrink-0" />
      <span className="font-body text-xs text-espresso flex-1 truncate">{label}</span>
      <ExternalLink className="w-3.5 h-3.5 text-muted group-hover:text-sienna flex-shrink-0" />
    </a>
  )

  return (
    <Modal open={open} onClose={onClose} title={`Documents — ${seller?.name}`} maxWidth="max-w-lg">
      {!hasAny ? (
        <p className="font-body text-sm text-muted py-4 text-center">No documents uploaded.</p>
      ) : (
        <div className="space-y-5">
          {kennelCert && (
            <div>
              <p className="font-body text-xs font-semibold uppercase tracking-widest text-muted mb-2">Kennel Registration Certificate</p>
              <DocLink url={kennelCert} label="View certificate" />
            </div>
          )}
          {sireCerts.length > 0 && (
            <div>
              <p className="font-body text-xs font-semibold uppercase tracking-widest text-muted mb-2">Sire Certificates ({sireCerts.length})</p>
              <div className="space-y-1.5">
                {sireCerts.map((url, i) => <DocLink key={i} url={url} label={`Sire certificate ${i + 1}`} />)}
              </div>
            </div>
          )}
          {damCerts.length > 0 && (
            <div>
              <p className="font-body text-xs font-semibold uppercase tracking-widest text-muted mb-2">Dam Certificates ({damCerts.length})</p>
              <div className="space-y-1.5">
                {damCerts.map((url, i) => <DocLink key={i} url={url} label={`Dam certificate ${i + 1}`} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

const TABS = ['All', 'Pending', 'KUSA', 'Canine SA']

const EMPTY_KENNEL = {
  name: '', registry: 'KUSA', description: '', location: '', contact: '', phone: '',
  commission: 8, color: '#B5651D',
}

function KennelFormModal({ kennel, open, onClose, onSave, title }) {
  const [form, setForm] = useState(kennel ?? EMPTY_KENNEL)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="label">Kennel Name *</label><input required className="input-field" value={form.name} onChange={set('name')} /></div>
          <div>
            <label className="label">Registry *</label>
            <div className="flex border border-divider overflow-hidden">
              {['KUSA', 'Canine SA'].map(r => (
                <button key={r} type="button" onClick={() => setForm(f => ({ ...f, registry: r }))}
                  className={`flex-1 py-3 font-body text-xs font-semibold transition-colors ${form.registry === r ? 'bg-espresso text-cream' : 'bg-white text-muted hover:text-espresso'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div><label className="label">Commission (%)</label><input type="number" min="0" max="30" className="input-field" value={form.commission} onChange={set('commission')} /></div>
          <div><label className="label">Location</label><input className="input-field" value={form.location} onChange={set('location')} placeholder="City, Province" /></div>
          <div><label className="label">Contact Email</label><input type="email" className="input-field" value={form.contact} onChange={set('contact')} /></div>
          <div><label className="label">Phone</label><input className="input-field" value={form.phone} onChange={set('phone')} /></div>
          <div><label className="label">Brand Colour</label><input type="color" className="input-field h-10 p-1 cursor-pointer" value={form.color} onChange={set('color')} /></div>
          <div className="col-span-2"><label className="label">Description</label><textarea rows={3} className="input-field" value={form.description} onChange={set('description')} /></div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 btn-secondary text-xs tracking-widest uppercase py-3">Cancel</button>
          <button onClick={() => onSave(form)} className="flex-1 btn-primary text-xs tracking-widest uppercase py-3">Save Kennel</button>
        </div>
      </div>
    </Modal>
  )
}

function CommissionModal({ kennel, open, onClose, onSave }) {
  const [value, setValue] = useState(String(kennel?.commission ?? 8))
  if (!kennel) return null
  return (
    <Modal open={open} onClose={onClose} title={`Edit Commission — ${kennel.name}`}>
      <div className="space-y-4">
        <p className="font-body text-sm text-muted">
          Set the commission percentage Chihuahua South Africa retains on each sale from this kennel.
        </p>
        <div>
          <label className="label">Commission (%)</label>
          <input
            type="number"
            min="0"
            max="30"
            step="0.5"
            className="input-field"
            value={value}
            onChange={e => setValue(e.target.value)}
          />
        </div>
        <div className="bg-cream border border-divider p-3 font-body text-xs text-muted">
          On a R10,000 sale: breeder receives R{(10000 * (1 - Number(value) / 100)).toLocaleString()},
          Chihuahua South Africa earns R{(10000 * Number(value) / 100).toLocaleString()}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 btn-secondary text-xs tracking-widest uppercase py-3">Cancel</button>
          <button onClick={() => onSave(Number(value))} className="flex-1 btn-primary text-xs tracking-widest uppercase py-3">Save</button>
        </div>
      </div>
    </Modal>
  )
}

export default function AdminKennels() {
  const { kennels, sellers, approveKennel, rejectKennel, updateKennelCommission, approveSeller, adminAddKennel, adminEditKennel, adminRemoveKennel } = useApp()
  const [tab, setTab] = useState('All')
  const [editKennel, setEditKennel] = useState(null)
  const [editFull, setEditFull] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [docsTarget, setDocsTarget] = useState(null)

  const pendingSellers = sellers.filter(s => s.status === 'pending_verification')
  const awaitingPayment = sellers.filter(s => s.status === 'pending_payment')

  const getPaymentLink = (sellerId) =>
    `${window.location.origin}/pay/membership?seller=${sellerId}`

  const copyLink = (sellerId) => {
    navigator.clipboard.writeText(getPaymentLink(sellerId))
    setCopiedId(sellerId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filtered = kennels.filter(k => {
    if (tab === 'Pending') return k.status === 'pending'
    if (tab === 'KUSA') return k.registry === 'KUSA' && k.status === 'approved'
    if (tab === 'Canine SA') return k.registry === 'Canine SA' && k.status === 'approved'
    return true
  })

  const statusBadge = (status) => {
    if (status === 'approved') return <span className="badge-available py-1 px-2">Approved</span>
    if (status === 'pending') return <span className="bg-amber-100 text-amber-700 text-[10px] font-bold tracking-widest uppercase px-2 py-1">Pending</span>
    if (status === 'rejected') return <span className="badge-sold py-1 px-2">Rejected</span>
    return null
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-display text-3xl font-semibold text-espresso mb-1">Kennels Management</h2>
          <p className="font-body text-sm text-muted">Add, edit, approve and remove kennels. Manage commission rates.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportCsv('kennels.csv', kennels.map(k => ({
            Name: k.name, Registry: k.registry, Location: k.location,
            Contact: k.contact, Phone: k.phone, Commission: k.commission + '%',
            Status: k.status, 'Membership Expiry': k.membershipExpiry ?? '—',
          })))} className="flex items-center gap-1.5 btn-secondary text-xs tracking-widest uppercase py-2.5 px-4">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 btn-primary text-xs tracking-widest uppercase py-2.5 px-5">
            <Plus className="w-3.5 h-3.5" /> Add Kennel
          </button>
        </div>
      </div>

      {/* Step 1: Pending verification */}
      {pendingSellers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-5 mb-4">
          <h3 className="font-body font-semibold text-sm text-amber-800 mb-1">
            Step 1 — Verify Applications ({pendingSellers.length})
          </h3>
          <p className="font-body text-xs text-amber-700 mb-3">Review each applicant's registry details, then approve to generate their payment link.</p>
          <div className="space-y-3">
            {pendingSellers.map(s => (
              <div key={s.id} className="flex items-center justify-between bg-white border border-amber-200 px-4 py-3">
                <div>
                  <p className="font-body text-sm font-semibold text-espresso">{s.name}</p>
                  <p className="font-body text-xs text-muted">{s.email} · Applied {s.joinedDate}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDocsTarget(s)}
                    className="flex items-center gap-1.5 bg-cream border border-divider text-espresso font-body text-xs font-semibold px-3 py-1.5 hover:border-sienna hover:text-sienna transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    View Docs
                  </button>
                  <button
                    onClick={() => approveSeller(s.id)}
                    className="flex items-center gap-1.5 bg-sage text-white font-body text-xs font-semibold px-3 py-1.5 hover:bg-sage-dark transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Approve → Generate Payment Link
                  </button>
                  <button className="flex items-center gap-1.5 bg-red-100 text-red-700 font-body text-xs font-semibold px-3 py-1.5 hover:bg-red-200 transition-colors">
                    <X className="w-3.5 h-3.5" />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Awaiting payment */}
      {awaitingPayment.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-5 mb-6">
          <h3 className="font-body font-semibold text-sm text-blue-800 mb-1">
            Step 2 — Send Payment Link ({awaitingPayment.length})
          </h3>
          <p className="font-body text-xs text-blue-700 mb-3">
            These sellers are approved — copy their payment link and send via WhatsApp or email. They pay R{1200} to activate their portal.
          </p>
          <div className="space-y-3">
            {awaitingPayment.map(s => (
              <div key={s.id} className="bg-white border border-blue-200 px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-body text-sm font-semibold text-espresso">{s.name}</p>
                    <p className="font-body text-xs text-muted">{s.email}</p>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest bg-blue-100 text-blue-700 px-2 py-0.5">Awaiting Payment</span>
                </div>
                <div className="flex items-center gap-2 bg-cream border border-divider px-3 py-2">
                  <code className="flex-1 font-mono text-xs text-espresso truncate">{getPaymentLink(s.id)}</code>
                  <button
                    onClick={() => copyLink(s.id)}
                    className={`flex items-center gap-1.5 font-body text-xs font-semibold px-3 py-1.5 transition-colors flex-shrink-0 ${copiedId === s.id ? 'bg-sage text-white' : 'bg-espresso text-cream hover:bg-sienna'}`}
                  >
                    {copiedId === s.id ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy Link</>}
                  </button>
                  <a
                    href={getPaymentLink(s.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-body text-xs text-sienna hover:underline flex-shrink-0"
                  >
                    <ExternalLink className="w-3 h-3" /> Preview
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0 mb-6 border-b-2 border-divider">
        {TABS.map(t => {
          const count = t === 'All' ? kennels.length
            : t === 'Pending' ? kennels.filter(k => k.status === 'pending').length
            : kennels.filter(k => k.registry === t && k.status === 'approved').length
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`tab-btn ${tab === t ? 'text-sienna border-b-2 border-sienna -mb-[2px]' : 'text-muted hover:text-espresso'}`}
            >
              {t}
              <span className={`ml-1.5 text-[10px] py-0.5 px-1.5 font-bold ${tab === t ? 'bg-espresso text-cream' : 'bg-divider text-muted'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="bg-white border border-divider overflow-hidden">
        {filtered.length === 0 ? (
          <p className="px-6 py-12 text-center font-body text-sm text-muted">No kennels in this category.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="bg-cream border-b border-divider">
                  <th className="text-left px-5 py-3 font-body text-xs font-semibold text-muted uppercase tracking-widest">Kennel</th>
                  <th className="text-left px-5 py-3 font-body text-xs font-semibold text-muted uppercase tracking-widest">Registry</th>
                  <th className="text-left px-5 py-3 font-body text-xs font-semibold text-muted uppercase tracking-widest">Location</th>
                  <th className="text-left px-5 py-3 font-body text-xs font-semibold text-muted uppercase tracking-widest">Commission</th>
                  <th className="text-left px-5 py-3 font-body text-xs font-semibold text-muted uppercase tracking-widest">Membership</th>
                  <th className="text-left px-5 py-3 font-body text-xs font-semibold text-muted uppercase tracking-widest">Status</th>
                  <th className="text-left px-5 py-3 font-body text-xs font-semibold text-muted uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {filtered.map(kennel => (
                  <tr key={kennel.id} className="hover:bg-cream/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                          style={{ backgroundColor: kennel.color }}
                        >
                          {kennel.initials}
                        </div>
                        <div>
                          <p className="font-semibold text-espresso">{kennel.name}</p>
                          <p className="text-xs text-muted">{kennel.contact}</p>
                          <p className="text-xs text-muted">{kennel.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={kennel.registry === 'KUSA' ? 'badge-kusa' : 'badge-canine'}>
                        {kennel.registry}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-muted text-xs">{kennel.location}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-espresso">{kennel.commission}%</span>
                        {kennel.status === 'approved' && (
                          <button
                            onClick={() => setEditKennel(kennel)}
                            className="text-muted hover:text-sienna transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs text-muted">
                      {kennel.membershipExpiry ? (
                        <span>{kennel.membershipExpiry}</span>
                      ) : (
                        <span className="text-amber-600 font-medium">Awaiting payment</span>
                      )}
                    </td>
                    <td className="px-5 py-4">{statusBadge(kennel.status)}</td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        {kennel.status === 'pending' && (
                          <>
                            <button
                              onClick={() => approveKennel(kennel.id)}
                              className="flex items-center gap-1 bg-sage text-white font-body text-xs font-semibold px-2.5 py-1.5 hover:bg-sage-dark transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Approve
                            </button>
                            <button
                              onClick={() => rejectKennel(kennel.id)}
                              className="flex items-center gap-1 bg-red-100 text-red-700 font-body text-xs font-semibold px-2.5 py-1.5 hover:bg-red-200 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                              Reject
                            </button>
                          </>
                        )}
                        {kennel.status === 'approved' && (
                          <button onClick={() => setEditFull(kennel)} className="text-muted hover:text-sienna transition-colors p-1">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => setDeleteTarget(kennel)} className="text-muted hover:text-red-500 transition-colors p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CommissionModal
        key={editKennel?.id}
        kennel={editKennel}
        open={!!editKennel}
        onClose={() => setEditKennel(null)}
        onSave={(val) => { updateKennelCommission(editKennel.id, val); setEditKennel(null) }}
      />

      {/* Add kennel */}
      <KennelFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add New Kennel"
        onSave={(form) => { adminAddKennel(form); setAddOpen(false) }}
      />

      {/* Edit kennel */}
      {editFull && (
        <KennelFormModal
          key={editFull.id}
          kennel={editFull}
          open={!!editFull}
          onClose={() => setEditFull(null)}
          title={`Edit — ${editFull.name}`}
          onSave={(form) => { adminEditKennel(editFull.id, form); setEditFull(null) }}
        />
      )}

      <DocsModal seller={docsTarget} open={!!docsTarget} onClose={() => setDocsTarget(null)} />

      {/* Remove kennel confirmation */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remove Kennel">
        <div className="space-y-4">
          <p className="font-body text-sm text-muted">
            Permanently remove <strong className="text-espresso">{deleteTarget?.name}</strong>? This will also remove all their puppy listings.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteTarget(null)} className="flex-1 btn-secondary text-xs tracking-widest uppercase py-3">Cancel</button>
            <button onClick={() => { adminRemoveKennel(deleteTarget.id); setDeleteTarget(null) }}
              className="flex-1 bg-red-600 text-white font-body text-xs font-semibold tracking-widest uppercase py-3 hover:bg-red-700 transition-colors">
              Remove Kennel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
