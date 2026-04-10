import { registerPlugin } from '@capacitor/core';

export interface MicrophonePermissionResult {
  granted: boolean;
  status: string;
}

export interface MicrophonePermissionPlugin {
  check(): Promise<MicrophonePermissionResult>;
  request(): Promise<MicrophonePermissionResult>;
}

export const MicrophonePermission = registerPlugin<MicrophonePermissionPlugin>(
  'MicrophonePermission'
);

