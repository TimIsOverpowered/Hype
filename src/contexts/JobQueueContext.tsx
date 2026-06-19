import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export type JobType = 'clip' | 'download';
export type JobStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface Job {
  id: string;
  job_type: JobType;
  name: string;
  status: JobStatus;
  progress: number;
  error: string | null;
}

interface JobQueueState {
  jobs: Map<string, Job>;
  submitJob: (
    type: JobType,
    m3u8Url: string,
    duration: number,
    outputPath: string,
    isFmp4: boolean,
    start?: number,
  ) => Promise<string>;
  cancelJob: (id: string) => Promise<void>;
  removeJob: (id: string) => void;
}

const JobQueueContext = createContext<JobQueueState | null>(null);

export function JobQueueProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<Map<string, Job>>(new Map());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unlistenRef = useRef<(() => void)[] | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const list =
        await invoke<
          Array<{
            id: string;
            job_type: string;
            name: string;
            status: string;
            progress: number;
            error: string | null;
          }>
        >('list_jobs');
      const map = new Map<string, Job>();
      for (const j of list) {
        map.set(j.id, {
          id: j.id,
          job_type: j.job_type as JobType,
          name: j.name,
          status: j.status as JobStatus,
          progress: j.progress,
          error: j.error,
        });
      }
      setJobs(map);
    } catch {
      // ignore
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchJobs uses only stable references
  useEffect(() => {
    fetchJobs();
    pollRef.current = setInterval(fetchJobs, 1000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (unlistenRef.current) {
        for (const unlisten of unlistenRef.current) {
          unlisten();
        }
        unlistenRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const setupListeners = async () => {
      const unlistens: (() => void)[] = [];

      const listenFor = async (event: string, handler: (job: Job) => void) => {
        try {
          const unlisten = await listen<{
            id: string;
            job_type: string;
            name: string;
            status: string;
            progress: number;
            error: string | null;
          }>(event, (e) => {
            handler({
              id: e.payload.id,
              job_type: e.payload.job_type as JobType,
              name: e.payload.name,
              status: e.payload.status as JobStatus,
              progress: e.payload.progress,
              error: e.payload.error,
            });
          });
          unlistens.push(unlisten);
        } catch {
          // ignore
        }
      };

      await listenFor('clip-progress', (job) => {
        setJobs((prev) => {
          const next = new Map(prev);
          const existing = next.get(job.id);
          if (existing) {
            next.set(job.id, { ...existing, progress: job.progress });
          }
          return next;
        });
      });

      await listenFor('clip-completed', (job) => {
        setJobs((prev) => {
          const next = new Map(prev);
          const existing = next.get(job.id);
          if (existing) {
            next.set(job.id, { ...existing, status: job.status, progress: 100 });
          }
          return next;
        });
      });

      await listenFor('clip-failed', (job) => {
        setJobs((prev) => {
          const next = new Map(prev);
          const existing = next.get(job.id);
          if (existing) {
            next.set(job.id, { ...existing, status: 'failed', progress: 100, error: job.error });
          }
          return next;
        });
      });

      await listenFor('download-progress', (job) => {
        setJobs((prev) => {
          const next = new Map(prev);
          const existing = next.get(job.id);
          if (existing) {
            next.set(job.id, { ...existing, progress: job.progress });
          }
          return next;
        });
      });

      await listenFor('download-completed', (job) => {
        setJobs((prev) => {
          const next = new Map(prev);
          const existing = next.get(job.id);
          if (existing) {
            next.set(job.id, { ...existing, status: job.status, progress: 100 });
          }
          return next;
        });
      });

      await listenFor('download-failed', (job) => {
        setJobs((prev) => {
          const next = new Map(prev);
          const existing = next.get(job.id);
          if (existing) {
            next.set(job.id, { ...existing, status: 'failed', progress: 100, error: job.error });
          }
          return next;
        });
      });

      unlistenRef.current = unlistens;
    };

    setupListeners();
  }, []);

  const submitJob = async (
    type: JobType,
    m3u8Url: string,
    duration: number,
    outputPath: string,
    isFmp4: boolean,
    start?: number,
  ): Promise<string> => {
    const newJob: Job = {
      id: `pending-${Date.now()}`,
      job_type: type,
      name: outputPath.split('/').pop() || 'job.mp4',
      status: 'running',
      progress: 0,
      error: null,
    };

    setJobs((prev) => {
      const next = new Map(prev);
      next.set(newJob.id, newJob);
      return next;
    });

    const { job_id } = await invoke<SubmitJobResponse>(
      type === 'clip' ? 'submit_clip' : 'submit_download',
      type === 'clip'
        ? {
            m3u8_url: m3u8Url,
            start: start ?? 0,
            duration,
            output_path: outputPath,
            is_fmp4: isFmp4,
          }
        : {
            m3u8_url: m3u8Url,
            duration,
            output_path: outputPath,
            is_fmp4: isFmp4,
          },
    );

    setJobs((prev) => {
      const next = new Map(prev);
      const job = next.get(newJob.id);
      if (job) {
        next.delete(newJob.id);
        next.set(job_id, { ...newJob, id: job_id, status: 'running', progress: 0 });
      }
      return next;
    });

    return job_id;
  };

  const cancelJob = async (id: string) => {
    await invoke('cancel_job', { id });
  };

  const removeJob = (id: string) => {
    setJobs((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  return (
    <JobQueueContext.Provider value={{ jobs, submitJob, cancelJob, removeJob }}>{children}</JobQueueContext.Provider>
  );
}

export function useJobQueue(): JobQueueState {
  const ctx = useContext(JobQueueContext);
  if (!ctx) throw new Error('useJobQueue must be used within JobQueueProvider');
  return ctx;
}

interface SubmitJobResponse {
  job_id: string;
}
