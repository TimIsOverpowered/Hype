import { useState } from 'react';

interface ConfirmConfig {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface ConfirmState {
  config: ConfirmConfig | null;
  resolve: ((value: boolean) => void) | null;
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({ config: null, resolve: null });

  const showConfirm = (config: ConfirmConfig): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ config, resolve: () => resolve(true) });
    });
  };

  const handleCancel = () => {
    setState({ config: null, resolve: null });
  };

  const handleConfirm = () => {
    state.resolve?.(true);
    setState({ config: null, resolve: null });
  };

  return { showConfirm, handleConfirm, handleCancel, config: state.config };
}

export function ConfirmDialog({
  config,
  onConfirm,
  onCancel,
}: {
  config: ConfirmConfig;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
      <div
        className="absolute inset-0 bg-black/60"
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
      />
      <div className="relative z-10 w-full max-w-[340px] rounded-lg border border-border bg-surface p-6">
        <h3 className="mb-2 text-center text-lg font-semibold text-text-primary">{config.title}</h3>
        <p className="mb-6 text-center text-sm text-text-secondary">{config.message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded border border-border bg-background px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-background/80"
          >
            {config.cancelLabel ?? 'Cancel'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-500"
          >
            {config.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
