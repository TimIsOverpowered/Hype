import { invoke } from '@tauri-apps/api/core';
import ReactECharts from 'echarts-for-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getToken } from '../../auth';
import { ECharts } from '../../constants/echarts';
import { TIME_UPDATE_THROTTLE_MS } from '../../constants/ui';
import { HYPE_API_BASE } from '../../constants/urls';
import { useGraphSettings } from '../../hooks/useGraphSettings';
import type {
  ClipDataPoint,
  ClipsResult,
  GraphDataPoint,
  GraphResult,
  GraphType,
  SerializedEmoteSet,
  TopEmote,
  TopSpike,
} from '../../types/graph';
import type { ChapterEdge } from '../../types/twitch';

interface GameChapter {
  readonly positionMilliseconds: number;
  readonly durationMilliseconds: number;
  readonly game?: string;
  readonly boxArtURL?: string;
}

import { toHHMMSS } from '../../utils/time';

const TABS: Array<{ key: GraphType; label: string }> = [
  { key: 'messages', label: 'Messages' },
  { key: 'clips', label: 'Clips' },
  { key: 'search', label: 'Search' },
];

const GAME_COLORS = [
  'rgba(239, 68, 68, 0.15)',
  'rgba(59, 130, 246, 0.15)',
  'rgba(16, 185, 129, 0.15)',
  'rgba(245, 158, 11, 0.15)',
  'rgba(139, 92, 246, 0.15)',
  'rgba(236, 72, 153, 0.15)',
  'rgba(14, 165, 233, 0.15)',
  'rgba(249, 115, 22, 0.15)',
  'rgba(168, 85, 247, 0.15)',
  'rgba(20, 184, 166, 0.15)',
];

function findNearestIndex(targetSec: number, xDataSeconds: number[]): number {
  if (xDataSeconds.length === 0) return 0;
  let lo = 0,
    hi = xDataSeconds.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (xDataSeconds[mid] < targetSec) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(xDataSeconds[lo - 1] - targetSec) < Math.abs(xDataSeconds[lo] - targetSec)) {
    return lo - 1;
  }
  return lo;
}

interface VodGraphProps {
  readonly vodId: string;
  readonly playerRef: React.RefObject<{ seek: (time: number) => void; play: () => void; pause: () => void } | null>;
  readonly emoteData: React.RefObject<SerializedEmoteSet>;
  readonly emotesLoaded?: boolean;
  readonly duration?: number;
  readonly currentTime?: number;
  readonly isWhitelisted?: boolean | undefined;
  readonly isHighlight?: boolean;
  readonly onClipStart?: (hms: string) => void;
  readonly onClipEnd?: (hms: string) => void;
  readonly chapters?: readonly ChapterEdge[];
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
  return emotes
    .map((e) => `<div style="overflow-wrap:break-word;word-break:break-all">${e.name}: ${e.count}</div>`)
    .join('');
}

function getEmoteUrl(name: string, emoteData: SerializedEmoteSet | null): string | null {
  if (!emoteData) return null;
  const stv = emoteData.seventv.find((e) => e.name === name || e.code === name);
  if (stv) return `https://cdn.7tv.app/emote/${stv.id}/1x.webp`;
  const bttv = emoteData.bttv.find((e) => e.code === name);
  if (bttv) return `https://cdn.betterttv.net/emote/${bttv.id}/1x`;
  const ffz = emoteData.ffz.find((e) => e.code === name || e.name === name);
  if (ffz) return `https://cdn.frankerfacez.com/emote/${ffz.id}/1`;
  return null;
}

