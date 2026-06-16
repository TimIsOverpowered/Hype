import { toHHMMSS } from '../../utils/time';

interface JobProgressProps {
  readonly progress: number;
  readonly isRunning: boolean;
  readonly error: string | null;
  readonly elapsed: number;
  readonly onCancel: () => void;
  readonly onRetry?: () => void;
  readonly jobType: JobType;
}

type JobType = 'clip' | 'download';

export default function JobProgress({
  progress,
  isRunning,
  error,
  elapsed,
  onCancel,
  onRetry,
  jobType,
}: JobProgressProps) {
  if (!isRunning && !error) return null;

  const remaining = isRunning
    ? Math.max(0, Math.round((elapsed / Math.max(progress, 1)) * (100 - progress) - elapsed))
    : 0;
  const etaStr = isRunning ? toHHMMSS(remaining) : '';

  const title = isRunning
    ? jobType === 'clip'
      ? 'Clipping VOD...'
      : 'Downloading VOD...'
    : error
      ? 'Job Failed'
      : 'Complete!';

  const subtitle = error ? error : !isRunning && !error ? 'Done!' : `Elapsed ${toHHMMSS(elapsed)} · ETA ${etaStr}`;

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border p-3 ${
        error
          ? 'border-red-500/50 bg-red-950/20'
          : !isRunning && !error
            ? 'border-green-500/50 bg-green-950/20'
            : 'border-border bg-surface'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isRunning ? (
            <svg
              className="h-4 w-4 animate-spin text-primary"
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <title>Loading</title>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : error ? (
            <svg
              className="h-4 w-4 text-red-400"
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <title>Error</title>
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          ) : (
            <svg
              className="h-4 w-4 text-green-400"
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <title>Done</title>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          )}
          <span className="text-sm font-medium text-text-primary">{title}</span>
        </div>

        <div className="flex items-center gap-2">
          {isRunning && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20"
            >
              Cancel
            </button>
          )}
          {error && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md bg-surface-elevated px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
            >
              Retry
            </button>
          )}
        </div>
      </div>

      {isRunning && (
        <div className="flex items-center gap-3">
          <div className="flex-1 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-2 rounded-full bg-primary transition-all duration-300"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-medium text-text-secondary">{Math.round(progress)}%</span>
        </div>
      )}

      <span className="text-xs text-text-hint">{subtitle}</span>
    </div>
  );
}
