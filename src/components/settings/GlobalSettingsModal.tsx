import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, MessageSquare, RotateCcw, Settings, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { API_BASE, getToken } from '../../auth';
import { DEFAULT_CHAT_WIDTH_MAX, DEFAULT_CHAT_WIDTH_MIN } from '../../constants/ui';
import { useChatSettings } from '../../hooks/useChatSettings';
import { useGraphSettings } from '../../hooks/useGraphSettings';
import { ConfirmDialog } from './ConfirmDialog';
import ConnectionsPanel from './ConnectionsPanel';
import PatreonPanel from './PatreonPanel';
import ProfilePanel from './ProfilePanel';

const FONT_OPTIONS = [
  { label: 'System Sans', value: 'ui-sans-serif, system-ui, -apple-system, sans-serif' },
  { label: 'Inter', value: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif' },
  { label: 'Roboto', value: 'Roboto, ui-sans-serif, system-ui, -apple-system, sans-serif' },
  { label: 'SF Pro', value: 'SF Pro Display, -apple-system, BlinkMacSystemFont, sans-serif' },
  { label: 'Source Sans 3', value: 'Source Sans 3, ui-sans-serif, system-ui, -apple-system, sans-serif' },
  { label: 'JetBrains Mono', value: 'JetBrains Mono, ui-monospace, Caskaydia Cove, monospace' },
  { label: 'SF Mono', value: 'SF Mono, ui-monospace, Cascadia Code, monospace' },
  { label: 'IBM Plex Mono', value: 'IBM Plex Mono, ui-monospace, monospace' },
  { label: 'Georgia (Serif)', value: 'Georgia, ui-serif, serif' },
  { label: 'System Serif', value: 'ui-serif, Georgia, Cambria, serif' },
];

export type SettingsTabKey = 'account' | 'chat' | 'graph' | 'patreon';

interface GlobalSettingsModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly initialTab?: SettingsTabKey;
}

