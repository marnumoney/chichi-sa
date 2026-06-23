import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useApp } from '../context/AppContext'

function parseSections(text) {
  const sections = []
  const lines = text.split('\n')
  let current = null
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (current) sections.push(current)
      current = { title: line.slice(3), lines: [] }
    } else if (line.startsWith('# ')) {
      // top-level heading — skip as title
    } else if (current) {
      current.lines.push(line)
    }
  }
  if (current) sections.push(current)
  return sections
}

function renderLines(lines) {
  return lines.map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-2" />
    if (line.startsWith('- ')) return <li key={i} className="ml-5 list-disc font-body text-sm text-muted leading-relaxed">{line.slice(2)}</li>
    const parts = line.split(/\*\*(.+?)\*\*/)
    return (
      <p key={i} className="font-body text-sm text-muted leading-relaxed">
        {parts.map((p, j) => j % 2 === 1 ? <strong key={j} className="font-semibold text-espresso">{p}</strong> : p)}
      </p>
    )
  })
}

function Accordion({ title, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-divider">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-cream/50 transition-colors text-left">
        <span className="font-display text-lg font-semibold text-espresso">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-divider space-y-2 bg-white">
          {children}
        </div>
      )}
    </div>
  )
}

export default function LegalPage() {
  const { legalContent } = useApp()
  const sections = parseSections(legalContent)

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      <div className="mb-10">
        <h1 className="font-display text-4xl font-semibold text-espresso mb-3">Terms & Conditions</h1>
        <p className="font-body text-sm text-muted">Click any section to expand. Last updated by admin.</p>
      </div>
      <div className="space-y-2">
        {sections.length > 0
          ? sections.map((s, i) => (
              <Accordion key={i} title={s.title}>
                <div className="pt-3 space-y-1.5">{renderLines(s.lines)}</div>
              </Accordion>
            ))
          : legalContent
            ? <div className="bg-white border border-divider p-6 space-y-1.5">{renderLines(legalContent.split('\n'))}</div>
            : <p className="font-body text-sm text-muted">No terms & conditions have been published yet.</p>
        }
      </div>
    </div>
  )
}
