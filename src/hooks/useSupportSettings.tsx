import { useState, useEffect } from "react";
import { getPublicSupportSettings } from "@/api/support.api";

export interface SupportSettings {
  support_email: string;
  support_phone: string;
  support_whatsapp: string;
}

const defaults: SupportSettings = {
  support_email: "hello@zentragig.com",
  support_phone: "+234 814 780 0542",
  support_whatsapp: "+234 814 780 0542",
};

export function useSupportSettings() {
  const [settings, setSettings] = useState<SupportSettings>(defaults);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchSettings = async () => {
      try {
        const { settings } = await getPublicSupportSettings();

        if (!cancelled && settings) {
          const result = { ...defaults };
          for (const row of settings) {
            const key = row.key as keyof SupportSettings;
            if (key in result) {
              result[key] = typeof row.value === "string" ? row.value : JSON.stringify(row.value).replace(/^"|"$/g, "");
            }
          }
          setSettings(result);
        }
      } catch {
        if (!cancelled) {
          setSettings(defaults);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  return { settings, loading };
}
