import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getUnreadMessagesCount } from "@/api/messages.api";

export function useUnreadMessages() {
  const { user, bootstrapStatus, onboardingComplete } = useAuth();
  const queryClient = useQueryClient();

  const queryKey = ["unread-messages", user?.id];
  const enabled = !!user && bootstrapStatus === "ready" && onboardingComplete;

  const { data: count = 0 } = useQuery({
    queryKey,
    enabled,
    staleTime: 60 * 1000,
    queryFn: getUnreadMessagesCount,
  });

  useEffect(() => {
    if (!enabled || !user) return;

    const channel = supabase
      .channel("unread-contract-messages")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contract_messages" },
        () => queryClient.invalidateQueries({ queryKey }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient, queryKey, user]);

  return count;
}
