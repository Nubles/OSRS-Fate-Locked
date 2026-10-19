/// <reference types="vite/client" />

/** Build id baked in by vite.config.ts (also written to version.json). */
declare const __BUILD_ID__: string;

interface ImportMetaEnv {
  /** Local testing only: the tracker's old and new addresses (config/trackerAddress.ts). */
  readonly VITE_OLD_TRACKER_URL?: string;
  readonly VITE_NEW_TRACKER_URL?: string;
}
