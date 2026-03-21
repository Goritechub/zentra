import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class ContractsService {
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

  async getContracts(authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);

    const { data, error } = await this.supabase
      .from("contracts")
      .select(
        "*, job:jobs!contracts_job_id_fkey(title, status), client:profiles!contracts_client_id_fkey(id, full_name, avatar_url), freelancer:profiles!contracts_freelancer_id_fkey(id, full_name, avatar_url)",
      )
      .or(`client_id.eq.${userId},freelancer_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return {
      success: true,
      data: {
        contracts: data || [],
      },
    };
  }

  async getDisputeDetail(disputeId: string, authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);

    const { data: dispute, error: disputeError } = await this.supabase
      .from("disputes")
      .select("*")
      .eq("id", disputeId)
      .single();

    if (disputeError) {
      throw new InternalServerErrorException(disputeError.message);
    }
    if (!dispute) {
      throw new NotFoundException("Dispute not found.");
    }

    const { data: contract, error: contractError } = await this.supabase
      .from("contracts")
      .select(
        "*, client:profiles!contracts_client_id_fkey(full_name, avatar_url, id), freelancer:profiles!contracts_freelancer_id_fkey(full_name, avatar_url, id)",
      )
      .eq("id", dispute.contract_id)
      .single();

    if (contractError) {
      throw new InternalServerErrorException(contractError.message);
    }

    const isParticipant =
      contract?.client_id === userId || contract?.freelancer_id === userId;
    const isAdjudicator = dispute.adjudicator_id === userId;

    if (!isParticipant && !isAdjudicator) {
      throw new UnauthorizedException("Access denied.");
    }

    return {
      success: true,
      data: {
        dispute,
        contract,
      },
    };
  }

  async getContractDetail(contractId: string, authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);

    const [
      contractRes,
      milestonesRes,
      disputesRes,
      escrowRes,
      walletTxRes,
      activityRes,
    ] = await Promise.all([
      this.supabase
        .from("contracts")
        .select(
          "*, client:profiles!contracts_client_id_fkey(full_name, avatar_url, id), freelancer:profiles!contracts_freelancer_id_fkey(full_name, avatar_url, id)",
        )
        .eq("id", contractId)
        .single(),
      this.supabase
        .from("milestones")
        .select("*")
        .eq("contract_id", contractId)
        .order("created_at", { ascending: true }),
      this.supabase
        .from("disputes")
        .select("*")
        .eq("contract_id", contractId)
        .order("created_at", { ascending: false }),
      this.supabase
        .from("escrow_ledger")
        .select("*")
        .eq("contract_id", contractId)
        .order("created_at", { ascending: false }),
      this.supabase
        .from("wallet_transactions")
        .select("*")
        .eq("contract_id", contractId)
        .order("created_at", { ascending: false }),
      this.supabase
        .from("contract_messages")
        .select("*")
        .eq("contract_id", contractId)
        .eq("is_system_message", true)
        .order("created_at", { ascending: false }),
    ]);

    for (const result of [
      contractRes,
      milestonesRes,
      disputesRes,
      escrowRes,
      walletTxRes,
      activityRes,
    ]) {
      if (result.error) {
        throw new InternalServerErrorException(result.error.message);
      }
    }

    const contract = contractRes.data;
    if (!contract) {
      throw new NotFoundException("Contract not found.");
    }
    if (contract.client_id !== userId && contract.freelancer_id !== userId) {
      throw new UnauthorizedException("Access denied.");
    }

    let reviewData: any = null;
    if (contract.status === "completed") {
      const { data, error } = await this.supabase
        .from("reviews")
        .select("id")
        .eq("contract_id", contractId)
        .eq("reviewer_id", userId)
        .maybeSingle();
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
      reviewData = data;
    }

    return {
      success: true,
      data: {
        contract,
        milestones: milestonesRes.data || [],
        disputes: disputesRes.data || [],
        escrowLedger: escrowRes.data || [],
        walletTransactions: walletTxRes.data || [],
        activityLog: activityRes.data || [],
        hasReviewed: !!reviewData,
      },
    };
  }

  async respondToDispute(
    disputeId: string,
    responseText: string,
    responseEvidenceUrls: string[],
    authorization?: string,
  ) {
    const userId = await this.getRequiredUserId(authorization);

    const { data: dispute, error: disputeError } = await this.supabase
      .from("disputes")
      .select("id, contract_id, respondent_id")
      .eq("id", disputeId)
      .single();

    if (disputeError) {
      throw new InternalServerErrorException(disputeError.message);
    }
    if (!dispute) {
      throw new NotFoundException("Dispute not found.");
    }

    if (dispute.respondent_id !== userId) {
      throw new UnauthorizedException("Only respondent can submit response.");
    }

    const { error: updateError } = await this.supabase
      .from("disputes")
      .update({
        respondent_explanation: (responseText || "").trim(),
        respondent_evidence_urls: responseEvidenceUrls || [],
        dispute_status: "under_review",
        status: "under_review",
        updated_at: new Date().toISOString(),
      })
      .eq("id", disputeId);

    if (updateError) {
      throw new InternalServerErrorException(updateError.message);
    }

    const { error: messageError } = await this.supabase.from("contract_messages").insert({
      contract_id: dispute.contract_id,
      sender_id: userId,
      content:
        "Response submitted to dispute. Case is now under review by a ZentraGig adjudicator.",
      is_system_message: true,
    });

    if (messageError) {
      throw new InternalServerErrorException(messageError.message);
    }

    return { success: true, data: { id: disputeId } };
  }

  async addMilestone(
    contractId: string,
    input: Record<string, any>,
    authorization?: string,
  ) {
    const userId = await this.getRequiredUserId(authorization);
    const { data: contract, error: contractError } = await this.supabase
      .from("contracts")
      .select("id, client_id")
      .eq("id", contractId)
      .single();
    if (contractError) {
      throw new InternalServerErrorException(contractError.message);
    }
    if (!contract || contract.client_id !== userId) {
      throw new UnauthorizedException("Only the client can add milestones.");
    }

    const { error } = await this.supabase.from("milestones").insert({
      contract_id: contractId,
      title: input.title || "",
      description: input.description || null,
      amount: input.amount ?? null,
      due_date: input.due_date || null,
    });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return { success: true, data: {} };
  }

  async submitReview(
    contractId: string,
    input: Record<string, any>,
    authorization?: string,
  ) {
    const userId = await this.getRequiredUserId(authorization);
    const { data: contract, error: contractError } = await this.supabase
      .from("contracts")
      .select("id, client_id, freelancer_id")
      .eq("id", contractId)
      .single();
    if (contractError) {
      throw new InternalServerErrorException(contractError.message);
    }
    if (!contract) {
      throw new NotFoundException("Contract not found.");
    }
    if (contract.client_id !== userId && contract.freelancer_id !== userId) {
      throw new UnauthorizedException("Only contract participants can review.");
    }

    const { error } = await this.supabase.from("reviews").insert({
      contract_id: contractId,
      reviewer_id: userId,
      reviewee_id: input.reviewee_id,
      rating: input.rating,
      comment: input.comment || null,
      rating_skills: input.rating_skills,
      rating_quality: input.rating_quality,
      rating_availability: input.rating_availability,
      rating_deadlines: input.rating_deadlines,
      rating_communication: input.rating_communication,
      rating_cooperation: input.rating_cooperation,
    } as any);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return { success: true, data: {} };
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
