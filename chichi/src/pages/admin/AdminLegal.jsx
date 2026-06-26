import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { Save, Eye, Edit3, Check } from 'lucide-react'

function MarkdownPreview({ text }) {
  const lines = text.split('\n')
  const elements = []
  let key = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('# ')) {
      elements.push(<h1 key={key++} className="font-display text-2xl font-semibold text-espresso mt-6 mb-3">{line.slice(2)}</h1>)
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={key++} className="font-display text-lg font-semibold text-espresso mt-5 mb-2">{line.slice(3)}</h2>)
    } else if (line.startsWith('- ')) {
      elements.push(
        <li key={key++} className="ml-5 list-disc font-body text-sm text-muted leading-relaxed">
          {line.slice(2).replace(/\*\*(.+?)\*\*/g, (_, m) => m)}
        </li>
      )
    } else if (line.trim() === '') {
      elements.push(<div key={key++} className="h-2" />)
    } else {
      const parts = line.split(/\*\*(.+?)\*\*/)
      elements.push(
        <p key={key++} className="font-body text-sm text-muted leading-relaxed">
          {parts.map((part, idx) =>
            idx % 2 === 1
              ? <strong key={idx} className="font-semibold text-espresso">{part}</strong>
              : part
          )}
        </p>
      )
    }
  }
  return <div className="space-y-1">{elements}</div>
}

export default function AdminLegal() {
  const { legalContent, updateLegal } = useApp()
  const [draft, setDraft] = useState(legalContent)
  const [mode, setMode] = useState('edit')
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    await updateLegal(draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const hasChanges = draft !== legalContent

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-display text-3xl font-semibold text-espresso mb-1">Legal & Rules</h2>
          <p className="font-body text-sm text-muted">Edit the terms, conditions, and marketplace rules shown publicly.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-divider overflow-hidden">
            <button
              onClick={() => setMode('edit')}
              className={`flex items-center gap-1.5 px-3 py-2 font-body text-xs font-medium transition-colors ${mode === 'edit' ? 'bg-espresso text-cream' : 'bg-white text-muted hover:text-espresso'}`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit
            </button>
            <button
              onClick={() => setMode('preview')}
              className={`flex items-center gap-1.5 px-3 py-2 font-body text-xs font-medium transition-colors ${mode === 'preview' ? 'bg-espresso text-cream' : 'bg-white text-muted hover:text-espresso'}`}
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={`flex items-center gap-2 px-4 py-2 font-body text-xs font-semibold tracking-widest uppercase transition-all ${
              saved ? 'bg-sage text-white' : hasChanges ? 'bg-sienna text-white hover:bg-sienna-dark' : 'bg-divider text-muted cursor-not-allowed'
            }`}
          >
            {saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      {mode === 'edit' ? (
        <div>
          {hasChanges && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 font-body text-xs px-4 py-2 mb-4">
              You have unsaved changes.
            </div>
          )}
          <textarea
            className="w-full h-[calc(100vh-280px)] input-field font-mono text-xs leading-relaxed resize-none"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            spellCheck={false}
          />
          <p className="font-body text-xs text-muted mt-2">
            Supports basic Markdown: # Heading, ## Subheading, **bold**, - bullet points
          </p>
        </div>
      ) : (
        <div className="bg-white border border-divider p-8 min-h-[calc(100vh-280px)] overflow-y-auto max-w-3xl">
          <MarkdownPreview text={draft} />
        </div>
      )}
    </div>
  )
}
