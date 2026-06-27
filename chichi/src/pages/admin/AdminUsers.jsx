import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { Pencil, Trash2, Plus, Check, X, FileText, ExternalLink, Eye } from 'lucide-react'
import Modal from '../../components/Modal'
import { sendApprovalEmail } from '../../utils/email'

function BuyerModal({ buyer, transactions, open, onClose }) {
  const purchases = transactions.filter(t => t.buyerId === buyer?.id)
  return (
    <Modal open={open} onClose={onClose} title={`Buyer — ${buyer?.name}`} maxWidth="max-w-lg">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 font-body text-sm">
          <div><p className="text-xs text-muted uppercase tracking-widest mb-1">Full Name</p><p className="font-semibold text-espresso">{buyer?.name}</p></div>
          <div><p className="text-xs text-muted uppercase tracking-widest mb-1">Email</p><p className="text-espresso break-all">{buyer?.email}</p></div>
          <div><p className="text-xs text-muted uppercase tracking-widest mb-1">Phone</p><p className="text-espresso">{buyer?.phone || '—'}</p></div>
          <div><p className="text-xs text-muted uppercase tracking-widest mb-1">Joined</p><p className="text-espresso">{buyer?.joinedDate}</p></div>
          <div><p className="text-xs text-muted uppercase tracking-widest mb-1">Purchases</p><p className="font-semibold text-espresso">{purchases.length}</p></div>
          <div><p className="text-xs text-muted uppercase tracking-widest mb-1">Total Spent</p><p className="font-semibold text-espresso">R{purchases.reduce((a, t) => a + (t.amount || 0), 0).toLocaleString()}</p></div>
        </div>

        {purchases.length > 0 && (
          <div>
            <p className="font-body text-xs font-semibold uppercase tracking-widest text-muted mb-3">Purchase History</p>
            <div className="space-y-2">
              {purchases.map(t => (
                <div key={t.id} className="flex items-center justify-between bg-cream border border-divider px-4 py-3 font-body text-sm">
                  <div>
                    <p className="font-semibold text-espresso">{t.puppyName}</p>
                    <p className="text-xs text-muted">{t.kennelName} · {t.date}</p>
                  </div>
                  <span className="font-semibold text-espresso">R{(t.amount || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={onClose} className="w-full btn-secondary text-xs tracking-widest uppercase py-3">Close</button>
      </div>
    </Modal>
  )
}

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

const EMPTY_SELLER = { name: '', email: '', phone: '', password: '', kennelId: '', status: 'approved' }

function SellerModal({ seller, kennels, open, onClose, onSave, title }) {
  const [form, setForm] = useState(seller ?? EMPTY_SELLER)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Full Name *</label><input required className="input-field" value={form.name} onChange={set('name')} /></div>
          <div><label className="label">Email *</label><input type="email" required className="input-field" value={form.email} onChange={set('email')} /></div>
          <div><label className="label">Phone</label><input className="input-field" value={form.phone || ''} onChange={set('phone')} /></div>
          <div><label className="label">Password</label><input type="password" required className="input-field" value={form.password || ''} onChange={set('password')} /></div>
          <div>
            <label className="label">Linked Kennel</label>
            <select className="input-field" value={form.kennelId || ''} onChange={set('kennelId')}>
              <option value="">No kennel linked</option>
              {kennels.filter(k => k.status === 'approved').map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input-field" value={form.status} onChange={set('status')}>
              <option value="approved">Approved</option>
              <option value="pending_verification">Pending Verification</option>
              <option value="pending_payment">Pending Payment</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 btn-secondary text-xs tracking-widest uppercase py-3">Cancel</button>
          <button onClick={() => onSave(form)} className="flex-1 btn-primary text-xs tracking-widest uppercase py-3">Save</button>
        </div>
      </div>
    </Modal>
  )
}

export default function AdminUsers() {
  const { sellers, buyers, kennels, transactions, approveSeller, adminAddSeller, adminEditSeller, adminRemoveSeller } = useApp()
  const [tab, setTab] = useState('Sellers')
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [docsTarget, setDocsTarget] = useState(null)
  const [buyerTarget, setBuyerTarget] = useState(null)

  const statusBadge = (status) => {
    if (status === 'approved') return <span className="badge-available px-2 py-0.5">Approved</span>
    if (status === 'pending_verification') return <span className="bg-amber-100 text-amber-700 text-[10px] font-bold tracking-widest uppercase px-2 py-0.5">Pending Verify</span>
    if (status === 'pending_payment') return <span className="bg-blue-100 text-blue-700 text-[10px] font-bold tracking-widest uppercase px-2 py-0.5">Pending Payment</span>
    if (status === 'rejected') return <span className="badge-sold px-2 py-0.5">Rejected</span>
    return null
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h2 className="font-display text-3xl font-semibold text-espresso mb-1">Users</h2>
          <p className="font-body text-sm text-muted">Manage all sellers and buyers on the platform.</p>
        </div>
        {tab === 'Sellers' && (
          <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 btn-primary text-xs tracking-widest uppercase py-2.5 px-5">
            <Plus className="w-3.5 h-3.5" /> Add Seller
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-6 border-b-2 border-divider">
        {['Sellers', 'Buyers'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`tab-btn ${tab === t ? 'text-sienna border-b-2 border-sienna -mb-[2px]' : 'text-muted hover:text-espresso'}`}>
            {t}
            <span className={`ml-1.5 text-[10px] py-0.5 px-1.5 font-bold ${tab === t ? 'bg-espresso text-cream' : 'bg-divider text-muted'}`}>
              {t === 'Sellers' ? sellers.length : buyers.length}
            </span>
          </button>
        ))}
      </div>

      {tab === 'Sellers' && (
        <div className="bg-white border border-divider overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full font-body text-sm">
              <thead>
                <tr className="bg-cream border-b border-divider">
                  {['Name', 'Email', 'Phone', 'Linked Kennel', 'Joined', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {sellers.map(s => {
                  const kennel = kennels.find(k => k.id === s.kennelId)
                  return (
                    <tr key={s.id} className="hover:bg-cream/30 transition-colors">
                      <td className="px-5 py-3 font-semibold text-espresso">{s.name}</td>
                      <td className="px-5 py-3 text-muted text-xs">{s.email}</td>
                      <td className="px-5 py-3 text-muted text-xs">{s.phone || '—'}</td>
                      <td className="px-5 py-3 text-xs">
                        {kennel ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-4 h-4 flex-shrink-0" style={{ backgroundColor: kennel.color }} />
                            <span className="text-espresso">{kennel.name}</span>
                          </div>
                        ) : <span className="text-muted">—</span>}
                      </td>
                      <td className="px-5 py-3 text-muted text-xs">{s.joinedDate}</td>
                      <td className="px-5 py-3">{statusBadge(s.status)}</td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2 items-center">
                          {s.status === 'pending_verification' && (
                            <button onClick={() => { approveSeller(s.id); sendApprovalEmail(s) }}
                              className="flex items-center gap-1 bg-sage text-white text-[10px] font-bold uppercase tracking-widest px-2 py-1.5 hover:bg-sage-dark transition-colors">
                              <Check className="w-3 h-3" /> Approve
                            </button>
                          )}
                          <button onClick={() => setDocsTarget(s)} className="text-muted hover:text-sienna transition-colors p-1" title="View documents">
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setEditTarget(s)} className="text-muted hover:text-sienna transition-colors p-1">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteTarget({ id: s.id, name: s.name, type: 'seller' })} className="text-muted hover:text-red-500 transition-colors p-1">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'Buyers' && (
        <div className="bg-white border border-divider overflow-hidden">
          {buyers.length === 0 ? (
            <p className="px-5 py-12 text-center font-body text-sm text-muted">No registered buyers yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full font-body text-sm">
                <thead>
                  <tr className="bg-cream border-b border-divider">
                    {['Name', 'Email', 'Phone', 'Joined', 'Purchases', 'Total Spent', ''].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {buyers.map(b => {
                    const buyerTxns = transactions.filter(t => t.buyerId === b.id)
                    const totalSpent = buyerTxns.reduce((a, t) => a + (t.amount || 0), 0)
                    return (
                      <tr key={b.id} className="hover:bg-cream/30 transition-colors">
                        <td className="px-5 py-3 font-semibold text-espresso">{b.name}</td>
                        <td className="px-5 py-3 text-muted text-xs">{b.email}</td>
                        <td className="px-5 py-3 text-muted text-xs">{b.phone || '—'}</td>
                        <td className="px-5 py-3 text-muted text-xs">{b.joinedDate}</td>
                        <td className="px-5 py-3 text-xs text-espresso">{b.purchaseCount ?? buyerTxns.length}</td>
                        <td className="px-5 py-3 font-semibold text-espresso">R{totalSpent.toLocaleString()}</td>
                        <td className="px-5 py-3">
                          <button onClick={() => setBuyerTarget(b)} className="text-muted hover:text-sienna transition-colors p-1" title="View details">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <DocsModal seller={docsTarget} open={!!docsTarget} onClose={() => setDocsTarget(null)} />
      <BuyerModal buyer={buyerTarget} transactions={transactions} open={!!buyerTarget} onClose={() => setBuyerTarget(null)} />

      {/* Add seller modal */}
      <SellerModal
        seller={EMPTY_SELLER}
        kennels={kennels}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add New Seller"
        onSave={(form) => { adminAddSeller(form); setAddOpen(false) }}
      />

      {/* Edit seller modal */}
      {editTarget && (
        <SellerModal
          key={editTarget.id}
          seller={editTarget}
          kennels={kennels}
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          title={`Edit — ${editTarget.name}`}
          onSave={(form) => { adminEditSeller(editTarget.id, form); setEditTarget(null) }}
        />
      )}

      {/* Delete confirmation */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remove User">
        <div className="space-y-4">
          <p className="font-body text-sm text-muted">
            Remove <strong className="text-espresso">{deleteTarget?.name}</strong> from the platform? This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteTarget(null)} className="flex-1 btn-secondary text-xs tracking-widest uppercase py-3">Cancel</button>
            <button onClick={() => { adminRemoveSeller(deleteTarget.id); setDeleteTarget(null) }}
              className="flex-1 bg-red-600 text-white font-body text-xs font-semibold tracking-widest uppercase py-3 hover:bg-red-700 transition-colors">
              Remove
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
