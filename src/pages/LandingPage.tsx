import { Clock, Compass, Download, MessageSquare, Scissors, Search, Trash2, TrendingUp, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import hypeLogo from '../assets/hype-logo.svg';
import { useRecentChannels } from '../hooks/useRecentChannels';

export default function LandingPage() {
  const { recent, removeRecentChannel, clearRecent } = useRecentChannels();
  const navigate = useNavigate();

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-8 items-center bg-background">
      <div className="w-full max-w-5xl space-y-12">
        {/* Hero Section */}
        <div className="flex flex-col items-center rounded-2xl border border-border/50 bg-surface/50 p-8 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
          <div className="relative z-10">
            <div className="flex justify-center mb-6">
              <img src={hypeLogo} alt="Hype" className="max-w-[300px] h-auto" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-2">Finding the Hype</h1>
            <p className="text-sm text-text-secondary max-w-xl mx-auto mb-4">
              Your ultimate Twitch companion. Download VODs, clip highlights, render chat, search keywords, and explore
              your stream data with powerful graphs.
            </p>
            <Link
              to="/browse"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-primary-hover shadow-lg shadow-primary/20 hover:scale-105 active:scale-95"
            >
              <Compass size={18} />
              Browse Whitelisted Channels
            </Link>
          </div>
        </div>

        {/* Recently Visited Section */}
        {recent.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-text-primary">
                <Clock className="text-primary" size={20} />
                Jump Back In
              </h2>
              <button
                type="button"
                onClick={clearRecent}
                className="text-xs font-medium text-text-hint hover:text-red-400 transition-colors"
              >
                Clear History
              </button>
            </div>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
              {recent.map((channel) => (
                <div
                  key={channel.channel}
                  className="group relative flex flex-col items-center gap-3 rounded-xl border border-border/50 bg-surface p-5 transition-all hover:border-primary/30 hover:bg-surface-elevated hover:shadow-lg hover:shadow-primary/5 cursor-pointer"
                  onClick={() => navigate(`/channel/${channel.channel}`)}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeRecentChannel(channel.channel);
                    }}
                    className="absolute top-2 right-2 p-1.5 text-text-hint opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>

                  <div className="relative h-16 w-16 overflow-hidden rounded-full ring-2 ring-white/5 transition-transform group-hover:scale-110 group-hover:ring-primary/40">
                    {channel.profileImageURL ? (
                      <img
                        src={channel.profileImageURL}
                        alt={channel.displayName}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-white/5">
                        <User className="h-8 w-8 text-text-hint" />
                      </div>
                    )}
                  </div>
                  <div className="text-center w-full">
                    <span className="block w-full truncate text-sm font-medium text-text-secondary transition-colors group-hover:text-text-primary">
                      {channel.displayName}
                    </span>
                    <span className="text-[10px] text-text-hint mt-1 block">
                      Visited {new Date(channel.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Features Section */}
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-text-primary">
            <TrendingUp className="text-primary" size={20} />
            Features
          </h2>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            <div className="rounded-xl border border-border/50 bg-surface p-6 transition-all hover:border-primary/30 hover:bg-surface-elevated">
              <div className="mb-3 flex items-center gap-2 text-primary">
                <TrendingUp size={20} />
                <h3 className="font-semibold">Graphs</h3>
              </div>
              <p className="text-sm text-text-secondary">
                See the Hype. Visualize chat activity and discover the best moments.
              </p>
            </div>

            <div className="rounded-xl border border-border/50 bg-surface p-6 transition-all hover:border-primary/30 hover:bg-surface-elevated">
              <div className="mb-3 flex items-center gap-2 text-primary">
                <Search size={20} />
                <h3 className="font-semibold">Search</h3>
              </div>
              <p className="text-sm text-text-secondary">
                Find exactly when{' '}
                <img
                  src="https://cdn.7tv.app/emote/01HE93VAT80008YHC7C41FE5VR/1x.avif"
                  alt="EWWW"
                  className="inline-block h-6 w-6 align-middle"
                />{' '}
                EWWW happens. Keyword search across every VOD.
              </p>
            </div>

            <div className="rounded-xl border border-border/50 bg-surface p-6 transition-all hover:border-primary/30 hover:bg-surface-elevated">
              <div className="mb-3 flex items-center gap-2 text-primary">
                <Download size={20} />
                <h3 className="font-semibold">Download</h3>
              </div>
              <p className="text-sm text-text-secondary">
                Whole VODs in 1440p60, 1080p60, 720p60, 480p30, or Audio. Your call.
              </p>
            </div>

            <div className="rounded-xl border border-border/50 bg-surface p-6 transition-all hover:border-primary/30 hover:bg-surface-elevated">
              <div className="mb-3 flex items-center gap-2 text-primary">
                <Scissors size={20} />
                <h3 className="font-semibold">Clipping</h3>
              </div>
              <p className="text-sm text-text-secondary">Zero quality loss. No duration limits. Blazing fast.</p>
            </div>

            <div className="rounded-xl border border-border/50 bg-surface p-6 transition-all hover:border-primary/30 hover:bg-surface-elevated">
              <div className="mb-3 flex items-center gap-2 text-primary">
                <MessageSquare size={20} />
                <h3 className="font-semibold">Chat Replay</h3>
              </div>
              <p className="text-sm text-text-secondary">
                Transparent chat baked into your clip. Save yourself the screen recording.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
