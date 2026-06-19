import ReactECharts from 'echarts-for-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ZSTDDecoder } from 'zstddec';
import { getChapters } from '../../api/twitch';
import { getToken } from '../../auth';
import { ECharts } from '../../constants/echarts';
import { DEFAULT_INTERVAL_SECONDS } from '../../constants/ui';
import { HYPE_API_BASE } from '../../constants/urls';
import { useGraphSettings } from '../../hooks/useGraphSettings';
import type { ClipDataPoint, GraphDataPoint, GraphType, TopEmote, WorkerEmoteData } from '../../types/graph';
import type { ChapterEdge } from '../../types/twitch';

const TABS: Array<{ key: GraphType; label: string }> = [
  { key: 'messages', label: 'Messages' },
  { key: 'clips', label: 'Clips' },
  { key: 'search', label: 'Search' },
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

interface VodGraphProps {
  readonly vodId: string;
  readonly playerRef: React.RefObject<{ seek: (time: number) => void; play: () => void; pause: () => void } | null>;
  readonly emoteData: React.RefObject<WorkerEmoteData | null>;
  readonly duration?: number;
  readonly isWhitelisted?: boolean | undefined;
}

function SkeletonGraph(): React.ReactNode {
  return (
    <div className="flex h-full w-full flex-col gap-2 p-4">
      <div className="h-4 w-24 rounded bg-white/5 animate-pulse" />
      <div className="flex-1 rounded bg-white/5 animate-pulse" />
    </div>
  );
}

function formatEmoteTooltip(emotes: readonly TopEmote[] | undefined): string {
  if (!emotes || emotes.length === 0) return '';
  return emotes.map((e) => `${e.name}: ${e.count}`).join('  ·  ');
}

function buildEChartsOption(
  data: GraphDataPoint[] | ClipDataPoint[],
  graphType: GraphType,
  searchTerm: string,
): Record<string, unknown> {
  const xData = data.map((d) => d.duration);
  let seriesName: string;

  if (graphType === 'clips') {
    seriesName = 'Views';
  } else if (graphType === 'search') {
    seriesName = searchTerm || 'Search';
  } else {
    seriesName = 'Messages';
  }

  const yData = data.map((d) => (graphType === 'clips' ? (d.views ?? 0) : (d as GraphDataPoint).y));

  const tooltipFormatter = (params: unknown) => {
    const p = params as Record<string, unknown>;
    if (!p.dataIndex) return '';
    const idx = typeof p.dataIndex === 'number' ? p.dataIndex : 0;
    const point = data[idx];
    if (!point) return '';

    let html = `<div style="font-weight:600;margin-bottom:4px">${point.duration}</div>`;
    html += `<div>${seriesName}: <b>${point.y}</b></div>`;

    if (graphType !== 'clips') {
      const gp = point as GraphDataPoint;
      if (gp.subs && gp.subs > 0) {
        html += `<div>Subs: <b>${gp.subs}</b></div>`;
      }
      if (gp.messages && gp.messages > 0) {
        html += `<div>Total messages: <b>${gp.messages}</b></div>`;
      }
      if (gp.emotes && gp.emotes.length > 0) {
        html += `<div style="margin-top:4px;color:#008080;font-size:12px">${formatEmoteTooltip(gp.emotes)}</div>`;
      }
    }
    if (point.game) {
      html += `<div style="margin-top:4px;color:#adadb8">Game: ${point.game}</div>`;
    }
    if (point.title && graphType !== 'clips') {
      html += `<div style="margin-top:2px;color:#adadb8">${point.title}</div>`;
    }
    if (point.slug) {
      html += `<div style="margin-top:2px;color:#adadb8">${point.slug}</div>`;
    }
    if (point.clipDuration) {
      const mins = Math.floor(point.clipDuration / 60);
      const secs = point.clipDuration % 60;
      html += `<div style="margin-top:2px;color:#adadb8">${mins}:${secs.toString().padStart(2, '0')}</div>`;
    }

    return html;
  };

  return {
    backgroundColor: 'transparent',
    grid: ECharts.GRID_PADDING,
    xAxis: {
      type: 'category',
      data: xData,
      boundaryGap: false,
      axisLine: { lineStyle: { color: ECharts.AXIS_COLOR } },
      axisLabel: { color: ECharts.LABEL_COLOR, fontSize: 11, interval: 'auto' },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: ECharts.AXIS_COLOR } },
      axisLabel: { color: ECharts.LABEL_COLOR, fontSize: 11 },
      splitLine: { lineStyle: { color: ECharts.SPLIT_COLOR } },
    },
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: ECharts.TOOLTIP_BG,
      borderColor: ECharts.BORDER_COLOR,
      borderWidth: 1,
      textStyle: { color: ECharts.TEXT_COLOR, fontSize: 12 },
      extraCssText: ECharts.TOOLTIP_CSS,
      formatter: tooltipFormatter,
    },
    series: [
      {
        name: seriesName,
        type: 'line' as const,
        data: yData,
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: ECharts.SERIES_COLOR },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: ECharts.AREA_TOP },
              { offset: 1, color: ECharts.AREA_BOTTOM },
            ],
          },
        },
      },
    ],
    dataZoom: [
      {
        type: 'inside' as const,
        xAxisIndex: 0,
        filterMode: 'none' as const,
      },
    ],
  };
}

