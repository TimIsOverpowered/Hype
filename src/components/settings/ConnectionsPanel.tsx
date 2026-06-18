import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getToken, useUser } from '../../auth';
import { API_BASE } from '../../constants/api';
import { PATREON_OAUTH_URL } from '../../constants/auth';

function ConnectionCard({
  icon,
  title,
  description,
  connected,
  onConnect,
  onDisconnect,
  isPending,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  connected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  isPending: boolean;
}) {
  return (
    <div className="flex gap-4 rounded-lg border border-border bg-surface p-4">
      <div className="shrink-0 rounded-md bg-surface-elevated p-2">{icon}</div>
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-text-primary">{title}</span>
          {connected ? (
            <button
              type="button"
              onClick={onDisconnect}
              disabled={isPending}
              className="rounded-md bg-surface-elevated px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary disabled:opacity-50"
            >
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              onClick={onConnect}
              disabled={isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              Connect
            </button>
          )}
        </div>
        <p className="text-xs text-text-hint">{description}</p>
      </div>
    </div>
  );
}

export default function ConnectionsPanel() {
  const { data: user } = useUser();
  const queryClient = useQueryClient();

  const patreonConnect = () => {
    const token = getToken();
    window.open(`${PATREON_OAUTH_URL}?token=${token}&client=desktop`, '_blank');
  };

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const accessToken = getToken();
      const res = await fetch(`${API_BASE}/v1/user/patreon`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
    onError: (err) => {
      console.error(err);
    },
  });

  if (!user) return null;

  const patreon = user.patreon ?? null;

  return (
    <div className="max-w-2xl">
      <h2 className="mb-1 text-lg font-semibold text-text-primary">Connections</h2>
      <p className="mb-4 text-xs text-text-hint">Manage your connected accounts and services</p>

      <ConnectionCard
        icon={
          <svg viewBox="0 -4.5 256 256" width="32" height="32" fill="currentColor" className="text-primary">
            <title>Patreon</title>
            <path d="M45.1355837,0 L45.1355837,246.35001 L0,246.35001 L0,0 L45.1355837,0 Z M163.657111,0 C214.65668,0 256,41.3433196 256,92.3428889 C256,143.342458 214.65668,184.685778 163.657111,184.685778 C112.657542,184.685778 71.3142222,143.342458 71.3142222,92.3428889 C71.3142222,41.3433196 112.657542,0 163.657111,0 Z" />
          </svg>
        }
        title="Patreon"
        description="Connect your Patreon account to unlock perks based on your tier. Hype will not publicly display your Patreon account information."
        connected={patreon?.isPatron ?? false}
        onConnect={patreonConnect}
        onDisconnect={() => disconnectMutation.mutate()}
        isPending={disconnectMutation.isPending}
      />
    </div>
  );
}
