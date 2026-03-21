import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

type AuthUser = {
  id: string;
};

@Injectable()
export class JobsService {
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

  async getOpenJobs(authorization?: string) {
    const user = await this.getOptionalUser(authorization);

    const { data, error } = await this.supabase
      .from("jobs")
      .select("*, client:profiles!jobs_client_id_fkey(full_name, avatar_url)")
      .eq("status", "open")
      .order("created_at", { ascending: false });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const jobs = (data || []).filter((job: any) => {
      if (job.visibility === "private") {
        return (
          !!user &&
          (job.client_id === user.id || (job.invited_expert_ids || []).includes(user.id))
        );
      }

      return true;
    });

    return {
      success: true,
      data: {
        jobs,
      },
    };
  }

  async getClientJobs(authorization?: string) {
    const user = await this.getRequiredUser(authorization);

    const { data: jobs, error: jobsError } = await this.supabase
      .from("jobs")
      .select("*")
      .eq("client_id", user.id)
      .order("created_at", { ascending: false });

    if (jobsError) {
      throw new InternalServerErrorException(jobsError.message);
    }

    const jobList = jobs || [];

    if (!jobList.length) {
      return {
        success: true,
        data: {
          jobs: [],
        },
      };
    }

    const jobIds = jobList.map((job: any) => job.id);

    const [proposalsRes, viewsRes] = await Promise.all([
      this.supabase
        .from("proposals")
        .select("id, job_id, status")
        .in("job_id", jobIds),
      this.supabase
        .from("job_views")
        .select("job_id")
        .in("job_id", jobIds),
    ]);

    if (proposalsRes.error) {
      throw new InternalServerErrorException(proposalsRes.error.message);
    }

    if (viewsRes.error) {
      throw new InternalServerErrorException(viewsRes.error.message);
    }

    const proposalMap = new Map<string, { total: number; interviewing: number }>();
    for (const proposal of proposalsRes.data || []) {
      if (!proposalMap.has(proposal.job_id)) {
        proposalMap.set(proposal.job_id, { total: 0, interviewing: 0 });
      }

      const entry = proposalMap.get(proposal.job_id)!;
      entry.total += 1;

      if (proposal.status === "interviewing") {
        entry.interviewing += 1;
      }
    }

    const viewMap = new Map<string, number>();
    for (const view of viewsRes.data || []) {
      viewMap.set(view.job_id, (viewMap.get(view.job_id) || 0) + 1);
    }

    return {
      success: true,
      data: {
        jobs: jobList.map((job: any) => ({
          ...job,
          _proposalCount: proposalMap.get(job.id)?.total || 0,
          _invitedCount: (job.invited_expert_ids || []).length,
          _interviewingCount: proposalMap.get(job.id)?.interviewing || 0,
          _viewCount: viewMap.get(job.id) || 0,
        })),
      },
    };
  }

  async searchInviteExperts(query: string, authorization?: string) {
    await this.getRequiredUser(authorization);
    if (!query || query.trim().length < 2) {
      return { success: true, data: { experts: [] } };
    }

    const { data, error } = await this.supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("role", "freelancer")
      .ilike("full_name", `%${query.trim()}%`)
      .limit(10);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return { success: true, data: { experts: data || [] } };
  }

  async createJob(input: Record<string, any>, authorization?: string) {
    const user = await this.getRequiredUser(authorization);

    const payload = {
      client_id: user.id,
      title: (input.title || "").trim(),
      description: (input.description || "").trim(),
      budget_min: input.budget_min ?? null,
      budget_max: input.budget_max ?? null,
      delivery_days: input.delivery_days ?? null,
      delivery_unit: input.delivery_unit || "days",
      is_remote: input.is_remote !== false,
      is_hourly: input.is_hourly === true,
      state: input.state || null,
      city: input.city || null,
      required_skills: Array.isArray(input.required_skills) ? input.required_skills : [],
      required_software: Array.isArray(input.required_software)
        ? input.required_software
        : [],
      skill_level: input.skill_level || "Intermediate",
      attachments: input.attachments || null,
      visibility: input.visibility || "public",
      invited_expert_ids: Array.isArray(input.invited_expert_ids)
        ? input.invited_expert_ids
        : [],
    };

    const { data, error } = await this.supabase
      .from("jobs")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return { success: true, data: { id: data?.id } };
  }