const VodGraph = memo(function VodGraph({
  vodId,
  playerRef,
  emoteData,
  duration: propDuration,
  isWhitelisted,
}: VodGraphProps) {
  const {
    interval,
    setInterval,
    messageThreshold: userMessageThreshold,
    setMessageThreshold,
    searchThreshold: userSearchThreshold,
    setSearchThreshold,
    resetInterval,
    resetMessageThreshold,
    resetSearchThreshold,
    resetAll,
  } = useGraphSettings();

  const [activeTab, setActiveTab] = useState<GraphType>('messages');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [graphData, setGraphData] = useState<GraphDataPoint[] | ClipDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [effectiveThreshold, setEffectiveThreshold] = useState<number | null>(null);
  const [totalViews, setTotalViews] = useState<number>(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const clipsRef = useRef<Array<{
    vod_offset: number;
    title: string;
    views: number;
    slug: string;
    duration: number;
  }> | null>(null);
  const chaptersRef = useRef<readonly ChapterEdge[] | null>(null);
  const durationRef = useRef<number>(0);
  const fetchedRef = useRef(false);
  const intervalRef = useRef(interval);
  const userMessageThresholdRef = useRef(userMessageThreshold);
  const userSearchThresholdRef = useRef(userSearchThreshold);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    intervalRef.current = interval;
    userMessageThresholdRef.current = userMessageThreshold;
    userSearchThresholdRef.current = userSearchThreshold;
  }, [interval, userMessageThreshold, userSearchThreshold]);

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL('../../workers/graphWorker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;

      worker.onmessage = (e: MessageEvent) => {
        if (e.data.type === 'aggregateResult') {
          setGraphData(e.data.payload.data);
          setEffectiveThreshold(e.data.payload.computedThreshold);
          setIsLoading(false);
        }
        if (e.data.type === 'aggregateClipsResult') {
          setGraphData(e.data.payload.data);
          setEffectiveThreshold(null);
          setTotalViews(e.data.payload.totalViews);
          setIsLoading(false);
        }
      };

      worker.onerror = (err) => {
        console.error('Graph worker error:', err);
        setError('Worker failed to initialize');
        setIsLoading(false);
      };
    } catch {
      setError('Failed to load graph worker');
    }

    return () => {
      if (worker) worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;
    worker.postMessage({ type: 'setEmotes', payload: { emotes: emoteData } });
  }, [emoteData]);

  const fetchClips = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${HYPE_API_BASE}/vods/${id}/clips`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data && Array.isArray(data)) {
        clipsRef.current = data;
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchChapters = useCallback(async (id: string) => {
    try {
      const edges = await getChapters(id);
      if (edges) {
        chaptersRef.current = edges;
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchZstdLogs = useCallback(async (id: string): Promise<string[] | null> => {
    try {
      const res = await fetch(`${HYPE_API_BASE}/vods/${id}/logs`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) return null;
      const buffer = await res.arrayBuffer();
      const decoder = new ZSTDDecoder();
      await decoder.init();
      const decompressed = await decoder.decode(new Uint8Array(buffer));
      const text = new TextDecoder('utf-8').decode(decompressed);
      return text.split('\n').filter((l) => l.length > 0);
    } catch {
      return null;
    }
  }, []);

  const runAggregate = useCallback(
    async (
      id: string,
      type: GraphType,
      dur: number,
      msgThresh: number | null,
      searchThresh: number | null,
      intv: number,
    ) => {
      const worker = workerRef.current;
      if (!worker) return;

      setIsLoading(true);
      setError(null);
      setGraphData([]);
      setEffectiveThreshold(null);

      if (type === 'clips') {
        if (!clipsRef.current || clipsRef.current.length === 0) {
          setError('No clips available');
          setIsLoading(false);
          fetchedRef.current = true;
          return;
        }

        worker.postMessage({
          type: 'aggregateClips',
          payload: {
            clips: clipsRef.current,
            chapters: chaptersRef.current ?? [],
          },
        });
        fetchedRef.current = true;
        return;
      }

      const logs = await fetchZstdLogs(id);
      if (!logs || logs.length === 0) {
        if (type === 'messages') {
          setError('No log data available');
          setIsLoading(false);
        }
        fetchedRef.current = true;
        return;
      }

      durationRef.current =
        dur ||
        Math.max(
          ...logs.map((line) => {
            const bracketOpen = line.indexOf('[');
            const bracketClose = line.indexOf(']');
            if (bracketOpen === -1 || bracketClose === -1) return 0;
            const timeStr = line.substring(bracketOpen + 1, bracketClose);
            const parts = timeStr.split(':').map(Number);
            if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
            if (parts.length === 2) return parts[0] * 60 + parts[1];
            return parts[0] ?? 0;
          }),
          dur,
        );

      const threshold = type === 'search' ? (searchThresh ?? 0) : (msgThresh ?? 0);

      worker.postMessage({
        type: 'aggregate',
        payload: {
          logs,
          duration: durationRef.current,
          interval: intv,
          emotes: emoteData.current,
          threshold,
          searchType: type,
          searchTerm: type === 'search' ? searchTerm : undefined,
        },
      });

      fetchedRef.current = true;
    },
    [fetchZstdLogs, emoteData, searchTerm],
  );

  useEffect(() => {
    fetchClips(vodId);
    fetchChapters(vodId);
  }, [vodId, fetchClips, fetchChapters]);

  useEffect(() => {
    if (!vodId || fetchedRef.current) return;
    runAggregate(vodId, activeTab, propDuration || 0, userMessageThreshold, userSearchThreshold, interval);
  }, [vodId, activeTab, runAggregate, propDuration, userMessageThreshold, userSearchThreshold, interval]);

  useEffect(() => {
    if (!vodId) return;
    runAggregate(vodId, activeTab, propDuration || 0, userMessageThreshold, userSearchThreshold, interval);
  }, [vodId, activeTab, runAggregate, propDuration, userMessageThreshold, userSearchThreshold, interval]);

  const handleChartClick = useCallback(
    (params: Record<string, unknown>) => {
      if (!params.dataIndex || !playerRef.current) return;
      const idx = typeof params.dataIndex === 'number' ? params.dataIndex : 0;
      const point = graphData[idx];
      if (!point) return;

      let seekTime: number;
      if (activeTab === 'clips') {
        seekTime = point.x - 5;
      } else {
        seekTime = point.x - intervalRef.current;
      }

      if (seekTime < 0) seekTime = 0;
      playerRef.current.seek(seekTime);
    },
    [graphData, playerRef, activeTab],
  );

  const option = useMemo(
    () => buildEChartsOption(graphData, activeTab, searchTerm),
    [graphData, activeTab, searchTerm],
  );

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearchTerm(value);
    }, 300);
  }, []);

  return (
    <div className="flex w-full flex-1 flex-col min-h-0 rounded-lg border border-border bg-surface p-3">
      {/* Tab bar */}
      <div className="relative mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1 overflow-x-auto">
          {isWhitelisted === false && (
            <div className="flex items-center gap-1.5 rounded-md border border-yellow-900/40 bg-yellow-950/30 px-3 py-1.5">
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
                className="text-yellow-500"
              >
                <title>Warning</title>
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span className="text-xs text-yellow-400">This streamer is not whitelisted</span>
            </div>
          )}
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-white/10 text-text-primary'
                  : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
          {activeTab === 'search' && (
            <input
              type="text"
              value={searchInput}
              onChange={handleSearchChange}
              placeholder="Search..."
              className="w-32 rounded border border-border bg-background px-2 py-1 text-xs text-text-primary placeholder-text-secondary outline-none transition-colors focus:border-border/60"
            />
          )}
        </div>
        <span className="absolute left-1/2 -translate-x-1/2 text-xs tabular-nums text-text-secondary">
          {activeTab === 'clips' && graphData.length > 0
            ? `${totalViews} views / ${interval}s`
            : effectiveThreshold != null && effectiveThreshold > 0
              ? `${effectiveThreshold} msgs / ${interval}s`
              : ''}
        </span>
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="text-text-secondary transition-colors hover:text-text-primary"
          title="Graph settings"
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
            <title>Settings</title>
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>

      {/* Chart area */}
      <div className="relative flex min-h-[200px] w-full flex-1 flex-col">
        {isLoading && !error ? (
          <SkeletonGraph />
        ) : error ? (
          <div className="flex h-full w-full flex-col items-center justify-center">
            <p className="text-sm text-text-muted">{error}</p>
          </div>
        ) : graphData.length === 0 ? (
          <div className="flex h-full w-full flex-col items-center justify-center">
            <p className="text-sm text-text-muted">No data to display</p>
          </div>
        ) : (
          <ReactECharts
            option={option}
            style={{ height: '100%', width: '100%' }}
            opts={{ renderer: 'canvas' }}
            onEvents={{ click: handleChartClick }}
            notMerge={true}
            lazyUpdate={true}
          />
        )}
      </div>

      {/* Settings modal */}
      {showSettings && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="w-80 max-h-[85vh] rounded-lg border border-border bg-surface text-text-primary"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  resetAll();
                  setShowResetConfirm(true);
                }}
                className="text-text-secondary transition-colors hover:text-text-primary"
                title="Reset all settings to defaults"
              >
                <RotateCcwIcon />
              </button>

              <h3 className="text-sm font-medium">Graph Settings</h3>

              <button
                type="button"
                onClick={() => setShowSettings(false)}
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
                  <div className="mb-2 text-xs font-medium text-text-secondary">Interval</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={5}
                      max={60}
                      step={5}
                      value={interval}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setInterval(v);
                      }}
                      className="min-w-0 flex-1 accent-primary"
                    />
                    <span className="shrink-0 text-sm text-text-secondary">{interval}s</span>
                    <button
                      type="button"
                      onClick={resetInterval}
                      disabled={interval === DEFAULT_INTERVAL_SECONDS}
                      className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors ${
                        interval === DEFAULT_INTERVAL_SECONDS
                          ? 'cursor-not-allowed opacity-40'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                      title="Reset interval"
                    >
                      <RotateCcwIcon />
                    </button>
                  </div>
                </div>

                <div className="rounded border border-border px-3 py-2">
                  <div className="mb-2 text-xs font-medium text-text-secondary">Message Threshold</div>
                  <div className="flex items-center gap-1">
                    <span className="shrink-0 text-xs text-text-secondary">every</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={userMessageThreshold ?? effectiveThreshold ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '') {
                          setMessageThreshold(null);
                          return;
                        }
                        const num = Number(v);
                        if (!Number.isFinite(num) || num <= 0) return;
                        setMessageThreshold(num);
                      }}
                      className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm text-text-primary"
                    />
                    <span className="shrink-0 text-xs text-text-secondary">msgs</span>
                    <button
                      type="button"
                      onClick={resetMessageThreshold}
                      disabled={userMessageThreshold == null}
                      className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors ${
                        userMessageThreshold == null
                          ? 'cursor-not-allowed opacity-40'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                      title="Reset to auto"
                    >
                      <RotateCcwIcon />
                    </button>
                  </div>
                </div>

                <div className="rounded border border-border px-3 py-2">
                  <div className="mb-2 text-xs font-medium text-text-secondary">Search Threshold</div>
                  <div className="flex items-center gap-1">
                    <span className="shrink-0 text-xs text-text-secondary">every</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={userSearchThreshold ?? 1}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '') {
                          setSearchThreshold(null);
                          return;
                        }
                        const num = Number(v);
                        if (!Number.isFinite(num) || num <= 0) return;
                        setSearchThreshold(num);
                      }}
                      className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm text-text-primary"
                    />
                    <span className="shrink-0 text-xs text-text-secondary">msgs</span>
                    <button
                      type="button"
                      onClick={resetSearchThreshold}
                      disabled={userSearchThreshold == null}
                      className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-border transition-colors ${
                        userSearchThreshold == null
                          ? 'cursor-not-allowed opacity-40'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                      title="Reset to auto"
                    >
                      <RotateCcwIcon />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset confirmation dialog */}
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
              This will reset your graph settings back to their default values.
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
                onClick={() => {
                  resetAll();
                  setShowResetConfirm(false);
                  setShowSettings(false);
                }}
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
});

export default VodGraph;
