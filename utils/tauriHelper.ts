// utils/tauriHelper.ts

/**
 * Helper to detect if the app is running inside Tauri.
 * Returns true when the Tauri IPC bridge is available.
 * Tauri v2 uses __TAURI_INTERNALS__ instead of __TAURI_IPC__
 */
export const isTauri = (): boolean => {
    if (typeof window === 'undefined') return false;
    return !!(
        (window as any).__TAURI_INTERNALS__ ||
        (window as any).__TAURI__ ||
        (window as any).__TAURI_IPC__
    );
};
