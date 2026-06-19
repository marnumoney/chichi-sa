import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { CheckCircle, Clock, Wallet, ArrowRight, Landmark, Check, Pencil, Download } from 'lucide-react'
import Modal from '../../components/Modal'
import { exportCsv } from '../../utils/exportCsv'

const SA_BANKS = [
  'ABSA Bank', 'Capitec Bank', 'FNB (First National Bank)', 'Nedbank',
  'Standard Bank', 'African Bank', 'Bidvest Bank', 'Discovery Bank',
  'Investec', 'TymeBank', 'Other',
]

function RandIcon() {
  return <span className="font-body font-bold text-base leading-none">R</span>
}

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-white border border-divider p-5 flex items-start gap-4">
      <div className={`w-10 h-10 flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="font-body text-xs text-muted uppercase tracking-widest mb-0.5">{label}</p>
        <p className="font-display text-3xl font-semibold text-espresso leading-none">{value}</p>
        {sub && <p className="font-body text-xs text-muted mt-1">{sub}</p>}
      </div>
    </div>
  )
}

function ReleaseModalContent({ txn, kennel, adminSettings, onSellerPaid, onCommissionPaid, onBothPaid, onClose }) {
  const [loading, setLoading] = useState(null) // 'seller' | 'commission' | 'both'
  const sellerHasBanking = kennel?.accountNumber
  const adminHasBanking = adminSettings.adminAccountNumber

  const handleSellerPaid = async () => {
    setLoading('seller')
    await onSellerPaid()
    setLoading(null)
  }
  const handleCommissionPaid = async () => {
    setLoading('commission')
    await onCommissionPaid()
    setLoading(null)
  }
  const handleBothPaid = async () => {
    setLoading('both')
    await onBothPaid()
    setLoading(null)
  }

  return (
    <div className="space-y-4">
      {/* Transaction summary */}
      <div className="bg-cream border border-divider p-4 space-y-2 font-body text-sm">
        <div className="flex justify-between"><span className="text-muted">Puppy</span><span className="font-semibold text-espresso">{txn.puppyName}</span></div>
        <div className="flex justify-between"><span className="text-muted">Buyer</span><span className="text-espresso">{txn.buyerName} · {txn.buyerEmail}</span></div>
        <div className="flex justify-between border-t border-divider pt-2"><span className="text-muted">Total received from buyer</span><span className="font-semibold text-espresso">R{txn.amount.toLocaleString()}</span></div>
      </div>

      {/* EFT 1 — Seller payout */}
      <div className={`border rounded-none p-4 ${txn.sellerPaid ? 'border-sage/30 bg-sage/5 opacity-60' : 'border-sienna/30 bg-cream'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-espresso text-cream font-bold text-xs flex items-center justify-center flex-shrink-0">1</div>
            <p className="font-body font-semibold text-sm text-espresso">EFT to Seller</p>
          </div>
          <span className="font-display text-xl font-semibold text-sage-dark">R{txn.sellerPayout.toLocaleString()}</span>
        </div>
        {sellerHasBanking ? (
          <div className="font-body text-xs space-y-1 mb-3">
            <div className="flex justify-between"><span className="text-muted">Bank</span><span className="text-espresso font-semibold">{kennel.bankName}</span></div>
            <div className="flex justify-between"><span className="text-muted">Account Holder</span><span className="text-espresso font-semibold">{kennel.accountHolder}</span></div>
            <div className="flex justify-between"><span className="text-muted">Account No.</span><span className="font-mono text-espresso font-semibold">{kennel.accountNumber}</span></div>
            <div className="flex justify-between"><span className="text-muted">Branch Code</span><span className="font-mono text-espresso">{kennel.branchCode}</span></div>
            <div className="flex justify-between"><span className="text-muted">Account Type</span><span className="text-espresso">{kennel.accountType}</span></div>
          </div>
        ) : (
          <p className="font-body text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 mb-3">⚠ Seller has not added banking details. Contact {kennel?.contact}</p>
        )}
        {txn.sellerPaid ? (
          <div className="flex items-center gap-2 text-sage-dark font-body text-xs font-semibold">
            <CheckCircle className="w-4 h-4" /> Paid on {txn.sellerPaidDate}
          </div>
        ) : (
          <button onClick={handleSellerPaid} disabled={!!loading}
            className="flex items-center gap-2 bg-espresso text-cream font-body text-xs font-semibold tracking-widest uppercase px-4 py-2 hover:bg-sienna transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <Check className="w-3.5 h-3.5" /> {loading === 'seller' ? 'Saving…' : `Mark Seller EFT Done — R${txn.sellerPayout.toLocaleString()}`}
          </button>
        )}
      </div>

      {/* EFT 2 — Admin commission */}
      <div className={`border p-4 ${txn.commissionPaid ? 'border-sage/30 bg-sage/5 opacity-60' : 'border-sienna/30 bg-cream'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-sienna text-cream font-bold text-xs flex items-center justify-center flex-shrink-0">2</div>
            <p className="font-body font-semibold text-sm text-espresso">EFT Commission to Admin</p>
          </div>
          <span className="font-display text-xl font-semibold text-sienna">R{txn.commission.toLocaleString()}</span>
        </div>
        {adminHasBanking ? (
          <div className="font-body text-xs space-y-1 mb-3">
            <div className="flex justify-between"><span className="text-muted">Bank</span><span className="text-espresso font-semibold">{adminSettings.adminBankName}</span></div>
            <div className="flex justify-between"><span className="text-muted">Account Holder</span><span className="text-espresso font-semibold">{adminSettings.adminAccountHolder}</span></div>
            <div className="flex justify-between"><span className="text-muted">Account No.</span><span className="font-mono text-espresso font-semibold">{adminSettings.adminAccountNumber}</span></div>
            <div className="flex justify-between"><span className="text-muted">Branch Code</span><span className="font-mono text-espresso">{adminSettings.adminBranchCode}</span></div>
            <div className="flex justify-between"><span className="text-muted">Account Type</span><span className="text-espresso">{adminSettings.adminAccountType}</span></div>
          </div>
        ) : (
          <p className="font-body text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 mb-3">⚠ Add your admin banking details below to see EFT instructions here.</p>
        )}
        {txn.commissionPaid ? (
          <div className="flex items-center gap-2 text-sage-dark font-body text-xs font-semibold">
            <CheckCircle className="w-4 h-4" /> Paid on {txn.commissionPaidDate}
          </div>
        ) : (
          <button onClick={handleCommissionPaid} disabled={!!loading}
            className="flex items-center gap-2 bg-sienna text-white font-body text-xs font-semibold tracking-widest uppercase px-4 py-2 hover:bg-sienna-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <Check className="w-3.5 h-3.5" /> {loading === 'commission' ? 'Saving…' : `Mark Commission EFT Done — R${txn.commission.toLocaleString()}`}
          </button>
        )}
      </div>

      {!txn.sellerPaid && !txn.commissionPaid && (
        <button onClick={handleBothPaid} disabled={!!loading}
          className="w-full bg-sage text-white font-body text-xs font-semibold tracking-widest uppercase py-3 hover:bg-sage-dark transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
          <Check className="w-4 h-4" /> {loading === 'both' ? 'Saving…' : 'Mark Both EFTs Done'}
        </button>
      )}

      <button onClick={onClose} className="w-full btn-secondary text-xs tracking-widest uppercase py-2.5">Close</button>
    </div>
  )
}

export default function AdminWallet() {
  const { transactions, kennels, adminSettings, updateAdminSettings, releasePayment, markSellerPaid, markCommissionPaid } = useApp()
  const [releaseModal, setReleaseModal] = useState(null)
  const [bankingOpen, setBankingOpen] = useState(!adminSettings.adminAccountNumber)
  const [bankForm, setBankForm] = useState({
    adminBankName: adminSettings.adminBankName ?? '',
    adminAccountHolder: adminSettings.adminAccountHolder ?? 'Chihuahua South Africa',
    adminAccountNumber: adminSettings.adminAccountNumber ?? '',
    adminBranchCode: adminSettings.adminBranchCode ?? '',
    adminAccountType: adminSettings.adminAccountType ?? 'Cheque / Current',
  })
  const [bankSaved, setBankSaved] = useState(false)

  const pendingTxns = transactions.filter(t => !t.sellerPaid || !t.commissionPaid)
  const totalHeld = pendingTxns.reduce((a, t) => a + (!t.sellerPaid ? t.sellerPayout : 0) + (!t.commissionPaid ? t.commission : 0), 0)
  const totalCommission = transactions.reduce((a, t) => a + t.commission, 0)
  const totalPaidOut = transactions.filter(t => t.sellerPaid).reduce((a, t) => a + t.sellerPayout, 0)
  const totalVolume = transactions.reduce((a, t) => a + t.amount, 0)

  const txnStatus = (t) => {
    if (t.sellerPaid && t.commissionPaid) return 'complete'
    if (!t.sellerPaid && !t.commissionPaid) return 'pending'
    return 'partial'
  }

  const handleSaveBank = async (e) => {
    e.preventDefault()
    await updateAdminSettings(bankForm)
    setBankSaved(true)
    setTimeout(() => { setBankSaved(false); setBankingOpen(false) }, 2000)
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="font-display text-3xl font-semibold text-espresso mb-1">Platform Wallet</h2>
        <p className="font-body text-sm text-muted">Track all buyer payments. Release seller payouts and commission via EFT.</p>
      </div>

      {/* Admin banking details */}
      <div className={`border mb-6 ${adminSettings.adminAccountNumber ? 'border-sage/30 bg-sage/5' : 'border-amber-200 bg-amber-50'}`}>
        <button type="button" onClick={() => setBankingOpen(!bankingOpen)}
          className="w-full flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <Landmark className={`w-4 h-4 flex-shrink-0 ${adminSettings.adminAccountNumber ? 'text-sage-dark' : 'text-amber-600'}`} />
            <div className="text-left">
              <p className={`font-body font-semibold text-sm ${adminSettings.adminAccountNumber ? 'text-sage-dark' : 'text-amber-800'}`}>
                {adminSettings.adminAccountNumber
                  ? `Admin Commission Account — ${adminSettings.adminBankName} ···· ${adminSettings.adminAccountNumber.slice(-4)}`
                  : '⚠ Add Admin Banking Details — Required to Receive Commission EFTs'}
              </p>
              <p className="font-body text-xs text-muted mt-0.5">Commission EFTs will be sent to this account after each sale.</p>
            </div>
          </div>
          <Pencil className="w-4 h-4 text-muted flex-shrink-0" />
        </button>

        {bankingOpen && (
          <form onSubmit={handleSaveBank} className="px-5 pb-5 border-t border-divider pt-4 bg-white space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Bank Name *</label>
                <select required className="input-field" value={bankForm.adminBankName} onChange={e => setBankForm(b => ({ ...b, adminBankName: e.target.value }))}>
                  <option value="">Select bank</option>
                  {SA_BANKS.map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Account Type *</label>
                <div className="flex border border-divider overflow-hidden">
                  {['Cheque / Current', 'Savings', 'Transmission'].map(t => (
                    <button key={t} type="button" onClick={() => setBankForm(b => ({ ...b, adminAccountType: t }))}
                      className={`flex-1 py-3 font-body text-xs font-semibold transition-colors ${bankForm.adminAccountType === t ? 'bg-espresso text-cream' : 'bg-white text-muted hover:text-espresso'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Account Holder *</label>
                <input required className="input-field" value={bankForm.adminAccountHolder} onChange={e => setBankForm(b => ({ ...b, adminAccountHolder: e.target.value }))} />
              </div>
              <div>
                <label className="label">Account Number *</label>
                <input required className="input-field font-mono tracking-widest" value={bankForm.adminAccountNumber} onChange={e => setBankForm(b => ({ ...b, adminAccountNumber: e.target.value }))} inputMode="numeric" />
              </div>
              <div>
                <label className="label">Branch Code *</label>
                <input required className="input-field font-mono" value={bankForm.adminBranchCode} onChange={e => setBankForm(b => ({ ...b, adminBranchCode: e.target.value }))} inputMode="numeric" />
                <p className="font-body text-[10px] text-muted mt-1">FNB: 250655 · ABSA: 632005 · Standard: 051001 · Nedbank: 198765 · Capitec: 470010</p>
              </div>
            </div>
            <button type="submit" className={`flex items-center gap-2 px-6 py-2.5 font-body text-xs font-semibold tracking-widest uppercase ${bankSaved ? 'bg-sage text-white' : 'btn-primary'}`}>
              {bankSaved ? <><Check className="w-3.5 h-3.5" /> Saved!</> : 'Save Banking Details'}
            </button>
          </form>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Clock} label="Pending EFTs" value={`R${totalHeld.toLocaleString()}`} sub={`${pendingTxns.length} transactions outstanding`} color="bg-amber-100 text-amber-700" />
        <StatCard icon={RandIcon} label="Commission Earned" value={`R${totalCommission.toLocaleString()}`} sub="Total commission across all sales" color="bg-sienna/10 text-sienna" />
        <StatCard icon={RandIcon} label="Paid Out to Sellers" value={`R${totalPaidOut.toLocaleString()}`} sub="EFTs completed to sellers" color="bg-sage/10 text-sage-dark" />
        <StatCard icon={Wallet} label="Total Volume" value={`R${totalVolume.toLocaleString()}`} sub="All time buyer payments" color="bg-espresso/10 text-espresso" />
      </div>

      {/* Pending banner */}
      {pendingTxns.length > 0 && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 px-5 py-4 mb-6">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="font-body font-semibold text-sm text-amber-800">{pendingTxns.length} transaction{pendingTxns.length > 1 ? 's' : ''} have outstanding EFTs</p>
              <p className="font-body text-xs text-amber-700">Each transaction requires 2 EFTs — one to seller, one to admin.</p>
            </div>
          </div>
        </div>
      )}

      {/* Transaction table */}
      <div className="bg-white border border-divider overflow-hidden">
        <div className="px-5 py-4 border-b border-divider flex items-center justify-between">
          <h3 className="font-body font-semibold text-sm text-espresso">All Transactions</h3>
          <div className="flex items-center gap-3">
            <span className="font-body text-xs text-muted">{transactions.length} total</span>
            <button onClick={() => exportCsv('transactions.csv', transactions.map(t => ({
              Date: t.date, Buyer: t.buyerName, 'Buyer Email': t.buyerEmail,
              Puppy: t.puppyName, Kennel: t.kennelName,
              Amount: t.amount, Commission: t.commission, 'Seller Payout': t.sellerPayout,
              'Seller Paid': t.sellerPaid ? t.sellerPaidDate : 'No',
              'Commission Paid': t.commissionPaid ? t.commissionPaidDate : 'No',
            })))} className="flex items-center gap-1.5 font-body text-xs text-muted hover:text-sienna transition-colors">
              <Download className="w-3.5 h-3.5" /> Export Excel
            </button>
          </div>
        </div>
        {transactions.length === 0 ? (
          <p className="px-5 py-12 text-center font-body text-sm text-muted">No transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-body text-sm">
              <thead>
                <tr className="bg-cream border-b border-divider">
                  {['Date', 'Buyer', 'Puppy', 'Kennel', 'Amount', 'Seller EFT', 'Commission EFT', 'Status', 'Action'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {[...transactions].reverse().map(txn => {
                  const st = txnStatus(txn)
                  return (
                    <tr key={txn.id} className={`hover:bg-cream/30 transition-colors ${st === 'complete' ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">{txn.date}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-espresso text-xs">{txn.buyerName}</p>
                        <p className="text-[10px] text-muted">{txn.buyerEmail}</p>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-espresso">{txn.puppyName}</td>
                      <td className="px-4 py-3 text-xs text-muted">{txn.kennelName}</td>
                      <td className="px-4 py-3 font-semibold text-espresso">R{txn.amount.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className={`text-xs font-semibold ${txn.sellerPaid ? 'text-sage-dark' : 'text-amber-600'}`}>
                          R{txn.sellerPayout.toLocaleString()}
                        </div>
                        <div className={`text-[10px] ${txn.sellerPaid ? 'text-sage-dark' : 'text-muted'}`}>
                          {txn.sellerPaid ? `✓ ${txn.sellerPaidDate}` : 'Pending'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className={`text-xs font-semibold ${txn.commissionPaid ? 'text-sage-dark' : 'text-sienna'}`}>
                          R{txn.commission.toLocaleString()}
                        </div>
                        <div className={`text-[10px] ${txn.commissionPaid ? 'text-sage-dark' : 'text-muted'}`}>
                          {txn.commissionPaid ? `✓ ${txn.commissionPaidDate}` : 'Pending'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {st === 'complete' && <span className="flex items-center gap-1 text-[10px] font-bold text-sage-dark"><CheckCircle className="w-3 h-3" /> Complete</span>}
                        {st === 'pending' && <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">2 EFTs due</span>}
                        {st === 'partial' && <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">1 EFT due</span>}
                      </td>
                      <td className="px-4 py-3">
                        {st !== 'complete' && (
                          <button onClick={() => setReleaseModal(txn)}
                            className="flex items-center gap-1.5 bg-espresso text-white font-body text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 hover:bg-sienna transition-colors whitespace-nowrap">
                            <ArrowRight className="w-3 h-3" /> Manage EFTs
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* How commission reaches admin */}
      <div className="mt-6 bg-white border border-divider p-5">
        <h3 className="font-body font-semibold text-sm text-espresso mb-4">Per Transaction — 2 EFTs Required</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { step: '1', label: 'Buyer Pays Full Amount', desc: 'e.g. R15,000 — processed via PayFast, pending admin release', color: 'bg-espresso' },
            { step: '2', label: 'EFT Seller Payout', desc: 'e.g. R13,800 → to seller\'s bank account', color: 'bg-sage' },
            { step: '3', label: 'EFT Commission to Admin', desc: 'e.g. R1,200 → to admin\'s bank account above', color: 'bg-sienna' },
          ].map(({ step, label, desc, color }) => (
            <div key={step} className="flex items-start gap-3">
              <div className={`w-7 h-7 ${color} text-white font-body font-bold text-xs flex items-center justify-center flex-shrink-0`}>{step}</div>
              <div>
                <p className="font-body font-semibold text-sm text-espresso">{label}</p>
                <p className="font-body text-xs text-muted">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Release modal */}
      {releaseModal && (
        <Modal open={!!releaseModal} onClose={() => setReleaseModal(null)} title="Manage EFTs" maxWidth="max-w-lg">
          <ReleaseModalContent
            txn={releaseModal}
            kennel={kennels.find(k => k.id === releaseModal.kennelId)}
            adminSettings={adminSettings}
            onSellerPaid={() => { markSellerPaid(releaseModal.id); setReleaseModal(prev => ({ ...prev, sellerPaid: true, sellerPaidDate: new Date().toISOString().split('T')[0] })) }}
            onCommissionPaid={() => { markCommissionPaid(releaseModal.id); setReleaseModal(prev => ({ ...prev, commissionPaid: true, commissionPaidDate: new Date().toISOString().split('T')[0] })) }}
            onBothPaid={() => { releasePayment(releaseModal.id); setReleaseModal(null) }}
            onClose={() => setReleaseModal(null)}
          />
        </Modal>
      )}
    </div>
  )
}
