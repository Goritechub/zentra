import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PlatformFreezeState {
  signupsPaused: boolean;
  platformFrozen: boolean;
  freezeMessage: string;
  loading: boolean;
  refetch: () => Promise<void>;
}

const PlatformFreezeContext = createContext<PlatformFreezeState>({
  signupsPaused: false,
  platformFrozen: false,
  freezeMessage: "",
  loading: true,
  refetch: async () => {},
});

export function PlatformFreezeProvider({ children }: { children: ReactNode }) {
  const [signupsPaused, setSignupsPaused] = useState(false);
  const [platformFrozen, setPlatformFrozen] = useState(false);
  const [freezeMessage, setFreezeMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchFreezeSettings = async () => {
    const { data } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["signups_paused", "platform_frozen"]);

    if (data) {
      for (const row of data) {
        if (row.key === "signups_paused") {
          const val = row.value as any;
          setSignupsPaused(val?.enabled === true);
        }
        if (row.key === "platform_frozen") {
          const val = row.value as any;
          setPlatformFrozen(val?.enabled === true);
          setFreezeMessage(val?.message || "The platform is temporarily under maintenance.");
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFreezeSettings();
  }, []);

  return (
    <PlatformFreezeContext.Provider
      value={{ signupsPaused, platformFrozen, freezeMessage, loading, refetch: fetchFreezeSettings }}
    >
      {children}
    </PlatformFreezeContext.Provider>
  );
}

export function usePlatformFreeze() {
  return useContext(PlatformFreezeContext);
}
