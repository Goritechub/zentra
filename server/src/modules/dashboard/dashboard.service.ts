import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class DashboardService {
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

  async getOverview(authorization?: string) {
    const user = await this.getRequiredUser(authorization);

    const [{ data: profile, error: profileError }, { data: adminRole, error: roleError }] =
      await Promise.all([
        this.supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle(),
        this.supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle(),
      ]);

    if (profileError) throw new InternalServerErrorException(profileError.message);
    if (roleError) throw new InternalServerErrorException(roleError.message);

    if (!profile) {
      return {
        success: true,
        data: {
          stats: { jobs: 0, proposals: 0, messages: 0, contracts: 0 },
          recentJobs: [],
          freelancerProfile: null,
          isAdmin: !!adminRole,
        },
      };
    }

    const isClient = profile.role === "client";

    const [primaryRes, proposalsCount, unreadCount, contractsCount] = await Promise.all([
      isClient
        ? this.supabase.from("jobs").select("id", { count: "exact", head: true }).eq("client_id", user.id)
        : this.supabase.from("proposals").select("id", { count: "exact", head: true }).eq("freelancer_id", user.id),
      isClient ? this.countClientProposalInbox(user.id) : this.supabase.from("proposals").select("id", { count: "exact", head: true }).eq("freelancer_id", user.id),
      this.supabase.rpc("count_unread_contract_messages" as any, { _user_id: user.id } as any),
      this.supabase.from("contracts").select("id", { count: "exact", head: true }).or(`client_id.eq.${user.id},freelancer_id.eq.${user.id}`),
    ]);

    if (primaryRes.error) throw new InternalServerErrorException(primaryRes.error.message);
    if ("error" in proposalsCount && proposalsCount.error) throw new InternalServerErrorException(proposalsCount.error.message);
    if (unreadCount.error) throw new InternalServerErrorException(unreadCount.error.message);
    if (contractsCount.error) throw new InternalServerErrorException(contractsCount.error.message);

    const stats = {
      jobs: primaryRes.count || 0,
      proposals: "count" in proposalsCount ? proposalsCount.count || 0 : 0,
      messages: typeof unreadCount.data === "number" ? unreadCount.data : 0,
      contracts: contractsCount.count || 0,
    };

    if (isClient) {
      const { data: recentJobs, error } = await this.supabase
        .from("jobs")
        .select("*")
        .eq("client_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw new InternalServerErrorException(error.message);

      return {
        success: true,
        data: {
          stats,
          recentJobs: recentJobs || [],
          freelancerProfile: null,
          isAdmin: !!adminRole,
        },
      };
    }

    const { data: freelancerProfile, error } = await this.supabase
      .from("freelancer_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw new InternalServerErrorException(error.message);

    return {
      success: true,
      data: {
        stats,
        recentJobs: [],
        freelancerProfile: freelancerProfile || null,
        isAdmin: !!adminRole,
      },
    };
  }

  private async countClientProposalInbox(userId: string) {
    const jobs = await this.supabase.from("jobs").select("id").eq("client_id", userId);
    if (jobs.error) return jobs;
    if (!jobs.data?.length) return { count: 0 };
    return this.supabase.from("proposals").select("id", { count: "exact", head: true }).in("job_id", jobs.data.map((job: any) => job.id));
  }

  private async getRequiredUser(authorization?: string) {
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : null;

    if (!token) throw new UnauthorizedException("Missing bearer token.");

    const {
      data: { user },
      error,
    } = await this.supabase.auth.getUser(token);

    if (error || !user) throw new UnauthorizedException("Invalid or expired session.");

    return user;
  }
}
