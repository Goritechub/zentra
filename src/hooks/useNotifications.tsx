import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getNotificationsList, markNotificationRead, markAllNotificationsRead } from "@/api/notifications.api";

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
  const { user, bootstrapStatus } = useAuth();
  const queryClient = useQueryClient();

  const userId = user?.id;
  const queryKey = useMemo(() => ["notifications", userId], [userId]);
  const enabled = !!user && bootstrapStatus === "ready";

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
    if (!enabled || !userId) return;
    const channel = supabase
      .channel(`user-notifications-${userId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => queryClient.invalidateQueries({ queryKey })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [enabled, queryClient, queryKey, userId]);

  const markAsRead = async (id: string) => {
    await markNotificationRead(id);
    queryClient.setQueryData<Notification[]>(queryKey, (prev = []) =>
      prev.map((notification) => notification.id === id ? { ...notification, is_read: true } : notification),
    );
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await markAllNotificationsRead();
    queryClient.setQueryData<Notification[]>(queryKey, (prev = []) =>
      prev.map((notification) => ({ ...notification, is_read: true })),
    );
  };

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, refetch };
}
