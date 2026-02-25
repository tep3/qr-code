import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.thaiapp.qrforge',
  appName: 'QR Forge',
  webDir: 'public',
  server: {
    url: 'https://qr-code.thaiapp.com',
    cleartext: true
  }, ios: {
    packageManager: "cocoapods"
  }
};

export default config;
