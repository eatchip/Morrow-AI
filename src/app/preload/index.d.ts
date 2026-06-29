import type { MorrowApi } from '../../shared/ipc';

declare global {
  interface Window {
    /**
     * IPC bridge exposed by preload via contextBridge. 形状定义在 src/shared/ipc.ts。
     */
    morrowApi: MorrowApi;
  }
}
