import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getVersion } from '@tauri-apps/api/app';
import { openUrl } from '@tauri-apps/plugin-opener';
import { relaunch } from '@tauri-apps/plugin-process';
import { type Update, check } from '@tauri-apps/plugin-updater';
import { Activity, ChevronDown, Info, MessageSquare, RotateCcw, Settings, User, Video, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import hypeLogo from '../../assets/vigor.png';
import { API_BASE, getToken } from '../../auth';
import {
  DEFAULT_CHAT_FONT_FAMILY,
  DEFAULT_CHAT_FONT_SIZE,
  DEFAULT_CHAT_WIDTH,
  DEFAULT_CHAT_WIDTH_MAX,
  DEFAULT_CHAT_WIDTH_MIN,
} from '../../constants/ui';
import { TwitterUrl } from '../../constants/urls';
import { DEFAULT_RENDER_SETTINGS, useChatRenderSettings } from '../../hooks/useChatRenderSettings';
import { useChatSettings } from '../../hooks/useChatSettings';
import { useGraphSettings } from '../../hooks/useGraphSettings';
import type { ChatRenderSettings } from '../../types/settings';
import { ConfirmDialog } from './ConfirmDialog';
import ConnectionsPanel from './ConnectionsPanel';
import PatreonPanel from './PatreonPanel';
import ProfilePanel from './ProfilePanel';

const COMMON_FONTS = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Segoe UI',
  'San Francisco',
  'Helvetica',
  'Arial',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Times New Roman',
  'Georgia',
  'Garamond',
  'Courier New',
  'JetBrains Mono',
  'Fira Code',
  'Consolas',
  'Courier',
  'Comic Sans MS',
];