  async getJobOverview(jobId?: string, authorization?: string) {
    if (!jobId) {
      throw new NotFoundException("Job id is required.");
    }

    const user = await this.getOptionalUser(authorization);

    const { data: job, error } = await this.supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    if (!job) {
      throw new NotFoundException("Job not found.");
    }

    const [
      clientRes,
      proposalRes,
      interviewRes,
      walletRes,
      appliedRes,
      proposalsForJobRes,
      interviewContractsRes,
      similarJobsRes,
    ] = await Promise.all([
      this.supabase.from("profiles").select("*").eq("id", job.client_id).single(),
      this.supabase.from("proposals").select("id", { count: "exact", head: true }).eq("job_id", jobId),
      this.supabase.from("proposals").select("id", { count: "exact", head: true }).eq("job_id", jobId).eq("status", "interviewing"),
      user ? this.supabase.from("wallets").select("*").eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      user ? this.supabase.from("proposals").select("id").eq("job_id", jobId).eq("freelancer_id", user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      user && job.client_id === user.id
        ? this.supabase
            .from("proposals")
            .select("*, freelancer:profiles!proposals_freelancer_id_fkey(id, full_name, avatar_url, state, city, is_verified)")
            .eq("job_id", jobId)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      user && job.client_id === user.id
        ? this.supabase
            .from("contracts")
            .select("*, freelancer:profiles!contracts_freelancer_id_fkey(id, full_name, avatar_url, state, city)")
            .eq("job_id", jobId)
            .in("status", ["interviewing"] as any)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      user
        ? this.getRelatedJobs(job, user.id)
        : Promise.resolve({ data: [], error: null }),
    ]);

    for (const result of [clientRes, proposalRes, interviewRes, walletRes, appliedRes, proposalsForJobRes, interviewContractsRes, similarJobsRes]) {
      if (result.error) {
        throw new InternalServerErrorException(result.error.message);
      }
    }

    let enrichedProposals = proposalsForJobRes.data || [];
    const freelancerIds = [...new Set(enrichedProposals.map((proposal: any) => proposal.freelancer_id))];
    if (freelancerIds.length) {
      const { data: kycData, error: kycError } = await this.supabase
        .from("kyc_verifications" as any)
        .select("user_id, kyc_status, zentra_verified")
        .in("user_id", freelancerIds);

      if (kycError) {
        throw new InternalServerErrorException(kycError.message);
      }

      const kycMap = new Map<string, any>();
      for (const kyc of kycData || []) {
        kycMap.set(kyc.user_id, kyc);
      }

      enrichedProposals = enrichedProposals.map((proposal: any) => ({
        ...proposal,
        kyc: kycMap.get(proposal.freelancer_id) || null,
      }));
    }

    return {
      success: true,
      data: {
        job,
        client: clientRes.data || null,
        wallet: walletRes.data || null,
        proposalCount: proposalRes.count || 0,
        interviewingCount: interviewRes.count || 0,
        hasApplied: !!appliedRes.data,
        proposals: enrichedProposals,
        interviewContracts: interviewContractsRes.data || [],
        similarJobs: similarJobsRes.data || [],
      },
    };
  }

  async getClientJobCancelState(jobId: string, authorization?: string) {
    const user = await this.getRequiredUser(authorization);

    const { data: job, error: jobError } = await this.supabase
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .eq("client_id", user.id)
      .maybeSingle();
    if (jobError) {
      throw new InternalServerErrorException(jobError.message);
    }
    if (!job) {
      throw new NotFoundException("Job not found.");
    }

    const { data: contract, error: contractError } = await this.supabase
      .from("contracts")
      .select("id")
      .eq("job_id", jobId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (contractError) {
      throw new InternalServerErrorException(contractError.message);
    }

    return {
      success: true,
      data: {
        hasAssignment: !!contract,
        contractId: contract?.id || null,
      },
    };
  }

  async trackJobView(jobId: string, authorization?: string) {
    const user = await this.getRequiredUser(authorization);
    const { error } = await this.supabase
      .from("job_views")
      .upsert(
        {
          job_id: jobId,
          viewer_id: user.id,
        } as any,
        { onConflict: "job_id,viewer_id" },
      );

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return { success: true, data: { jobId } };
  }

  async cancelClientJob(jobId: string, authorization?: string) {
    const user = await this.getRequiredUser(authorization);

    const { error } = await this.supabase
      .from("jobs")
      .update({ status: "cancelled" })
      .eq("id", jobId)
      .eq("client_id", user.id);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return { success: true, data: { id: jobId, status: "cancelled" } };
  }

  async createJobDispute(jobId: string, reason: string, authorization?: string) {
    const user = await this.getRequiredUser(authorization);

    const { data: contract, error: contractError } = await this.supabase
      .from("contracts")
      .select("id, job_id")
      .eq("job_id", jobId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (contractError) {
      throw new InternalServerErrorException(contractError.message);
    }

    if (!contract) {
      throw new NotFoundException("No active contract found for this job.");
    }

    const { data: job, error: jobError } = await this.supabase
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .eq("client_id", user.id)
      .maybeSingle();
    if (jobError) {
      throw new InternalServerErrorException(jobError.message);
    }
    if (!job) {
      throw new NotFoundException("Job not found.");
    }

    const { error: disputeError } = await this.supabase.from("disputes").insert({
      contract_id: contract.id,
      raised_by: user.id,
      reason: (reason || "").trim(),
      status: "open",
    });
    if (disputeError) {
      throw new InternalServerErrorException(disputeError.message);
    }

    const { error: contractUpdateError } = await this.supabase
      .from("contracts")
      .update({ status: "disputed" })
      .eq("id", contract.id);
    if (contractUpdateError) {
      throw new InternalServerErrorException(contractUpdateError.message);
    }

    return { success: true, data: { jobId, contractId: contract.id } };
  }

  private getRelatedJobs(job: any, userId: string) {
    if (job.client_id === userId) {
      return this.supabase
        .from("jobs")
        .select("id, title, budget_min, budget_max, is_hourly, created_at, state, city, is_remote, delivery_days, status")
        .eq("client_id", userId)
        .neq("id", job.id)
        .order("created_at", { ascending: false })
        .limit(4);
    }

    return this.supabase
      .from("jobs")
      .select("id, title, budget_min, budget_max, is_hourly, created_at, state, city, is_remote, delivery_days, status")
      .eq("status", "open")
      .neq("id", job.id)
      .limit(4);
  }

  private async getOptionalUser(authorization?: string): Promise<AuthUser | null> {
    const token = this.extractBearerToken(authorization);

    if (!token) {
      return null;
    }

    const {
      data: { user },
      error,
    } = await this.supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return { id: user.id };
  }

  private async getRequiredUser(authorization?: string): Promise<AuthUser> {
    const token = this.extractBearerToken(authorization);

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

    return { id: user.id };
  }

  private extractBearerToken(authorization?: string) {
    return authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : null;
  }
}
