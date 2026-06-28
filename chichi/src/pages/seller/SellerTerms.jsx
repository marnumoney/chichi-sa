import { useApp } from '../../context/AppContext'

function renderLines(lines) {
  return lines.map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-2" />
    if (line.startsWith('- '))
      return <li key={i} className="ml-5 list-disc font-body text-sm text-muted leading-relaxed">{line.slice(2)}</li>
    if (line.startsWith('## '))
      return <h2 key={i} className="font-display text-lg font-semibold text-espresso mt-6 mb-2">{line.slice(3)}</h2>
    if (line.startsWith('# '))
      return <h1 key={i} className="font-display text-2xl font-semibold text-espresso mt-6 mb-3">{line.slice(2)}</h1>
    const parts = line.split(/\*\*(.+?)\*\*/)
    return (
      <p key={i} className="font-body text-sm text-muted leading-relaxed">
        {parts.map((p, j) => j % 2 === 1 ? <strong key={j} className="font-semibold text-espresso">{p}</strong> : p)}
      </p>
    )
  })
}

export default function SellerTerms() {
  const { legalContent } = useApp()

  return (
    <div>
      <div className="mb-8">
        <h2 className="font-display text-3xl font-semibold text-espresso mb-1">Terms &amp; Conditions</h2>
        <p className="font-body text-sm text-muted">Marketplace rules and seller obligations.</p>
      </div>

      <div className="bg-white border border-divider p-6 md:p-10 max-w-3xl">
        {legalContent
          ? <div className="space-y-1">{renderLines(legalContent.split('\n'))}</div>
          : <p className="font-body text-sm text-muted">No terms have been published yet.</p>
        }
      </div>
    </div>
  )
}
