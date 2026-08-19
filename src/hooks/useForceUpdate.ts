import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";

/**
 * Compare two semver strings. Returns:
 *  -1 if a < b, 0 if equal, 1 if a > b
 */
function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

export function useForceUpdate() {
  const [updateRequired, setUpdateRequired] = useState(false);
  const [storeUrl, setStoreUrl] = useState("");

  useEffect(() => {
    async function check() {
      // Only check on native platforms
      if (!Capacitor.isNativePlatform()) return;

      try {
        // Get current app version
        const appInfo = await CapApp.getInfo();
        const currentVersion = appInfo.build; // build number (CURRENT_PROJECT_VERSION)

        // Get minimum version from database
        const { data, error } = await supabase
          .from("app_config" as any)
          .select("value")
          .eq("key", "min_version")
          .single();

        if (error || !data) return;

        const minVersion = (data as any).value as string;

        if (compareSemver(currentVersion, minVersion) < 0) {
          // Determine store URL
          const platform = Capacitor.getPlatform();
          if (platform === "android") {
            setStoreUrl(
              `https://play.google.com/store/apps/details?id=${appInfo.id}`
            );
          } else if (platform === "ios") {
            // Replace with actual App Store ID if needed
            setStoreUrl("https://apps.apple.com/app/idYOUR_APP_ID");
          }
          setUpdateRequired(true);
        }
      } catch (e) {
        console.warn("Force update check failed:", e);
      }
    }

    check();
  }, []);

  return { updateRequired, storeUrl };
}
