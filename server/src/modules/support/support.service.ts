import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { SupabaseAdminService } from "../shared/supabase-admin.service";

@Injectable()
export class SupportService {
  constructor(private readonly supabaseAdmin: SupabaseAdminService) {}

  async createComplaint(
    subject: string,
    category: string,
    message: string,
    authorization?: string,
  ) {
    const userId = await this.supabaseAdmin.getRequiredUserId(authorization);
    const supabase = this.supabaseAdmin.getClient();

    const { error } = await supabase.from("complaints").insert({
      user_id: userId,
      subject: (subject || "").trim(),
      category,
      message: (message || "").trim(),
    });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return { success: true, data: {} };
  }

  async getMyComplaints(authorization?: string) {
    const userId = await this.supabaseAdmin.getRequiredUserId(authorization);
    const supabase = this.supabaseAdmin.getClient();

    const { data, error } = await supabase
      .from("complaints")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return { success: true, data: { complaints: data || [] } };
  }

  async getSupportChat(authorization?: string) {
    const userId = await this.supabaseAdmin.getRequiredUserId(authorization);
    const supabase = this.supabaseAdmin.getClient();

    const { data: existing, error: existingError } = await supabase
      .from("support_chats")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existingError) {
      throw new InternalServerErrorException(existingError.message);
    }

    let chatId = existing?.id as string | undefined;
    if (!chatId) {
      const { data: created, error: createError } = await supabase
        .from("support_chats")
        .insert({ user_id: userId })
        .select("id")
        .single();

      if (createError) {
        throw new InternalServerErrorException(createError.message);
      }

      chatId = created.id;
    }

    const { data: messages, error: messagesError } = await supabase
      .from("support_chat_messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });
    if (messagesError) {
      throw new InternalServerErrorException(messagesError.message);
    }

    const { error: markReadError } = await supabase
      .from("support_chat_messages")
      .update({ is_read: true })
      .eq("chat_id", chatId)
      .eq("sender_type", "admin")
      .eq("is_read", false);
    if (markReadError) {
      throw new InternalServerErrorException(markReadError.message);
    }

    return {
      success: true,
      data: {
        chatId,
        messages: messages || [],
      },
    };
  }

  async sendSupportMessage(message: string, authorization?: string) {
    const userId = await this.supabaseAdmin.getRequiredUserId(authorization);
    const supabase = this.supabaseAdmin.getClient();

    const { data: existing, error: existingError } = await supabase
      .from("support_chats")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (existingError) {
      throw new InternalServerErrorException(existingError.message);
    }

    let chatId = existing?.id as string | undefined;
    if (!chatId) {
      const { data: created, error: createError } = await supabase
        .from("support_chats")
        .insert({ user_id: userId })
        .select("id")
        .single();
      if (createError) {
        throw new InternalServerErrorException(createError.message);
      }
      chatId = created.id;
    }

    const { error: msgError } = await supabase.from("support_chat_messages").insert({
      chat_id: chatId,
      sender_id: userId,
      sender_type: "user",
      message: (message || "").trim(),
    });
    if (msgError) {
      throw new InternalServerErrorException(msgError.message);
    }

    const { error: updateError } = await supabase
      .from("support_chats")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", chatId);
    if (updateError) {
      throw new InternalServerErrorException(updateError.message);
    }

    return { success: true, data: { chatId } };
  }

  async getAdminSettings(authorization?: string) {
    await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();
    const { data, error } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["support_email", "support_phone", "support_whatsapp"]);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const settings = { email: "", phone: "", whatsapp: "" };
    for (const row of data || []) {
      const value =
        typeof row.value === "string"
          ? row.value
          : String(row.value).replace(/^"|"$/g, "");
      if (row.key === "support_email") settings.email = value;
      if (row.key === "support_phone") settings.phone = value;
      if (row.key === "support_whatsapp") settings.whatsapp = value;
    }

    return { success: true, data: settings };
  }

  async updateAdminSettings(
    email: string,
    phone: string,
    whatsapp: string,
    authorization?: string,
  ) {
    await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();
    const updates = [
      { key: "support_email", value: JSON.stringify((email || "").trim()) },
      { key: "support_phone", value: JSON.stringify((phone || "").trim()) },
      {
        key: "support_whatsapp",
        value: JSON.stringify((whatsapp || "").trim()),
      },
    ];

    for (const row of updates) {
      const { error } = await supabase
        .from("platform_settings")
        .update({ value: row.value as any, updated_at: new Date().toISOString() })
        .eq("key", row.key);
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
    }

    return { success: true, data: {} };
  }

  async getAdminComplaints(status: string, authorization?: string) {
    await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();
    let query = supabase
      .from("complaints")
      .select("*")
      .order("created_at", { ascending: false });
    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    const { data, error } = await query;
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return { success: true, data: { complaints: data || [] } };
  }

  async updateComplaintStatus(
    complaintId: string,
    status: string,
    authorization?: string,
  ) {
    await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();
    const { error } = await supabase
      .from("complaints")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", complaintId);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return { success: true, data: { id: complaintId, status } };
  }

  async getAdminChats(authorization?: string) {
    await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();
    const { data, error } = await supabase
      .from("support_chats")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return { success: true, data: { chats: data || [] } };
  }

  async getAdminChatMessages(chatId: string, authorization?: string) {
    await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();
    const { data, error } = await supabase
      .from("support_chat_messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const { error: markReadError } = await supabase
      .from("support_chat_messages")
      .update({ is_read: true })
      .eq("chat_id", chatId)
      .eq("sender_type", "user")
      .eq("is_read", false);
    if (markReadError) {
      throw new InternalServerErrorException(markReadError.message);
    }

    return { success: true, data: { messages: data || [] } };
  }

  async sendAdminChatMessage(
    chatId: string,
    message: string,
    authorization?: string,
  ) {
    const adminId = await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();
    const { error: msgError } = await supabase.from("support_chat_messages").insert({
      chat_id: chatId,
      sender_id: adminId,
      sender_type: "admin",
      message: (message || "").trim(),
    });
    if (msgError) {
      throw new InternalServerErrorException(msgError.message);
    }

    const { error: updateError } = await supabase
      .from("support_chats")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", chatId);
    if (updateError) {
      throw new InternalServerErrorException(updateError.message);
    }

    return { success: true, data: { chatId } };
  }

  private async assertAdmin(authorization?: string) {
    const supabase = this.supabaseAdmin.getClient();
    const userId = await this.supabaseAdmin.getRequiredUserId(authorization);
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      throw new ForbiddenException("Admin access required.");
    }
    return userId;
  }
}
