import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { createContext, useCallback, useContext, useEffect, useReducer, useRef } from 'react';
import { toast } from 'sonner';
import { DEFAULT_RENDER_SETTINGS } from '../hooks/useChatRenderSettings';
import { safeLocalStorage } from '../utils/safeLocalStorage';

export type JobType = 'clip' | 'download' | 'chat-render';
export type JobStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface Job {
  id: string;
  job_type: JobType;
  name: string;
  status: JobStatus;
  progress: number;
  error: string | null;
  outputPath?: string;
  isVertical?: boolean;
}

export interface SubmitJobParams {
  type: JobType;
  m3u8Url: string;
  duration: number;
  outputPath: string;
  isFmp4: boolean;
  start?: number;
  isVertical?: boolean;
}

type JobsRecord = Record<string, Job>;

type JobAction =
  | { type: 'UPSERT'; job: Job }
  | { type: 'UPSERT_PROGRESS'; id: string; progress: number }
  | { type: 'UPSERT_STATUS'; id: string; status: JobStatus; progress?: number; error?: string | null }
  | { type: 'REMOVE'; id: string }
  | { type: 'RECONCILE'; incoming: Set<string> };

function jobsReducer(state: JobsRecord, action: JobAction): JobsRecord {
  switch (action.type) {
    case 'UPSERT': {
      const existing = state[action.job.id];
      return {
        ...state,
        [action.job.id]: {
          ...action.job,
          outputPath: action.job.outputPath ?? existing?.outputPath,
          isVertical: action.job.isVertical ?? existing?.isVertical,
        },
      };
    }
    case 'UPSERT_PROGRESS': {
      const existing = state[action.id];
      if (!existing) return state;
      return { ...state, [action.id]: { ...existing, progress: action.progress } };
    }
    case 'UPSERT_STATUS': {
      const existing = state[action.id];
      if (!existing) return state;
      return {
        ...state,
        [action.id]: {
          ...existing,
          status: action.status,
          progress: action.progress ?? existing.progress,
          error: action.error ?? existing.error,
        },
      };
    }
    case 'REMOVE': {
      const { [action.id]: _, ...rest } = state;
      return rest;
    }
    case 'RECONCILE': {
      const next: JobsRecord = {};
      for (const [id, job] of Object.entries(state)) {
        if (action.incoming.has(id)) {
          next[id] = job;
        }
      }
      return next;
    }
  }
}

interface JobQueueState {
  jobs: JobsRecord;
  submitJob: (params: SubmitJobParams) => Promise<string>;
  cancelJob: (id: string) => Promise<void>;
  removeJob: (id: string) => void;
  renderChatOverlay: (
    vodId: string,
    broadcasterId: string,
    startSec: number,
    durationSec: number,
    outputPath: string,
  ) => Promise<string>;
}

const JobQueueContext = createContext<JobQueueState | null>(null);

