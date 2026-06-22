import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, MessageSquare, RotateCcw, Settings, User, Video, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { API_BASE, getToken } from '../../auth';
import {
  DEFAULT_CHAT_FONT_FAMILY,
  DEFAULT_CHAT_FONT_SIZE,
  DEFAULT_CHAT_WIDTH,
  DEFAULT_CHAT_WIDTH_MAX,
  DEFAULT_CHAT_WIDTH_MIN,
} from '../../constants/ui';
import { DEFAULT_RENDER_SETTINGS, useChatRenderSettings } from '../../hooks/useChatRenderSettings';
import { useChatSettings } from '../../hooks/useChatSettings';
import { useGraphSettings } from '../../hooks/useGraphSettings';
import type { ChatRenderSettings } from '../../types/settings';
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

export type SettingsTabKey = 'account' | 'chat' | 'chat-render' | 'graph' | 'patreon';

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
  const location = useLocation();
  const isVodActive = location.pathname.includes('/vod/');
  const chatSettings = useChatSettings();
  const chatRenderSettings = useChatRenderSettings();
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
    if (activeTab === 'chat-render') chatRenderSettings.resetAll();
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
              label="Chat Replay"
              active={activeTab === 'chat'}
              onClick={() => setActiveTab('chat')}
            />
            <TabButton
              icon={<Video size={18} />}
              label="Chat Renderer"
              active={activeTab === 'chat-render'}
              onClick={() => setActiveTab('chat-render')}
            />
            <TabButton
              icon={<Activity size={18} />}
              label="Graph"
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
              {activeTab === 'chat' && 'Chat Replay Settings'}
              {activeTab === 'chat-render' && 'Chat Renderer Settings'}
              {activeTab === 'graph' && 'Graph Settings'}
              {activeTab === 'patreon' && 'Patreon'}
            </h3>
            <div className="flex items-center gap-2">
              {(activeTab === 'chat' || activeTab === 'chat-render' || activeTab === 'graph') && (
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
                <div className="flex flex-col rounded-lg border border-border p-4">
                  <div className="flex items-center gap-1">
                    <label className="text-sm font-medium text-text-secondary">Font Family</label>
                    <button
                      type="button"
                      onClick={chatSettings.resetFontFamily}
                      className={`ml-auto shrink-0 rounded p-1 transition-colors ${
                        chatSettings.fontFamily === DEFAULT_CHAT_FONT_FAMILY
                          ? 'cursor-not-allowed text-text-hint opacity-30'
                          : 'hover:bg-white/5 hover:text-text-secondary'
                      }`}
                      title="Reset to default"
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>
                  <select
                    value={chatSettings.fontFamily}
                    onChange={(e) => chatSettings.setFontFamily(e.target.value)}
                    className="mt-2 w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
                  >
                    {FONT_OPTIONS.map((font) => (
                      <option key={font.value} value={font.value}>
                        {font.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col rounded-lg border border-border p-4">
                  <div className="mb-4 flex items-center gap-1">
                    <label className="text-sm font-medium text-text-secondary">Font Size</label>
                    <button
                      type="button"
                      onClick={chatSettings.resetMessageFontSize}
                      className={`ml-auto shrink-0 rounded p-1 transition-colors ${
                        chatSettings.messageFontSize === DEFAULT_CHAT_FONT_SIZE
                          ? 'cursor-not-allowed text-text-hint opacity-30'
                          : 'hover:bg-white/5 hover:text-text-secondary'
                      }`}
                      title="Reset to default"
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>
                  <span className="mb-2 text-sm font-bold text-text-primary">{chatSettings.messageFontSize}px</span>
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

                <div className="flex flex-col rounded-lg border border-border p-4">
                  <div className="mb-4 flex items-center gap-1">
                    <label className="text-sm font-medium text-text-secondary">Chat Width</label>
                    <button
                      type="button"
                      onClick={chatSettings.resetChatWidth}
                      className={`ml-auto shrink-0 rounded p-1 transition-colors ${
                        chatSettings.chatWidth === DEFAULT_CHAT_WIDTH
                          ? 'cursor-not-allowed text-text-hint opacity-30'
                          : 'hover:bg-white/5 hover:text-text-secondary'
                      }`}
                      title="Reset to default"
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>
                  <span className="mb-2 text-sm font-bold text-text-primary">{chatSettings.chatWidth}px</span>
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
                  <div className="flex items-center gap-3 text-sm text-text-primary">
                    <input
                      type="checkbox"
                      checked={chatSettings.showTimestamp}
                      onChange={() => chatSettings.setShowTimestamp(!chatSettings.showTimestamp)}
                      className="h-4 w-4 cursor-pointer accent-primary"
                    />
                    Show Timestamps
                    <button
                      type="button"
                      onClick={chatSettings.resetShowTimestamp}
                      className={`ml-auto shrink-0 rounded p-1 transition-colors ${
                        chatSettings.showTimestamp === false
                          ? 'cursor-not-allowed text-text-hint opacity-30'
                          : 'hover:bg-white/5 hover:text-text-secondary'
                      }`}
                      title="Reset to default"
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-text-primary">
                    <input
                      type="checkbox"
                      checked={chatSettings.chatOnLeft}
                      onChange={() => chatSettings.setChatOnLeft(!chatSettings.chatOnLeft)}
                      className="h-4 w-4 cursor-pointer accent-primary"
                    />
                    Align Chat to Left Side
                    <button
                      type="button"
                      onClick={chatSettings.resetChatOnLeft}
                      className={`ml-auto shrink-0 rounded p-1 transition-colors ${
                        chatSettings.chatOnLeft === false
                          ? 'cursor-not-allowed text-text-hint opacity-30'
                          : 'hover:bg-white/5 hover:text-text-secondary'
                      }`}
                      title="Reset to default"
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'chat-render' && (
              <RenderSettingsTabContent
                settings={chatRenderSettings.settings}
                onSave={chatRenderSettings.persistSettings}
              />
            )}

            {activeTab === 'graph' && (
              <div className="mx-auto max-w-2xl space-y-6">
                <div className="flex flex-col rounded-lg border border-border p-4">
                  <div className="mb-4 flex items-center gap-1">
                    <label className="text-sm font-medium text-text-secondary">Polling Interval</label>
                    <button
                      type="button"
                      onClick={graphSettings.resetInterval}
                      className={`ml-auto shrink-0 rounded p-1 transition-colors ${
                        graphSettings.interval === 30
                          ? 'cursor-not-allowed text-text-hint opacity-30'
                          : 'hover:bg-white/5 hover:text-text-secondary'
                      }`}
                      title="Reset to default"
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>
                  <span className="mb-2 text-sm font-bold text-text-primary">{graphSettings.interval}s</span>
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

                <div className="flex flex-col rounded-lg border border-border p-4">
                  <div className="flex items-center gap-1">
                    <label className="text-sm font-medium text-text-secondary">Message Threshold</label>
                    <button
                      type="button"
                      onClick={graphSettings.resetMessageThreshold}
                      className={`ml-auto shrink-0 rounded p-1 transition-colors ${
                        graphSettings.messageThreshold === null
                          ? 'cursor-not-allowed text-text-hint opacity-30'
                          : 'hover:bg-white/5 hover:text-text-secondary'
                      }`}
                      title="Reset to default"
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder={isVodActive ? String(graphSettings.effectiveMessageThreshold ?? '') : 'Auto'}
                      value={
                        graphSettings.messageThreshold ??
                        (isVodActive ? (graphSettings.effectiveMessageThreshold ?? '') : '')
                      }
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
                  <p className="mt-3 text-xs text-text-hint">
                    Minimum messages per interval before the graph point is plotted.
                  </p>
                </div>

                <div className="flex flex-col rounded-lg border border-border p-4">
                  <div className="flex items-center gap-1">
                    <label className="text-sm font-medium text-text-secondary">Search Threshold</label>
                    <button
                      type="button"
                      onClick={graphSettings.resetSearchThreshold}
                      className={`ml-auto shrink-0 rounded p-1 transition-colors ${
                        graphSettings.searchThreshold === null
                          ? 'cursor-not-allowed text-text-hint opacity-30'
                          : 'hover:bg-white/5 hover:text-text-secondary'
                      }`}
                      title="Reset to default"
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder={isVodActive ? String(graphSettings.effectiveSearchThreshold ?? '') : 'Auto'}
                      value={
                        graphSettings.searchThreshold ??
                        (isVodActive ? (graphSettings.effectiveSearchThreshold ?? '') : '')
                      }
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
                  <p className="mt-3 text-xs text-text-hint">
                    Minimum search hits per interval before the graph point is plotted.
                  </p>
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

function RenderSettingsTabContent({
  settings,
  onSave,
}: {
  readonly settings: ChatRenderSettings;
  readonly onSave: (updates: Partial<ChatRenderSettings>) => void;
}) {
  const [form, setForm] = useState<ChatRenderSettings>(settings);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleChange = <K extends keyof ChatRenderSettings>(key: K, value: ChatRenderSettings[K]) => {
    const nextForm = { ...form, [key]: value };
    setForm(nextForm);
    onSave({ [key]: value });
  };

  const handleReset = <K extends keyof ChatRenderSettings>(key: K) => {
    handleChange(key, DEFAULT_RENDER_SETTINGS[key]);
  };

  const ResetButton = ({ onClick }: { readonly onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className="ml-auto shrink-0 rounded p-1 text-text-hint transition-colors hover:bg-white/5 hover:text-text-secondary"
      title="Reset to default"
    >
      <RotateCcw size={12} />
    </button>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Dimensions & Framerate */}
      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col rounded-lg border border-border p-4">
          <div className="flex items-center gap-1">
            <label className="text-sm font-medium text-text-secondary">Width (px)</label>
            <ResetButton onClick={() => handleReset('width')} />
          </div>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={form.width || ''}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, '');
              handleChange('width', val ? Number(val) : 0);
            }}
            className="mt-2 w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col rounded-lg border border-border p-4">
          <div className="flex items-center gap-1">
            <label className="text-sm font-medium text-text-secondary">Height (px)</label>
            <ResetButton onClick={() => handleReset('height')} />
          </div>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={form.height || ''}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, '');
              handleChange('height', val ? Number(val) : 0);
            }}
            className="mt-2 w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col rounded-lg border border-border p-4">
          <div className="flex items-center gap-1">
            <label className="text-sm font-medium text-text-secondary">Framerate (FPS)</label>
            <ResetButton onClick={() => handleReset('fps')} />
          </div>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={form.fps || ''}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, '');
              handleChange('fps', val ? Number(val) : 0);
            }}
            className="mt-2 w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Typography & Background ROW */}
      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col rounded-lg border border-border p-4">
          <div className="flex items-center gap-1">
            <label className="text-sm font-medium text-text-secondary">Font Size (px)</label>
            <ResetButton onClick={() => handleReset('fontSize')} />
          </div>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={form.fontSize || ''}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, '');
              handleChange('fontSize', val ? Number(val) : 0);
            }}
            className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-text-primary outline-none transition-colors focus:border-primary"
          />
        </div>

        <div className="flex flex-col rounded-lg border border-border p-4">
          <div className="flex items-center gap-1">
            <label className="text-sm font-medium text-text-secondary">Font Color</label>
            <ResetButton onClick={() => handleReset('fontColor')} />
          </div>
          <div className="flex h-10 w-full items-center rounded-md border border-border bg-background px-2 transition-colors focus-within:border-primary mt-2">
            <input
              type="color"
              value={form.fontColor}
              onChange={(e) => handleChange('fontColor', e.target.value)}
              className="h-6 w-6 shrink-0 cursor-pointer appearance-none rounded border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-none"
            />
            <input
              type="text"
              value={form.fontColor}
              onChange={(e) => handleChange('fontColor', e.target.value)}
              spellCheck={false}
              className="ml-2 w-full bg-transparent text-sm font-medium uppercase text-text-primary outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col rounded-lg border border-border p-4">
          <div className="flex items-center gap-1">
            <label className="text-sm font-medium text-text-secondary">Background</label>
            <ResetButton onClick={() => handleReset('backgroundColor')} />
          </div>
          <div
            className={`flex h-10 w-full items-center rounded-md border border-border bg-background px-2 transition-all ${
              form.transparentBackground ? 'pointer-events-none opacity-25 grayscale' : 'focus-within:border-primary'
            } mt-2`}
          >
            <input
              type="color"
              value={form.backgroundColor}
              onChange={(e) => handleChange('backgroundColor', e.target.value)}
              disabled={form.transparentBackground}
              className="h-6 w-6 shrink-0 cursor-pointer appearance-none rounded border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-none"
            />
            <input
              type="text"
              value={form.backgroundColor}
              onChange={(e) => handleChange('backgroundColor', e.target.value)}
              disabled={form.transparentBackground}
              spellCheck={false}
              className="ml-2 w-full bg-transparent text-sm font-medium uppercase text-text-primary outline-none disabled:cursor-not-allowed"
            />
          </div>
          <div className="flex items-center gap-3 text-sm text-text-primary mt-3">
            <input
              type="checkbox"
              checked={form.transparentBackground}
              onChange={(e) => handleChange('transparentBackground', e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-primary"
            />
            Transparent
            <ResetButton onClick={() => handleReset('transparentBackground')} />
          </div>
        </div>
      </div>

      {/* Feature Configuration & Filter Lists */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <span className="text-sm font-medium text-text-secondary mb-1">Emotes &amp; Badges</span>
          <div className="flex items-center gap-3 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={form.showBadges}
              onChange={(e) => handleChange('showBadges', e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-primary"
            />
            Chat Badges
            <ResetButton onClick={() => handleReset('showBadges')} />
          </div>
          <div className="flex items-center gap-3 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={form.enable7tv}
              onChange={(e) => handleChange('enable7tv', e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-primary"
            />
            7TV Emotes
            <ResetButton onClick={() => handleReset('enable7tv')} />
          </div>
          <div className="flex items-center gap-3 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={form.enableBttv}
              onChange={(e) => handleChange('enableBttv', e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-primary"
            />
            BTTV Emotes
            <ResetButton onClick={() => handleReset('enableBttv')} />
          </div>
          <div className="flex items-center gap-3 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={form.enableFfz}
              onChange={(e) => handleChange('enableFfz', e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-primary"
            />
            FFZ Emotes
            <ResetButton onClick={() => handleReset('enableFfz')} />
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <span className="text-sm font-medium text-text-secondary mb-1">Filters (Comma Separated)</span>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1 text-xs text-text-hint">
              Ignored Users
              <ResetButton onClick={() => handleReset('ignoredUsers')} />
            </label>
            <input
              type="text"
              value={form.ignoredUsers}
              onChange={(e) => handleChange('ignoredUsers', e.target.value)}
              className="w-full rounded border border-border bg-surface px-2 py-1.5 text-xs text-text-primary outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1.5 mt-2">
            <label className="flex items-center gap-1 text-xs text-text-hint">
              Banned Words
              <ResetButton onClick={() => handleReset('bannedWords')} />
            </label>
            <input
              type="text"
              value={form.bannedWords}
              onChange={(e) => handleChange('bannedWords', e.target.value)}
              className="w-full rounded border border-border bg-surface px-2 py-1.5 text-xs text-text-primary outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
