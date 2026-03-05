// cacheManager.js
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Preferences } from "@capacitor/preferences";
import { CapacitorIosWebviewCacheCleaner } from "capacitor-ios-webview-cache-cleaner-plugin";
import { WebViewCache } from "capacitor-plugin-webview-cache";

export const CacheManager = {
  async clearIfVersionChanged() {
    if (!Capacitor.isNativePlatform()) return false;

    try {
      const info = await App.getInfo();
      const currentVersion = info.version;
      const { value: lastVersion } = await Preferences.get({
        key: "app_version",
      });

      if (!lastVersion || lastVersion !== currentVersion) {
        console.log(`Version changed, clearing caches...`);

        // Clear platform-specific caches
        if (Capacitor.getPlatform() === "ios") {
          await CapacitorIosWebviewCacheCleaner.clearWebViewCache();
        } else if (Capacitor.getPlatform() === "android") {
          await WebViewCache.clearCache();
        }

        // Clear web storage
        localStorage.clear();
        sessionStorage.clear();

        // Store new version
        await Preferences.set({ key: "app_version", value: currentVersion });

        return true;
      }
      return false;
    } catch (error) {
      console.error("Cache clearing error:", error);
      return false;
    }
  },
};
