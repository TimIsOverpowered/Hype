import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { API_BASE, getToken, useUser } from '../../auth';

interface WhitelistResponse {
  readonly error: boolean;
  readonly errorMSG?: string;
  readonly message?: string;
  readonly whitelist?: { id: string; channel: string };
}

interface UserUpdate {
  readonly whitelists: { id: string; channel: string }[];
}

export default function WhitelistPanel() {
  const queryClient = useQueryClient();
  const { data: user } = useUser();
  const [input, setInput] = useState('');
  const [success, setSuccess] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const whitelists = user?.whitelists ?? [];

  const whitelistMutation = useMutation({
    mutationFn: async (username: string) => {
      const accessToken = getToken();
      const res = await fetch(`${API_BASE}/v1/whitelist/channel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ username }),
      });
      return res.json();
    },
    onSuccess: (data: WhitelistResponse) => {
      if (data.error) {
        setSuccess(false);
        setErrorMsg(data.errorMSG ?? '');
      } else {
        setSuccess(true);
        setErrorMsg('');
        queryClient.setQueryData(['user'], (old: UserUpdate | undefined) => {
          if (!old) return old;
          return { ...old, whitelists: [...old.whitelists, data.whitelist ?? { id: '', channel: '' }] };
        });
      }
    },
    onError: () => {
      setSuccess(false);
      setErrorMsg('Server encountered an error.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (channel: string) => {
      const accessToken = getToken();
      await fetch(`${API_BASE}/v1/whitelist/channel`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ channel }),
      });
    },
    onSuccess: (_, channel) => {
      queryClient.setQueryData(['user'], (old: UserUpdate | undefined) => {
        if (!old) return old;
        return { ...old, whitelists: old.whitelists.filter((w) => w.channel !== channel) };
      });
    },
    onError: (err) => {
      console.error(err);
    },
  });

  if (!user) return null;

  const isVip = (user.patreon && user.patreon.tier >= 1 && user.patreon.isPatron) || user.whitelist || user.admin;

  const handleAdd = () => {
    if (!isVip || whitelistMutation.isPending || !input.trim()) return;
    whitelistMutation.mutate(input.trim());
    setInput('');
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleDelete = (channel: string) => {
    if (!window.confirm(`Remove ${channel} from your whitelist?`)) return;
    deleteMutation.mutate(channel);
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">Whitelist</h3>

      <div className="flex items-center gap-4 py-1">
        <span className="w-32 shrink-0 text-sm font-semibold text-text-secondary">Channels</span>
        <span className="text-sm text-text-primary">
          {whitelists.length}/{user.max_whitelist_channels}
        </span>
      </div>

      <div className="border-t border-border" />

      <div className="py-2">
        <div className="flex items-center gap-4 py-1">
          <span className="w-32 shrink-0 text-sm font-semibold text-text-secondary">Add Channel</span>
          <div className="flex flex-1 gap-2">
            {success === false && (
              <div className="mb-2 w-full rounded-md bg-red-950/50 border border-red-900/50 px-3 py-1.5 text-xs text-red-400">
                {errorMsg}
              </div>
            )}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              disabled={!isVip}
              placeholder="Channel name"
              className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-text-primary placeholder-text-hint outline-none transition-colors focus:border-primary disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={!isVip || whitelistMutation.isPending}
              className={`rounded-md px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-50 ${
                success === true
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : success === false
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-primary hover:bg-primary-hover'
              }`}
            >
              {whitelistMutation.isPending ? '...' : 'Add'}
            </button>
          </div>
        </div>
      </div>

      <div className="border-t border-border" />

      <div className="py-2">
        <span className="mb-2 block text-sm font-semibold text-text-secondary">Whitelisted</span>
        <div className="flex flex-col gap-1">
          {whitelists.map((w) => (
            <div key={w.id} className="flex items-center justify-between rounded-md bg-surface-elevated px-3 py-1.5">
              <span className="text-sm text-text-primary">{w.channel}</span>
              <button
                type="button"
                onClick={() => handleDelete(w.channel)}
                disabled={deleteMutation.isPending}
                className="text-text-hint transition-colors hover:text-red-400 disabled:opacity-50"
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
                  <title>Remove</title>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
          {whitelists.length === 0 && <p className="py-1 text-xs text-text-hint">No whitelisted channels</p>}
        </div>
      </div>
    </div>
  );
}
