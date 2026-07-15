'use client'

type Platform = 'download' | 'native' | 'whatsapp' | 'instagram' | 'facebook'

type Props = {
  isExporting: boolean
  canNativeShare: boolean
  onDownload: (platform?: Platform) => Promise<void>
  onNativeShare: () => Promise<void>
  onWhatsApp: () => Promise<void>
  onInstagram: () => Promise<void>
  onFacebook: () => Promise<void>
  onCopyCaption: () => Promise<void>
}

export default function ShareActions({
  isExporting,
  canNativeShare,
  onDownload,
  onNativeShare,
  onWhatsApp,
  onInstagram,
  onFacebook,
  onCopyCaption,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={canNativeShare ? onNativeShare : onWhatsApp}
          disabled={isExporting}
          className="tap-press min-h-12 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-black disabled:opacity-60"
        >
          {isExporting ? 'Preparing...' : 'Share'}
        </button>
        <button
          type="button"
          onClick={() => onDownload('download')}
          disabled={isExporting}
          className="tap-press min-h-12 rounded-xl border border-[#d8a84f]/45 bg-[#d8a84f]/12 px-4 py-3 text-sm font-black text-[#f1d28a] disabled:opacity-60"
        >
          Download Image
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SmallAction label="WhatsApp" onClick={onWhatsApp} disabled={isExporting} />
        <SmallAction
          label="Download for Instagram"
          onClick={onInstagram}
          disabled={isExporting}
        />
        <SmallAction label="Facebook" onClick={onFacebook} disabled={isExporting} />
        <SmallAction label="Copy caption" onClick={onCopyCaption} disabled={false} />
      </div>
    </div>
  )
}

function SmallAction({
  label,
  onClick,
  disabled,
}: {
  label: string
  onClick: () => Promise<void>
  disabled: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="tap-press min-h-10 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-bold text-white/70 disabled:opacity-50"
    >
      {label}
    </button>
  )
}
