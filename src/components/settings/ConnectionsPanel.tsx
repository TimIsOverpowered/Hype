import { openUrl } from '@tauri-apps/plugin-opener';
import { getToken, useUser } from '../../auth';
import { PATREON_OAUTH_URL } from '../../constants/auth';

export default function ConnectionsPanel({ onDisconnect }: { onDisconnect?: () => void }) {
  const { data: user } = useUser();

  const patreonConnect = async () => {
    const token = getToken();
    await openUrl(`${PATREON_OAUTH_URL}?token=${token}&client=desktop`);
  };

  if (!user) return null;

  const patreon = user.patreon ?? null;

  return (
    <div className="max-w-2xl">
      <h2 className="mb-1 text-lg font-semibold text-text-primary">Connections</h2>
      <p className="mb-4 text-xs text-text-hint">Manage your connected accounts and services</p>

      <div className="flex gap-4 rounded-lg border border-border bg-surface p-4">
        <div className="shrink-0 rounded-md bg-surface-elevated p-2">
          <svg viewBox="0 -4.5 256 256" width="32" height="32" fill="currentColor" className="text-primary">
            <title>Patreon</title>
            <path d="M45.1355837,0 L45.1355837,246.35001 L0,246.35001 L0,0 L45.1355837,0 Z M163.657111,0 C214.65668,0 256,41.3433196 256,92.3428889 C256,143.342458 214.65668,184.685778 163.657111,184.685778 C112.657542,184.685778 71.3142222,143.342458 71.3142222,92.3428889 C71.3142222,41.3433196 112.657542,0 163.657111,0 Z" />
          </svg>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-text-primary">Patreon</span>
            {patreon ? (
              <button
                type="button"
                onClick={() => onDisconnect?.()}
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50"
              >
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                onClick={patreonConnect}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                Connect
              </button>
            )}
          </div>
          <p className="text-xs text-text-hint">
            Connect your Patreon account to unlock perks based on your tier. Hype will not publicly display your Patreon
            account information.
          </p>
        </div>
      </div>
    </div>
  );
}
