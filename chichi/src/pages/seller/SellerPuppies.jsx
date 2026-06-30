import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { Plus, Trash2, X, Check, Upload, Landmark, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import Modal from '../../components/Modal'
import { uploadImage, uploadImages } from '../../utils/storage'

const SA_BANKS = [
  'ABSA Bank', 'Capitec Bank', 'FNB (First National Bank)', 'Nedbank',
  'Standard Bank', 'African Bank', 'Bidvest Bank', 'Discovery Bank',
  'Investec', 'TymeBank', 'Other',
]

function BankingDetailsSection({ kennel, onSave }) {
  const hasBanking = kennel?.accountNumber
  const [open, setOpen] = useState(!hasBanking)
  const [saved, setSaved] = useState(false)
  const [bankError, setBankError] = useState('')
  const [bank, setBank] = useState({
    bankName: kennel?.bankName ?? '',
    accountHolder: kennel?.accountHolder ?? '',
    accountNumber: kennel?.accountNumber ?? '',
    branchCode: kennel?.branchCode ?? '',
    accountType: kennel?.accountType ?? 'Cheque / Current',
  })

  const handleSave = async (e) => {
    e.preventDefault()
    setBankError('')
    try {
      await onSave(bank)
      setSaved(true)
      setTimeout(() => { setSaved(false); setOpen(false) }, 2000)
    } catch (err) {
      setBankError(err?.message || 'Failed to save banking details. Please try again.')
    }
  }

  return (
    <div className={`border mb-6 ${hasBanking ? 'border-sage/30 bg-sage/5' : 'border-amber-200 bg-amber-50'}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4"
      >
        <div className="flex items-center gap-3">
          <Landmark className={`w-4 h-4 flex-shrink-0 ${hasBanking ? 'text-sage-dark' : 'text-amber-600'}`} />
          <div className="text-left">
            <p className={`font-body font-semibold text-sm ${hasBanking ? 'text-sage-dark' : 'text-amber-800'}`}>
              {hasBanking ? `Banking Details — ${kennel.bankName} ···· ${kennel.accountNumber.slice(-4)}` : '⚠ Add Banking Details to Receive Payments'}
            </p>
            <p className="font-body text-xs text-muted mt-0.5">
              {hasBanking ? 'Admin will EFT your payout to this account after each sale.' : 'Required so admin can send your payout via EFT after each sale.'}
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted flex-shrink-0" />}
      </button>

      {open && (
        <form onSubmit={handleSave} className="px-5 pb-5 border-t border-divider pt-4 space-y-4 bg-white">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Bank Name *</label>
              <select required className="input-field" value={bank.bankName} onChange={e => setBank(b => ({ ...b, bankName: e.target.value }))}>
                <option value="">Select your bank</option>
                {SA_BANKS.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Account Type *</label>
              <div className="flex border border-divider overflow-hidden">
                {['Cheque / Current', 'Savings', 'Transmission'].map(t => (
                  <button key={t} type="button"
                    onClick={() => setBank(b => ({ ...b, accountType: t }))}
                    className={`flex-1 py-3 font-body text-xs font-semibold transition-colors ${bank.accountType === t ? 'bg-espresso text-cream' : 'bg-white text-muted hover:text-espresso'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Account Holder Name *</label>
              <input required className="input-field" value={bank.accountHolder} onChange={e => setBank(b => ({ ...b, accountHolder: e.target.value }))} placeholder="Name as on bank account" />
            </div>
            <div>
              <label className="label">Account Number *</label>
              <input required className="input-field font-mono tracking-widest" value={bank.accountNumber} onChange={e => setBank(b => ({ ...b, accountNumber: e.target.value }))} placeholder="e.g. 1234567890" inputMode="numeric" />
            </div>
            <div>
              <label className="label">Branch Code *</label>
              <input required className="input-field font-mono" value={bank.branchCode} onChange={e => setBank(b => ({ ...b, branchCode: e.target.value }))} placeholder="e.g. 632005" inputMode="numeric" />
              <p className="font-body text-[10px] text-muted mt-1">FNB: 250655 · ABSA: 632005 · Standard: 051001 · Nedbank: 198765 · Capitec: 470010</p>
            </div>
          </div>
          <button type="submit" className={`flex items-center gap-2 px-6 py-2.5 font-body text-xs font-semibold tracking-widest uppercase transition-colors ${saved ? 'bg-sage text-white' : 'btn-primary'}`}>
            {saved ? <><Check className="w-3.5 h-3.5" /> Saved!</> : 'Save Banking Details'}
          </button>
          {bankError && <p className="font-body text-xs text-red-600 mt-2">{bankError}</p>}
        </form>
      )}
    </div>
  )
}

const EMPTY_FORM = {
  name: '',
  breed: 'Chihuahua',
  coatType: 'Smooth Coat',
  gender: 'Male',
  color: '',
  dob: '',
  price: '',
  breedingRights: null,
  breedingRightsPrice: '',
  description: '',
  registrationNo: '',
  pedigree: { sire: '', dam: '', sireSire: '', sireDam: '', damSire: '', damDam: '' },
  health: [],
  images: [],
  sireImage: null,
  damImage: null,
}

const HEALTH_OPTIONS = [
  'Inoculation Up to Date',
  'Deworming Up to Date',
  'Vet Checked & Certified',
]

export default function SellerPuppies() {
  const { sellerUser, puppies, adminSettings, kennels, addPuppy, delistPuppy, updateSellerProfile } = useApp()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [imagePreviews, setImagePreviews] = useState([])
  const [uploadingImages, setUploadingImages] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [uploadingSire, setUploadingSire] = useState(false)
  const [sireError, setSireError] = useState('')
  const [uploadingDam, setUploadingDam] = useState(false)
  const [damError, setDamError] = useState('')
  const [addError, setAddError] = useState(null)
  const [commissionModal, setCommissionModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const myPuppies = puppies.filter(p => p.kennelId === sellerUser?.kennelId)
  const kennel = sellerUser?.kennel ?? kennels.find(k => k.id === sellerUser?.kennelId)
  const commission = kennel?.commission ?? adminSettings?.defaultCommission ?? 8
  const totalPrice = Number(form.price || 0) + Number(form.breedingRightsPrice || 0)
  const commissionAmt = totalPrice ? Math.round(totalPrice * commission / 100) : 0
  const payoutAmt = totalPrice ? totalPrice - commissionAmt : 0

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))
  const setPedigree = (key) => (e) => setForm(f => ({ ...f, pedigree: { ...f.pedigree, [key]: e.target.value } }))

  const toggleHealth = (cert) => {
    setForm(f => ({
      ...f,
      health: f.health.includes(cert) ? f.health.filter(h => h !== cert) : [...f.health, cert],
    }))
  }

  const handleImages = async (e) => {
    const files = e.target.files
    if (!files.length) return
    // Show local previews immediately while uploading
    const localPreviews = Array.from(files).map(f => URL.createObjectURL(f))
    setImagePreviews(localPreviews)
    setUploadingImages(true)
    setUploadError(null)
    try {
      const urls = await uploadImages(files)
      setImagePreviews(urls)
      setForm(f => ({ ...f, images: urls }))
    } catch (err) {
      setUploadError(err?.message || 'Image upload failed. Check your internet connection and try again.')
      setImagePreviews([])
      setForm(f => ({ ...f, images: [] }))
    } finally {
      setUploadingImages(false)
    }
  }

  const handleSireImage = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setForm(f => ({ ...f, sireImage: URL.createObjectURL(file) }))
    setUploadingSire(true)
    setSireError('')
    try {
      const url = await uploadImage(file)
      setForm(f => ({ ...f, sireImage: url }))
    } catch (err) {
      setForm(f => ({ ...f, sireImage: null }))
      setSireError(err?.message || 'Sire photo upload failed. Please try again.')
    } finally {
      setUploadingSire(false)
    }
  }

  const handleDamImage = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setForm(f => ({ ...f, damImage: URL.createObjectURL(file) }))
    setUploadingDam(true)
    setDamError('')
    try {
      const url = await uploadImage(file)
      setForm(f => ({ ...f, damImage: url }))
    } catch (err) {
      setForm(f => ({ ...f, damImage: null }))
      setDamError(err?.message || 'Dam photo upload failed. Please try again.')
    } finally {
      setUploadingDam(false)
    }
  }

  const handleFormSubmit = (e) => {
    e.preventDefault()
    if (form.breedingRights === null) return
    setAddError(null)
    if (!form.sireImage || form.sireImage.startsWith('blob:')) {
      setAddError('A photo of the sire (father) is required for admin verification.')
      return
    }
    if (!form.damImage || form.damImage.startsWith('blob:')) {
      setAddError('A photo of the dam (mother) is required for admin verification.')
      return
    }
    setCommissionModal(true)
  }

  const handleConfirmAdd = async () => {
    setAddError(null)
    try {
      await addPuppy({
        ...form,
        kennelId: sellerUser.kennelId,
        price: Number(form.price),
        breedingRightsPrice: Number(form.breedingRightsPrice || 0),
        images: form.images.length > 0 ? form.images : [],
      })
      setCommissionModal(false)
      setShowForm(false)
      setForm(EMPTY_FORM)
      setImagePreviews([])
    } catch (err) {
      setCommissionModal(false)
      setAddError(err.message || 'Failed to add puppy. Please try again.')
    }
  }

  return (
    <div>
      {/* Banking details */}
      <BankingDetailsSection
        kennel={sellerUser?.kennel}
        onSave={(bankData) => updateSellerProfile(bankData)}
      />

      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-display text-3xl font-semibold text-espresso mb-1">My Puppies</h2>
          <p className="font-body text-sm text-muted">{myPuppies.filter(p => !p.sold).length} active · {myPuppies.filter(p => p.sold).length} sold</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`flex items-center gap-2 text-xs font-body font-semibold tracking-widest uppercase px-5 py-2.5 transition-colors ${showForm ? 'bg-divider text-muted' : 'btn-primary'}`}
        >
          {showForm ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Plus className="w-3.5 h-3.5" /> Add Puppy</>}
        </button>
      </div>

      {/* Add puppy form */}
      {showForm && (
        <form onSubmit={handleFormSubmit} className="bg-white border border-divider p-6 mb-8 space-y-6">
          <h3 className="font-display text-xl font-semibold text-espresso border-b border-divider pb-3">New Puppy Listing</h3>

          {/* Basic info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Name *</label>
              <input className="input-field" required value={form.name} onChange={set('name')} placeholder="Puppy's name" />
            </div>
            <div>
              <label className="label">Breed</label>
              <input className="input-field bg-cream text-muted cursor-not-allowed" readOnly value="Chihuahua" />
            </div>
            <div>
              <label className="label">Coat Type *</label>
              <div className="flex border border-divider overflow-hidden">
                {['Smooth Coat', 'Long Coat'].map(c => (
                  <button key={c} type="button" onClick={() => setForm(f => ({ ...f, coatType: c }))}
                    className={`flex-1 py-3 font-body text-xs font-semibold transition-colors ${form.coatType === c ? 'bg-espresso text-cream' : 'bg-white text-muted hover:text-espresso'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Colour *</label>
              <input className="input-field" required value={form.color} onChange={set('color')} placeholder="e.g. Blue Merle, Fawn, Cream" />
            </div>
            <div>
              <label className="label">Gender *</label>
              <div className="flex border border-divider overflow-hidden">
                {['Male', 'Female'].map(g => (
                  <button key={g} type="button" onClick={() => setForm(f => ({ ...f, gender: g }))}
                    className={`flex-1 py-3 font-body text-xs font-semibold transition-colors ${form.gender === g ? 'bg-espresso text-cream' : 'bg-white text-muted hover:text-espresso'}`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Date of Birth *</label>
              <input type="date" className="input-field" required value={form.dob} onChange={set('dob')} />
            </div>
            <div>
              <label className="label">Registration No.</label>
              <input className="input-field" value={form.registrationNo} onChange={set('registrationNo')} placeholder="KUSA-2026-CHI-..." />
            </div>
          </div>

          {/* Price & Breeding Rights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Price (R) *</label>
              <input type="number" min="1" className="input-field" required value={form.price} onChange={set('price')} placeholder="15000" />
            </div>
            <div>
              <label className="label">Breeding Rights *</label>
              <div className="flex border border-divider overflow-hidden">
                {[{ val: true, label: 'Full Breeding Rights', color: 'bg-sage text-white' }, { val: false, label: 'Non-Breeding (Pet Only)', color: 'bg-espresso text-cream' }].map(opt => (
                  <button
                    key={String(opt.val)}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, breedingRights: opt.val }))}
                    className={`flex-1 py-3 px-2 font-body text-xs font-semibold transition-colors text-center leading-tight ${form.breedingRights === opt.val ? opt.color : 'bg-white text-muted hover:text-espresso'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {form.breedingRights === null && (
                <p className="font-body text-[10px] text-red-500 mt-1">Please select breeding rights</p>
              )}
            </div>
            {form.breedingRights === true && (
              <div>
                <label className="label">Breeding Rights Additional Price (R)</label>
                <input
                  type="number"
                  min="0"
                  className="input-field"
                  value={form.breedingRightsPrice}
                  onChange={set('breedingRightsPrice')}
                  placeholder="e.g. 3000 (added on top of puppy price)"
                />
                {form.breedingRightsPrice && (
                  <p className="font-body text-[10px] text-muted mt-1">
                    Total with breeding rights: R{(Number(form.price || 0) + Number(form.breedingRightsPrice)).toLocaleString()}
                  </p>
                )}
              </div>
            )}
            {form.price && (
              <div className="bg-sienna/5 border border-sienna/20 p-4 flex flex-col justify-center space-y-1">
                <p className="font-body text-xs text-muted font-semibold">Commission preview ({commission}% goes to Chihuahua South Africa admin)</p>
                <p className="font-body text-xs text-muted">Puppy price: R{Number(form.price).toLocaleString()}</p>
                {form.breedingRightsPrice && Number(form.breedingRightsPrice) > 0 && (
                  <p className="font-body text-xs text-muted">Breeding rights: R{Number(form.breedingRightsPrice).toLocaleString()}</p>
                )}
                <p className="font-body text-sm"><span className="text-muted">Total sale:</span> <strong className="text-espresso">R{totalPrice.toLocaleString()}</strong></p>
                <p className="font-body text-sm"><span className="text-muted">Commission:</span> <strong className="text-sienna">R{commissionAmt.toLocaleString()}</strong></p>
                <p className="font-body text-sm"><span className="text-muted">Your payout:</span> <strong className="text-sage-dark">R{payoutAmt.toLocaleString()}</strong></p>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="label">Description *</label>
            <textarea className="input-field" required rows={3} value={form.description} onChange={set('description')} placeholder="Describe the puppy, head type (apple/deer), coat quality, temperament, what's included in the puppy pack..." />
          </div>

          {/* Pedigree */}
          <div>
            <label className="label mb-3">Pedigree</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[['sire', "Sire (Father)"], ['dam', 'Dam (Mother)'], ['sireSire', "Sire's Sire"], ['sireDam', "Sire's Dam"], ['damSire', "Dam's Sire"], ['damDam', "Dam's Dam"]].map(([key, label]) => (
                <div key={key}>
                  <label className="label text-[10px]">{label}</label>
                  <input className="input-field text-xs py-2" value={form.pedigree[key]} onChange={setPedigree(key)} placeholder={label} />
                </div>
              ))}
            </div>
          </div>

          {/* Health certs */}
          <div>
            <label className="label mb-3">Health Certifications</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {HEALTH_OPTIONS.map(cert => (
                <div key={cert} onClick={() => toggleHealth(cert)} className={`flex items-center gap-2 p-2 border cursor-pointer transition-colors ${form.health.includes(cert) ? 'border-sage bg-sage/5' : 'border-divider hover:border-sage/40'}`}>
                  <div className={`w-4 h-4 flex items-center justify-center flex-shrink-0 border transition-colors ${form.health.includes(cert) ? 'border-sage bg-sage' : 'border-divider'}`}>
                    {form.health.includes(cert) && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <span className="font-body text-xs text-espresso leading-tight">{cert}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Images */}
          {/* Puppy photos */}
          <div>
            <label className="label mb-3">Puppy Photos</label>
            <label className={`flex items-center gap-3 border-2 border-dashed p-6 transition-colors ${uploadingImages ? 'border-sienna/40 cursor-wait' : 'border-divider hover:border-sienna/40 cursor-pointer'}`}>
              {uploadingImages
                ? <Loader2 className="w-5 h-5 text-sienna animate-spin" />
                : <Upload className="w-5 h-5 text-muted" />}
              <span className="font-body text-sm text-muted">
                {uploadingImages ? 'Uploading photos…' : 'Click to upload puppy photos (multiple allowed)'}
              </span>
              <input type="file" accept="image/*" multiple className="sr-only" onChange={handleImages} disabled={uploadingImages} />
            </label>
            {uploadError && (
              <p className="font-body text-xs text-red-500 mt-1">{uploadError}</p>
            )}
            {imagePreviews.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {imagePreviews.map((url, i) => (
                  <img key={i} src={url} alt="" className="w-16 h-16 object-cover border border-divider" />
                ))}
              </div>
            )}
          </div>

          {/* Sire & Dam photos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label mb-3">Sire (Father) Photo *</label>
              <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed border-divider hover:border-sienna/40 p-4 cursor-pointer transition-colors min-h-[120px] ${uploadingSire ? 'opacity-60 pointer-events-none' : ''}`}>
                {uploadingSire ? (
                  <Loader2 className="w-5 h-5 text-sienna animate-spin" />
                ) : form.sireImage ? (
                  <img src={form.sireImage} alt="Sire" className="w-full h-28 object-cover" />
                ) : (
                  <>
                    <Upload className="w-5 h-5 text-muted" />
                    <span className="font-body text-xs text-muted text-center">Upload photo of the Sire</span>
                  </>
                )}
                <input type="file" accept="image/*" className="sr-only" onChange={handleSireImage} disabled={uploadingSire} />
              </label>
              {form.sireImage && !uploadingSire && (
                <button type="button" onClick={() => setForm(f => ({ ...f, sireImage: null }))} className="font-body text-xs text-red-500 hover:underline mt-1">Remove</button>
              )}
              {sireError && <p className="font-body text-xs text-red-600 mt-1">{sireError}</p>}
            </div>
            <div>
              <label className="label mb-3">Dam (Mother) Photo *</label>
              <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed border-divider hover:border-sienna/40 p-4 cursor-pointer transition-colors min-h-[120px] ${uploadingDam ? 'opacity-60 pointer-events-none' : ''}`}>
                {uploadingDam ? (
                  <Loader2 className="w-5 h-5 text-sienna animate-spin" />
                ) : form.damImage ? (
                  <img src={form.damImage} alt="Dam" className="w-full h-28 object-cover" />
                ) : (
                  <>
                    <Upload className="w-5 h-5 text-muted" />
                    <span className="font-body text-xs text-muted text-center">Upload photo of the Dam</span>
                  </>
                )}
                <input type="file" accept="image/*" className="sr-only" onChange={handleDamImage} disabled={uploadingDam} />
              </label>
              {form.damImage && !uploadingDam && (
                <button type="button" onClick={() => setForm(f => ({ ...f, damImage: null }))} className="font-body text-xs text-red-500 hover:underline mt-1">Remove</button>
              )}
              {damError && <p className="font-body text-xs text-red-600 mt-1">{damError}</p>}
            </div>
          </div>

          {addError && (
            <p className="font-body text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2">{addError}</p>
          )}

          <button type="submit" disabled={uploadingImages || uploadingSire || uploadingDam}
            className={`btn-primary text-xs tracking-widest uppercase py-3.5 px-8 ${(uploadingImages || uploadingSire || uploadingDam) ? 'opacity-60 cursor-not-allowed' : ''}`}>
            Review & Confirm Listing
          </button>
        </form>
      )}

      {/* Puppy list */}
      {myPuppies.length === 0 ? (
        <div className="text-center py-20 font-body text-sm text-muted">
          No puppies listed yet. Click "Add Puppy" to get started.
        </div>
      ) : (
        <div className="bg-white border border-divider overflow-hidden">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="bg-cream border-b border-divider">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-widest">Puppy</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-widest">Coat / Gender</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-widest">Colour</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-widest">Price</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-widest">Breeding</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-widest">Reg No.</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-widest">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {myPuppies.map(p => (
                <tr key={p.id} className="hover:bg-cream/30 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={p.images[0] || ''}
                        alt={p.name}
                        className={`w-10 h-10 object-cover flex-shrink-0 ${p.sold ? 'grayscale' : ''}`}
                        onError={e => { e.target.src = `https://picsum.photos/seed/${p.id}/80/80` }}
                      />
                      <span className="font-semibold text-espresso">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-muted text-xs">
                    <div>{p.coatType ?? 'Smooth Coat'}</div>
                    <div className={`text-[10px] font-bold ${p.gender === 'Male' ? 'text-blue-600' : 'text-pink-500'}`}>{p.gender}</div>
                  </td>
                  <td className="px-5 py-3 text-muted text-xs">{p.color || '—'}</td>
                  <td className="px-5 py-3 font-semibold text-espresso">
                    R{p.price.toLocaleString()}
                    {p.breedingRightsPrice > 0 && <div className="text-[10px] text-sage-dark font-normal">+R{Number(p.breedingRightsPrice).toLocaleString()} breeding</div>}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 ${p.breedingRights ? 'bg-sage/10 text-sage-dark' : 'bg-espresso/10 text-espresso'}`}>
                      {p.breedingRights ? 'Full' : 'Pet Only'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted text-xs font-mono">{p.registrationNo || '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 ${p.sold ? 'bg-red-100 text-red-700' : 'bg-sage/10 text-sage-dark'}`}>
                      {p.sold ? 'Sold' : 'Active'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {!p.sold && (
                      <button
                        onClick={() => setDeleteTarget(p)}
                        className="flex items-center gap-1 text-red-500 hover:text-red-700 font-body text-xs transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delist
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Commission confirmation modal */}
      <Modal open={commissionModal} onClose={() => setCommissionModal(false)} title="Confirm Listing">
        <div className="space-y-4">
          <p className="font-body text-sm text-muted">
            Review the pricing for <strong className="text-espresso">{form.name}</strong> before listing.
          </p>
          <div className="bg-cream border border-divider p-4 space-y-2">
            <div className="flex justify-between font-body text-sm">
              <span className="text-muted">Puppy price</span>
              <span className="text-espresso">R{Number(form.price).toLocaleString()}</span>
            </div>
            {form.breedingRightsPrice && Number(form.breedingRightsPrice) > 0 && (
              <div className="flex justify-between font-body text-sm">
                <span className="text-muted">Breeding rights fee</span>
                <span className="text-espresso">R{Number(form.breedingRightsPrice).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-body text-sm border-t border-divider pt-2">
              <span className="font-semibold text-espresso">Total sale price</span>
              <span className="font-semibold text-espresso">R{totalPrice.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-body text-sm border-b border-divider pb-2">
              <span className="text-muted">Admin commission ({commission}%)</span>
              <span className="text-sienna">− R{commissionAmt.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-body text-sm pt-1">
              <span className="font-semibold text-espresso">Your net payout</span>
              <span className="font-bold text-sage-dark text-base">R{payoutAmt.toLocaleString()}</span>
            </div>
          </div>
          <p className="font-body text-xs text-muted leading-relaxed">
            By confirming, you agree that the {commission}% commission will be paid to the Chihuahua South Africa admin upon sale. Your net payout will be transferred to you within 3 business days of confirmed delivery.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setCommissionModal(false)} className="flex-1 btn-secondary text-xs tracking-widest uppercase py-3">Cancel</button>
            <button onClick={handleConfirmAdd} className="flex-1 btn-primary text-xs tracking-widest uppercase py-3">Confirm & List</button>
          </div>
        </div>
      </Modal>

      {/* Delist confirmation */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delist Puppy">
        <div className="space-y-4">
          <p className="font-body text-sm text-muted">
            Remove <strong className="text-espresso">{deleteTarget?.name}</strong> from your active listings?
            Use this if you've sold the puppy outside of Chihuahua South Africa.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteTarget(null)} className="flex-1 btn-secondary text-xs tracking-widest uppercase py-3">Cancel</button>
            <button
              onClick={() => { delistPuppy(deleteTarget.id); setDeleteTarget(null) }}
              className="flex-1 bg-red-600 text-white font-body text-xs font-semibold tracking-widest uppercase py-3 hover:bg-red-700 transition-colors"
            >
              Delist
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
