export interface Complaint {
  id: string;
  user_id: string;
  subject: string;
  category: string;
  message: string;
  status: string;
  admin_notes: string | null;
  attachments: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface SupportChat {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SupportChatMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  sender_type: string;
  message: string;
  is_read: boolean;
  attachments: string[] | null;
  created_at: string;
}
