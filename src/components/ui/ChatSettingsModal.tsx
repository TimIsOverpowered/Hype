import { useCallback, useState } from 'react';
import { DEFAULT_CHAT_WIDTH_MAX, DEFAULT_CHAT_WIDTH_MIN } from '../../constants/ui';
import type { UseChatSettingsReturn } from '../../hooks/useChatSettings';

const FONT_OPTIONS = [
  { label: 'System Sans', value: 'ui-sans-serif, system-ui, -apple-system, sans-serif' },
  { label: 'Inter', value: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif' },
  { label: 'Roboto', value: 'Roboto, ui-sans-serif, system-ui, -apple-system, sans-serif' },
  { label: 'SF Pro', value: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif' },
  { label: 'Source Sans 3', value: 'Source Sans 3, ui-sans-serif, system-ui, -apple-system, sans-serif' },
  { label: 'JetBrains Mono', value: 'JetBrains Mono, ui-monospace, Caskaydia Cove, monospace' },
  { label: 'SF Mono', value: 'SF Mono, ui-monospace, Cascadia Code, monospace' },
  { label: 'IBM Plex Mono', value: 'IBM Plex Mono, ui-monospace, monospace' },
  { label: 'Georgia (Serif)', value: 'Georgia, ui-serif, serif' },
  { label: 'System Serif', value: 'ui-serif, Georgia, Cambria, serif' },
];

const RotateCcwIcon = () => (
  // biome-ignore lint/a11y/noSvgWithoutTitle: icon button has title prop on parent button
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
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

interface ChatSettingsModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly chatSettings: UseChatSettingsReturn;
}

export default function ChatSettingsModal({ open, onClose, chatSettings }: ChatSettingsModalProps) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleResetAll = useCallback(() => {
    chatSettings.resetAll();
    setShowResetConfirm(false);
  }, [chatSettings]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-80 max-h-[85vh] rounded-lg border border-border bg-surface text-text-primary"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="text-text-secondary transition-colors hover:text-text-primary"
            title="Reset all settings to defaults"
          >
            <RotateCcwIcon />
          </button>

          <h3 className="text-sm font-medium">Chat Settings</h3>

          <button
            type="button"
            onClick={onClose}
            className="text-text-secondary transition-colors hover:text-text-primary"
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
              <title>Close settings</title>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4" style={{ maxHeight: 'calc(85vh - 52px)' }}>
          <div className="space-y-4">
            <div className="rounded border border-border px-3 py-2">
              <div className="mb-2 text-xs font-medium text-text-secondary">Font</div>
              <div className="flex items-center gap-2">
                <select
                  value={chatSettings.fontFamily}
                  onChange={(e) => chatSettings.setFontFamily(e.target.value)}
                  className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm text-text-primary"
                >
                  {FONT_OPTIONS.map((font) => (
                    <option key={font.value} value={font.value}>
                      {font.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={chatSettings.resetFontFamily}
                  disabled={chatSettings.fontFamily === 'Inter, sans-serif'}
                  className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors ${
                    chatSettings.fontFamily === 'Inter, sans-serif'
                      ? 'cursor-not-allowed opacity-40'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                  title="Reset font"
                >
                  <RotateCcwIcon />
                </button>
              </div>
            </div>

            <div className="rounded border border-border px-3 py-2">
              <div className="mb-2 text-xs font-medium text-text-secondary">Font Size</div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={10}
                  max={24}
                  step={1}
                  value={chatSettings.messageFontSize}
                  onChange={(e) => chatSettings.setMessageFontSize(Number(e.target.value))}
                  className="min-w-0 flex-1 accent-primary"
                />
                <span className="shrink-0 text-sm text-text-secondary">{chatSettings.messageFontSize}px</span>
                <button
                  type="button"
                  onClick={chatSettings.resetMessageFontSize}
                  disabled={chatSettings.messageFontSize === 14}
                  className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors ${
                    chatSettings.messageFontSize === 14
                      ? 'cursor-not-allowed opacity-40'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                  title="Reset font size"
                >
                  <RotateCcwIcon />
                </button>
              </div>
            </div>

            <div className="rounded border border-border px-3 py-2">
              <div className="mb-2 text-xs font-medium text-text-secondary">Chat Width</div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={DEFAULT_CHAT_WIDTH_MIN}
                  max={DEFAULT_CHAT_WIDTH_MAX}
                  step={5}
                  value={chatSettings.chatWidth}
                  onChange={(e) => chatSettings.setChatWidth(Number(e.target.value))}
                  className="min-w-0 flex-1 accent-primary"
                />
                <span className="shrink-0 text-sm text-text-secondary">{chatSettings.chatWidth}px</span>
                <button
                  type="button"
                  onClick={chatSettings.resetChatWidth}
                  disabled={chatSettings.chatWidth === 340}
                  className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors ${
                    chatSettings.chatWidth === 340
                      ? 'cursor-not-allowed opacity-40'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                  title="Reset width"
                >
                  <RotateCcwIcon />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between rounded border border-border px-3 py-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={chatSettings.showTimestamp}
                  onChange={() => chatSettings.setShowTimestamp(!chatSettings.showTimestamp)}
                  className="accent-primary"
                />
                Show timestamps
              </label>
              <button
                type="button"
                onClick={chatSettings.resetShowTimestamp}
                disabled={!chatSettings.showTimestamp}
                className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors ${
                  !chatSettings.showTimestamp
                    ? 'cursor-not-allowed opacity-40'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
                title="Reset timestamps"
              >
                <RotateCcwIcon />
              </button>
            </div>

            <div className="flex items-center justify-between rounded border border-border px-3 py-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={chatSettings.chatOnLeft}
                  onChange={() => chatSettings.setChatOnLeft(!chatSettings.chatOnLeft)}
                  className="accent-primary"
                />
                Chat on left
              </label>
              <button
                type="button"
                onClick={chatSettings.resetChatOnLeft}
                disabled={!chatSettings.chatOnLeft}
                className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors ${
                  !chatSettings.chatOnLeft
                    ? 'cursor-not-allowed opacity-40'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
                title="Reset chat position"
              >
                <RotateCcwIcon />
              </button>
            </div>
          </div>
        </div>
      </div>

      {showResetConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={(e) => {
              e.stopPropagation();
              setShowResetConfirm(false);
            }}
          />
          <div
            className="relative z-[61] w-full max-w-[340px] rounded-lg border border-border bg-surface p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400">
                {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative icon in confirmation dialog */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
            </div>
            <h3 className="mb-2 text-center text-lg font-semibold text-text-primary">Reset All Settings?</h3>
            <p className="mb-6 text-center text-sm text-text-secondary">
              This will reset all your personalized chat settings back to their default values.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 rounded border border-border bg-background px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-background/80"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetAll}
                className="flex-1 rounded bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-500"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
