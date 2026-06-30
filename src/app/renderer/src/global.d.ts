import type { MorrowApi } from '../../../shared/ipc';

declare global {
  interface Window {
    morrowApi: MorrowApi;
  }
}
