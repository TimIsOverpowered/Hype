import { User } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchWhitelistedChannels } from '../auth';
import type { WhitelistChannel } from '../types/twitch';

const PAGE_SIZE = 100;

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
  const [total, setTotal] = useState(0);
  const [channels, setChannels] = useState<WhitelistChannel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const isLoadingRef = useRef(false);

  useEffect(() => {
    setIsLoadingInitial(true);
    setChannels([]);
    pageRef.current = 1;
    setHasMore(true);
    setError(null);

    fetchWhitelistedChannels(1, PAGE_SIZE)
      .then((data) => {
        setTotal(data.total);
        setChannels([...data.channels]);
        setHasMore(data.channels.length >= PAGE_SIZE);
      })
      .catch((err) => setError(err.message))
      .finally(() => {
        setIsLoadingInitial(false);
        setIsLoading(false);
      });
  }, []);

  const pageRef = useRef(1);

  const loadMore = useCallback(() => {
    if (isLoading || !hasMore) return;
    isLoadingRef.current = true;
    setIsLoading(true);

    pageRef.current += 1;
    const nextPage = pageRef.current;
    fetchWhitelistedChannels(nextPage, PAGE_SIZE)
      .then((data) => {
        setChannels((prev) => [...prev, ...data.channels]);
        setHasMore(data.channels.length >= PAGE_SIZE);
        pageRef.current = nextPage;
      })
      .catch((err) => setError(err.message))
      .finally(() => {
        setIsLoading(false);
        isLoadingRef.current = false;
      });
  }, [isLoading, hasMore]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingRef.current) {
          loadMore();
        }
      },
      { rootMargin: '200px' },
    );

    const el = sentinelRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return (
    <div className="flex flex-1 flex-col items-center overflow-y-auto p-6">
      {/* Whitelisted channels */}
      <div className="w-full max-w-7xl">
        {isLoadingInitial ? (
          <>
            <div className="mb-4 h-7 w-64 rounded bg-white/5 animate-pulse" />
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
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
            <p className="text-sm text-text-hint">{error}</p>
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

            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
              {channels.map((c) => (
                <ChannelCard key={c.channel} channel={c} />
              ))}
            </div>

            {hasMore && (
              <div ref={sentinelRef} className="flex justify-center py-8">
                {isLoading && (
                  <div className="flex items-center gap-2 text-sm text-text-hint">
                    <div className="h-4 w-4 animate-spin rounded-full border-[1.5px] border-primary border-t-transparent" />
                    Loading more...
                  </div>
                )}
              </div>
            )}

            {!hasMore && channels.length > 0 && (
              <div ref={sentinelRef} className="py-8 text-center text-sm text-text-hint">
                All channels loaded
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
