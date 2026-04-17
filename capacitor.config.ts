import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wintak.flipz',
  appName: 'FLIPZ',
  webDir: 'dist',
  plugins: {
    AdMob: {
      appIdAndroid: 'ca-app-pub-3940256099942544~3347511713',
    },
  },
};

export default config;
