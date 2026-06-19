import { Bell, CheckCircle2, ChevronDown, ChevronUp, Clock, Loader2, XCircle } from 'lucide-react';
import { useRef, useState } from 'react';
import { type Job, useJobQueue } from '../../contexts/JobQueueContext';

export default function JobQueueDropdown() {
  const { jobs, cancelJob, removeJob } = useJobQueue();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activeJobs = Array.from(jobs.values()).filter((j) => j.status === 'running');
  const completedJobs = Array.from(jobs.values()).filter((j) => j.status === 'completed');
  const failedJobs = Array.from(jobs.values()).filter((j) => j.status === 'failed');
  const cancelledJobs = Array.from(jobs.values()).filter((j) => j.status === 'cancelled');

  const activeCount = activeJobs.length + failedJobs.length;

  const handleClose = () => {
    setOpen(false);
    setExpanded(false);
  };

  const handleToggle = () => {
    setOpen((prev) => !prev);
  };

  const handleOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      handleClose();
    }
  };

  const handleCancel = async (id: string) => {
    await cancelJob(id);
  };

  const handleRemove = (id: string) => {
    removeJob(id);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className={`relative flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/10 hover:text-text-primary ${
          activeCount > 0 ? 'text-text-primary' : 'text-text-secondary'
        }`}
      >
        <Bell className="h-5 w-5" />
        {activeCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-lg border border-border bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-medium text-text-primary">Job Queue</span>
            <button
              type="button"
              onClick={handleClose}
              className="text-text-hint transition-colors hover:text-text-primary"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {activeJobs.length === 0 &&
              failedJobs.length === 0 &&
              completedJobs.length === 0 &&
              cancelledJobs.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-8">
                  <Clock className="h-8 w-8 text-text-hint" />
                  <span className="text-xs text-text-hint">No active jobs</span>
                </div>
              )}

            {activeJobs.length > 0 && (
              <div className="border-b border-border">
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-xs font-medium text-text-secondary">
                    {activeJobs.length} {activeJobs.length === 1 ? 'job' : 'jobs'} in progress
                  </span>
                </div>
                {activeJobs.map((job) => (
                  <JobItem key={job.id} job={job} onCancel={() => handleCancel(job.id)} />
                ))}
              </div>
            )}

            {failedJobs.length > 0 && (
              <div className="border-b border-border">
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => !prev)}
                  className="flex w-full items-center justify-between px-4 py-2 transition-colors hover:bg-white/5"
                >
                  <span className="text-xs font-medium text-red-400">
                    {failedJobs.length} {failedJobs.length === 1 ? 'failed' : 'failed'}
                  </span>
                  {expanded ? (
                    <ChevronUp className="h-3 w-3 text-text-hint" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-text-hint" />
                  )}
                </button>
                {expanded &&
                  failedJobs.map((job) => (
                    <JobItem key={job.id} job={job} onCancel={() => handleRemove(job.id)} showRemove />
                  ))}
              </div>
            )}

            {completedJobs.length > 0 && (
              <div className="border-b border-border">
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => !prev)}
                  className="flex w-full items-center justify-between px-4 py-2 transition-colors hover:bg-white/5"
                >
                  <span className="text-xs font-medium text-green-400">
                    {completedJobs.length} {completedJobs.length === 1 ? 'completed' : 'completed'}
                  </span>
                  {expanded ? (
                    <ChevronUp className="h-3 w-3 text-text-hint" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-text-hint" />
                  )}
                </button>
                {expanded &&
                  completedJobs.map((job) => (
                    <JobItem key={job.id} job={job} onCancel={() => handleRemove(job.id)} showRemove />
                  ))}
              </div>
            )}

            {cancelledJobs.length > 0 && (
              <div className="border-b border-border">
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => !prev)}
                  className="flex w-full items-center justify-between px-4 py-2 transition-colors hover:bg-white/5"
                >
                  <span className="text-xs font-medium text-text-hint">
                    {cancelledJobs.length} {cancelledJobs.length === 1 ? 'cancelled' : 'cancelled'}
                  </span>
                  {expanded ? (
                    <ChevronUp className="h-3 w-3 text-text-hint" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-text-hint" />
                  )}
                </button>
                {expanded &&
                  cancelledJobs.map((job) => (
                    <JobItem key={job.id} job={job} onCancel={() => handleRemove(job.id)} showRemove />
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {open && <div className="fixed inset-0 z-40" onClick={handleOutsideClick} />}
    </div>
  );
}

function JobItem({ job, onCancel, showRemove = false }: { job: Job; onCancel: () => void; showRemove?: boolean }) {
  const typeLabel = job.job_type === 'clip' ? 'Clip' : 'Download';
  const typeColor = job.job_type === 'clip' ? 'text-primary' : 'text-text-secondary';

  const name = job.name.length > 30 ? `${job.name.slice(0, 27)}...` : job.name;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 last:border-b-0">
      {job.status === 'running' ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
      ) : job.status === 'failed' ? (
        <XCircle className="h-4 w-4 shrink-0 text-red-400" />
      ) : job.status === 'completed' ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0 text-text-hint" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-medium uppercase tracking-wider ${typeColor}`}>{typeLabel}</span>
          <span className="truncate text-xs text-text-primary">{name}</span>
        </div>
        {job.status === 'running' && (
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${Math.min(job.progress, 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-text-hint">{Math.round(job.progress)}%</span>
          </div>
        )}
        {job.status === 'failed' && job.error && (
          <p className="mt-0.5 truncate text-[10px] text-red-400" title={job.error}>
            {job.error}
          </p>
        )}
      </div>

      {job.status === 'running' ? (
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 rounded-md bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-500/20"
        >
          Cancel
        </button>
      ) : showRemove ? (
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-medium text-text-hint transition-colors hover:bg-white/10 hover:text-text-primary"
        >
          Remove
        </button>
      ) : null}
    </div>
  );
}
