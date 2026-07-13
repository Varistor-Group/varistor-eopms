import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.varistor.eopms',
  appName: 'EOPMS',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    // Ensure WebView retains localStorage/cookies across restarts
    webContentsDebuggingEnabled: false,
  },
};

export default config;
