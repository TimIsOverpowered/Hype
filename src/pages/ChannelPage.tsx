import type { InfiniteData } from '@tanstack/react-query';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getNextVods, getVods } from '../api/twitch';
import { getToken } from '../auth';
import { INTERSECTION_OBSERVER_MARGIN } from '../constants/ui';
import { useRecentChannels } from '../hooks/useRecentChannels';
import type { VodEdge, VodPage } from '../types/twitch';
import { toHHMMSS } from '../utils/time';

function VodCardSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="aspect-video w-full rounded-md bg-white/5 animate-pulse" />
      <div className="h-3 w-full rounded bg-white/5 animate-pulse" />
      <div className="h-3 w-16 rounded bg-white/5 animate-pulse" />
    </div>
  );
}

function VodCard({ vod, displayName }: { vod: VodEdge; displayName?: string }) {
  const navigate = useNavigate();

  const thumbnail = vod.node.previewThumbnailURL;
  const duration = toHHMMSS(vod.node.lengthSeconds);
  const date = vod.node.createdAt
    ? new Date(vod.node.createdAt).toLocaleDateString('en-US', {
        month: 'long',
        day: '2-digit',
        year: 'numeric',
      })
    : '';

  return (
    <button
      type="button"
      onClick={() => navigate(`/vod/${vod.node.id}`)}
      className="group flex flex-col gap-2 text-left"
    >
      <div className="relative overflow-hidden rounded-md">
        {thumbnail ? (
          <img
            src={thumbnail.replace('{width}', '320').replace('{height}', '180')}
            alt={vod.node.title}
            className="aspect-video w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="aspect-video w-full bg-white/5" />
        )}
        <div className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white">
          {duration}
        </div>
        {date && (
          <div className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-white">
            {date}
          </div>
        )}
        <div className="absolute top-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          {vod.node.broadcastType === 'HIGHLIGHT' ? 'Highlight' : 'Archive'}
        </div>
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-text-secondary group-hover:text-text-primary">
          {vod.node.title}
        </p>
        {displayName && <p className="mt-0.5 truncate text-[10px] text-text-hint">{displayName}</p>}
      </div>
    </button>
  );
}

export default function ChannelPage() {
  const { channel } = useParams() as { channel: string };
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const { addRecentChannel } = useRecentChannels();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error } = useInfiniteQuery<
    VodPage,
    Error,
    InfiniteData<VodPage, string | null>,
    [string, string],
    string | null
  >({
    queryKey: ['channel-vods', channel],
    queryFn: ({ pageParam }) => (pageParam === null ? getVods(channel) : getNextVods(channel, pageParam)),
    initialPageParam: null,
    getNextPageParam: (lastPage) =>
      lastPage.pageInfo.hasNextPage ? (lastPage.edges[lastPage.edges.length - 1]?.cursor ?? null) : null,
  });

  useEffect(() => {
    const el = sentinelRef.current;
    const root = scrollContainerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { root, rootMargin: INTERSECTION_OBSERVER_MARGIN },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const vods =
    data?.pages.flatMap((p: VodPage) =>
      p.edges.filter((v: VodEdge) => v.node.broadcastType === 'ARCHIVE' || v.node.broadcastType === 'HIGHLIGHT'),
    ) ?? [];
  const twitchUser = data?.pages[0]?.user;

  useEffect(() => {
    if (twitchUser?.login) {
      addRecentChannel({
        channel: twitchUser.login,
        displayName: twitchUser.displayName,
        profileImageURL: twitchUser.profileImageURL ?? null,
      });
    }
  }, [twitchUser, addRecentChannel]);

  if (!getToken()) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <p className="text-text-secondary">You must be logged in to view this page.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <div className="h-20 w-20 rounded-full bg-white/5 animate-pulse" />
        <div className="h-4 w-32 rounded bg-white/5 animate-pulse" />
        <div className="w-full grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          <VodCardSkeleton />
          <VodCardSkeleton />
          <VodCardSkeleton />
          <VodCardSkeleton />
          <VodCardSkeleton />
          <VodCardSkeleton />
          <VodCardSkeleton />
          <VodCardSkeleton />
          <VodCardSkeleton />
          <VodCardSkeleton />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <p className="text-text-muted">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollContainerRef} className="flex flex-1 flex-col items-center overflow-y-auto p-6">
      {twitchUser && (
        <div className="mb-6 flex flex-col items-center gap-2">
          <img src={twitchUser.profileImageURL} alt={twitchUser.displayName} className="h-20 w-20 rounded-full" />
          <h1 className="text-lg font-semibold text-text-primary">{twitchUser.displayName}'s VODs</h1>
        </div>
      )}

      <div className="w-full grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
        {vods.map((vod) => (
          <VodCard key={vod.node.id} vod={vod} displayName={twitchUser?.displayName} />
        ))}
      </div>

      {hasNextPage && (
        <div ref={sentinelRef} className="flex justify-center py-8">
          {isFetchingNextPage && (
            <div className="flex items-center gap-2 text-sm text-text-hint">
              <div className="h-4 w-4 animate-spin rounded-full border-[1.5px] border-primary border-t-transparent" />
              Loading more...
            </div>
          )}
        </div>
      )}

      {!hasNextPage && vods.length > 0 && (
        <div className="py-8 text-center text-sm text-text-hint">All VODs loaded</div>
      )}

      {vods.length === 0 && <p className="mt-4 text-sm text-text-hint">No VODs found</p>}
    </div>
  );
}
