import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cardquest.flipz',
  appName: 'FLIPZ',
  webDir: 'dist',
  plugins: {
    AdMob: {
      appIdAndroid: 'ca-app-pub-3940256099942544~3347511713',
      appIdIos: 'ca-app-pub-6340983480597130~7855353560',
    },
  },
};

export default config;
