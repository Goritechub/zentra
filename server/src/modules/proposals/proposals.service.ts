import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class ProposalsService {
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

  async getExpertOverview(authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);

    const [proposalsRes, offersRes] = await Promise.all([
      this.supabase
        .from("proposals")
        .select(
          "*, job:jobs(id, title, client_id, budget_min, budget_max, is_hourly, status, client:profiles!jobs_client_id_fkey(full_name, avatar_url))",
        )
        .eq("freelancer_id", userId)
        .order("created_at", { ascending: false }),
      this.supabase
        .from("offers")
        .select("*, client:profiles!offers_client_id_fkey(full_name, avatar_url)")
        .eq("freelancer_id", userId)
        .order("created_at", { ascending: false }),
    ]);

    if (proposalsRes.error) {
      throw new InternalServerErrorException(proposalsRes.error.message);
    }

    if (offersRes.error) {
      throw new InternalServerErrorException(offersRes.error.message);
    }

    const proposals = proposalsRes.data || [];
    const offers = offersRes.data || [];
    const interviewing = proposals.filter((proposal: any) => proposal.status === "interviewing");
    const proposalIds = interviewing.map((proposal: any) => proposal.id);

    let interviewContracts: Record<string, string> = {};
    if (proposalIds.length) {
      const { data, error } = await this.supabase
        .from("contracts")
        .select("id, proposal_id")
        .in("proposal_id", proposalIds)
        .eq("status", "interviewing" as any);

      if (error) {
        throw new InternalServerErrorException(error.message);
      }

      interviewContracts = (data || []).reduce((acc: Record<string, string>, contract: any) => {
        if (contract.proposal_id) {
          acc[contract.proposal_id] = contract.id;
        }
        return acc;
      }, {});
    }

    return {
      success: true,
      data: {
        proposals,
        offers,
        interviewContracts,
      },
    };
  }

  async getClientReceivedOverview(authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);

    const [{ data: wallet, error: walletError }, { data: jobs, error: jobsError }] = await Promise.all([
      this.supabase.from("wallets").select("*").eq("user_id", userId).maybeSingle(),
      this.supabase.from("jobs").select("id, title, status").eq("client_id", userId),
    ]);

    if (walletError) {
      throw new InternalServerErrorException(walletError.message);
    }

    if (jobsError) {
      throw new InternalServerErrorException(jobsError.message);
    }

    if (!jobs?.length) {
      return {
        success: true,
        data: {
          wallet,
          jobs: [],
          proposals: [],
          jobContracts: [],
        },
      };
    }

    const jobIds = jobs.map((job: any) => job.id);
    const [proposalsRes, contractsRes] = await Promise.all([
      this.supabase
        .from("proposals")
        .select(
          "*, freelancer:profiles!proposals_freelancer_id_fkey(full_name, avatar_url, state, city, is_verified)",
        )
        .in("job_id", jobIds)
        .order("created_at", { ascending: false }),
      this.supabase
        .from("contracts")
        .select("id, job_id, status, freelancer_id")
        .in("job_id", jobIds)
        .in("status", ["active", "completed", "pending_funding", "disputed"] as any),
    ]);

    if (proposalsRes.error) {
      throw new InternalServerErrorException(proposalsRes.error.message);
    }

    if (contractsRes.error) {
      throw new InternalServerErrorException(contractsRes.error.message);
    }

    const proposals = proposalsRes.data || [];
    const freelancerIds = [...new Set(proposals.map((proposal: any) => proposal.freelancer_id))];

    let kycMap = new Map<string, any>();
    if (freelancerIds.length) {
      const { data: kycData, error: kycError } = await this.supabase
        .from("kyc_verifications" as any)
        .select("user_id, kyc_status, zentra_verified")
        .in("user_id", freelancerIds);

      if (kycError) {
        throw new InternalServerErrorException(kycError.message);
      }

      for (const kyc of kycData || []) {
        kycMap.set(kyc.user_id, kyc);
      }
    }

    const enrichedProposals = proposals.map((proposal: any) => ({
      ...proposal,
      job_title: jobs.find((job: any) => job.id === proposal.job_id)?.title || "Unknown Job",
      kyc: kycMap.get(proposal.freelancer_id) || null,
    }));

    return {
      success: true,
      data: {
        wallet,
        jobs,
        proposals: enrichedProposals,
        jobContracts: contractsRes.data || [],
      },
    };
  }

  async getMyApplyContext(jobId: string, authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);

    const { data: job, error: jobError } = await this.supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError) {
      throw new InternalServerErrorException(jobError.message);
    }

    const { data: existingProposal, error: proposalError } = await this.supabase
      .from("proposals")
      .select("*")
      .eq("job_id", jobId)
      .eq("freelancer_id", userId)
      .maybeSingle();

    if (proposalError) {
      throw new InternalServerErrorException(proposalError.message);
    }

    return {
      success: true,
      data: {
        job: job || null,
        existingProposal: existingProposal || null,
      },
    };
  }

  async submitMyProposal(jobId: string, input: Record<string, any>, authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);
    const payload = {
      job_id: jobId,
      bid_amount: Number(input.bid_amount || 0),
      delivery_days: Number(input.delivery_days || 0),
      delivery_unit: input.delivery_unit || "days",
      cover_letter: (input.cover_letter || "").trim(),
      attachments: Array.isArray(input.attachments) ? input.attachments : undefined,
      payment_type: input.payment_type || "project",
      milestones: Array.isArray(input.milestones) ? input.milestones : [],
    };

    const { data: moderationData, error: moderationError } = await this.supabase.functions.invoke(
      "moderate-proposal",
      { body: payload },
    );

    if (moderationError) {
      throw new BadRequestException(moderationError.message || "Proposal moderation failed.");
    }

    if (moderationData?.error) {
      throw new BadRequestException(moderationData.error);
    }

    const { data: proposal, error: proposalError } = await this.supabase
      .from("proposals")
      .select("*")
      .eq("job_id", jobId)
      .eq("freelancer_id", userId)
      .maybeSingle();

    if (proposalError) {
      throw new InternalServerErrorException(proposalError.message);
    }

    return {
      success: true,
      data: {
        proposal: proposal || null,
      },
    };
  }

  async updateMyProposal(proposalId: string, input: Record<string, any>, authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);

    const { data: ownedProposal, error: ownedProposalError } = await this.supabase
      .from("proposals")
      .select("id, freelancer_id")
      .eq("id", proposalId)
      .maybeSingle();

    if (ownedProposalError) {
      throw new InternalServerErrorException(ownedProposalError.message);
    }

    if (!ownedProposal) {
      throw new NotFoundException("Proposal not found.");
    }

    if (ownedProposal.freelancer_id !== userId) {
      throw new UnauthorizedException("You can only update your own proposal.");
    }

    const { data: updated, error: updateError } = await this.supabase
      .from("proposals")
      .update({
        bid_amount: Number(input.bid_amount || 0),
        delivery_days: Number(input.delivery_days || 0),
        delivery_unit: input.delivery_unit || "days",
        cover_letter: (input.cover_letter || "").trim(),
        payment_type: input.payment_type || "project",
        milestones: Array.isArray(input.milestones) ? input.milestones : [],
        edit_count: Number(input.edit_count || 0),
        last_edited_at: input.last_edited_at || new Date().toISOString(),
      } as any)
      .eq("id", proposalId)
      .eq("freelancer_id", userId)
      .select("*")
      .single();

    if (updateError) {
      throw new InternalServerErrorException(updateError.message);
    }

    return {
      success: true,
      data: {
        proposal: updated,
      },
    };
  }

  async updateStatus(proposalId: string, status: string, authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);
    const proposal = await this.getClientOwnedProposal(proposalId, userId);

    const { error } = await this.supabase
      .from("proposals")
      .update({ status } as any)
      .eq("id", proposal.id);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return { success: true, data: { id: proposal.id, status } };
  }

  async startInterview(proposalId: string, authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);
    const proposal = await this.getClientOwnedProposal(proposalId, userId);
    const job = await this.getJobForClient(proposal.job_id, userId);

    const { error: propError } = await this.supabase
      .from("proposals")
      .update({ status: "interviewing" } as any)
      .eq("id", proposal.id);
    if (propError) {
      throw new InternalServerErrorException(propError.message);
    }

    const { data: contractData, error: contractError } = await this.supabase
      .from("contracts")
      .insert({
        job_id: proposal.job_id,
        client_id: userId,
        freelancer_id: proposal.freelancer_id,
        proposal_id: proposal.id,
        amount: proposal.bid_amount,
        status: "interviewing" as any,
        job_title: job.title || null,
        job_description: job.description || null,
        job_budget_min: job.budget_min || null,
        job_budget_max: job.budget_max || null,
        job_delivery_days: job.delivery_days || null,
        job_delivery_unit: job.delivery_unit || "days",
        job_attachments: job.attachments || [],
        accepted_cover_letter: proposal.cover_letter,
        accepted_bid_amount: proposal.bid_amount,
        accepted_attachments: proposal.attachments || [],
        accepted_payment_type: proposal.payment_type || "project",
      } as any)
      .select("id")
      .single();
    if (contractError || !contractData) {
      throw new InternalServerErrorException(contractError?.message || "Failed to create interview contract.");
    }

    await this.insertSystemMessage(
      contractData.id,
      userId,
      `Interview started for "${job.title || "this job"}". Discuss the project details here.`,
    );

    if (proposal.cover_letter) {
      await this.insertSystemMessage(
        contractData.id,
        proposal.freelancer_id,
        `Original Proposal:\n\n${proposal.cover_letter}`,
      );
    }

    await this.notify(
      proposal.freelancer_id,
      "interview_started",
      "Interview Started",
      "A client started an interview for your proposal.",
      contractData.id,
    );

    return {
      success: true,
      data: {
        proposalId: proposal.id,
        contractId: contractData.id,
      },
    };
  }

  async rejectProposal(proposalId: string, authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);
    const proposal = await this.getClientOwnedProposal(proposalId, userId);

    const { error: propError } = await this.supabase
      .from("proposals")
      .update({ status: "rejected" } as any)
      .eq("id", proposal.id);
    if (propError) {
      throw new InternalServerErrorException(propError.message);
    }

    const { data: contracts, error: contractsError } = await this.supabase
      .from("contracts")
      .select("id")
      .eq("proposal_id", proposal.id)
      .eq("status", "interviewing" as any);
    if (contractsError) {
      throw new InternalServerErrorException(contractsError.message);
    }

    for (const contract of contracts || []) {
      const { error: updateError } = await this.supabase
        .from("contracts")
        .update({ status: "rejected" as any } as any)
        .eq("id", contract.id);
      if (updateError) {
        throw new InternalServerErrorException(updateError.message);
      }
      await this.insertSystemMessage(
        contract.id,
        userId,
        "This interview has been closed. The proposal was declined.",
      );
    }

    await this.notify(
      proposal.freelancer_id,
      "proposal_rejected",
      "Proposal Declined",
      "Your proposal was declined.",
      contracts?.[0]?.id || null,
    );

    return { success: true, data: { id: proposal.id, status: "rejected" } };
  }

  async acceptAndAssign(proposalId: string, fundNow: boolean, authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);
    const proposal = await this.getClientOwnedProposal(proposalId, userId);
    const job = await this.getJobForClient(proposal.job_id, userId);

    const { data: wallet, error: walletError } = await this.supabase
      .from("wallets")
      .select("balance, escrow_balance, total_spent")
      .eq("user_id", userId)
      .maybeSingle();
    if (walletError) {
      throw new InternalServerErrorException(walletError.message);
    }

    const requiredAmount =
      proposal.payment_type === "milestone" && proposal.milestones?.length
        ? Number(proposal.milestones[0].amount || 0)
        : Number(proposal.bid_amount || 0);

    if (fundNow && (!wallet || Number(wallet.balance || 0) < requiredAmount)) {
      throw new BadRequestException("Insufficient wallet balance to fund this contract.");
    }

    const { error: propError } = await this.supabase
      .from("proposals")
      .update({ status: "accepted" } as any)
      .eq("id", proposal.id);
    if (propError) {
      throw new InternalServerErrorException(propError.message);
    }

    let contractId: string | null = null;
    const newStatus = fundNow ? "active" : "pending_funding";
    const { data: existingInterview, error: existingError } = await this.supabase
      .from("contracts")
      .select("id")
      .eq("proposal_id", proposal.id)
      .eq("status", "interviewing" as any)
      .maybeSingle();
    if (existingError) {
      throw new InternalServerErrorException(existingError.message);
    }

    if (existingInterview?.id) {
      const { data: updated, error: updateError } = await this.supabase
        .from("contracts")
        .update({ status: newStatus as any, started_at: new Date().toISOString() } as any)
        .eq("id", existingInterview.id)
        .select("id")
        .single();
      if (updateError || !updated) {
        throw new InternalServerErrorException(updateError?.message || "Failed to activate contract.");
      }
      contractId = updated.id;
    } else {
      const { data: created, error: createError } = await this.supabase
        .from("contracts")
        .insert({
          job_id: proposal.job_id,
          client_id: userId,
          freelancer_id: proposal.freelancer_id,
          proposal_id: proposal.id,
          amount: proposal.bid_amount,
          status: newStatus as any,
          job_title: job.title || null,
          job_description: job.description || null,
          job_budget_min: job.budget_min || null,
          job_budget_max: job.budget_max || null,
          job_delivery_days: job.delivery_days || null,
          job_delivery_unit: job.delivery_unit || "days",
          job_attachments: job.attachments || [],
          accepted_cover_letter: proposal.cover_letter,
          accepted_bid_amount: proposal.bid_amount,
          accepted_attachments: proposal.attachments || [],
          accepted_payment_type: proposal.payment_type || "project",
        } as any)
        .select("id")
        .single();
      if (createError || !created) {
        throw new InternalServerErrorException(createError?.message || "Failed to create contract.");
      }
      contractId = created.id;
      await this.insertSystemMessage(
        contractId,
        userId,
        `Contract created for "${job.title || "this job"}". Welcome aboard.`,
      );
      if (proposal.cover_letter) {
        await this.insertSystemMessage(contractId, proposal.freelancer_id, `Original Proposal:\n\n${proposal.cover_letter}`);
      }
    }

    await this.insertSystemMessage(contractId, userId, "Congratulations. You have been hired for this project.");

    const { error: jobUpdateError } = await this.supabase
      .from("jobs")
      .update({ status: "in_progress" })
      .eq("id", proposal.job_id);
    if (jobUpdateError) {
      throw new InternalServerErrorException(jobUpdateError.message);
    }

    const { data: otherInterviews, error: othersError } = await this.supabase
      .from("contracts")
      .select("id")
      .eq("job_id", proposal.job_id)
      .eq("status", "interviewing" as any)
      .neq("id", contractId);
    if (othersError) {
      throw new InternalServerErrorException(othersError.message);
    }
    for (const interview of otherInterviews || []) {
      const { error: cancelError } = await this.supabase
        .from("contracts")
        .update({ status: "cancelled" as any } as any)
        .eq("id", interview.id);
      if (cancelError) {
        throw new InternalServerErrorException(cancelError.message);
      }
      await this.insertSystemMessage(
        interview.id,
        userId,
        "This job has been assigned to another expert. This interview is now closed.",
      );
    }

    const { error: rejectOthersError } = await this.supabase
      .from("proposals")
      .update({ status: "rejected" } as any)
      .eq("job_id", proposal.job_id)
      .neq("id", proposal.id)
      .in("status", ["pending", "interviewing"]);
    if (rejectOthersError) {
      throw new InternalServerErrorException(rejectOthersError.message);
    }

    if (proposal.payment_type === "milestone" && proposal.milestones?.length > 0) {
      const milestoneRows = proposal.milestones.map((ms: any, idx: number) => ({
        contract_id: contractId,
        title: ms.title,
        amount: ms.amount,
        due_date: ms.date || null,
        status: fundNow && idx === 0 ? "funded" : "pending",
        funded_at: fundNow && idx === 0 ? new Date().toISOString() : null,
      }));
      const { data: createdMilestones, error: milestonesError } = await this.supabase
        .from("milestones")
        .insert(milestoneRows)
        .select("id");
      if (milestonesError) {
        throw new InternalServerErrorException(milestonesError.message);
      }
      if (fundNow && createdMilestones?.[0]) {
        await this.lockEscrow(userId, wallet, requiredAmount, contractId, createdMilestones[0].id, job.title || "job");
      }
    } else {
      const { data: singleMilestone, error: singleMilestoneError } = await this.supabase
        .from("milestones")
        .insert({
          contract_id: contractId,
          title: "Full Project Delivery",
          amount: proposal.bid_amount,
          status: fundNow ? "funded" : "pending",
          funded_at: fundNow ? new Date().toISOString() : null,
        })
        .select("id")
        .single();
      if (singleMilestoneError) {
        throw new InternalServerErrorException(singleMilestoneError.message);
      }
      if (fundNow && singleMilestone?.id) {
        await this.lockEscrow(
          userId,
          wallet,
          Number(proposal.bid_amount || 0),
          contractId,
          singleMilestone.id,
          job.title || "job",
        );
      }
    }

    await this.insertSystemMessage(
      contractId,
      userId,
      fundNow
        ? "Funds have been deposited into escrow. Work can begin."
        : "Contract created but funding is pending. Fund milestone(s) before work begins.",
    );

    await this.notify(
      proposal.freelancer_id,
      "hired",
      "You've Been Hired",
      `You have been hired for "${job.title || "a job"}".`,
      contractId,
    );

    return { success: true, data: { contractId, status: newStatus } };
  }

  private async lockEscrow(
    userId: string,
    wallet: any,
    amount: number,
    contractId: string,
    milestoneId: string,
    jobTitle: string,
  ) {
    const currentBalance = Number(wallet?.balance || 0);
    const currentEscrow = Number(wallet?.escrow_balance || 0);
    const currentSpent = Number(wallet?.total_spent || 0);

    const { error: walletUpdateError } = await this.supabase
      .from("wallets")
      .update({
        balance: currentBalance - amount,
        escrow_balance: currentEscrow + amount,
        total_spent: currentSpent + amount,
      })
      .eq("user_id", userId);
    if (walletUpdateError) {
      throw new InternalServerErrorException(walletUpdateError.message);
    }

    const { error: txError } = await this.supabase.from("wallet_transactions").insert({
      user_id: userId,
      type: "escrow_lock",
      amount,
      balance_after: currentBalance - amount,
      description: `Escrow funding for "${jobTitle}"`,
      contract_id: contractId,
    });
    if (txError) {
      throw new InternalServerErrorException(txError.message);
    }

    const { error: ledgerError } = await this.supabase.from("escrow_ledger").insert({
      contract_id: contractId,
      milestone_id: milestoneId,
      held_amount: amount,
      status: "held",
    });
    if (ledgerError) {
      throw new InternalServerErrorException(ledgerError.message);
    }
  }

  private async getClientOwnedProposal(proposalId: string, userId: string) {
    const { data: proposal, error } = await this.supabase
      .from("proposals")
      .select("*")
      .eq("id", proposalId)
      .single();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!proposal) {
      throw new NotFoundException("Proposal not found.");
    }

    const { data: job, error: jobError } = await this.supabase
      .from("jobs")
      .select("id")
      .eq("id", proposal.job_id)
      .eq("client_id", userId)
      .maybeSingle();
    if (jobError) {
      throw new InternalServerErrorException(jobError.message);
    }
    if (!job) {
      throw new UnauthorizedException("You can only manage proposals on your own jobs.");
    }

    return proposal;
  }

  private async getJobForClient(jobId: string, userId: string) {
    const { data, error } = await this.supabase
      .from("jobs")
      .select("id, title, description, budget_min, budget_max, delivery_days, delivery_unit, attachments")
      .eq("id", jobId)
      .eq("client_id", userId)
      .single();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      throw new NotFoundException("Job not found.");
    }
    return data;
  }

  private async insertSystemMessage(contractId: string, senderId: string, content: string) {
    const { error } = await this.supabase.from("contract_messages").insert({
      contract_id: contractId,
      sender_id: senderId,
      content,
      is_system_message: true,
    } as any);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  private async notify(
    userId: string,
    type: string,
    title: string,
    message: string,
    contractId?: string | null,
  ) {
    const { error } = await this.supabase.from("notifications").insert({
      user_id: userId,
      type,
      title,
      message,
      contract_id: contractId || null,
    } as any);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
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
