import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getNextVods, getVods } from '../api/twitch';
import type { TwitchUser, VodEdge, VodPage } from '../types/twitch';
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

function VodCard({ vod, twitchUser }: { vod: VodEdge; twitchUser?: TwitchUser }) {
  const navigate = useNavigate();

  if (vod.node.broadcastType !== 'ARCHIVE') return null;

  const thumbnail = vod.node.previewThumbnailURL;
  const duration = toHHMMSS(vod.node.lengthSeconds);
  const date = vod.node.createdAt ? new Date(vod.node.createdAt).toLocaleDateString() : '';

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
        <div className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
          {duration}
        </div>
        {date && (
          <div className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
            {date}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-text-secondary group-hover:text-text-primary">
          {vod.node.title}
        </p>
        {twitchUser && <p className="mt-0.5 truncate text-[10px] text-text-hint">{twitchUser.displayName}</p>}
      </div>
    </button>
  );
}

export default function ChannelPage() {
  const { channel } = useParams() as { channel: string };
  const [vodPage, setVodPage] = useState<VodPage | null>(null);
  const [twitchUser, setTwitchUser] = useState<TwitchUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!channel) return;

    setIsLoading(true);
    setError(null);

    getVods(channel)
      .then((result) => {
        setVodPage(result);
        if (result.user) setTwitchUser(result.user);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load channel'))
      .finally(() => setIsLoading(false));
  }, [channel]);

  const loadMore = useCallback(() => {
    if (!channel || !vodPage?.pageInfo.hasNextPage) return;

    const lastEdge = vodPage.edges[vodPage.edges.length - 1];
    if (!lastEdge?.cursor) return;

    getNextVods(channel, lastEdge.cursor)
      .then((result) => {
        setVodPage((prev) =>
          prev ? { ...prev, edges: [...prev.edges, ...result.edges], pageInfo: result.pageInfo } : null,
        );
      })
      .catch(() => {});
  }, [channel, vodPage]);

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <div className="h-20 w-20 rounded-full bg-white/5 animate-pulse" />
        <div className="h-4 w-32 rounded bg-white/5 animate-pulse" />
        <div className="grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }, () => (
            <VodCardSkeleton key={String(Math.random())} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <p className="text-text-muted">{error}</p>
        </div>
      </div>
    );
  }

  if (!vodPage) return null;

  const vods = vodPage.edges.filter((v) => v.node.broadcastType === 'ARCHIVE');

  return (
    <div className="flex flex-1 flex-col items-center overflow-y-auto p-6">
      {twitchUser && (
        <div className="mb-6 flex flex-col items-center gap-2">
          <img src={twitchUser.profileImageURL} alt={twitchUser.displayName} className="h-20 w-20 rounded-full" />
          <h1 className="text-lg font-semibold text-text-primary">{twitchUser.displayName}'s VODs</h1>
        </div>
      )}

      <div className="grid w-full max-w-4xl grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {vods.map((vod) => (
          <VodCard key={vod.cursor} vod={vod} twitchUser={twitchUser ?? undefined} />
        ))}
      </div>

      {vodPage.pageInfo.hasNextPage && (
        <button
          type="button"
          onClick={loadMore}
          className="mt-6 rounded-md bg-surface-elevated px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
        >
          Load More
        </button>
      )}

      {vods.length === 0 && <p className="mt-4 text-sm text-text-hint">No archived VODs found</p>}
    </div>
  );
}
