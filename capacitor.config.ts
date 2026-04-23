import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.argosx.app',
  appName: 'Argos X',
  webDir: 'dist',
  server: {
    url: 'https://e545c249-ee69-43b7-a4a7-f7a5b616fe83.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#0F172A'
  }
};

export default config;
