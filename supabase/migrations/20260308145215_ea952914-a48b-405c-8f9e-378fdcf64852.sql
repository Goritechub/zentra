
-- Complaints table
CREATE TABLE public.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  message text NOT NULL,
  attachments text[] DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'new',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own complaints" ON public.complaints FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own complaints" ON public.complaints FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all complaints" ON public.complaints FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update complaints" ON public.complaints FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- Support chats table
CREATE TABLE public.support_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.support_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own support chat" ON public.support_chats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own support chat" ON public.support_chats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own support chat" ON public.support_chats FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all support chats" ON public.support_chats FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update all support chats" ON public.support_chats FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- Support chat messages
CREATE TABLE public.support_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.support_chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_type text NOT NULL DEFAULT 'user',
  message text NOT NULL,
  attachments text[] DEFAULT '{}'::text[],
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat participants can view messages" ON public.support_chat_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.support_chats sc WHERE sc.id = support_chat_messages.chat_id AND sc.user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
);
CREATE POLICY "Chat participants can send messages" ON public.support_chat_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND (
    EXISTS (SELECT 1 FROM public.support_chats sc WHERE sc.id = support_chat_messages.chat_id AND sc.user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);
CREATE POLICY "Admins can update messages" ON public.support_chat_messages FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can update own chat messages" ON public.support_chat_messages FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.support_chats sc WHERE sc.id = support_chat_messages.chat_id AND sc.user_id = auth.uid())
);

-- Enable realtime for support chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_chat_messages;

-- Seed default support settings using existing platform_settings table
INSERT INTO public.platform_settings (key, value) VALUES
  ('support_email', '"hello@zentragig.com"'::jsonb),
  ('support_phone', '"+234 801 234 5678"'::jsonb),
  ('support_whatsapp', '"+234 801 234 5678"'::jsonb)
ON CONFLICT (key) DO NOTHING;
