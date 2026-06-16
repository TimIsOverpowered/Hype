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
    </div>
  );
}
