import { useMutation, useQueryClient } from '@tanstack/react-query';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { API_BASE, getToken, useUser } from '../../auth';
import { PATREON_OAUTH_URL } from '../../constants/auth';

const PERKS = [
  'Custom badge in Twitch chat',
  'Exclusive Patreon-only perks based on your tier',
  'Help keep Hype free and open source',
];

export default function PatreonPanel() {
  const queryClient = useQueryClient();
  const { data: user } = useUser();
  const [clicked, setClicked] = useState(false);
  const [success, setSuccess] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const accessToken = getToken();
      const res = await fetch(`${API_BASE}/v1/user/verify/patreon`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.error) {
        setSuccess(false);
        setErrorMsg(data.message);
      } else {
        setSuccess(true);
        setErrorMsg('');
        queryClient.invalidateQueries({ queryKey: ['user'] });
      }
    },
    onError: () => {
      setSuccess(false);
      setErrorMsg('Server encountered an error!');
    },
  });

  const patreonConnect = async () => {
    const token = getToken();
    await openUrl(`${PATREON_OAUTH_URL}?token=${token}&client=desktop`);
  };

  if (!user) return null;

  const patreon = user.patreon ?? null;

  const handleVerify = () => {
    setClicked(true);
    verifyMutation.mutate();
    setTimeout(() => setClicked(false), 3000);
  };

  return (
    <div className="max-w-2xl">
      {!patreon ? (
        <div className="rounded-xl border border-border bg-surface p-6">
          <h3 className="mb-1 text-sm font-semibold text-text-primary">Connect Patreon</h3>
          <p className="mb-4 text-xs text-text-secondary">
            Link your Patreon account to unlock exclusive perks and support Hype.
          </p>
          <ul className="mb-4 space-y-1.5">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-center gap-2 text-xs text-text-secondary">
                <Check className="h-3.5 w-3.5 text-primary" />
                <span>{perk}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={patreonConnect}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-hover"
          >
            Connect Patreon
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${patreon.isPatron ? 'bg-green-400' : 'bg-amber-400'}`} />
              <span className={`text-xs ${patreon.isPatron ? 'text-green-400' : 'text-amber-400'}`}>
                {patreon.isPatron ? 'Active Patron' : 'Connected — No Active Tier'}
              </span>
            </div>
            <div className="ml-auto">
              <span className="inline-flex items-center rounded-full border border-border bg-surface-elevated px-2.5 py-0.5 text-xs font-medium text-text-primary">
                {patreon.tierName}
              </span>
            </div>
          </div>

          {success === false && (
            <div className="mb-4 rounded-lg bg-red-950/50 border border-red-900/50 px-3 py-2 text-xs text-red-400">
              {errorMsg}
            </div>
          )}

          <button
            type="button"
            onClick={handleVerify}
            disabled={clicked || verifyMutation.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {verifyMutation.isPending ? 'Updating...' : 'Update'}
          </button>
        </div>
      )}
    </div>
  );
}
