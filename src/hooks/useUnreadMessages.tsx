import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useUnreadMessages() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) { setCount(0); return; }

    const fetchCount = async () => {
      // Get all contracts the user is part of
      const { data: contracts } = await supabase
        .from("contracts")
        .select("id")
        .or(`client_id.eq.${user.id},freelancer_id.eq.${user.id}`);

      if (!contracts?.length) { setCount(0); return; }

      const contractIds = contracts.map(c => c.id);
      const { count: unread, error } = await supabase
        .from("contract_messages")
        .select("*", { count: "exact", head: true })
        .in("contract_id", contractIds)
        .neq("sender_id", user.id)
        .eq("is_read", false);

      if (!error && unread !== null) setCount(unread);
    };

    fetchCount();

    const channel = supabase
      .channel("unread-contract-messages")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contract_messages" },
        () => fetchCount()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return count;
}
