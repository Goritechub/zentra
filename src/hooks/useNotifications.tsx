import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getNotificationsList } from "@/api/notifications.api";

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  contract_id: string | null;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const { user, bootstrapStatus, onboardingComplete } = useAuth();
  const queryClient = useQueryClient();

  const queryKey = ["notifications", user?.id];
  const enabled = !!user && bootstrapStatus === "ready" && onboardingComplete;

  const {
    data: notifications = [],
    isLoading: loading,
    refetch,
  } = useQuery({
    queryKey,
    enabled,
    staleTime: 30 * 1000,
    queryFn: async () => getNotificationsList(),
  });

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications],
  );

  // Realtime subscription
  useEffect(() => {
    if (!enabled || !user) return;
    const channel = supabase
      .channel("user-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [enabled, queryClient, queryKey, user]);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true } as any).eq("id", id);
    await queryClient.setQueryData<Notification[]>(queryKey, (prev = []) =>
      prev.map((notification) => notification.id === id ? { ...notification, is_read: true } : notification),
    );
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true } as any).eq("user_id", user.id).eq("is_read", false);
    await queryClient.setQueryData<Notification[]>(queryKey, (prev = []) =>
      prev.map((notification) => ({ ...notification, is_read: true })),
    );
  };

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, refetch };
}
