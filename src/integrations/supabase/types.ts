export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_activity_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      admin_permissions: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          permission: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission?: string
          user_id?: string
        }
        Relationships: []
      }
      bank_details: {
        Row: {
          account_name: string
          account_number: string
          bank_code: string
          bank_name: string
          created_at: string
          id: string
          is_default: boolean | null
          recipient_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name: string
          account_number: string
          bank_code: string
          bank_name: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          recipient_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_code?: string
          bank_name?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          recipient_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_details_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      certifications: {
        Row: {
          created_at: string
          credential_url: string | null
          id: string
          issuer: string | null
          name: string
          user_id: string
          year_obtained: number | null
        }
        Insert: {
          created_at?: string
          credential_url?: string | null
          id?: string
          issuer?: string | null
          name: string
          user_id: string
          year_obtained?: number | null
        }
        Update: {
          created_at?: string
          credential_url?: string | null
          id?: string
          issuer?: string | null
          name?: string
          user_id?: string
          year_obtained?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "certifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_mentions: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          mentioned_user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          mentioned_user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          mentioned_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_mentions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "contest_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          admin_notes: string | null
          attachments: string[] | null
          category: string
          created_at: string
          id: string
          message: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          attachments?: string[] | null
          category?: string
          created_at?: string
          id?: string
          message: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          attachments?: string[] | null
          category?: string
          created_at?: string
          id?: string
          message?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contest_comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contest_comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "contest_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      contest_comments: {
        Row: {
          content: string
          contest_id: string
          created_at: string
          id: string
          parent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          contest_id: string
          created_at?: string
          id?: string
          parent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          contest_id?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contest_comments_contest_id_fkey"
            columns: ["contest_id"]
            isOneToOne: false
            referencedRelation: "contests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contest_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "contest_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      contest_entries: {
        Row: {
          attachments: string[] | null
          contest_id: string
          created_at: string | null
          description: string | null
          edit_count: number
          freelancer_id: string
          id: string
          is_nominee: boolean | null
          is_winner: boolean | null
          last_edited_at: string | null
          prize_position: number | null
        }
        Insert: {
          attachments?: string[] | null
          contest_id: string
          created_at?: string | null
          description?: string | null
          edit_count?: number
          freelancer_id: string
          id?: string
          is_nominee?: boolean | null
          is_winner?: boolean | null
          last_edited_at?: string | null
          prize_position?: number | null
        }
        Update: {
          attachments?: string[] | null
          contest_id?: string
          created_at?: string | null
          description?: string | null
          edit_count?: number
          freelancer_id?: string
          id?: string
          is_nominee?: boolean | null
          is_winner?: boolean | null
          last_edited_at?: string | null
          prize_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contest_entries_contest_id_fkey"
            columns: ["contest_id"]
            isOneToOne: false
            referencedRelation: "contests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contest_entries_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contest_follows: {
        Row: {
          contest_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          contest_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          contest_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contest_follows_contest_id_fkey"
            columns: ["contest_id"]
            isOneToOne: false
            referencedRelation: "contests"
            referencedColumns: ["id"]
          },
        ]
      }
      contests: {
        Row: {
          banner_image: string | null
          category: string | null
          client_id: string
          created_at: string | null
          deadline: string
          deadline_extended_once: boolean
          description: string
          id: string
          prize_fifth: number | null
          prize_first: number
          prize_fourth: number | null
          prize_second: number | null
          prize_third: number | null
          required_skills: string[] | null
          required_software: string[] | null
          rules: string | null
          status: string
          title: string
          updated_at: string | null
          visibility: string
          winner_justifications: Json | null
          winner_selection_method: string | null
        }
        Insert: {
          banner_image?: string | null
          category?: string | null
          client_id: string
          created_at?: string | null
          deadline: string
          deadline_extended_once?: boolean
          description: string
          id?: string
          prize_fifth?: number | null
          prize_first?: number
          prize_fourth?: number | null
          prize_second?: number | null
          prize_third?: number | null
          required_skills?: string[] | null
          required_software?: string[] | null
          rules?: string | null
          status?: string
          title: string
          updated_at?: string | null
          visibility?: string
          winner_justifications?: Json | null
          winner_selection_method?: string | null
        }
        Update: {
          banner_image?: string | null
          category?: string | null
          client_id?: string
          created_at?: string | null
          deadline?: string
          deadline_extended_once?: boolean
          description?: string
          id?: string
          prize_fifth?: number | null
          prize_first?: number
          prize_fourth?: number | null
          prize_second?: number | null
          prize_third?: number | null
          required_skills?: string[] | null
          required_software?: string[] | null
          rules?: string | null
          status?: string
          title?: string
          updated_at?: string | null
          visibility?: string
          winner_justifications?: Json | null
          winner_selection_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_attachments: {
        Row: {
          context: string
          contract_id: string
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          message_id: string | null
          milestone_id: string | null
          uploaded_by: string
        }
        Insert: {
          context?: string
          contract_id: string
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          message_id?: string | null
          milestone_id?: string | null
          uploaded_by: string
        }
        Update: {
          context?: string
          contract_id?: string
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          message_id?: string | null
          milestone_id?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_attachments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "contract_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_attachments_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_messages: {
        Row: {
          content: string
          contract_id: string
          created_at: string
          edited_at: string | null
          id: string
          is_read: boolean
          is_system_message: boolean
          sender_id: string
        }
        Insert: {
          content: string
          contract_id: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_read?: boolean
          is_system_message?: boolean
          sender_id: string
        }
        Update: {
          content?: string
          contract_id?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_read?: boolean
          is_system_message?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_messages_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          accepted_attachments: string[] | null
          accepted_bid_amount: number | null
          accepted_cover_letter: string | null
          accepted_payment_type: string | null
          amount: number
          client_id: string
          completed_at: string | null
          created_at: string | null
          freelancer_id: string
          id: string
          job_attachments: string[] | null
          job_budget_max: number | null
          job_budget_min: number | null
          job_category: string | null
          job_delivery_days: number | null
          job_delivery_unit: string | null
          job_description: string | null
          job_id: string | null
          job_title: string | null
          proposal_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["contract_status"] | null
          terms_conditions: string | null
        }
        Insert: {
          accepted_attachments?: string[] | null
          accepted_bid_amount?: number | null
          accepted_cover_letter?: string | null
          accepted_payment_type?: string | null
          amount: number
          client_id: string
          completed_at?: string | null
          created_at?: string | null
          freelancer_id: string
          id?: string
          job_attachments?: string[] | null
          job_budget_max?: number | null
          job_budget_min?: number | null
          job_category?: string | null
          job_delivery_days?: number | null
          job_delivery_unit?: string | null
          job_description?: string | null
          job_id?: string | null
          job_title?: string | null
          proposal_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["contract_status"] | null
          terms_conditions?: string | null
        }
        Update: {
          accepted_attachments?: string[] | null
          accepted_bid_amount?: number | null
          accepted_cover_letter?: string | null
          accepted_payment_type?: string | null
          amount?: number
          client_id?: string
          completed_at?: string | null
          created_at?: string | null
          freelancer_id?: string
          id?: string
          job_attachments?: string[] | null
          job_budget_max?: number | null
          job_budget_min?: number | null
          job_category?: string | null
          job_delivery_days?: number | null
          job_delivery_unit?: string | null
          job_description?: string | null
          job_id?: string | null
          job_title?: string | null
          proposal_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["contract_status"] | null
          terms_conditions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          adjudicator_assigned_at: string | null
          adjudicator_id: string | null
          admin_notes: string | null
          contract_id: string
          created_at: string
          dispute_status: string
          evidence_urls: string[] | null
          id: string
          milestone_id: string | null
          raised_by: string
          reason: string
          resolution_explanation: string | null
          resolution_split_client: number | null
          resolution_split_freelancer: number | null
          resolution_type: string | null
          resolved_at: string | null
          resolved_by: string | null
          respondent_evidence_urls: string[] | null
          respondent_explanation: string | null
          respondent_id: string | null
          response_deadline: string | null
          status: string
          updated_at: string
        }
        Insert: {
          adjudicator_assigned_at?: string | null
          adjudicator_id?: string | null
          admin_notes?: string | null
          contract_id: string
          created_at?: string
          dispute_status?: string
          evidence_urls?: string[] | null
          id?: string
          milestone_id?: string | null
          raised_by: string
          reason: string
          resolution_explanation?: string | null
          resolution_split_client?: number | null
          resolution_split_freelancer?: number | null
          resolution_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          respondent_evidence_urls?: string[] | null
          respondent_explanation?: string | null
          respondent_id?: string | null
          response_deadline?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          adjudicator_assigned_at?: string | null
          adjudicator_id?: string | null
          admin_notes?: string | null
          contract_id?: string
          created_at?: string
          dispute_status?: string
          evidence_urls?: string[] | null
          id?: string
          milestone_id?: string | null
          raised_by?: string
          reason?: string
          resolution_explanation?: string | null
          resolution_split_client?: number | null
          resolution_split_freelancer?: number | null
          resolution_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          respondent_evidence_urls?: string[] | null
          respondent_explanation?: string | null
          respondent_id?: string | null
          response_deadline?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      escrow_ledger: {
        Row: {
          contract_id: string
          created_at: string
          expert_amount: number
          held_amount: number
          id: string
          milestone_id: string | null
          platform_fee: number
          released_amount: number
          status: string
          updated_at: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          expert_amount?: number
          held_amount?: number
          id?: string
          milestone_id?: string | null
          platform_fee?: number
          released_amount?: number
          status?: string
          updated_at?: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          expert_amount?: number
          held_amount?: number
          id?: string
          milestone_id?: string | null
          platform_fee?: number
          released_amount?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrow_ledger_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_ledger_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      escrow_transactions: {
        Row: {
          amount: number
          contract_id: string
          created_at: string
          id: string
          milestone_id: string | null
          payee_id: string | null
          payer_id: string
          reference: string | null
          status: string
          type: string
        }
        Insert: {
          amount: number
          contract_id: string
          created_at?: string
          id?: string
          milestone_id?: string | null
          payee_id?: string | null
          payer_id: string
          reference?: string | null
          status?: string
          type: string
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string
          id?: string
          milestone_id?: string | null
          payee_id?: string | null
          payer_id?: string
          reference?: string | null
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrow_transactions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_transactions_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      freelancer_profiles: {
        Row: {
          availability: Database["public"]["Enums"]["availability_type"] | null
          bio: string | null
          created_at: string | null
          hourly_rate: number | null
          id: string
          min_project_rate: number | null
          rating: number | null
          show_whatsapp: boolean | null
          skill_levels: Json | null
          skills: string[] | null
          title: string | null
          total_jobs_completed: number | null
          updated_at: string | null
          user_id: string
          years_experience: number | null
        }
        Insert: {
          availability?: Database["public"]["Enums"]["availability_type"] | null
          bio?: string | null
          created_at?: string | null
          hourly_rate?: number | null
          id?: string
          min_project_rate?: number | null
          rating?: number | null
          show_whatsapp?: boolean | null
          skill_levels?: Json | null
          skills?: string[] | null
          title?: string | null
          total_jobs_completed?: number | null
          updated_at?: string | null
          user_id: string
          years_experience?: number | null
        }
        Update: {
          availability?: Database["public"]["Enums"]["availability_type"] | null
          bio?: string | null
          created_at?: string | null
          hourly_rate?: number | null
          id?: string
          min_project_rate?: number | null
          rating?: number | null
          show_whatsapp?: boolean | null
          skill_levels?: Json | null
          skills?: string[] | null
          title?: string | null
          total_jobs_completed?: number | null
          updated_at?: string | null
          user_id?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "freelancer_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hidden_conversations: {
        Row: {
          contract_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hidden_conversations_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      job_views: {
        Row: {
          created_at: string
          id: string
          job_id: string
          viewer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          viewer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_views_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          attachments: string[] | null
          budget_max: number | null
          budget_min: number | null
          city: string | null
          client_id: string
          created_at: string | null
          delivery_days: number | null
          delivery_unit: string
          description: string
          id: string
          invited_expert_ids: string[] | null
          is_hourly: boolean | null
          is_remote: boolean | null
          required_skill_levels: Json | null
          required_skills: string[] | null
          required_software: string[] | null
          skill_level: string | null
          state: string | null
          status: Database["public"]["Enums"]["job_status"] | null
          title: string
          updated_at: string | null
          visibility: string
        }
        Insert: {
          attachments?: string[] | null
          budget_max?: number | null
          budget_min?: number | null
          city?: string | null
          client_id: string
          created_at?: string | null
          delivery_days?: number | null
          delivery_unit?: string
          description: string
          id?: string
          invited_expert_ids?: string[] | null
          is_hourly?: boolean | null
          is_remote?: boolean | null
          required_skill_levels?: Json | null
          required_skills?: string[] | null
          required_software?: string[] | null
          skill_level?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["job_status"] | null
          title: string
          updated_at?: string | null
          visibility?: string
        }
        Update: {
          attachments?: string[] | null
          budget_max?: number | null
          budget_min?: number | null
          city?: string | null
          client_id?: string
          created_at?: string | null
          delivery_days?: number | null
          delivery_unit?: string
          description?: string
          id?: string
          invited_expert_ids?: string[] | null
          is_hourly?: boolean | null
          is_remote?: boolean | null
          required_skill_levels?: Json | null
          required_skills?: string[] | null
          required_software?: string[] | null
          skill_level?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["job_status"] | null
          title?: string
          updated_at?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_verifications: {
        Row: {
          admin_notes: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          didit_session_id: string | null
          document_type: string | null
          full_name_on_id: string | null
          id: string
          kyc_provider_result: Json | null
          kyc_provider_status: string | null
          kyc_status: string
          updated_at: string
          user_id: string
          verification_level: string
          verification_url: string | null
          zentra_verified: boolean
          zentra_verified_at: string | null
          zentra_verified_by: string | null
        }
        Insert: {
          admin_notes?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          didit_session_id?: string | null
          document_type?: string | null
          full_name_on_id?: string | null
          id?: string
          kyc_provider_result?: Json | null
          kyc_provider_status?: string | null
          kyc_status?: string
          updated_at?: string
          user_id: string
          verification_level?: string
          verification_url?: string | null
          zentra_verified?: boolean
          zentra_verified_at?: string | null
          zentra_verified_by?: string | null
        }
        Update: {
          admin_notes?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          didit_session_id?: string | null
          document_type?: string | null
          full_name_on_id?: string | null
          id?: string
          kyc_provider_result?: Json | null
          kyc_provider_status?: string | null
          kyc_status?: string
          updated_at?: string
          user_id?: string
          verification_level?: string
          verification_url?: string | null
          zentra_verified?: boolean
          zentra_verified_at?: string | null
          zentra_verified_by?: string | null
        }
        Relationships: []
      }
      legal_documents: {
        Row: {
          content: string
          created_at: string
          id: string
          is_published: boolean
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          is_published?: boolean
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_published?: boolean
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachments: string[] | null
          content: string
          created_at: string | null
          id: string
          is_read: boolean | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          attachments?: string[] | null
          content: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          attachments?: string[] | null
          content?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      milestone_submissions: {
        Row: {
          attachments: string[] | null
          contract_id: string
          created_at: string
          id: string
          milestone_id: string
          notes: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_by: string
        }
        Insert: {
          attachments?: string[] | null
          contract_id: string
          created_at?: string
          id?: string
          milestone_id: string
          notes?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by: string
        }
        Update: {
          attachments?: string[] | null
          contract_id?: string
          created_at?: string
          id?: string
          milestone_id?: string
          notes?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestone_submissions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestone_submissions_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          amount: number
          approved_at: string | null
          contract_id: string
          created_at: string
          description: string | null
          due_date: string | null
          funded_at: string | null
          id: string
          status: string
          submission_attachments: string[] | null
          submission_notes: string | null
          submitted_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          contract_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          funded_at?: string | null
          id?: string
          status?: string
          submission_attachments?: string[] | null
          submission_notes?: string | null
          submitted_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          contract_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          funded_at?: string | null
          id?: string
          status?: string
          submission_attachments?: string[] | null
          submission_notes?: string | null
          submitted_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_logs: {
        Row: {
          confidence: number | null
          content_type: string
          created_at: string
          id: string
          raw_content: string | null
          user_id: string
          violation_reason: string
        }
        Insert: {
          confidence?: number | null
          content_type: string
          created_at?: string
          id?: string
          raw_content?: string | null
          user_id: string
          violation_reason: string
        }
        Update: {
          confidence?: number | null
          content_type?: string
          created_at?: string
          id?: string
          raw_content?: string | null
          user_id?: string
          violation_reason?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          contract_id: string | null
          created_at: string
          id: string
          is_read: boolean
          link_url: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link_url?: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link_url?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          budget: number | null
          client_id: string
          created_at: string | null
          description: string | null
          freelancer_id: string
          id: string
          job_id: string | null
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          budget?: number | null
          client_id: string
          created_at?: string | null
          description?: string | null
          freelancer_id: string
          id?: string
          job_id?: string | null
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          budget?: number | null
          client_id?: string
          created_at?: string | null
          description?: string | null
          freelancer_id?: string
          id?: string
          job_id?: string | null
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_transfers: {
        Row: {
          amount: number
          completed_at: string | null
          contract_id: string
          created_at: string
          expert_id: string
          id: string
          initiated_at: string
          milestone_id: string | null
          paystack_response: Json | null
          platform_fee: number
          status: string
          transfer_code: string | null
        }
        Insert: {
          amount: number
          completed_at?: string | null
          contract_id: string
          created_at?: string
          expert_id: string
          id?: string
          initiated_at?: string
          milestone_id?: string | null
          paystack_response?: Json | null
          platform_fee?: number
          status?: string
          transfer_code?: string | null
        }
        Update: {
          amount?: number
          completed_at?: string | null
          contract_id?: string
          created_at?: string
          expert_id?: string
          id?: string
          initiated_at?: string
          milestone_id?: string | null
          paystack_response?: Json | null
          platform_fee?: number
          status?: string
          transfer_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_transfers_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_transfers_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      paystack_references: {
        Row: {
          amount: number
          channel: string | null
          contract_id: string | null
          created_at: string
          gateway_response: string | null
          id: string
          milestone_id: string | null
          paystack_response: Json | null
          purpose: string
          reference: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          channel?: string | null
          contract_id?: string | null
          created_at?: string
          gateway_response?: string | null
          id?: string
          milestone_id?: string | null
          paystack_response?: Json | null
          purpose?: string
          reference: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          channel?: string | null
          contract_id?: string | null
          created_at?: string
          gateway_response?: string | null
          id?: string
          milestone_id?: string | null
          paystack_response?: Json | null
          purpose?: string
          reference?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paystack_references_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paystack_references_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paystack_references_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_revenue: {
        Row: {
          commission_amount: number
          commission_rate: number
          contract_id: string | null
          created_at: string
          gross_amount: number
          id: string
          milestone_id: string | null
          net_to_freelancer: number
        }
        Insert: {
          commission_amount: number
          commission_rate: number
          contract_id?: string | null
          created_at?: string
          gross_amount: number
          id?: string
          milestone_id?: string | null
          net_to_freelancer: number
        }
        Update: {
          commission_amount?: number
          commission_rate?: number
          contract_id?: string | null
          created_at?: string
          gross_amount?: number
          id?: string
          milestone_id?: string | null
          net_to_freelancer?: number
        }
        Relationships: [
          {
            foreignKeyName: "platform_revenue_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_revenue_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_reviews: {
        Row: {
          comment: string | null
          contracts_at_review: number
          created_at: string
          id: string
          is_approved: boolean
          is_featured: boolean
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          contracts_at_review?: number
          created_at?: string
          id?: string
          is_approved?: boolean
          is_featured?: boolean
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          contracts_at_review?: number
          created_at?: string
          id?: string
          is_approved?: boolean
          is_featured?: boolean
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      portfolio_items: {
        Row: {
          created_at: string | null
          description: string | null
          freelancer_profile_id: string
          id: string
          images: string[] | null
          project_type: string | null
          software_used: string[] | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          freelancer_profile_id: string
          id?: string
          images?: string[] | null
          project_type?: string | null
          software_used?: string[] | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          freelancer_profile_id?: string
          id?: string
          images?: string[] | null
          project_type?: string | null
          software_used?: string[] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_items_freelancer_profile_id_fkey"
            columns: ["freelancer_profile_id"]
            isOneToOne: false
            referencedRelation: "freelancer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_code_hash: string | null
          avatar_url: string | null
          city: string | null
          created_at: string | null
          email: string
          full_name: string | null
          full_name_edited: boolean
          id: string
          is_verified: boolean | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          state: string | null
          theme_preference: string | null
          updated_at: string | null
          username: string | null
          username_edited: boolean
          whatsapp: string | null
        }
        Insert: {
          auth_code_hash?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          full_name_edited?: boolean
          id: string
          is_verified?: boolean | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          state?: string | null
          theme_preference?: string | null
          updated_at?: string | null
          username?: string | null
          username_edited?: boolean
          whatsapp?: string | null
        }
        Update: {
          auth_code_hash?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          full_name_edited?: boolean
          id?: string
          is_verified?: boolean | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          state?: string | null
          theme_preference?: string | null
          updated_at?: string | null
          username?: string | null
          username_edited?: boolean
          whatsapp?: string | null
        }
        Relationships: []
      }
      proposals: {
        Row: {
          attachments: string[] | null
          bid_amount: number
          cover_letter: string
          created_at: string | null
          delivery_days: number
          delivery_unit: string
          edit_count: number
          freelancer_id: string
          id: string
          job_id: string
          last_edited_at: string | null
          milestones: Json | null
          payment_type: string
          status: Database["public"]["Enums"]["proposal_status"] | null
          updated_at: string | null
        }
        Insert: {
          attachments?: string[] | null
          bid_amount: number
          cover_letter: string
          created_at?: string | null
          delivery_days: number
          delivery_unit?: string
          edit_count?: number
          freelancer_id: string
          id?: string
          job_id: string
          last_edited_at?: string | null
          milestones?: Json | null
          payment_type?: string
          status?: Database["public"]["Enums"]["proposal_status"] | null
          updated_at?: string | null
        }
        Update: {
          attachments?: string[] | null
          bid_amount?: number
          cover_letter?: string
          created_at?: string | null
          delivery_days?: number
          delivery_unit?: string
          edit_count?: number
          freelancer_id?: string
          id?: string
          job_id?: string
          last_edited_at?: string | null
          milestones?: Json | null
          payment_type?: string
          status?: Database["public"]["Enums"]["proposal_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          contract_id: string
          created_at: string | null
          id: string
          rating: number
          rating_availability: number | null
          rating_communication: number | null
          rating_cooperation: number | null
          rating_deadlines: number | null
          rating_quality: number | null
          rating_skills: number | null
          reviewee_id: string
          reviewer_id: string
        }
        Insert: {
          comment?: string | null
          contract_id: string
          created_at?: string | null
          id?: string
          rating: number
          rating_availability?: number | null
          rating_communication?: number | null
          rating_cooperation?: number | null
          rating_deadlines?: number | null
          rating_quality?: number | null
          rating_skills?: number | null
          reviewee_id: string
          reviewer_id: string
        }
        Update: {
          comment?: string | null
          contract_id?: string
          created_at?: string | null
          id?: string
          rating?: number
          rating_availability?: number | null
          rating_communication?: number | null
          rating_cooperation?: number | null
          rating_deadlines?: number | null
          rating_quality?: number | null
          rating_skills?: number | null
          reviewee_id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_experts: {
        Row: {
          client_id: string
          created_at: string | null
          freelancer_id: string
          id: string
          note: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          freelancer_id: string
          id?: string
          note?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          freelancer_id?: string
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_experts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_experts_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_offers: {
        Row: {
          banner_image: string | null
          category: string | null
          created_at: string | null
          delivery_days: number | null
          delivery_unit: string | null
          description: string
          freelancer_id: string
          id: string
          images: string[] | null
          is_active: boolean | null
          price: number | null
          pricing_type: string | null
          revisions_allowed: number | null
          skills: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          banner_image?: string | null
          category?: string | null
          created_at?: string | null
          delivery_days?: number | null
          delivery_unit?: string | null
          description: string
          freelancer_id: string
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          price?: number | null
          pricing_type?: string | null
          revisions_allowed?: number | null
          skills?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          banner_image?: string | null
          category?: string | null
          created_at?: string | null
          delivery_days?: number | null
          delivery_unit?: string | null
          description?: string
          freelancer_id?: string
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          price?: number | null
          pricing_type?: string | null
          revisions_allowed?: number | null
          skills?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_offers_freelancer_id_fkey"
            columns: ["freelancer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_chat_messages: {
        Row: {
          attachments: string[] | null
          chat_id: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          sender_id: string
          sender_type: string
        }
        Insert: {
          attachments?: string[] | null
          chat_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          sender_id: string
          sender_type?: string
        }
        Update: {
          attachments?: string[] | null
          chat_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          sender_id?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "support_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      support_chats: {
        Row: {
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_violation_counts: {
        Row: {
          created_at: string
          is_suspended: boolean
          last_violation_at: string | null
          messaging_restricted_until: string | null
          total_violations: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          is_suspended?: boolean
          last_violation_at?: string | null
          messaging_restricted_until?: string | null
          total_violations?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          is_suspended?: boolean
          last_violation_at?: string | null
          messaging_restricted_until?: string | null
          total_violations?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      verification_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          contract_id: string | null
          created_at: string
          description: string | null
          id: string
          milestone_id: string | null
          reference: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after?: number
          contract_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          milestone_id?: string | null
          reference?: string | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          contract_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          milestone_id?: string | null
          reference?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          escrow_balance: number
          id: string
          total_earned: number
          total_spent: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number
          escrow_balance?: number
          id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number
          escrow_balance?: number
          id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          amount: number
          bank_detail_id: string
          created_at: string
          id: string
          reason: string | null
          status: string
          transfer_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          bank_detail_id: string
          created_at?: string
          id?: string
          reason?: string | null
          status?: string
          transfer_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          bank_detail_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          status?: string
          transfer_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_bank_detail_id_fkey"
            columns: ["bank_detail_id"]
            isOneToOne: false
            referencedRelation: "bank_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      work_experience: {
        Row: {
          company: string
          created_at: string
          description: string | null
          end_year: number | null
          id: string
          is_current: boolean
          role: string
          start_year: number
          user_id: string
        }
        Insert: {
          company: string
          created_at?: string
          description?: string | null
          end_year?: number | null
          id?: string
          is_current?: boolean
          role: string
          start_year: number
          user_id: string
        }
        Update: {
          company?: string
          created_at?: string
          description?: string | null
          end_year?: number | null
          id?: string
          is_current?: boolean
          role?: string
          start_year?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_experience_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_user_account: { Args: { _user_id: string }; Returns: Json }
      get_contest_entry_count: {
        Args: { _contest_id: string }
        Returns: number
      }
      get_funding_status: {
        Args: {
          _budget_max?: number
          _budget_min?: number
          _client_id: string
          _contract_id?: string
        }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      availability_type: "full_time" | "part_time" | "weekends" | "flexible"
      contract_status:
        | "active"
        | "completed"
        | "disputed"
        | "cancelled"
        | "draft"
        | "pending_funding"
        | "submitted"
        | "in_review"
        | "interviewing"
        | "rejected"
      job_status: "open" | "in_progress" | "completed" | "cancelled"
      proposal_status:
        | "pending"
        | "interviewing"
        | "accepted"
        | "rejected"
        | "withdrawn"
      user_role: "client" | "freelancer" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      availability_type: ["full_time", "part_time", "weekends", "flexible"],
      contract_status: [
        "active",
        "completed",
        "disputed",
        "cancelled",
        "draft",
        "pending_funding",
        "submitted",
        "in_review",
        "interviewing",
        "rejected",
      ],
      job_status: ["open", "in_progress", "completed", "cancelled"],
      proposal_status: [
        "pending",
        "interviewing",
        "accepted",
        "rejected",
        "withdrawn",
      ],
      user_role: ["client", "freelancer", "admin"],
    },
  },
} as const
