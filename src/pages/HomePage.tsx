import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUsers } from '../api/twitch';
import { useUser } from '../auth';
import type { TwitchUser } from '../types/twitch';

function ChannelSkeleton() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg p-4">
      <div className="h-16 w-16 rounded-full bg-white/5 animate-pulse" />
      <div className="h-3 w-24 rounded bg-white/5 animate-pulse" />
    </div>
  );
}

function ChannelCard({ user }: { user: TwitchUser }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(`/channel/${user.login}`)}
      className="group flex flex-col items-center gap-2 rounded-lg p-4 transition-colors hover:bg-white/5"
    >
      <img
        src={user.profileImageURL}
        alt={user.displayName}
        className="h-16 w-16 rounded-full object-cover transition-transform group-hover:scale-105"
      />
      <span className="truncate text-sm font-medium text-text-secondary group-hover:text-text-primary">
        {user.displayName}
      </span>
    </button>
  );
}

export default function HomePage() {
  const { data: user } = useUser();
  const navigate = useNavigate();
  const [vodId, setVodId] = useState('');
  const [twitchUsers, setTwitchUsers] = useState<TwitchUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  useEffect(() => {
    if (!user?.whitelists || user.whitelists.length === 0) return;

    setIsLoadingUsers(true);
    const logins = user.whitelists.map((w) => w.channel);

    getUsers(logins)
      .then((users: TwitchUser[]) => setTwitchUsers(users))
      .catch(() => {})
      .finally(() => setIsLoadingUsers(false));
  }, [user]);

  const handleVodLoad = useCallback(() => {
    if (vodId.trim()) {
      navigate(`/vod/${vodId.trim()}`);
    }
  }, [vodId, navigate]);

  return (
    <div className="flex flex-1 flex-col items-center overflow-y-auto p-6">
      {/* VOD entry */}
      <div className="mb-8 w-full max-w-md">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter VOD ID..."
            value={vodId}
            onChange={(e) => setVodId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleVodLoad()}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder-text-hint outline-none transition-colors focus:border-primary"
          />
          <button
            type="button"
            onClick={handleVodLoad}
            disabled={!vodId.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            Load
          </button>
        </div>
      </div>

      {/* Whitelisted channels */}
      {user && user.whitelists.length > 0 && (
        <div className="w-full max-w-2xl">
          <h2 className="mb-4 text-center text-lg font-semibold text-text-primary">
            Whitelisted Channels ({twitchUsers.length})
          </h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {isLoadingUsers
              ? user.whitelists.map((w) => <ChannelSkeleton key={w.channel} />)
              : twitchUsers.map((u) => <ChannelCard key={u.id} user={u} />)}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!user && (
        <div className="mt-8 text-center">
          <p className="text-text-secondary">Enter a VOD ID to get started</p>
          <p className="mt-1 text-sm text-text-hint">Login to manage your whitelisted channels</p>
        </div>
      )}
    </div>
  );
}
