import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SupportSettings {
  support_email: string;
  support_phone: string;
  support_whatsapp: string;
}

const defaults: SupportSettings = {
  support_email: "hello@zentragig.com",
  support_phone: "+234 801 234 5678",
  support_whatsapp: "+234 801 234 5678",
};

export function useSupportSettings() {
  const [settings, setSettings] = useState<SupportSettings>(defaults);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from("platform_settings")
          .select("key, value")
          .in("key", ["support_email", "support_phone", "support_whatsapp"]);

        if (error) {
          throw error;
        }

        if (!cancelled && data) {
          const result = { ...defaults };
          for (const row of data) {
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
