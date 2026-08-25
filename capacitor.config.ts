import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wintak.flipz',
  appName: 'FLIPZ',
  webDir: 'dist',
  plugins: {
    AdMob: {
      appIdAndroid: 'ca-app-pub-6340983480597130~9251933354',
      appIdIos: 'ca-app-pub-6340983480597130~9251933354',
    },
  },
};

export default config;
