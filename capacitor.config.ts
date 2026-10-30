import type { CapacitorConfig } from '@capacitor/cli';

// TapIN2Events phone apps (Capacitor), replacing the Twinr-wrapped apps as updates to the same store listings.
// - iPhone Bundle ID: net.tapin2events (appId below). Android package: net.tapin2events.app (set in
//   android/app/build.gradle as applicationId), matching the existing Google Play listing.
// - The apps load the live site, app.tapin2events.com, the same address the Twinr apps use, so a person's sign-in
//   and saved settings stay with them when the app updates, and website updates reach the apps instantly.
const config: CapacitorConfig = {
  appId: 'net.tapin2events',
  appName: 'TapIN2Events',
  webDir: 'dist',
  server: {
    url: 'https://app.tapin2events.com',
    cleartext: false,
    // Stripe checkout and Stripe payouts setup open inside the app.
    allowNavigation: ['app.tapin2events.com', '*.tapin2events.com', 'checkout.stripe.com', 'connect.stripe.com'],
  },
  plugins: {
    SplashScreen: { launchShowDuration: 1200, launchAutoHide: true, backgroundColor: '#4F46E5', showSpinner: false },
  },
  ios: { contentInset: 'never', limitsNavigationsToAppBoundDomains: false },
  android: { allowMixedContent: false },
};

export default config;
