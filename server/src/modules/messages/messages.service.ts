import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class MessagesService {
  private readonly supabase: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>("SUPABASE_URL");
    const serviceRoleKey = this.configService.get<string>("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new InternalServerErrorException("Supabase server configuration is missing.");
    }

    this.supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async getConversations(authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);

    const [{ data: contracts, error: contractsError }, { data: hiddenData, error: hiddenError }] =
      await Promise.all([
        this.supabase
          .from("contracts")
          .select(
            "id, job_title, status, client_id, freelancer_id, client:profiles!contracts_client_id_fkey(full_name, avatar_url), freelancer:profiles!contracts_freelancer_id_fkey(full_name, avatar_url)",
          )
          .or(`client_id.eq.${userId},freelancer_id.eq.${userId}`)
          .order("created_at", { ascending: false }),
        this.supabase
          .from("hidden_conversations")
          .select("contract_id")
          .eq("user_id", userId),
      ]);

    if (contractsError) {
      throw new InternalServerErrorException(contractsError.message);
    }

    if (hiddenError) {
      throw new InternalServerErrorException(hiddenError.message);
    }

    const hiddenIds = (hiddenData || []).map((hidden: any) => hidden.contract_id);

    if (!contracts?.length) {
      return {
        success: true,
        data: {
          conversations: [],
          hiddenIds,
        },
      };
    }

    const contractIds = contracts.map((contract: any) => contract.id);
    const { data: messages, error: messagesError } = await this.supabase
      .from("contract_messages")
      .select("id, contract_id, sender_id, content, is_read, created_at")
      .in("contract_id", contractIds)
      .order("created_at", { ascending: false });

    if (messagesError) {
      throw new InternalServerErrorException(messagesError.message);
    }

    const messageMap = new Map<string, any[]>();
    for (const message of messages || []) {
      if (!messageMap.has(message.contract_id)) {
        messageMap.set(message.contract_id, []);
      }

      messageMap.get(message.contract_id)!.push(message);
    }

    const conversations = (contracts || []).map((contract: any) => {
      const contractMessages = messageMap.get(contract.id) || [];
      const latestMessage = contractMessages[0];
      const unreadCount = contractMessages.filter(
        (message: any) => message.sender_id !== userId && !message.is_read,
      ).length;
      const partner = contract.client_id === userId ? contract.freelancer : contract.client;

      return {
        contractId: contract.id,
        contractTitle: contract.job_title || "Contract",
        contractStatus: contract.status,
        partner: {
          full_name: partner?.full_name || "User",
          avatar_url: partner?.avatar_url || null,
        },
        lastMessage: latestMessage?.content || null,
        lastMessageAt: latestMessage?.created_at || null,
        unreadCount,
      };
    });

    conversations.sort((a, b) => {
      if (!a.lastMessageAt && !b.lastMessageAt) return 0;
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

    return {
      success: true,
      data: {
        conversations,
        hiddenIds,
      },
    };
  }

  async getUnreadCount(authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);

    const { data, error } = await this.supabase.rpc(
      "count_unread_contract_messages" as any,
      { _user_id: userId } as any,
    );

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return {
      success: true,
      data: {
        count: typeof data === "number" ? data : 0,
      },
    };
  }

  async hideConversations(contractIds: string[], authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);
    if (!contractIds.length) {
      return { success: true, data: { count: 0 } };
    }

    const rows = contractIds.map((contractId) => ({
      user_id: userId,
      contract_id: contractId,
    }));
    const { error } = await this.supabase.from("hidden_conversations").upsert(rows, {
      onConflict: "user_id,contract_id",
      ignoreDuplicates: true,
    });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return { success: true, data: { count: contractIds.length } };
  }

  async hideConversation(contractId: string, authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);
    const { error } = await this.supabase.from("hidden_conversations").upsert(
      {
        user_id: userId,
        contract_id: contractId,
      },
      {
        onConflict: "user_id,contract_id",
        ignoreDuplicates: true,
      },
    );

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return { success: true, data: { contractId } };
  }

  async unhideConversation(contractId: string, authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);
    const { error } = await this.supabase
      .from("hidden_conversations")
      .delete()
      .eq("user_id", userId)
      .eq("contract_id", contractId);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return { success: true, data: { contractId } };
  }

  private async getRequiredUserId(authorization?: string) {
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : null;

    if (!token) {
      throw new UnauthorizedException("Missing bearer token.");
    }

    const {
      data: { user },
      error,
    } = await this.supabase.auth.getUser(token);

    if (error || !user) {
      throw new UnauthorizedException("Invalid or expired session.");
    }

    return user.id;
  }
}
