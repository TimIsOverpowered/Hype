import { relaunch } from '@tauri-apps/plugin-process';
import type { Update } from '@tauri-apps/plugin-updater';
import { Download, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface UpdateDialogProps {
  readonly open: boolean;
  readonly update: Update;
  readonly currentVersion: string;
  readonly onClose: () => void;
}

export default function UpdateDialog({ open, update, currentVersion, onClose }: UpdateDialogProps) {
  const [installing, setInstalling] = useState(false);
  const [status, setStatus] = useState<'downloading' | 'installing'>('downloading');
  const [contentLength, setContentLength] = useState<number | undefined>(undefined);
  const [downloaded, setDownloaded] = useState(0);

  useEffect(() => {
    if (open) {
      setInstalling(false);
      setStatus('downloading');
      setContentLength(undefined);
      setDownloaded(0);
    }
  }, [open]);

  const handleInstall = async () => {
    setInstalling(true);
    try {
      await update.downloadAndInstall(async (event) => {
        switch (event.event) {
          case 'Started':
            setContentLength(event.data.contentLength);
            break;
          case 'Progress':
            setDownloaded((d) => d + event.data.chunkLength);
            break;
          case 'Finished':
            setStatus('installing');
            break;
        }
      });
      await relaunch();
    } catch (err) {
      console.error('Update failed', err);
      setInstalling(false);
      setStatus('downloading');
    }
  };

  if (!open) return null;

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const progressPct = contentLength ? Math.min((downloaded / contentLength) * 100, 99.9) : 0;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="relative z-10 w-full max-w-[380px] rounded-lg border border-border bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded p-1 text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
        >
          <X size={14} />
        </button>

        {/* Title */}
        <h3 className="mb-1 text-base font-semibold text-text-primary">Update Available</h3>
        <p className="mb-5 text-sm text-text-hint">
          v{currentVersion} → v{update.version}
        </p>

        {/* Release notes */}
        {update.body && (
          <div className="mb-5 max-h-40 overflow-y-auto rounded border border-border bg-background p-3 text-xs leading-relaxed text-text-secondary whitespace-pre-wrap">
            {update.body}
          </div>
        )}

        {/* Footer */}
        {installing ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-text-secondary">
              <span>{status === 'downloading' ? 'Downloading...' : 'Installing...'}</span>
              <span className="text-text-hint">
                {contentLength ? `${formatBytes(downloaded)} / ${formatBytes(contentLength)}` : 'Starting...'}
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded bg-background">
              <div
                className="h-full rounded bg-primary transition-all duration-200"
                style={{ width: status === 'installing' ? '100%' : `${progressPct}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleInstall}
              className="flex-1 rounded bg-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
            >
              <span className="flex items-center justify-center gap-1.5">
                <Download size={14} />
                Update Now
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-surface-elevated px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
            >
              Later
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
