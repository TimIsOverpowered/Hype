import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';
import { useCallback, useState } from 'react';
import { useUser } from '../../auth';
import WhitelistPanel from './WhitelistPanel';

function UserInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 py-2">
      <span className="w-32 shrink-0 text-sm font-semibold text-text-secondary">{label}</span>
      <span className="text-sm text-text-primary">{value}</span>
    </div>
  );
}

function CheckUpdatesButton() {
  const [checking, setChecking] = useState(false);
  const [done, setDone] = useState(false);

  const handleCheck = useCallback(async () => {
    setChecking(true);
    setDone(false);
    try {
      const update = await check();
      if (update?.available) {
        await update.downloadAndInstall((_event) => {
          // progress tracking
        });
        await relaunch();
      } else {
        setDone(true);
        setTimeout(() => setDone(false), 3000);
      }
    } catch {
      // update check failed
    } finally {
      setChecking(false);
    }
  }, []);

  return (
    <button
      type="button"
      onClick={handleCheck}
      disabled={checking}
      className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
    >
      {checking ? 'Checking...' : done ? 'Up to date' : 'Check for Updates'}
    </button>
  );
}

export default function ProfilePanel() {
  const { data: user } = useUser();

  if (!user) return null;

  const isVip = (user.patreon && user.patreon.tier >= 1 && user.patreon.isPatron) || user.whitelist || user.admin;

  return (
    <div className="max-w-2xl">
      <div className="rounded-lg border border-border bg-surface p-4">
        <UserInfoRow label="Username" value={user.display_name} />
        <div className="border-t border-border" />
        <UserInfoRow label="Status" value={isVip ? 'VIP' : 'Free'} />
      </div>

      <div className="mt-6">
        <WhitelistPanel />
      </div>

      <div className="mt-6">
        <CheckUpdatesButton />
      </div>
    </div>
  );
}
