import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, Search, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getToken, logout, searchWhitelistedChannels, useUser } from '../../auth';
import { TWITCH_OAUTH_LOGIN_URL } from '../../constants/auth';
import {
  CHANNEL_SEARCH_DEBOUNCE_MS,
  MIN_SEARCH_QUERY_LENGTH,
  SEARCH_BLUR_DELAY_MS,
  STALE_TIME_30SEC,
} from '../../constants/ui';
import { DiscordUrl, KoFiUrl, PatreonUrl, TwitterUrl } from '../../constants/urls';
import type { SearchResult } from '../../types/twitch';
import JobQueueDropdown from '../ui/JobQueueDropdown';

const SOCIALS = [
  {
    href: DiscordUrl,
    label: 'Discord',
    svg: (
      <svg
        viewBox="0 0 71 55"
        width="20"
        height="20"
        fill="currentColor"
        className="text-text-secondary hover:text-text-primary transition-colors"
      >
        <title>Discord</title>
        <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z" />
      </svg>
    ),
  },
  {
    href: TwitterUrl,
    label: 'Twitter',
    svg: (
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="currentColor"
        className="text-text-secondary hover:text-text-primary transition-colors"
      >
        <title>Twitter</title>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    href: PatreonUrl,
    label: 'Patreon',
    svg: (
      <svg
        viewBox="0 -4.5 256 256"
        width="20"
        height="20"
        fill="currentColor"
        className="text-text-secondary hover:text-text-primary transition-colors"
      >
        <title>Patreon</title>
        <path d="M45.1355837,0 L45.1355837,246.35001 L0,246.35001 L0,0 L45.1355837,0 Z M163.657111,0 C214.65668,0 256,41.3433196 256,92.3428889 C256,143.342458 214.65668,184.685778 163.657111,184.685778 C112.657542,184.685778 71.3142222,143.342458 71.3142222,92.3428889 C71.3142222,41.3433196 112.657542,0 163.657111,0 Z" />
      </svg>
    ),
  },
  {
    href: KoFiUrl,
    label: 'Ko-fi',
    svg: (
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="currentColor"
        className="text-text-secondary hover:text-text-primary transition-colors"
      >
        <title>Ko-fi</title>
        <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311zm6.173.478c-.928.116-1.682.028-1.682.028V7.284h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.667-2.059 3.015z" />
      </svg>
    ),
  },
];

import hypeLogo from '../../assets/vigor.png';

function LogoIcon() {
  return <img src={hypeLogo} alt="Hype" width="28" height="28" className="rounded" />;
}

function LoginButton({ className }: { className?: string }) {
  return (
    <a
      href={`${TWITCH_OAUTH_LOGIN_URL}?client=desktop`}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover ${className}`}
    >
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
        <title>Login</title>
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        <polyline points="10 17 15 12 10 7" />
        <line x1="15" y1="12" x2="3" y2="12" />
      </svg>
      Login
    </a>
  );
}

function UserMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const handleLogout = () => {
    logout();
    queryClient.invalidateQueries({
      predicate: (q) =>
        q.queryKey[0] === 'user' || q.queryKey[0] === 'whitelisted-channels' || q.queryKey[0] === 'search',
      refetchType: 'all',
    });
    navigate('/');
  };

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-elevated transition-colors hover:bg-white/10 hover:text-text-primary"
      >
        <User className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-fit whitespace-nowrap rounded-md border border-border bg-surface py-1 shadow-lg">
          <a
            href="/profile"
            onClick={(e) => {
              e.preventDefault();
              setOpen(false);
              navigate('/profile');
            }}
            className="flex items-center gap-2 px-2 py-1.5 text-sm text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
          >
            <User className="h-4 w-4" />
            Profile
          </a>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 px-2 py-1.5 text-sm text-red-400 transition-colors hover:bg-white/5 hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </button>
        </div>
      )}
    </div>
  );
}

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: user, isLoading } = useUser();
  const hasToken = Boolean(getToken());
  const isAuthenticated = user !== null || (isLoading && hasToken);
  const [channelInput, setChannelInput] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  const isHomePage = location.pathname === '/' || location.pathname === '/home';

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(channelInput), CHANNEL_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [channelInput]);

  const { data: searchResults = [], isFetching } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchWhitelistedChannels(debouncedQuery),
    enabled: debouncedQuery.length >= MIN_SEARCH_QUERY_LENGTH,
    staleTime: STALE_TIME_30SEC,
  });

  const handleChannelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (channelInput.trim()) {
      navigate(`/channel/${channelInput.trim()}`);
      setChannelInput('');
      setSearchOpen(false);
    }
  };

  const handleBlur = () => {
    setTimeout(() => setSearchOpen(false), SEARCH_BLUR_DELAY_MS);
  };

  const handleFocus = () => {
    if (debouncedQuery.length >= 2) setSearchOpen(true);
  };

  return (
    <nav className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
      {/* Left: Logo + Socials */}
      <div className="flex items-center gap-3">
        {!isHomePage && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 rounded-md bg-surface-elevated px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <title>Back</title>
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </button>
        )}

        <Link to="/" className="flex items-center gap-2">
          <LogoIcon />
          <span className="text-sm font-bold tracking-tight text-text-primary">Hype</span>
        </Link>

        <div className="flex items-center gap-1">
          {SOCIALS.map(({ href, label, svg }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              title={label}
              className="flex p-1.5 transition-colors"
            >
              {svg}
            </a>
          ))}
        </div>
      </div>

      {/* Center: Channel input */}
      <form onSubmit={handleChannelSubmit} className="absolute left-1/2 -translate-x-1/2 max-w-[200px]">
        <div ref={searchWrapperRef} className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-hint" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Enter a Twitch channel"
            value={channelInput}
            onChange={(e) => {
              setChannelInput(e.target.value);
              setSearchOpen(e.target.value.length >= 2);
            }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 pl-9 text-sm text-text-primary placeholder-text-hint outline-none transition-colors focus:border-primary"
          />
          {(searchOpen || (channelInput.length >= 2 && isFetching)) && (
            <div className="absolute top-full left-0 z-50 mt-1 w-full whitespace-nowrap rounded-md border border-border bg-surface py-1 shadow-lg">
              {isFetching ? (
                <div className="flex h-8 items-center justify-center">
                  <div className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-primary border-t-transparent" />
                </div>
              ) : (
                <>
                  {searchResults.map((result: SearchResult) => (
                    <Link
                      key={result.channel}
                      to={`/channel/${result.channel}`}
                      onClick={() => setSearchOpen(false)}
                      className="flex items-center gap-2 px-2 py-1.5 text-sm text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
                    >
                      {result.profileImageURL ? (
                        <img src={result.profileImageURL} alt="" className="h-6 w-6 shrink-0 rounded-full" />
                      ) : (
                        <User className="h-4 w-4 shrink-0 text-text-hint" />
                      )}
                      <span className="truncate">{result.displayName}</span>
                    </Link>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      if (channelInput.trim()) {
                        navigate(`/channel/${channelInput.trim()}`);
                        setSearchOpen(false);
                      }
                    }}
                    disabled={!channelInput.trim()}
                    className="block w-full px-2 py-1.5 text-left text-sm text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary disabled:opacity-40"
                  >
                    Go to {channelInput}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </form>

      {/* Right: Auth buttons */}
      <div className="flex items-center gap-2">
        {isAuthenticated && <JobQueueDropdown />}
        {isAuthenticated ? <UserMenu /> : <LoginButton />}
      </div>
    </nav>
  );
}
