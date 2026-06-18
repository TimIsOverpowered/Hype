import ReactECharts from 'echarts-for-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ZSTDDecoder } from 'zstddec';
import { getChapters } from '../../api/twitch';
import { ECharts } from '../../constants/echarts';
import { getToken } from '../../auth';
import {
  DEFAULT_INTERVAL_SECONDS,
  DEFAULT_MESSAGE_THRESHOLD,
  DEFAULT_SEARCH_TERM,
  DEFAULT_SEARCH_THRESHOLD,
} from '../../constants/ui';
import { HYPE_API_BASE } from '../../constants/urls';
import type { GraphDataPoint, GraphType, TopEmote, WorkerEmoteData } from '../../types/graph';
import type { ChapterEdge } from '../../types/twitch';

const TABS: Array<{ key: GraphType; label: string }> = [
  { key: 'messages', label: 'Messages' },
  { key: 'clips', label: 'Clips' },
  { key: 'search', label: 'Search' },
];

interface VodGraphProps {
  readonly vodId: string;
  readonly playerRef: React.RefObject<{ seek: (time: number) => void; play: () => void; pause: () => void } | null>;
  readonly emoteData: React.RefObject<WorkerEmoteData | null>;
  readonly interval?: number;
  readonly messageThreshold?: number;
  readonly searchThreshold?: number;
  readonly volumeThreshold?: number;
  readonly searchTerm?: string;
  readonly duration?: number;
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
  data: GraphDataPoint[],
  graphType: GraphType,
  searchTerm: string | undefined,
): Record<string, unknown> {
  const xData = data.map((d) => d.duration);
  let seriesName: string;

  if (graphType === 'clips') {
    seriesName = 'Views';
  } else if (graphType === 'search') {
    seriesName = searchTerm ?? 'Search';
  } else {
    seriesName = 'Messages';
  }

  const yData = data.map((d) => (graphType === 'clips' ? (d.views ?? 0) : d.y));

  const tooltipFormatter = (params: unknown) => {
    const p = params as Record<string, unknown>;
    if (!p.dataIndex) return '';
    const idx = typeof p.dataIndex === 'number' ? p.dataIndex : 0;
    const point = data[idx];
    if (!point) return '';

    let html = `<div style="font-weight:600;margin-bottom:4px">${point.duration}</div>`;
    html += `<div>${seriesName}: <b>${point.y}</b></div>`;

    if (point.subs && point.subs > 0) {
      html += `<div>Subs: <b>${point.subs}</b></div>`;
    }
    if (point.messages && point.messages > 0) {
      html += `<div>Total messages: <b>${point.messages}</b></div>`;
    }
    if (point.game) {
      html += `<div style="margin-top:4px;color:#adadb8">Game: ${point.game}</div>`;
    }
    if (point.title) {
      html += `<div style="margin-top:2px;color:#adadb8">${point.title}</div>`;
    }
    if (point.emotes && point.emotes.length > 0) {
      html += `<div style="margin-top:4px;color:#008080;font-size:12px">${formatEmoteTooltip(point.emotes)}</div>`;
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
      axisLabel: { color: ECharts.LABEL_COLOR, fontSize: 11, interval: 'auto', rotate: 0 },
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
      {
        type: 'slider' as const,
        bottom: 8,
        height: 18,
        borderColor: 'transparent',
        backgroundColor: ECharts.TOOLTIP_BG,
        fillerColor: ECharts.SLIDER_FILL,
        handleStyle: { color: ECharts.SERIES_COLOR },
        textStyle: { color: '#adadb8', fontSize: 10 },
        dataBackground: {
          lineStyle: { color: ECharts.AXIS_COLOR },
          areaStyle: { color: ECharts.SPLIT_COLOR },
        },
      },
    ],
  };
}

const VodGraph = memo(function VodGraph({
  vodId,
  playerRef,
  emoteData,
  interval = DEFAULT_INTERVAL_SECONDS,
  messageThreshold = DEFAULT_MESSAGE_THRESHOLD,
  searchThreshold = DEFAULT_SEARCH_THRESHOLD,
  searchTerm = DEFAULT_SEARCH_TERM,
  duration: propDuration,
}: VodGraphProps) {
  const [activeTab, setActiveTab] = useState<GraphType>('messages');
  const [graphData, setGraphData] = useState<GraphDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL('../../workers/graphWorker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;

      worker.onmessage = (e: MessageEvent) => {
        if (e.data.type === 'aggregateResult') {
          setGraphData(e.data.payload.data);
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
    async (id: string, type: GraphType, dur: number) => {
      const worker = workerRef.current;
      if (!worker) return;

      setIsLoading(true);
      setError(null);
      setGraphData([]);

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

      worker.postMessage({
        type: 'aggregate',
        payload: {
          logs,
          duration: durationRef.current,
          interval,
          emotes: emoteData.current,
          threshold: type === 'search' ? searchThreshold : messageThreshold,
          searchType: type,
          searchTerm: type === 'search' ? searchTerm : undefined,
        },
      });

      fetchedRef.current = true;
    },
    [fetchZstdLogs, emoteData, interval, messageThreshold, searchThreshold, searchTerm],
  );

  useEffect(() => {
    fetchClips(vodId);
    fetchChapters(vodId);
  }, [vodId, fetchClips, fetchChapters]);

  useEffect(() => {
    if (!vodId || fetchedRef.current) return;
    runAggregate(vodId, activeTab, propDuration || 0);
  }, [vodId, activeTab, runAggregate, propDuration]);

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
        seekTime = point.x - interval;
      }

      if (seekTime < 0) seekTime = 0;
      playerRef.current.seek(seekTime);
    },
    [graphData, playerRef, activeTab, interval],
  );

  const option = useMemo(
    () => buildEChartsOption(graphData, activeTab, searchTerm),
    [graphData, activeTab, searchTerm],
  );

  return (
    <div className="flex w-full flex-1 flex-col min-h-0 rounded-lg border border-border bg-surface p-3">
      {/* Tab bar */}
      <div className="flex items-center gap-1 overflow-x-auto">
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
    </div>
  );
});

export default VodGraph;
