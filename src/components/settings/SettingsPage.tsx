import { useNavigate, useParams } from 'react-router-dom';
import { useUser } from '../../auth';
import ConnectionsPanel from './ConnectionsPanel';
import PatreonPanel from './PatreonPanel';
import ProfilePanel from './ProfilePanel';

const TABS = [
  { key: 'profile', label: 'Profile' },
  { key: 'connections', label: 'Connections' },
  { key: 'patreon', label: 'Patreon' },
] as const;

export default function SettingsPage() {
  const navigate = useNavigate();
  const { subPath } = useParams() as { subPath?: string };
  const { data: user } = useUser();

  if (!user) return null;

  const activeTab = subPath || 'profile';

  const showPatreonTab = user.patreon?.isPatron;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-6">
      <h1 className="mb-4 text-2xl font-semibold text-text-primary">Profile</h1>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-border">
        {TABS.map((tab) => {
          if (tab.key === 'patreon' && !showPatreonTab) return null;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => navigate(`/profile/${tab.key}`, { replace: true })}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'text-primary' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.label}
              {isActive && <div className="absolute bottom-0 left-0 right-0 h-px bg-primary" />}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 py-4">
        {activeTab === 'profile' && <ProfilePanel />}
        {activeTab === 'connections' && <ConnectionsPanel />}
        {activeTab === 'patreon' && showPatreonTab && <PatreonPanel />}
      </div>
    </div>
  );
}
