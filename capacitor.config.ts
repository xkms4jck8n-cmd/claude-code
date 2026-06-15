import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.yahya.knowledgekingdom",
  appName: "Knowledge Kingdom",
  webDir: "dist",
  ios: {
    contentInset: "always",
    // Background behind the WKWebView (matches the game's dark theme).
    backgroundColor: "#0b1020ff",
    // Keep web links inside the app's web view rather than opening Safari.
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#0b1020",
      showSpinner: false,
      iosSpinnerStyle: "small",
      splashFullScreen: true,
      splashImmersive: true,
    },
    Keyboard: {
      resize: "native",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0b1020",
    },
  },
};

export default config;
