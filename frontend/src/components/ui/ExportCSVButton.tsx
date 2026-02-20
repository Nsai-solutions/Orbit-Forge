interface ExportCSVButtonProps {
  onClick: () => void
  label?: string
}

export default function ExportCSVButton({ onClick, label = 'Export CSV' }: ExportCSVButtonProps) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-1 rounded text-[9px] font-mono border border-white/10 text-[var(--text-tertiary)] hover:text-accent-blue hover:border-accent-blue/30 transition-colors"
    >
      {label}
    </button>
  )
}