export default function GlobalSettingsModal({ open, onClose, initialTab = 'account' }: GlobalSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabKey>(initialTab);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const queryClient = useQueryClient();

  const chatSettings = useChatSettings();
  const graphSettings = useGraphSettings();

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
  });

  useEffect(() => {
    if (open) setActiveTab(initialTab);
  }, [open, initialTab]);

  if (!open) return null;

  const handleResetAll = () => {
    if (activeTab === 'chat') chatSettings.resetAll();
    if (activeTab === 'graph') graphSettings.resetAll();
    setShowResetConfirm(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-[650px] max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar */}
        <div className="flex w-64 flex-col border-r border-border bg-surface">
          <div className="border-b border-border p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
              <Settings className="h-5 w-5" />
              Settings
            </h2>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            <TabButton
              icon={<User size={18} />}
              label="Account"
              active={activeTab === 'account'}
              onClick={() => setActiveTab('account')}
            />
            <TabButton
              icon={
                <svg viewBox="0 -4.5 256 256" width="18" height="18" fill="currentColor">
                  <title>Patreon</title>
                  <path d="M45.1355837,0 L45.1355837,246.35001 L0,246.35001 L0,0 L45.1355837,0 Z M163.657111,0 C214.65668,0 256,41.3433196 256,92.3428889 C256,143.342458 214.65668,184.685778 163.657111,184.685778 C112.657542,184.685778 71.3142222,143.342458 71.3142222,92.3428889 C71.3142222,41.3433196 112.657542,0 163.657111,0 Z" />
                </svg>
              }
              label="Patreon"
              active={activeTab === 'patreon'}
              onClick={() => setActiveTab('patreon')}
            />
            <TabButton
              icon={<MessageSquare size={18} />}
              label="Chat Overlay"
              active={activeTab === 'chat'}
              onClick={() => setActiveTab('chat')}
            />
            <TabButton
              icon={<Activity size={18} />}
              label="Graph & Insights"
              active={activeTab === 'graph'}
              onClick={() => setActiveTab('graph')}
            />
          </nav>
        </div>

        {/* Content Area */}
        <div className="relative flex flex-1 flex-col bg-background">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-8 py-5">
            <h3 className="text-base font-medium text-text-primary">
              {activeTab === 'account' && 'Account Settings'}
              {activeTab === 'chat' && 'Chat Overlay Settings'}
              {activeTab === 'graph' && 'Graph & Insights Settings'}
              {activeTab === 'patreon' && 'Patreon'}
            </h3>
            <div className="flex items-center gap-2">
              {(activeTab === 'chat' || activeTab === 'graph') && (
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  className="rounded-md p-2 text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
                  title="Reset to defaults"
                >
                  <RotateCcw size={18} />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-2 text-text-secondary transition-colors hover:bg-red-500/20 hover:text-red-400"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-8">
            {activeTab === 'account' && (
              <div className="mx-auto max-w-2xl space-y-10">
                <ProfilePanel />
                <ConnectionsPanel onDisconnect={() => setShowDisconnectConfirm(true)} />
              </div>
            )}

            {activeTab === 'patreon' && <PatreonPanel />}

            {activeTab === 'chat' && (
              <div className="mx-auto max-w-2xl space-y-6">
                <div className="rounded-lg border border-border p-4">
                  <label className="mb-2 block text-sm font-medium text-text-secondary">Font Family</label>
                  <select
                    value={chatSettings.fontFamily}
                    onChange={(e) => chatSettings.setFontFamily(e.target.value)}
                    className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
                  >
                    {FONT_OPTIONS.map((font) => (
                      <option key={font.value} value={font.value}>
                        {font.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-lg border border-border p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <label className="text-sm font-medium text-text-secondary">Font Size</label>
                    <span className="text-sm font-bold text-text-primary">{chatSettings.messageFontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={24}
                    step={1}
                    value={chatSettings.messageFontSize}
                    onChange={(e) => chatSettings.setMessageFontSize(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="rounded-lg border border-border p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <label className="text-sm font-medium text-text-secondary">Overlay Width</label>
                    <span className="text-sm font-bold text-text-primary">{chatSettings.chatWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min={DEFAULT_CHAT_WIDTH_MIN}
                    max={DEFAULT_CHAT_WIDTH_MAX}
                    step={5}
                    value={chatSettings.chatWidth}
                    onChange={(e) => chatSettings.setChatWidth(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>

                <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
                  <label className="flex cursor-pointer items-center gap-3 text-sm text-text-primary">
                    <input
                      type="checkbox"
                      checked={chatSettings.showTimestamp}
                      onChange={() => chatSettings.setShowTimestamp(!chatSettings.showTimestamp)}
                      className="h-4 w-4 cursor-pointer accent-primary"
                    />
                    Show Timestamps
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 text-sm text-text-primary">
                    <input
                      type="checkbox"
                      checked={chatSettings.chatOnLeft}
                      onChange={() => chatSettings.setChatOnLeft(!chatSettings.chatOnLeft)}
                      className="h-4 w-4 cursor-pointer accent-primary"
                    />
                    Align Chat to Left Side
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'graph' && (
              <div className="mx-auto max-w-2xl space-y-6">
                <div className="rounded-lg border border-border p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <label className="text-sm font-medium text-text-secondary">Polling Interval</label>
                    <span className="text-sm font-bold text-text-primary">{graphSettings.interval}s</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={60}
                    step={5}
                    value={graphSettings.interval}
                    onChange={(e) => graphSettings.setInterval(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <p className="mt-3 text-xs text-text-hint">
                    How many seconds of chat data to bundle into a single graph point.
                  </p>
                </div>

                <div className="rounded-lg border border-border p-4">
                  <label className="mb-2 block text-sm font-medium text-text-secondary">Message Threshold</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="Auto"
                      value={graphSettings.messageThreshold ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '') return graphSettings.setMessageThreshold(null);
                        const num = Number(v);
                        if (Number.isFinite(num) && num > 0) graphSettings.setMessageThreshold(num);
                      }}
                      className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
                    />
                    <span className="shrink-0 text-sm text-text-secondary">msgs</span>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4">
                  <label className="mb-2 block text-sm font-medium text-text-secondary">Search Threshold</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="1"
                      value={graphSettings.searchThreshold ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '') return graphSettings.setSearchThreshold(null);
                        const num = Number(v);
                        if (Number.isFinite(num) && num > 0) graphSettings.setSearchThreshold(num);
                      }}
                      className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
                    />
                    <span className="shrink-0 text-sm text-text-secondary">hits</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showResetConfirm && (
        <ConfirmDialog
          config={{
            title: 'Reset Defaults?',
            message: `This will reset your ${activeTab} settings back to their factory default values.`,
            confirmLabel: 'Reset',
          }}
          onConfirm={handleResetAll}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}

      {showDisconnectConfirm && (
        <ConfirmDialog
          config={{
            title: 'Disconnect Patreon?',
            message: 'Are you sure you want to disconnect your Patreon account?',
            confirmLabel: 'Disconnect',
          }}
          onConfirm={() => {
            disconnectMutation.mutate();
            setShowDisconnectConfirm(false);
          }}
          onCancel={() => setShowDisconnectConfirm(false)}
        />
      )}
    </div>
  );
}

function TabButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        active ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