function buildEChartsOption(
  data: GraphDataPoint[] | ClipDataPoint[],
  graphType: GraphType,
  searchTerm: string,
  gameChapters: readonly GameChapter[] | null,
): Record<string, unknown> {
  const xData = data.map((d) => d.duration);
  const xDataSeconds = data.map((d) => (d as GraphDataPoint | ClipDataPoint).x);
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
    const arr = params as Array<Record<string, unknown>>;
    if (arr[0]?.dataIndex == null) return '';
    const idx = typeof arr[0].dataIndex === 'number' ? arr[0].dataIndex : 0;
    const point = data[idx];
    if (!point) return '';

    const sep = '<span style="color:#adadb8"> : </span>';
    const bold = (v: number | string) => `<b>${v}</b>`;
    let html = `<div style="font-weight:600;margin-bottom:4px">${point.duration}</div>`;
    if (point.game) {
      html += `<div style="color:#adadb8">Game${sep}${point.game}</div>`;
    }
    html += `<div>${seriesName}${sep}${bold(point.y)}</div>`;

    if (graphType === 'clips') {
      const cp = point as ClipDataPoint;
      if (cp.title) {
        html += `<div style="margin-top:4px;color:#adadb8">Title${sep}${cp.title}</div>`;
      }
      if (cp.slug) {
        html += `<div style="color:#adadb8">Clip${sep}${cp.slug}</div>`;
      }
      if (cp.clipDuration) {
        html += `<div style="color:#adadb8">Duration${sep}${toHHMMSS(cp.clipDuration)}</div>`;
      }
    } else {
      const gp = point as GraphDataPoint;
      if (gp.subs && gp.subs > 0) {
        html += `<div style="margin-top:4px">Subs${sep}${bold(gp.subs)}</div>`;
      }

      if (gp.emotes && gp.emotes.length > 0) {
        html += `<div style="margin-top:4px;color:#e879a8;font-size:14px">${formatEmoteTooltip(gp.emotes)}</div>`;
      }
    }

    return html;
  };

  const markAreaData: unknown[][] = [];
  const gameColorsMap = new Map<string, number>();
  const richStyles: Record<string, unknown> = {};
  let colorIndex = 0;

  const totalDurationSec = xDataSeconds.length > 0 ? xDataSeconds[xDataSeconds.length - 1] - xDataSeconds[0] : 0;
  const minDistanceSec = totalDurationSec * 0.1;
  const lastLabelSecAtLevel = [-99999, -99999];

  if (gameChapters && gameChapters.length > 0 && xDataSeconds.length > 0) {
    for (let i = 0; i < gameChapters.length; i++) {
      const chapter = gameChapters[i];
      const startSec = chapter.positionMilliseconds / 1000;
      const endSec = (chapter.positionMilliseconds + chapter.durationMilliseconds) / 1000;

      const labelXSec = (startSec + endSec) / 2;

      const hasDataInChapter = xDataSeconds.some((sec) => sec >= startSec && sec <= endSec);
      if (!hasDataInChapter) {
        continue;
      }

      const gameName = chapter.game || 'Unknown';
      const boxArtURL = chapter.boxArtURL;

      if (!gameColorsMap.has(gameName)) {
        gameColorsMap.set(gameName, colorIndex);

        if (boxArtURL) {
          const url = boxArtURL.replace('{width}', '40').replace('{height}', '53');
          richStyles[`gameIcon_${colorIndex}`] = {
            backgroundColor: { image: url },
            height: 26,
            width: 20,
            align: 'center',
          };
        }

        colorIndex++;
      }

      const gameColorIdx = gameColorsMap.get(gameName) ?? 0;

      const startIndex = findNearestIndex(startSec, xDataSeconds);
      const endIndex = findNearestIndex(endSec, xDataSeconds);

      if (startIndex === endIndex && startIndex === 0 && endSec < xDataSeconds[0]) {
        continue;
      }

      const hasImage = !!boxArtURL && !!richStyles[`gameIcon_${gameColorIdx}`];
      const formatterStr = hasImage ? `{gameIcon_${gameColorIdx}|}\n{name|${gameName}}` : `{name|${gameName}}`;

      let level = 0;
      if (labelXSec - lastLabelSecAtLevel[0] < minDistanceSec) {
        level = 1;
        if (labelXSec - lastLabelSecAtLevel[1] < minDistanceSec) {
          level = lastLabelSecAtLevel[0] < lastLabelSecAtLevel[1] ? 0 : 1;
        }
      }

      lastLabelSecAtLevel[level] = labelXSec;
      const yOffset = level * 26;

      markAreaData.push([
        {
          name: gameName,
          xAxis: xData[startIndex],
          itemStyle: { color: GAME_COLORS[gameColorIdx % GAME_COLORS.length] },
          label: {
            show: true,
            position: 'insideTop',
            offset: [0, yOffset],
            color: '#adadb8',
            fontSize: 10,
            formatter: formatterStr,
            rich: {
              name: {
                color: '#f0f0f5',
                fontSize: 10,
                fontWeight: 'bold',
                padding: [4, 0, 0, 0],
                textBorderColor: '#000',
                textBorderWidth: 2,
              },
              ...richStyles,
            },
          },
        },
        {
          xAxis: xData[endIndex],
        },
      ]);
    }
  }

  return {
    backgroundColor: 'transparent',
    grid: { ...ECharts.GRID_PADDING, top: 35 },
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
      textStyle: { color: ECharts.TEXT_COLOR, fontSize: 14 },
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
        sampling: 'lttb',
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
        markLine: {
          symbol: ['none', 'none'],
          animation: false,
          silent: true,
          label: { show: false },
          lineStyle: {
            color: ECharts.PLAYHEAD_COLOR,
            width: 2,
            type: 'solid',
          },
          data: [{ xAxis: 0 }],
        },
        markArea: {
          silent: true,
          data: markAreaData,
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
  emotesLoaded,
  duration: propDuration,
  currentTime,
  isWhitelisted,
  isHighlight,
  onClipStart,
  onClipEnd,
  chapters,
}: VodGraphProps) {
  const {
    interval,
    setInterval: _setInterval,
    messageThreshold: userMessageThreshold,
    setMessageThreshold: _setMessageThreshold,
    searchThreshold: userSearchThreshold,
    setSearchThreshold: _setSearchThreshold,
    setEffectiveMessageThreshold,
    setEffectiveSearchThreshold,
    showInsights,
    setShowInsights,
  } = useGraphSettings();

  const [activeTab, setActiveTab] = useState<GraphType>('messages');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [graphData, setGraphData] = useState<GraphDataPoint[] | ClipDataPoint[]>([]);
  const [gameChapters, setGameChapters] = useState<readonly GameChapter[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [effectiveThreshold, setEffectiveThreshold] = useState<number | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [totalMessages, setTotalMessages] = useState<number>(0);
  const [overallTopEmotes, setOverallTopEmotes] = useState<TopEmote[]>([]);
  const [topSpikes, setTopSpikes] = useState<TopSpike[]>([]);

  const chartInstanceRef = useRef<unknown>(null);
  const disposedRef = useRef(false);
  const clipsRef = useRef<Array<{
    vod_offset: number;
    title: string;
    views: number;
    slug: string;
    duration: number;
  }> | null>(null);
  const gameChaptersRef = useRef<readonly GameChapter[] | null>(null);
  const durationRef = useRef<number>(0);
  const propDurationRef = useRef<number>(0);
  const fetchedRef = useRef(false);
  const intervalRef = useRef(interval);
  const userMessageThresholdRef = useRef(userMessageThreshold);
  const userSearchThresholdRef = useRef(userSearchThreshold);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleChartClickRef = useRef<((idx: number) => void) | null>(null);
  const graphDataRef = useRef<GraphDataPoint[] | ClipDataPoint[]>(graphData);
  const lastPlayheadUpdateRef = useRef<number>(0);

  useEffect(() => {
    graphDataRef.current = graphData;
  }, [graphData]);

  useEffect(() => {
    intervalRef.current = interval;
    userMessageThresholdRef.current = userMessageThreshold;
    userSearchThresholdRef.current = userSearchThreshold;
    propDurationRef.current = propDuration ?? 0;
  }, [interval, userMessageThreshold, userSearchThreshold, propDuration]);

  useEffect(() => {
    return () => {
      disposedRef.current = true;
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      disposedRef.current = true;
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

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

  const fetchZstdLogs = useCallback(async (id: string): Promise<string[] | null> => {
    try {
      return await invoke<string[]>('fetch_vod_logs', {
        vodId: id,
        token: getToken(),
      });
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
      setHasStarted(true);
      setIsLoading(true);
      setError(null);
      setGraphData([]);
      setGameChapters(null);
      setEffectiveThreshold(null);

      if (type === 'clips') {
        await fetchClips(id);
      }

      if (type === 'clips') {
        if (!clipsRef.current || clipsRef.current.length === 0) {
          setError('No clips available');
          setIsLoading(false);
          fetchedRef.current = true;
          return;
        }

        const payload = {
          clips: clipsRef.current,
          chapters: chapters ?? [],
        };
        const result = await invoke<ClipsResult>('aggregate_clips_cmd', { payload });
        setGraphData([...result.data]);
        setEffectiveThreshold(null);
        setEffectiveMessageThreshold(null);
        if (result.chapters) {
          setGameChapters(result.chapters);
          gameChaptersRef.current = result.chapters;
        }
        setIsLoading(false);
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

      const payload = {
        logs,
        duration: durationRef.current,
        interval: intv,
        emotes: emoteData.current,
        threshold,
        searchType: type,
        searchTerm: type === 'search' ? searchTerm : undefined,
        chapters: chapters ?? [],
      };
      const result = await invoke<GraphResult>('aggregate_graph', { payload });
      setGraphData([...result.data]);
      setEffectiveThreshold(result.computedThreshold);
      if (type === 'messages') {
        setEffectiveMessageThreshold(result.computedThreshold);
      } else if (type === 'search') {
        setEffectiveSearchThreshold(result.computedThreshold);
      }
      setTotalMessages(result.totalMessages ?? 0);
      setOverallTopEmotes([...(result.topEmotes ?? [])]);
      setTopSpikes([...(result.topSpikes ?? [])]);
      if (result.chapters) {
        setGameChapters(result.chapters);
        gameChaptersRef.current = result.chapters;
      }
      setIsLoading(false);
      fetchedRef.current = true;
    },
    [
      fetchZstdLogs,
      emoteData,
      searchTerm,
      fetchClips,
      setEffectiveMessageThreshold,
      setEffectiveSearchThreshold,
      chapters,
    ],
  );

  useEffect(() => {
    if (!vodId || propDurationRef.current <= 0 || isWhitelisted !== true || !emotesLoaded || isHighlight) return;
    runAggregate(vodId, activeTab, propDurationRef.current, userMessageThreshold, userSearchThreshold, interval);
  }, [
    vodId,
    activeTab,
    runAggregate,
    userMessageThreshold,
    userSearchThreshold,
    interval,
    isWhitelisted,
    emotesLoaded,
    isHighlight,
  ]);

  useEffect(() => {
    if (
      vodId &&
      propDurationRef.current > 0 &&
      !fetchedRef.current &&
      isWhitelisted === true &&
      emotesLoaded &&
      !isHighlight
    ) {
      runAggregate(vodId, activeTab, propDurationRef.current, userMessageThreshold, userSearchThreshold, interval);
    }
  }, [
    isWhitelisted,
    activeTab,
    runAggregate,
    vodId,
    userMessageThreshold,
    userSearchThreshold,
    interval,
    emotesLoaded,
    isHighlight,
  ]);

  const handleChartClick = useCallback(
    (idx: number) => {
      const point = graphData[idx];
      if (!point || !playerRef.current) return;

      let seekTime: number;
      let startTime: number;
      let endTime: number;
      if (activeTab === 'clips') {
        seekTime = point.x;
        startTime = point.x;
        const clipDuration = (point as ClipDataPoint).clipDuration ?? 0;
        endTime = point.x + clipDuration;
      } else {
        seekTime = point.x;
        startTime = point.x;
        endTime = point.x + intervalRef.current;
      }

      if (seekTime < 0) seekTime = 0;
      if (startTime < 0) startTime = 0;
      playerRef.current.seek(seekTime);
      if (onClipStart) onClipStart(toHHMMSS(startTime));
      if (onClipEnd) onClipEnd(toHHMMSS(endTime));
    },
    [graphData, playerRef, activeTab, onClipStart, onClipEnd],
  );

  const handleSeekToTime = useCallback(
    (timeSec: number) => {
      if (!playerRef.current) return;
      let seekTime = timeSec - intervalRef.current;
      if (seekTime < 0) seekTime = 0;
      playerRef.current.seek(seekTime);
      if (onClipStart) onClipStart(toHHMMSS(seekTime));
      if (onClipEnd) onClipEnd(toHHMMSS(timeSec));
    },
    [playerRef, onClipStart, onClipEnd],
  );

  useEffect(() => {
    handleChartClickRef.current = handleChartClick;
  }, [handleChartClick]);

  const updatePlayhead = useCallback((echartsInstance: unknown, time: number) => {
    if (disposedRef.current) return;
    if (time <= 0 || graphDataRef.current.length === 0) return;

    const ec = echartsInstance as {
      isDisposed?: () => boolean;
      setOption: (option: Record<string, unknown>, notMerge?: boolean, lazyUpdate?: boolean) => void;
    };

    if (ec.isDisposed?.()) return;

    const xVals = graphDataRef.current.map((d) => d.x);
    let targetIndex = xVals.indexOf(Math.round(time));
    if (targetIndex < 0) {
      targetIndex = findNearestIndex(time, xVals);
    }

    if (targetIndex < 0 || targetIndex >= xVals.length) return;

    const formattedTime = toHHMMSS(time);

    ec.setOption(
      {
        series: [
          {
            markLine: {
              data: [
                {
                  xAxis: targetIndex,
                  label: {
                    show: true,
                    position: 'end',
                    formatter: () => formattedTime,
                    backgroundColor: ECharts.TOOLTIP_BG,
                    borderColor: ECharts.BORDER_COLOR,
                    borderWidth: 1,
                    color: ECharts.TEXT_COLOR,
                    padding: [4, 8],
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 'bold',
                  },
                },
              ],
            },
          },
        ],
      },
      false,
      true,
    );
  }, []);

  useEffect(() => {
    if (disposedRef.current) return;
    if (currentTime == null || currentTime <= 0 || graphData.length === 0) return;

    const now = Date.now();
    if (now - lastPlayheadUpdateRef.current < TIME_UPDATE_THROTTLE_MS) return;
    lastPlayheadUpdateRef.current = now;

    const chart = chartInstanceRef.current;
    if (!chart) return;

    updatePlayhead(chart, currentTime);
  }, [currentTime, graphData.length, updatePlayhead]);

  useEffect(() => {
    if (disposedRef.current) return;
    const chart = chartInstanceRef.current;
    if (!chart) return;

    const ec = chart as {
      isDisposed?: () => boolean;
      on: (event: string, fn: (...args: unknown[]) => void) => void;
      off: (event: string, fn?: (...args: unknown[]) => void) => void;
    };

    const onZoom = () => {
      if (disposedRef.current || ec.isDisposed?.()) return;
      if (currentTime != null && currentTime > 0) {
        updatePlayhead(chart, currentTime);
      }
    };

    ec.off('datazoom', onZoom);
    ec.on('datazoom', onZoom);

    ec.off('resize', onZoom);
    ec.on('resize', onZoom);

    return () => {
      if (ec.isDisposed?.()) return;
      ec.off('datazoom', onZoom);
      ec.off('resize', onZoom);
    };
  }, [currentTime, updatePlayhead]);

  const handleChartReady = useCallback((echartsInstance: unknown) => {
    disposedRef.current = false;
    chartInstanceRef.current = echartsInstance;

    type EChartsEvent = { offsetX: number; offsetY: number };

    const chart = echartsInstance as {
      off: (event: string) => void;
      getZr: () => {
        off: (ev: string) => void;
        on: (ev: string, fn: (e: EChartsEvent) => void) => void;
      };
      convertFromPixel: (finder: { seriesIndex?: number }, value: [number, number]) => number | number[] | undefined;
      containPixel: (finder: string, value: [number, number]) => boolean;
    };

    chart.off('click');
    const zr = chart.getZr();
    zr.off('click');

    zr.on('click', (e: EChartsEvent) => {
      if (disposedRef.current) return;
      if (!chart.containPixel('grid', [e.offsetX, e.offsetY])) {
        return;
      }
      const pointInGrid = chart.convertFromPixel({ seriesIndex: 0 }, [e.offsetX, e.offsetY]);
      if (pointInGrid == null) return;

      const idx = Array.isArray(pointInGrid) ? Math.round(pointInGrid[0]) : Math.round(pointInGrid);
      const data = graphDataRef.current;
      if (idx >= 0 && idx < data.length) {
        handleChartClickRef.current?.(idx);
      }
    });
  }, []);

  const option = useMemo(
    () => buildEChartsOption(graphData, activeTab, searchTerm, gameChapters),
    [graphData, activeTab, searchTerm, gameChapters],
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
    <div className="flex w-full h-full gap-3 min-h-0">
      {/* Main Graph Area */}
      <div className="flex flex-1 flex-col min-h-0 min-w-0 rounded-lg border border-border bg-surface p-3">
        {/* Tab bar */}
        <div className="relative mb-2 flex items-center justify-between">
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
          <span className="absolute left-1/2 -translate-x-1/2 text-xs tabular-nums text-text-secondary hidden sm:block">
            {activeTab === 'clips' && graphData.length > 0
              ? 'Clip Views / Time'
              : effectiveThreshold != null && effectiveThreshold > 0
                ? `${effectiveThreshold} msgs / ${interval}s`
                : ''}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowInsights(!showInsights)}
              className={`transition-colors hover:text-text-primary ${showInsights ? 'text-primary' : 'text-text-secondary'}`}
              title={showInsights ? 'Hide VOD Insights' : 'Show VOD Insights'}
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
                <title>Toggle Insights</title>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="15" y1="3" x2="15" y2="21" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-global-settings', { detail: 'graph' }))}
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
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1.74-1v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </div>

        {/* Chart area */}
        <div className="relative flex min-h-[200px] w-full flex-1 flex-col">
          {error ? (
            <div className="flex h-full w-full flex-col items-center justify-center">
              <p className="text-sm text-text-muted">{error}</p>
            </div>
          ) : isHighlight ? (
            <div className="flex h-full w-full flex-col items-center justify-center">
              <div className="flex items-center gap-1.5 rounded-md border border-yellow-900/40 bg-yellow-950/30 px-4 py-2">
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
                <p className="text-sm text-yellow-400">Graph data not available for highlights</p>
              </div>
            </div>
          ) : isWhitelisted === false ? (
            <div className="flex h-full w-full flex-col items-center justify-center">
              <div className="flex items-center gap-1.5 rounded-md border border-yellow-900/40 bg-yellow-950/30 px-4 py-2">
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
                <p className="text-sm text-yellow-400">This streamer is not whitelisted</p>
              </div>
            </div>
          ) : !hasStarted || (isLoading && !error) ? (
            <SkeletonGraph />
          ) : graphData.length === 0 ? (
            <div className="flex h-full w-full flex-col items-center justify-center">
              <p className="text-sm text-text-muted">No data to display</p>
            </div>
          ) : (
            <ReactECharts
              option={option}
              style={{ height: '100%', width: '100%' }}
              opts={{ renderer: 'canvas' }}
              onChartReady={handleChartReady}
              notMerge={true}
              lazyUpdate={true}
            />
          )}
        </div>
      </div>

      {/* Insights Side Panel */}
      {showInsights && (
        <div className="w-56 shrink-0 flex flex-col rounded-lg border border-border bg-surface p-3 overflow-hidden">
          <h3 className="text-sm font-semibold text-text-primary mb-3">VOD Insights</h3>
          {!hasStarted || (isLoading && !error) ? (
            <div className="flex flex-col gap-4 animate-pulse">
              <div className="h-10 w-full bg-white/5 rounded" />
              <div className="h-24 w-full bg-white/5 rounded" />
              <div className="h-32 w-full bg-white/5 rounded" />
            </div>
          ) : error || isWhitelisted === false || isHighlight ? (
            <span className="text-xs text-text-hint">No insights available</span>
          ) : (
            <div className="flex flex-col h-full min-h-0 gap-4 overflow-y-auto chat-scrollbar pr-1">
              {/* Total Messages Metric */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-text-secondary">Total Messages</span>
                <span className="text-lg font-bold text-primary">{totalMessages?.toLocaleString() ?? 0}</span>
              </div>

              {/* Top Emotes Grid */}
              {overallTopEmotes && overallTopEmotes.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-text-secondary">Top Emotes</span>
                  <div className="flex flex-wrap gap-1.5">
                    {overallTopEmotes.map((emote) => {
                      const url = getEmoteUrl(emote.name, emoteData.current);
                      return (
                        <button
                          type="button"
                          key={emote.name}
                          onClick={() => {
                            setActiveTab('search');
                            setSearchInput(emote.name);
                            setSearchTerm(emote.name);
                          }}
                          className="flex items-center gap-1.5 rounded bg-background border border-border px-1.5 py-1 hover:border-primary/50 transition-colors"
                          title={`${emote.count.toLocaleString()} uses`}
                        >
                          {url ? (
                            <img src={url} alt={emote.name} className="h-4 w-4 object-contain" />
                          ) : (
                            <span className="text-[10px]">{emote.name}</span>
                          )}
                          <span className="text-[10px] font-medium text-text-secondary">
                            {emote.count >= 1000 ? `${(emote.count / 1000).toFixed(1)}k` : emote.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Top Moments List */}
              {topSpikes && topSpikes.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-text-secondary">Top Moments</span>
                  <div className="flex flex-col gap-1">
                    {topSpikes.map((spike, idx) => (
                      <button
                        type="button"
                        key={spike.time}
                        onClick={() => handleSeekToTime(spike.time)}
                        className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-white/5 transition-colors group text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-text-hint group-hover:text-text-secondary w-5 shrink-0">
                            #{idx + 1}
                          </span>
                          <span className="text-xs font-medium text-primary group-hover:text-primary-hover">
                            {spike.duration}
                          </span>
                        </div>
                        <span className="text-[10px] text-text-hint">{spike.messages.toLocaleString()} msgs</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default VodGraph;
