import { useInfiniteQuery } from '@tanstack/react-query';
import { User } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchWhitelistedChannels } from '../auth';
import { CHANNEL_PAGE_SIZE, INTERSECTION_OBSERVER_MARGIN } from '../constants/ui';
import type { WhitelistChannel } from '../types/twitch';

function ChannelCard({ channel }: { channel: WhitelistChannel }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(`/channel/${channel.channel}`)}
      className="group flex flex-col items-center gap-3 rounded-xl border border-border/50 bg-surface p-4 transition-all hover:border-primary/30 hover:bg-surface-elevated hover:shadow-lg hover:shadow-primary/5"
    >
      <div className="relative h-16 w-16 overflow-hidden rounded-full ring-2 ring-white/5 transition-transform group-hover:scale-110 group-hover:ring-primary/40">
        {channel.profileImageURL ? (
          <img
            src={channel.profileImageURL}
            alt={channel.displayName}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <User className="h-10 w-10 text-text-hint" />
          </div>
        )}
      </div>
      <span className="max-w-full truncate text-sm font-medium text-text-secondary transition-colors group-hover:text-text-primary">
        {channel.displayName}
      </span>
    </button>
  );
}

function ChannelSkeleton() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border/50 bg-surface p-4">
      <div className="h-16 w-16 rounded-full bg-white/5 animate-pulse" />
      <div className="h-3 w-20 rounded bg-white/5 animate-pulse" />
    </div>
  );
}

export default function HomePage() {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingInitial,
    error,
  } = useInfiniteQuery({
    queryKey: ['whitelisted-channels'],
    queryFn: ({ pageParam }) => fetchWhitelistedChannels(pageParam, CHANNEL_PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.channels.length >= CHANNEL_PAGE_SIZE ? lastPage.page + 1 : undefined),
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

  const channels = data?.pages.flatMap((p) => p.channels) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  return (
    <div ref={scrollContainerRef} className="flex flex-1 flex-col items-center overflow-y-auto p-6">
      <div className="w-full">
        {isLoadingInitial ? (
          <>
            <div className="mb-4 h-7 w-64 rounded bg-white/5 animate-pulse" />
            <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
              <ChannelSkeleton />
              <ChannelSkeleton />
              <ChannelSkeleton />
              <ChannelSkeleton />
              <ChannelSkeleton />
              <ChannelSkeleton />
              <ChannelSkeleton />
              <ChannelSkeleton />
              <ChannelSkeleton />
              <ChannelSkeleton />
              <ChannelSkeleton />
              <ChannelSkeleton />
            </div>
          </>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <p className="text-text-secondary">Failed to load channels</p>
            <p className="text-sm text-text-hint">{error.message}</p>
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <p className="text-text-secondary">No whitelisted channels</p>
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-baseline gap-2">
              <h2 className="text-xl font-semibold text-text-primary">Whitelisted Channels</h2>
              <span className="text-text-hint">—</span>
              <span className="text-xl font-bold text-primary">{total}</span>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
              {channels.map((c) => (
                <ChannelCard key={c.channel} channel={c} />
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

            {!hasNextPage && channels.length > 0 && (
              <div className="py-8 text-center text-sm text-text-hint">All channels loaded</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
