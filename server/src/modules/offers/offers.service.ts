import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class OffersService {
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

  async getReceivedOffers(authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);

    const [privateJobsRes, directOffersRes] = await Promise.all([
      this.supabase
        .from("jobs")
        .select("*, client:profiles!jobs_client_id_fkey(id, full_name, avatar_url, state, city)")
        .eq("visibility", "private")
        .eq("status", "open")
        .contains("invited_expert_ids", [userId]),
      this.supabase
        .from("offers")
        .select("*, client:profiles!offers_client_id_fkey(id, full_name, avatar_url)")
        .eq("freelancer_id", userId)
        .order("created_at", { ascending: false }),
    ]);

    if (privateJobsRes.error) {
      throw new InternalServerErrorException(privateJobsRes.error.message);
    }

    if (directOffersRes.error) {
      throw new InternalServerErrorException(directOffersRes.error.message);
    }

    const jobOffers = (privateJobsRes.data || []).map((job: any) => ({
      _type: "job_offer",
      id: job.id,
      title: job.title,
      description: job.description,
      budget: job.budget_max || job.budget_min,
      budget_min: job.budget_min,
      budget_max: job.budget_max,
      client: job.client,
      client_id: job.client_id,
      created_at: job.created_at,
      state: job.state,
      city: job.city,
      is_remote: job.is_remote,
      delivery_days: job.delivery_days,
      delivery_unit: job.delivery_unit,
      required_skills: job.required_skills,
      status: "pending",
      job_id: job.id,
    }));

    const directOffers = ((directOffersRes.data as any[]) || []).map((offer: any) => ({
      _type: "direct_offer",
      ...offer,
    }));

    const offers = [...jobOffers, ...directOffers].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    return {
      success: true,
      data: {
        offers,
      },
    };
  }

  async getSentOffers(authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);

    const [offersRes, jobsRes] = await Promise.all([
      this.supabase
        .from("offers")
        .select("*, freelancer:profiles!offers_freelancer_id_fkey(full_name, avatar_url)")
        .eq("client_id", userId)
        .order("created_at", { ascending: false }),
      this.supabase
        .from("jobs")
        .select("*")
        .eq("client_id", userId)
        .eq("visibility", "private")
        .order("created_at", { ascending: false }),
    ]);

    if (offersRes.error) {
      throw new InternalServerErrorException(offersRes.error.message);
    }

    if (jobsRes.error) {
      throw new InternalServerErrorException(jobsRes.error.message);
    }

    return {
      success: true,
      data: {
        offers: (offersRes.data as any[]) || [],
        privateJobs: (jobsRes.data as any[]) || [],
      },
    };
  }

  async cancelSentOfferJob(jobId: string, authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);
    const { error } = await this.supabase
      .from("jobs")
      .update({ status: "cancelled" })
      .eq("id", jobId)
      .eq("client_id", userId);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return {
      success: true,
      data: {
        jobId,
        status: "cancelled",
      },
    };
  }

  async declineOffer(
    offerType: "direct_offer" | "job_offer",
    offerId: string | null,
    jobId: string | null,
    title: string | null,
    clientId: string | null,
    authorization?: string,
  ) {
    const userId = await this.getRequiredUserId(authorization);

    if (offerType === "direct_offer" && offerId) {
      const { error } = await this.supabase
        .from("offers")
        .update({ status: "rejected" })
        .eq("id", offerId)
        .eq("freelancer_id", userId);

      if (error) {
        throw new InternalServerErrorException(error.message);
      }
    }

    if (offerType === "job_offer" && jobId) {
      const { data: job, error: jobError } = await this.supabase
        .from("jobs")
        .select("invited_expert_ids")
        .eq("id", jobId)
        .single();
      if (jobError) {
        throw new InternalServerErrorException(jobError.message);
      }

      const invited = (job?.invited_expert_ids || []) as string[];
      const updated = invited.filter((id) => id !== userId);
      const { error: updateError } = await this.supabase
        .from("jobs")
        .update({ invited_expert_ids: updated })
        .eq("id", jobId);
      if (updateError) {
        throw new InternalServerErrorException(updateError.message);
      }
    }

    if (clientId) {
      const { error: notifyError } = await this.supabase.from("notifications").insert({
        user_id: clientId,
        title: "Offer Declined",
        message: `An expert declined your offer: "${title || "Offer"}"`,
        type: "offer_declined",
      });
      if (notifyError) {
        throw new InternalServerErrorException(notifyError.message);
      }
    }

    return { success: true, data: { declined: true } };
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
