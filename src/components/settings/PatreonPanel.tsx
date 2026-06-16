import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { API_BASE, getToken, useUser } from '../../auth';

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

  if (!user) return null;

  const { patreon } = user;

  const handleVerify = () => {
    setClicked(true);
    verifyMutation.mutate();
    setTimeout(() => setClicked(false), 3000);
  };

  return (
    <div className="max-w-2xl">
      <h2 className="mb-4 text-lg font-semibold text-text-primary">Patreon</h2>

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center gap-4 py-2">
          <span className="w-32 shrink-0 text-sm font-semibold text-text-secondary">Status</span>
          <span className={`text-sm ${patreon.isPatron ? 'text-primary' : 'text-text-hint'}`}>
            {patreon.isPatron ? 'You are a patron!' : 'You are not a patron!'}
          </span>
        </div>

        <div className="border-t border-border" />

        <div className="flex items-center gap-4 py-2">
          <span className="w-32 shrink-0 text-sm font-semibold text-text-secondary">Tier</span>
          <span className="text-sm text-text-primary">{patreon.tierName}</span>
        </div>

        <div className="border-t border-border" />

        <div className="py-3">
          {success === false && (
            <div className="mb-3 rounded-md bg-red-950/50 border border-red-900/50 px-3 py-2 text-xs text-red-400">
              {errorMsg}
            </div>
          )}
          <button
            type="button"
            onClick={handleVerify}
            disabled={clicked || verifyMutation.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {verifyMutation.isPending ? 'Updating...' : 'Update'}
          </button>
        </div>
      </div>
    </div>
  );
}
