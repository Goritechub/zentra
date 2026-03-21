import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { SupabaseAdminService } from "../shared/supabase-admin.service";

@Injectable()
export class ClientReadService {
  constructor(private readonly supabaseAdmin: SupabaseAdminService) {}

  async getBrowseContests(_authorization?: string) {
    const supabase = this.supabaseAdmin.getClient();

    const { data, error } = await supabase
      .from("contests")
      .select("*, client:profiles!contests_client_id_fkey(full_name)")
      .order("created_at", { ascending: false });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const contests = (data || []) as any[];
    const withCounts = await this.attachContestCounts(contests);

    return {
      success: true,
      data: {
        contests: withCounts,
      },
    };
  }

  async getMyContests(authorization?: string) {
    const supabase = this.supabaseAdmin.getClient();
    const userId = await this.supabaseAdmin.getRequiredUserId(authorization);

    const { data, error } = await supabase
      .from("contests")
      .select("*")
      .eq("client_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const contests = (data || []) as any[];
    const withCounts = await this.attachContestCounts(contests);

    return {
      success: true,
      data: {
        contests: withCounts,
      },
    };
  }

  async getSavedExperts(authorization?: string) {
    const supabase = this.supabaseAdmin.getClient();
    const userId = await this.supabaseAdmin.getRequiredUserId(authorization);

    const { data: savedExperts, error: savedError } = await supabase
      .from("saved_experts")
      .select("*, freelancer:profiles!saved_experts_freelancer_id_fkey(*)")
      .eq("client_id", userId)
      .order("created_at", { ascending: false });

    if (savedError) {
      throw new InternalServerErrorException(savedError.message);
    }

    const saved = (savedExperts || []) as any[];
    if (!saved.length) {
      return {
        success: true,
        data: {
          savedExperts: [],
        },
      };
    }

    const freelancerIds = [...new Set(saved.map((item) => item.freelancer_id).filter(Boolean))];
    const { data: freelancerProfiles, error: profileError } = await supabase
      .from("freelancer_profiles")
      .select("*")
      .in("user_id", freelancerIds);

    if (profileError) {
      throw new InternalServerErrorException(profileError.message);
    }

    const freelancerProfileMap = new Map<string, any>();
    for (const profile of freelancerProfiles || []) {
      freelancerProfileMap.set(profile.user_id, profile);
    }

    return {
      success: true,
      data: {
        savedExperts: saved.map((item) => ({
          ...item,
          freelancerProfile: freelancerProfileMap.get(item.freelancer_id) || null,
        })),
      },
    };
  }

  async removeSavedExpert(savedExpertId: string, authorization?: string) {
    const supabase = this.supabaseAdmin.getClient();
    const userId = await this.supabaseAdmin.getRequiredUserId(authorization);

    const { error } = await supabase
      .from("saved_experts")
      .delete()
      .eq("id", savedExpertId)
      .eq("client_id", userId);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return {
      success: true,
      data: {
        id: savedExpertId,
      },
    };
  }

  async getBrowseExperts(authorization?: string) {
    const supabase = this.supabaseAdmin.getClient();
    const userId = await this.supabaseAdmin.getOptionalUserId(authorization);

    const { data: freelancers, error: freelancersError } = await supabase
      .from("freelancer_profiles")
      .select("*, profile:profiles!freelancer_profiles_user_id_fkey(*)");

    if (freelancersError) {
      throw new InternalServerErrorException(freelancersError.message);
    }

    if (!userId) {
      return {
        success: true,
        data: {
          freelancers: freelancers || [],
          savedIds: [],
          savedExperts: [],
        },
      };
    }

    const savedResponse = await this.getSavedExperts(authorization);
    const savedExperts = savedResponse.data.savedExperts || [];

    return {
      success: true,
      data: {
        freelancers: freelancers || [],
        savedIds: savedExperts.map((item: any) => item.freelancer_id).filter(Boolean),
        savedExperts,
      },
    };
  }

  async getBrowseServices(_authorization?: string) {
    const supabase = this.supabaseAdmin.getClient();
    const { data, error } = await supabase
      .from("service_offers")
      .select(
        "*, freelancer:profiles!service_offers_freelancer_id_fkey(full_name, avatar_url, username)",
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return {
      success: true,
      data: {
        services: data || [],
      },
    };
  }

  async getPublishedLegalDocument(slug: string, _authorization?: string) {
    const supabase = this.supabaseAdmin.getClient();
    const { data, error } = await supabase
      .from("legal_documents")
      .select("title, content")
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return {
      success: true,
      data: {
        document: data || null,
      },
    };
  }

  async saveExpert(freelancerId: string, authorization?: string) {
    const supabase = this.supabaseAdmin.getClient();
    const userId = await this.supabaseAdmin.getRequiredUserId(authorization);

    const { error } = await supabase.from("saved_experts").upsert(
      {
        client_id: userId,
        freelancer_id: freelancerId,
      },
      {
        onConflict: "client_id,freelancer_id",
        ignoreDuplicates: true,
      },
    );

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return {
      success: true,
      data: {
        freelancerId,
      },
    };
  }

  async removeSavedExpertByFreelancer(
    freelancerId: string,
    authorization?: string,
  ) {
    const supabase = this.supabaseAdmin.getClient();
    const userId = await this.supabaseAdmin.getRequiredUserId(authorization);

    const { error } = await supabase
      .from("saved_experts")
      .delete()
      .eq("client_id", userId)
      .eq("freelancer_id", freelancerId);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return {
      success: true,
      data: {
        freelancerId,
      },
    };
  }

  private async attachContestCounts(contests: any[]) {
    if (!contests.length) {
      return [];
    }

    const supabase = this.supabaseAdmin.getClient();
    const contestIds = contests.map((contest) => contest.id);

    const [entriesRes, winnersRes] = await Promise.all([
      supabase
        .from("contest_entries")
        .select("contest_id")
        .in("contest_id", contestIds),
      supabase
        .from("contest_entries")
        .select("contest_id")
        .in("contest_id", contestIds)
        .eq("is_winner", true),
    ]);

    if (entriesRes.error) {
      throw new InternalServerErrorException(entriesRes.error.message);
    }

    if (winnersRes.error) {
      throw new InternalServerErrorException(winnersRes.error.message);
    }

    const entryCountMap = new Map<string, number>();
    for (const row of entriesRes.data || []) {
      entryCountMap.set(row.contest_id, (entryCountMap.get(row.contest_id) || 0) + 1);
    }

    const winnerCountMap = new Map<string, number>();
    for (const row of winnersRes.data || []) {
      winnerCountMap.set(row.contest_id, (winnerCountMap.get(row.contest_id) || 0) + 1);
    }

    return contests.map((contest) => ({
      ...contest,
      _entryCount: entryCountMap.get(contest.id) || 0,
      _winnersCount: winnerCountMap.get(contest.id) || 0,
    }));
  }
}
