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
      contest_entries: {
        Row: {
          attachments: string[] | null
          contest_id: string
          created_at: string | null
          description: string | null
          freelancer_id: string
          id: string
          is_winner: boolean | null
          prize_position: number | null
        }
        Insert: {
          attachments?: string[] | null
          contest_id: string
          created_at?: string | null
          description?: string | null
          freelancer_id: string
          id?: string
          is_winner?: boolean | null
          prize_position?: number | null
        }
        Update: {
          attachments?: string[] | null
          contest_id?: string
          created_at?: string | null
          description?: string | null
          freelancer_id?: string
          id?: string
          is_winner?: boolean | null
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
      contests: {
        Row: {
          category: string | null
          client_id: string
          created_at: string | null
          deadline: string
          description: string
          id: string
          prize_first: number
          prize_second: number | null
          prize_third: number | null
          required_skills: string[] | null
          required_software: string[] | null
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          client_id: string
          created_at?: string | null
          deadline: string
          description: string
          id?: string
          prize_first?: number
          prize_second?: number | null
          prize_third?: number | null
          required_skills?: string[] | null
          required_software?: string[] | null
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          client_id?: string
          created_at?: string | null
          deadline?: string
          description?: string
          id?: string
          prize_first?: number
          prize_second?: number | null
          prize_third?: number | null
          required_skills?: string[] | null
          required_software?: string[] | null
          status?: string
          title?: string
          updated_at?: string | null
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
      contracts: {
        Row: {
          amount: number
          client_id: string
          completed_at: string | null
          created_at: string | null
          freelancer_id: string
          id: string
          job_id: string | null
          proposal_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["contract_status"] | null
        }
        Insert: {
          amount: number
          client_id: string
          completed_at?: string | null
          created_at?: string | null
          freelancer_id: string
          id?: string
          job_id?: string | null
          proposal_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["contract_status"] | null
        }
        Update: {
          amount?: number
          client_id?: string
          completed_at?: string | null
          created_at?: string | null
          freelancer_id?: string
          id?: string
          job_id?: string | null
          proposal_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["contract_status"] | null
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
          admin_notes: string | null
          contract_id: string
          created_at: string
          evidence_urls: string[] | null
          id: string
          milestone_id: string | null
          raised_by: string
          reason: string
          resolved_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          contract_id: string
          created_at?: string
          evidence_urls?: string[] | null
          id?: string
          milestone_id?: string | null
          raised_by: string
          reason: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          contract_id?: string
          created_at?: string
          evidence_urls?: string[] | null
          id?: string
          milestone_id?: string | null
          raised_by?: string
          reason?: string
          resolved_at?: string | null
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
      jobs: {
        Row: {
          attachments: string[] | null
          budget_max: number | null
          budget_min: number | null
          city: string | null
          client_id: string
          created_at: string | null
          delivery_days: number | null
          description: string
          id: string
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
        }
        Insert: {
          attachments?: string[] | null
          budget_max?: number | null
          budget_min?: number | null
          city?: string | null
          client_id: string
          created_at?: string | null
          delivery_days?: number | null
          description: string
          id?: string
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
        }
        Update: {
          attachments?: string[] | null
          budget_max?: number | null
          budget_min?: number | null
          city?: string | null
          client_id?: string
          created_at?: string | null
          delivery_days?: number | null
          description?: string
          id?: string
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
          avatar_url: string | null
          city: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          is_verified: boolean | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          state: string | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          is_verified?: boolean | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          state?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_verified?: boolean | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          state?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      proposals: {
        Row: {
          bid_amount: number
          cover_letter: string
          created_at: string | null
          delivery_days: number
          edit_count: number
          freelancer_id: string
          id: string
          job_id: string
          last_edited_at: string | null
          status: Database["public"]["Enums"]["proposal_status"] | null
          updated_at: string | null
        }
        Insert: {
          bid_amount: number
          cover_letter: string
          created_at?: string | null
          delivery_days: number
          edit_count?: number
          freelancer_id: string
          id?: string
          job_id: string
          last_edited_at?: string | null
          status?: Database["public"]["Enums"]["proposal_status"] | null
          updated_at?: string | null
        }
        Update: {
          bid_amount?: number
          cover_letter?: string
          created_at?: string | null
          delivery_days?: number
          edit_count?: number
          freelancer_id?: string
          id?: string
          job_id?: string
          last_edited_at?: string | null
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
          reviewee_id: string
          reviewer_id: string
        }
        Insert: {
          comment?: string | null
          contract_id: string
          created_at?: string | null
          id?: string
          rating: number
          reviewee_id: string
          reviewer_id: string
        }
        Update: {
          comment?: string | null
          contract_id?: string
          created_at?: string | null
          id?: string
          rating?: number
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
          category: string | null
          created_at: string | null
          delivery_days: number | null
          description: string
          freelancer_id: string
          id: string
          is_active: boolean | null
          price: number | null
          skills: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          delivery_days?: number | null
          description: string
          freelancer_id: string
          id?: string
          is_active?: boolean | null
          price?: number | null
          skills?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          delivery_days?: number | null
          description?: string
          freelancer_id?: string
          id?: string
          is_active?: boolean | null
          price?: number | null
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
      transactions: {
        Row: {
          amount: number
          contract_id: string | null
          created_at: string | null
          description: string | null
          id: string
          reference: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          contract_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          reference?: string | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          contract_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          reference?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      availability_type: "full_time" | "part_time" | "weekends" | "flexible"
      contract_status: "active" | "completed" | "disputed" | "cancelled"
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
      contract_status: ["active", "completed", "disputed", "cancelled"],
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
