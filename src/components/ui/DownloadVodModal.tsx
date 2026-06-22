import { useEffect, useState } from 'react';
import type { M3u8Variant } from '../../types/twitch';
import { toHHMMSS } from '../../utils/time';

interface DownloadVodModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onDownload: (m3u8Url: string, includeChat: boolean) => void;
  readonly vodId: string;
  readonly vodTitle: string;
  readonly duration: number;
  readonly variants: M3u8Variant[];
  readonly isLoading: boolean;
}

export default function DownloadVodModal({
  open,
  onClose,
  onDownload,
  vodId,
  vodTitle,
  duration,
  variants,
  isLoading,
}: DownloadVodModalProps) {
  const [selectedVariantName, setSelectedVariantName] = useState('');
  const [includeChat, setIncludeChat] = useState(false);

  useEffect(() => {
    if (open && variants.length > 0) {
      setSelectedVariantName(variants[0].name);
    }
  }, [open, variants]);

  const handleDownload = () => {
    const variant = variants.find((v) => v.name === selectedVariantName);
    if (!variant) return;
    onDownload(variant.uri, includeChat);
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      {/* Modal */}
      <div
        role="document"
        className="relative z-10 w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <title>Close</title>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Title */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Download VOD</h2>
          <p className="mt-1 text-sm text-text-secondary">{vodTitle || `VOD ${vodId}`}</p>
        </div>

        {/* VOD info */}
        <div className="mb-4 flex items-center gap-3 text-xs text-text-hint">
          <span>ID: {vodId}</span>
          <span>·</span>
          <span>Duration: {toHHMMSS(duration)}</span>
        </div>

        {/* Quality selector */}
        <div className="mb-4">
          <label htmlFor="quality-select" className="mb-1.5 block text-xs font-medium text-text-secondary">
            Quality
          </label>
          {isLoading ? (
            <div className="flex h-10 items-center gap-2 rounded-md border border-border bg-background px-3">
              <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span className="text-xs text-text-hint">Scanning quality options...</span>
            </div>
          ) : variants.length === 0 ? (
            <div className="flex h-10 items-center rounded-md border border-border bg-background px-3">
              <span className="text-xs text-text-hint">No quality options available</span>
            </div>
          ) : (
            <select
              id="quality-select"
              value={selectedVariantName}
              onChange={(e) => setSelectedVariantName(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-text-primary outline-none transition-colors focus:border-primary"
            >
              {variants.map((variant) => (
                <option key={variant.name} value={variant.name}>
                  {variant.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Chat Toggle */}
        <div className="mb-6 flex items-center justify-between rounded-lg border border-border bg-black/20 p-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-text-primary">Include Chat Render</span>
            <span className="text-xs text-text-hint">Generates an additional chat overlay video</span>
          </div>
          <input
            type="checkbox"
            checked={includeChat}
            onChange={(e) => setIncludeChat(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
        </div>

        {/* Download button */}
        <button
          type="button"
          onClick={handleDownload}
          disabled={variants.length === 0 || isLoading}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <title>Download</title>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download
        </button>
      </div>
    </div>
  );
}
