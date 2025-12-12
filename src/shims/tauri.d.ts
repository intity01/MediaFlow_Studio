declare module '@tauri-apps/api/dialog' {
    export interface OpenDialogOptions {
        directory?: boolean;
        multiple?: boolean;
        defaultPath?: string;
        title?: string;
        filters?: { name: string; extensions: string[] }[];
    }
    export function open(options?: OpenDialogOptions): Promise<null | string | string[]>;
}

declare module '@tauri-apps/plugin-store' {
    export const store: {
        get(key: string): Promise<string | null>;
        set(key: string, value: string): Promise<void>;
        save(): Promise<void>;
    };
}