export function JobQueueProvider({ children }: { children: React.ReactNode }) {
  const [jobs, dispatch] = useReducer(jobsReducer, {});
  const toastedRef = useRef(new Set<string>());
  const jobsRef = useRef<JobsRecord>(jobs);

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

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
      const incoming = new Set(list.map((j) => j.id));
      dispatch({ type: 'RECONCILE', incoming });
      for (const j of list) {
        dispatch({
          type: 'UPSERT',
          job: {
            id: j.id,
            job_type: j.job_type as JobType,
            name: j.name,
            status: j.status as JobStatus,
            progress: j.progress,
            error: j.error,
          },
        });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const showToast = useCallback(
    (id: string, message: string, description: string, variant: 'success' | 'error' | 'info') => {
      if (toastedRef.current.has(id)) return;
      toastedRef.current.add(id);
      setTimeout(() => toastedRef.current.delete(id), 10000);
      toast[variant](message, { description });
    },
    [],
  );

  useEffect(() => {
    const controller = { cancelled: false };
    const unlistens: Array<() => void> = [];

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
        if (!controller.cancelled) {
          unlistens.push(unlisten);
        } else {
          unlisten();
        }
      } catch {
        // ignore
      }
    };

    const updateProgress = (job: Job) => {
      dispatch({ type: 'UPSERT_PROGRESS', id: job.id, progress: job.progress });
    };

    const markCompleted = (job: Job) => {
      dispatch({ type: 'UPSERT_STATUS', id: job.id, status: 'completed', progress: 100 });
    };

    const markFailed = (job: Job) => {
      dispatch({ type: 'UPSERT_STATUS', id: job.id, status: 'failed', progress: 100, error: job.error });
    };

    const markCancelled = (job: Job) => {
      dispatch({ type: 'UPSERT_STATUS', id: job.id, status: 'cancelled' });
    };

    const setup = async () => {
      for (const prefix of ['clip', 'download'] as const) {
        await listenFor(`${prefix}-progress`, updateProgress);
        await listenFor(`${prefix}-completed`, (job) => {
          markCompleted(job);
          showToast(job.id, `${prefix.charAt(0).toUpperCase() + prefix.slice(1)} completed`, job.name, 'success');

          const frontendJob = jobsRef.current[job.id];
          if (prefix === 'clip' && frontendJob?.isVertical && frontendJob?.outputPath) {
            window.dispatchEvent(new CustomEvent('open-vertical-editor', { detail: frontendJob.outputPath }));
          }
        });
        await listenFor(`${prefix}-failed`, (job) => {
          markFailed(job);
          showToast(
            job.id,
            `${prefix.charAt(0).toUpperCase() + prefix.slice(1)} failed`,
            job.error ?? 'Unknown error',
            'error',
          );
        });
        await listenFor(`${prefix}-cancelled`, markCancelled);
      }

      const unlistenChatProgress = await listen<{ job_id: string; progress: number }>('chat-render-progress', (e) => {
        dispatch({ type: 'UPSERT_PROGRESS', id: e.payload.job_id, progress: e.payload.progress });
      });
      if (!controller.cancelled) {
        unlistens.push(unlistenChatProgress);
      } else {
        unlistenChatProgress();
      }

      const unlistenAssetPreload = await listen<{ job_id: string; loaded: number; total: number }>(
        'asset-preload-progress',
        (e) => {
          const data = e.payload;
          dispatch({
            type: 'UPSERT_PROGRESS',
            id: data.job_id,
            progress: 5 + (data.loaded / Math.max(data.total, 1)) * 15,
          });
        },
      );
      if (!controller.cancelled) {
        unlistens.push(unlistenAssetPreload);
      } else {
        unlistenAssetPreload();
      }

      const unlistenChatComplete = await listen<{ job_id: string; output_path: string }>(
        'chat-render-complete',
        (e) => {
          dispatch({ type: 'UPSERT_STATUS', id: e.payload.job_id, status: 'completed', progress: 100 });
          const name = e.payload.output_path.split('/').pop() || 'Chat render completed';
          showToast(e.payload.job_id, 'Chat render completed', name, 'success');
        },
      );
      if (!controller.cancelled) {
        unlistens.push(unlistenChatComplete);
      } else {
        unlistenChatComplete();
      }

      const unlistenChatFailed = await listen<{ job_id: string; error: string }>('chat-render-failed', (e) => {
        dispatch({
          type: 'UPSERT_STATUS',
          id: e.payload.job_id,
          status: 'failed',
          progress: 100,
          error: e.payload.error,
        });
        showToast(e.payload.job_id, 'Chat render failed', e.payload.error ?? 'Unknown error', 'error');
      });
      if (!controller.cancelled) {
        unlistens.push(unlistenChatFailed);
      } else {
        unlistenChatFailed();
      }
    };

    setup();

    return () => {
      controller.cancelled = true;
      for (const u of unlistens) u();
    };
  }, [showToast]);

  const submitJob = useCallback(
    async ({
      type,
      m3u8Url,
      duration,
      outputPath,
      isFmp4,
      start = 0,
      isVertical = false,
    }: SubmitJobParams): Promise<string> => {
      const newJob: Job = {
        id: `pending-${Date.now()}`,
        job_type: type,
        name: outputPath.split('/').pop() || 'job.mp4',
        status: 'running',
        progress: 0,
        error: null,
        outputPath,
        isVertical,
      };

      dispatch({ type: 'UPSERT', job: newJob });

      const typeLabel = type === 'clip' ? 'Clip' : 'Download';
      showToast(newJob.id, `${typeLabel} started`, newJob.name, 'info');

      const { job_id } = await invoke<SubmitJobResponse>(
        type === 'clip' ? 'submit_clip' : 'submit_download',
        type === 'clip'
          ? {
              m3u8Url,
              start,
              duration,
              outputPath,
              isFmp4,
            }
          : {
              m3u8Url,
              duration,
              outputPath,
              isFmp4,
            },
      );

      dispatch({ type: 'REMOVE', id: newJob.id });
      dispatch({
        type: 'UPSERT',
        job: { ...newJob, id: job_id, status: 'running', progress: 0, outputPath, isVertical },
      });

      return job_id;
    },
    [showToast],
  );

  const cancelJob = useCallback(
    async (id: string) => {
      dispatch({ type: 'UPSERT_STATUS', id, status: 'cancelled' });
      const job = jobs[id];
      if (job) {
        showToast(id, 'Job cancelled', job.name, 'info');
      }
      try {
        await invoke('cancel_job', { id });
      } catch {
        // job may already be completed/failed — ignore
      }
    },
    [jobs, showToast],
  );

  const removeJob = useCallback(async (id: string) => {
    dispatch({ type: 'REMOVE', id });
    await invoke('remove_job', { id });
  }, []);

  const renderChatOverlay = useCallback(
    async (
      vodId: string,
      broadcasterId: string,
      startSec: number,
      durationSec: number,
      outputPath: string,
    ): Promise<string> => {
      const name = outputPath.split('/').pop() || 'chat-render.webm';
      showToast('chat-render', 'Chat render started', name, 'info');

      const saved = safeLocalStorage.getItem('chat-render-settings');
      const config = saved ? { ...DEFAULT_RENDER_SETTINGS, ...JSON.parse(saved) } : DEFAULT_RENDER_SETTINGS;

      const { job_id } = await invoke<SubmitJobResponse>('render_chat_video_orchestrator_cmd', {
        vodId,
        broadcasterId,
        startSec,
        durationSec,
        outputPath,
        config,
      });

      await fetchJobs();

      return job_id;
    },
    [fetchJobs, showToast],
  );

  return (
    <JobQueueContext.Provider value={{ jobs, submitJob, cancelJob, removeJob, renderChatOverlay }}>
      {children}
    </JobQueueContext.Provider>
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