function FontCombobox({ value, onChange }: { readonly value: string; readonly onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative mt-auto h-10 w-full">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Type or select a font..."
        className="h-full w-full rounded-md border border-border bg-background px-3 pr-8 text-sm text-text-primary outline-none transition-colors focus:border-primary"
      />
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="absolute right-0 top-0 flex h-full w-8 items-center justify-center text-text-secondary transition-colors hover:text-text-primary"
      >
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-xl">
          {COMMON_FONTS.map((font) => (
            <button
              key={font}
              type="button"
              onClick={() => {
                onChange(font);
                setOpen(false);
              }}
              className="block w-full px-3 py-1.5 text-left text-sm text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
              style={{ fontFamily: font }}
            >
              {font}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export type SettingsTabKey = 'account' | 'chat' | 'chat-render' | 'graph' | 'patreon' | 'about';

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
          <div className="border-t border-border p-3">
            <TabButton
              icon={<Info size={18} />}
              label="About"
              active={activeTab === 'about'}
              onClick={() => setActiveTab('about')}
            />
          </div>
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
              {activeTab === 'about' && 'About'}
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
                  <FontCombobox value={chatSettings.fontFamily} onChange={(v) => chatSettings.setFontFamily(v)} />
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

            {activeTab === 'about' && <AboutPanel />}
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
    if (key === 'generateMask' && value === true) {
      nextForm.backgroundColor = '#000000';
    }
    setForm(nextForm);
    onSave({ [key]: value });
    if (key === 'generateMask' && value === true) {
      onSave({ backgroundColor: '#000000' });
    }
  };

  const handleReset = <K extends keyof ChatRenderSettings>(key: K) => {
    handleChange(key, DEFAULT_RENDER_SETTINGS[key]);
  };

  const ResetButton = ({ onClick, disabled }: { readonly onClick: () => void; readonly disabled: boolean }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`ml-auto shrink-0 rounded p-1 transition-colors ${
        disabled
          ? 'cursor-not-allowed text-text-hint opacity-30'
          : 'text-text-hint hover:bg-white/5 hover:text-text-secondary'
      }`}
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
          <div className="flex items-center gap-1 mb-2">
            <label className="text-sm font-medium whitespace-nowrap text-text-secondary">Width (px)</label>
            <ResetButton onClick={() => handleReset('width')} disabled={form.width === DEFAULT_RENDER_SETTINGS.width} />
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
            className="mt-auto w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col rounded-lg border border-border p-4">
          <div className="flex items-center gap-1 mb-2">
            <label className="text-sm font-medium whitespace-nowrap text-text-secondary">Height (px)</label>
            <ResetButton
              onClick={() => handleReset('height')}
              disabled={form.height === DEFAULT_RENDER_SETTINGS.height}
            />
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
            className="mt-auto w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col rounded-lg border border-border p-4">
          <div className="flex items-center gap-1 mb-2">
            <label className="text-sm font-medium whitespace-nowrap text-text-secondary">Framerate (FPS)</label>
            <ResetButton onClick={() => handleReset('fps')} disabled={form.fps === DEFAULT_RENDER_SETTINGS.fps} />
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
            className="mt-auto w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Typography & Background - Spaced out into a 2x2 grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col rounded-lg border border-border p-4">
          <div className="flex items-center gap-1 mb-2">
            <label className="text-sm font-medium whitespace-nowrap text-text-secondary">Font Family</label>
            <ResetButton
              onClick={() => handleReset('fontFamily')}
              disabled={form.fontFamily === DEFAULT_RENDER_SETTINGS.fontFamily}
            />
          </div>
          <FontCombobox value={form.fontFamily || ''} onChange={(v) => handleChange('fontFamily', v)} />
        </div>

        <div className="flex flex-col rounded-lg border border-border p-4">
          <div className="flex items-center gap-1 mb-2">
            <label className="text-sm font-medium whitespace-nowrap text-text-secondary">Font Size (px)</label>
            <ResetButton
              onClick={() => handleReset('fontSize')}
              disabled={form.fontSize === DEFAULT_RENDER_SETTINGS.fontSize}
            />
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
            className="mt-auto h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-text-primary outline-none transition-colors focus:border-primary"
          />
        </div>

        <div className="flex flex-col rounded-lg border border-border p-4">
          <div className="flex items-center gap-1 mb-2">
            <label className="text-sm font-medium whitespace-nowrap text-text-secondary">Font Color</label>
            <ResetButton
              onClick={() => handleReset('fontColor')}
              disabled={form.fontColor === DEFAULT_RENDER_SETTINGS.fontColor}
            />
          </div>
          <div className="flex h-10 w-full items-center rounded-md border border-border bg-background px-2 transition-colors focus-within:border-primary">
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
          <div className="flex items-center gap-1 mb-2">
            <label className="text-sm font-medium whitespace-nowrap text-text-secondary">Background Color</label>
            <ResetButton
              onClick={() => handleReset('backgroundColor')}
              disabled={form.backgroundColor === DEFAULT_RENDER_SETTINGS.backgroundColor}
            />
          </div>
          <div
            className={`flex h-10 w-full items-center rounded-md border border-border bg-background px-2 transition-all ${
              form.generateMask ? 'pointer-events-none opacity-25 grayscale' : 'focus-within:border-primary'
            }`}
          >
            <input
              type="color"
              value={form.backgroundColor}
              onChange={(e) => handleChange('backgroundColor', e.target.value)}
              disabled={form.generateMask}
              className="h-6 w-6 shrink-0 cursor-pointer appearance-none rounded border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-none"
            />
            <input
              type="text"
              value={form.backgroundColor}
              onChange={(e) => handleChange('backgroundColor', e.target.value)}
              disabled={form.generateMask}
              spellCheck={false}
              className="ml-2 w-full bg-transparent text-sm font-medium uppercase text-text-primary outline-none disabled:cursor-not-allowed"
            />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <label className="relative inline-flex cursor-pointer items-center gap-2 text-xs text-text-secondary transition-colors hover:text-text-primary">
              <input
                type="checkbox"
                checked={form.generateMask}
                onChange={(e) => handleChange('generateMask', e.target.checked)}
                className="peer sr-only"
              />
              <div className="h-4 w-7 rounded-full bg-border transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-3 after:w-3 after:rounded-full after:bg-text-secondary after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-3 peer-checked:after:bg-text-primary" />
              <span>Generate Mask</span>
            </label>
            <ResetButton
              onClick={() => handleReset('generateMask')}
              disabled={form.generateMask === DEFAULT_RENDER_SETTINGS.generateMask}
            />
          </div>
          {form.generateMask && (
            <p className="mt-1 text-[11px] text-text-hint">
              Background is forced to black to generate a clean Track Matte.
            </p>
          )}
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
            <ResetButton
              onClick={() => handleReset('showBadges')}
              disabled={form.showBadges === DEFAULT_RENDER_SETTINGS.showBadges}
            />
          </div>
          <div className="flex items-center gap-3 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={form.enable7tv}
              onChange={(e) => handleChange('enable7tv', e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-primary"
            />
            7TV Emotes
            <ResetButton
              onClick={() => handleReset('enable7tv')}
              disabled={form.enable7tv === DEFAULT_RENDER_SETTINGS.enable7tv}
            />
          </div>
          <div className="flex items-center gap-3 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={form.enableBttv}
              onChange={(e) => handleChange('enableBttv', e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-primary"
            />
            BTTV Emotes
            <ResetButton
              onClick={() => handleReset('enableBttv')}
              disabled={form.enableBttv === DEFAULT_RENDER_SETTINGS.enableBttv}
            />
          </div>
          <div className="flex items-center gap-3 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={form.enableFfz}
              onChange={(e) => handleChange('enableFfz', e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-primary"
            />
            FFZ Emotes
            <ResetButton
              onClick={() => handleReset('enableFfz')}
              disabled={form.enableFfz === DEFAULT_RENDER_SETTINGS.enableFfz}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <span className="text-sm font-medium text-text-secondary mb-1">Filters (Comma Separated)</span>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1 text-xs text-text-hint">
              Ignored Users
              <ResetButton
                onClick={() => handleReset('ignoredUsers')}
                disabled={form.ignoredUsers === DEFAULT_RENDER_SETTINGS.ignoredUsers}
              />
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
              <ResetButton
                onClick={() => handleReset('bannedWords')}
                disabled={form.bannedWords === DEFAULT_RENDER_SETTINGS.bannedWords}
              />
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

function AboutPanel() {
  const [version, setVersion] = useState<string>('');
  const [updateStatus, setUpdateStatus] = useState<
    'idle' | 'checking' | 'available' | 'up-to-date' | 'downloading' | 'error'
  >('idle');
  const [updateError, setUpdateError] = useState('');
  const [updateInstance, setUpdateInstance] = useState<Update | null>(null);

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch((e) => console.error('Failed to get app version', e));
  }, []);

  const checkForUpdate = async () => {
    setUpdateStatus('checking');
    setUpdateError('');
    try {
      const update = await check();
      if (update) {
        setUpdateInstance(update);
        setUpdateStatus('available');
      } else {
        setUpdateStatus('up-to-date');
        setTimeout(() => setUpdateStatus('idle'), 3000);
      }
    } catch (err) {
      setUpdateStatus('error');
      setUpdateError(String(err));
    }
  };

  const installUpdate = async () => {
    if (!updateInstance) return;
    setUpdateStatus('downloading');
    try {
      await updateInstance.downloadAndInstall();
      await relaunch();
    } catch (err) {
      setUpdateStatus('error');
      setUpdateError(String(err));
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center space-y-8 pt-8">
      <div className="flex flex-col items-center gap-4">
        <img src={hypeLogo} alt="Hype" className="h-28 w-28 rounded-3xl shadow-2xl" />
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-text-primary">Hype</h2>
          <p className="text-text-secondary">Version {version}</p>
        </div>
      </div>

      <div className="flex w-full flex-col items-center gap-3 rounded-xl border border-border bg-surface p-6 text-center shadow-sm">
        {updateStatus === 'idle' || updateStatus === 'up-to-date' ? (
          <>
            {updateStatus === 'up-to-date' && (
              <p className="text-sm text-text-secondary">Hype is up to date.</p>
            )}
            <button
              type="button"
              onClick={checkForUpdate}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-primary/20 transition-colors hover:bg-primary-hover"
            >
              Check for Updates
            </button>
          </>
        ) : updateStatus === 'checking' ? (
          <div className="flex items-center gap-3 text-sm text-text-secondary">
            <div className="h-4 w-4 animate-spin rounded-full border-[2px] border-primary border-t-transparent" />
            Checking for updates...
          </div>
        ) : updateStatus === 'downloading' ? (
          <div className="flex items-center gap-3 text-sm text-text-secondary">
            <div className="h-4 w-4 animate-spin rounded-full border-[2px] border-primary border-t-transparent" />
            Downloading & Installing...
          </div>
        ) : updateStatus === 'available' ? (
          <>
            <p className="text-sm font-medium text-text-primary">
              New update available: v{updateInstance?.version}
            </p>
            <button
              type="button"
              onClick={installUpdate}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-primary/20 transition-colors hover:bg-primary-hover"
            >
              Download & Install
            </button>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-red-400">Failed to check for updates</p>
            <p className="max-w-full truncate px-4 text-xs text-text-hint">{updateError}</p>
            <button
              type="button"
              onClick={checkForUpdate}
              className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-md shadow-primary/20 transition-colors hover:bg-primary-hover"
            >
              Try Again
            </button>
          </>
        )}
      </div>

      <div className="flex w-full items-center justify-center gap-4 text-sm text-text-hint">
        <button
          type="button"
          onClick={() => openUrl('https://github.com/timisoverpowered/hype')}
          className="transition-colors hover:text-text-primary hover:underline"
        >
          GitHub
        </button>
        <span>&bull;</span>
        <span className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => openUrl(TwitterUrl)}
            className="font-medium text-text-secondary transition-colors hover:text-primary hover:underline"
          >
            made by op with ♥
          </button>
        </span>
      </div>
    </div>
  );
}
