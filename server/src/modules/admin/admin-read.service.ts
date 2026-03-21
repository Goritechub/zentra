import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { SupabaseAdminService } from "../shared/supabase-admin.service";

@Injectable()
export class AdminReadService {
  constructor(private readonly supabaseAdmin: SupabaseAdminService) {}

  async getOverview(authorization?: string) {
    const supabase = this.supabaseAdmin.getClient();
    const userId = await this.assertAdmin(authorization);

    const [
      profilesRes,
      clientsRes,
      expertsRes,
      jobsRes,
      contestsRes,
      contractsRes,
      walletsRes,
      txRes,
      disputesRes,
      revenueRes,
    ] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "client"),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "freelancer"),
      supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("contests").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("contracts").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("wallets").select("escrow_balance"),
      supabase.from("wallet_transactions").select("id", { count: "exact", head: true }),
      supabase.from("disputes").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("platform_revenue").select("commission_amount"),
    ]);

    for (const result of [
      profilesRes,
      clientsRes,
      expertsRes,
      jobsRes,
      contestsRes,
      contractsRes,
      walletsRes,
      txRes,
      disputesRes,
      revenueRes,
    ]) {
      if (result.error) {
        throw new InternalServerErrorException(result.error.message);
      }
    }

    const totalEscrow = (walletsRes.data || []).reduce(
      (sum, wallet: any) => sum + (wallet.escrow_balance || 0),
      0,
    );
    const totalRevenue = (revenueRes.data || []).reduce(
      (sum, rev: any) => sum + (rev.commission_amount || 0),
      0,
    );

    return {
      success: true,
      data: {
        requestedBy: userId,
        totalUsers: profilesRes.count || 0,
        totalClients: clientsRes.count || 0,
        totalExperts: expertsRes.count || 0,
        activeJobs: jobsRes.count || 0,
        activeContests: contestsRes.count || 0,
        activeContracts: contractsRes.count || 0,
        totalEscrow,
        totalTransactions: txRes.count || 0,
        openDisputes: disputesRes.count || 0,
        totalRevenue,
      },
    };
  }

  async getPayments(authorization?: string) {
    const supabase = this.supabaseAdmin.getClient();
    const userId = await this.assertAdmin(authorization);

    const [walletsRes, txRes, wdRes, revRes, freezeRes] = await Promise.all([
      supabase
        .from("wallets")
        .select("*, profile:profiles!wallets_user_id_fkey(full_name, email, role)")
        .order("balance", { ascending: false })
        .limit(200),
      supabase
        .from("wallet_transactions")
        .select("*, profile:profiles!wallet_transactions_user_id_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("withdrawal_requests")
        .select(
          "*, profile:profiles!withdrawal_requests_user_id_fkey(full_name), bank:bank_details!withdrawal_requests_bank_detail_id_fkey(bank_name, account_number)",
        )
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("platform_revenue")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "withdrawals_frozen")
        .maybeSingle(),
    ]);

    for (const result of [walletsRes, txRes, wdRes, revRes, freezeRes]) {
      if (result.error) {
        throw new InternalServerErrorException(result.error.message);
      }
    }

    const wallets = walletsRes.data || [];

    return {
      success: true,
      data: {
        requestedBy: userId,
        wallets,
        transactions: txRes.data || [],
        withdrawals: wdRes.data || [],
        revenue: revRes.data || [],
        withdrawalsFrozen:
          freezeRes.data?.value === true || freezeRes.data?.value === "true",
        pendingClearance: wallets.filter(
          (wallet: any) => (wallet.pending_clearance || 0) > 0,
        ),
      },
    };
  }

  async getReviews(authorization?: string) {
    await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();
    const { data, error } = await supabase
      .from("reviews")
      .select(
        "*, reviewer:profiles!reviews_reviewer_id_fkey(full_name), reviewee:profiles!reviews_reviewee_id_fkey(full_name), contract:contracts!reviews_contract_id_fkey(job_title)",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return {
      success: true,
      data: {
        reviews: data || [],
      },
    };
  }

  async deleteReview(reviewId: string, authorization?: string) {
    const adminId = await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();

    const { error: deleteError } = await supabase
      .from("reviews")
      .delete()
      .eq("id", reviewId);
    if (deleteError) {
      throw new InternalServerErrorException(deleteError.message);
    }

    const { error: logError } = await supabase
      .from("admin_activity_log")
      .insert({
        admin_id: adminId,
        action: "delete_review",
        target_type: "review",
        target_id: reviewId,
        details: {},
      });
    if (logError) {
      throw new InternalServerErrorException(logError.message);
    }

    return {
      success: true,
      data: {
        id: reviewId,
      },
    };
  }

  async getPlatformReviews(authorization?: string) {
    await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();
    const { data, error } = await supabase
      .from("platform_reviews")
      .select("*, profiles:user_id(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return {
      success: true,
      data: {
        reviews: data || [],
      },
    };
  }

  async setPlatformReviewApproval(
    reviewId: string,
    isApproved: boolean,
    authorization?: string,
  ) {
    await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();
    const { error } = await supabase
      .from("platform_reviews")
      .update({ is_approved: !!isApproved })
      .eq("id", reviewId);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return {
      success: true,
      data: {
        id: reviewId,
        isApproved: !!isApproved,
      },
    };
  }

  async setPlatformReviewFeatured(
    reviewId: string,
    isFeatured: boolean,
    authorization?: string,
  ) {
    await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();
    const { error } = await supabase
      .from("platform_reviews")
      .update({ is_featured: !!isFeatured })
      .eq("id", reviewId);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return {
      success: true,
      data: {
        id: reviewId,
        isFeatured: !!isFeatured,
      },
    };
  }

  async deletePlatformReview(reviewId: string, authorization?: string) {
    const adminId = await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();

    const { error: deleteError } = await supabase
      .from("platform_reviews")
      .delete()
      .eq("id", reviewId);
    if (deleteError) {
      throw new InternalServerErrorException(deleteError.message);
    }

    const { error: logError } = await supabase
      .from("admin_activity_log")
      .insert({
        admin_id: adminId,
        action: "delete_platform_review",
        target_type: "platform_review",
        target_id: reviewId,
        details: {},
      });
    if (logError) {
      throw new InternalServerErrorException(logError.message);
    }

    return {
      success: true,
      data: {
        id: reviewId,
      },
    };
  }

  async getJobs(authorization?: string) {
    await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();
    const { data, error } = await supabase
      .from("jobs")
      .select("*, client:profiles!jobs_client_id_fkey(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return {
      success: true,
      data: {
        jobs: data || [],
      },
    };
  }

  async getContracts(authorization?: string) {
    await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();
    const { data, error } = await supabase
      .from("contracts")
      .select(
        "*, client:profiles!contracts_client_id_fkey(full_name), freelancer:profiles!contracts_freelancer_id_fkey(full_name)",
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return { success: true, data: { contracts: data || [] } };
  }

  async getContractDetail(contractId: string, authorization?: string) {
    await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();

    const [contractRes, milestonesRes, escrowRes] = await Promise.all([
      supabase
        .from("contracts")
        .select(
          "*, client:profiles!contracts_client_id_fkey(full_name), freelancer:profiles!contracts_freelancer_id_fkey(full_name)",
        )
        .eq("id", contractId)
        .single(),
      supabase
        .from("milestones")
        .select("*")
        .eq("contract_id", contractId)
        .order("created_at", { ascending: true }),
      supabase.from("escrow_ledger").select("*").eq("contract_id", contractId),
    ]);

    for (const result of [contractRes, milestonesRes, escrowRes]) {
      if (result.error) {
        throw new InternalServerErrorException(result.error.message);
      }
    }

    return {
      success: true,
      data: {
        contract: contractRes.data,
        milestones: milestonesRes.data || [],
        escrow: escrowRes.data || [],
      },
    };
  }

  async deleteContract(contractId: string, authorization?: string) {
    const adminId = await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();

    const { data: contract, error: contractError } = await supabase
      .from("contracts")
      .select("id, status, job_title, client_id, freelancer_id")
      .eq("id", contractId)
      .single();
    if (contractError) {
      throw new InternalServerErrorException(contractError.message);
    }

    const { data: milestoneIds, error: milestoneError } = await supabase
      .from("milestones")
      .select("id")
      .eq("contract_id", contractId);
    if (milestoneError) {
      throw new InternalServerErrorException(milestoneError.message);
    }
    const { data: disputeIds, error: disputeError } = await supabase
      .from("disputes")
      .select("id")
      .eq("contract_id", contractId);
    if (disputeError) {
      throw new InternalServerErrorException(disputeError.message);
    }

    if (milestoneIds?.length) {
      const ids = milestoneIds.map((m: any) => m.id);
      const [subsDelete, attachmentsByMilestoneDelete] = await Promise.all([
        supabase.from("milestone_submissions").delete().in("milestone_id", ids),
        supabase.from("contract_attachments").delete().in("milestone_id", ids),
      ]);
      if (subsDelete.error) {
        throw new InternalServerErrorException(subsDelete.error.message);
      }
      if (attachmentsByMilestoneDelete.error) {
        throw new InternalServerErrorException(attachmentsByMilestoneDelete.error.message);
      }
    }

    if (disputeIds?.length) {
      const ids = disputeIds.map((d: any) => d.id);
      const { error } = await supabase.from("dispute_messages").delete().in("dispute_id", ids);
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
    }

    const [contractAttachmentsDelete, messagesDelete, escrowDelete, escrowTxDelete, hiddenDelete, disputesDelete, payoutDelete, reviewsDelete, notificationsDelete, milestonesDelete, walletTxDelete, revenueDelete, paystackDelete] =
      await Promise.all([
        supabase.from("contract_attachments").delete().eq("contract_id", contractId),
        supabase.from("contract_messages").delete().eq("contract_id", contractId),
        supabase.from("escrow_ledger").delete().eq("contract_id", contractId),
        supabase.from("escrow_transactions").delete().eq("contract_id", contractId),
        supabase.from("hidden_conversations").delete().eq("contract_id", contractId),
        supabase.from("disputes").delete().eq("contract_id", contractId),
        supabase.from("payout_transfers").delete().eq("contract_id", contractId),
        supabase.from("reviews").delete().eq("contract_id", contractId),
        supabase.from("notifications").delete().eq("contract_id", contractId),
        supabase.from("milestones").delete().eq("contract_id", contractId),
        supabase.from("wallet_transactions").delete().eq("contract_id", contractId),
        supabase.from("platform_revenue").delete().eq("contract_id", contractId),
        supabase.from("paystack_references").delete().eq("contract_id", contractId),
      ]);

    for (const result of [
      contractAttachmentsDelete,
      messagesDelete,
      escrowDelete,
      escrowTxDelete,
      hiddenDelete,
      disputesDelete,
      payoutDelete,
      reviewsDelete,
      notificationsDelete,
      milestonesDelete,
      walletTxDelete,
      revenueDelete,
      paystackDelete,
    ]) {
      if (result.error) {
        throw new InternalServerErrorException(result.error.message);
      }
    }

    const { error: contractDeleteError } = await supabase
      .from("contracts")
      .delete()
      .eq("id", contractId);
    if (contractDeleteError) {
      throw new InternalServerErrorException(contractDeleteError.message);
    }

    const message =
      contract.status === "interviewing"
        ? `Your interview contract for "${contract.job_title || "a project"}" has been closed by ZentraGig.`
        : `Your contract for "${contract.job_title || "a project"}" has been removed by ZentraGig.`;

    await Promise.all([
      this.notifyUser(
        contract.client_id,
        "Contract Closed by Platform",
        message,
        "contract_closed",
        "/contracts",
      ),
      this.notifyUser(
        contract.freelancer_id,
        "Contract Closed by Platform",
        message,
        "contract_closed",
        "/contracts",
      ),
      this.logAdminAction(adminId, "delete_contract", "contract", contract.id, {
        status: contract.status,
        job_title: contract.job_title,
      }),
    ]);

    return { success: true, data: { id: contractId } };
  }

  async getJobProposals(jobId: string, authorization?: string) {
    await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();
    const { data, error } = await supabase
      .from("proposals")
      .select("*, freelancer:profiles!proposals_freelancer_id_fkey(full_name, email)")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return {
      success: true,
      data: {
        proposals: data || [],
      },
    };
  }

  async deleteJob(jobId: string, authorization?: string) {
    const adminId = await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();

    const [proposalsDelete, viewsDelete] = await Promise.all([
      supabase.from("proposals").delete().eq("job_id", jobId),
      supabase.from("job_views").delete().eq("job_id", jobId),
    ]);

    if (proposalsDelete.error) {
      throw new InternalServerErrorException(proposalsDelete.error.message);
    }
    if (viewsDelete.error) {
      throw new InternalServerErrorException(viewsDelete.error.message);
    }

    const { error: jobDeleteError } = await supabase
      .from("jobs")
      .delete()
      .eq("id", jobId);
    if (jobDeleteError) {
      throw new InternalServerErrorException(jobDeleteError.message);
    }

    const { error: logError } = await supabase.from("admin_activity_log").insert({
      admin_id: adminId,
      action: "delete_job",
      target_type: "job",
      target_id: jobId,
      details: {},
    });
    if (logError) {
      throw new InternalServerErrorException(logError.message);
    }

    return { success: true, data: { id: jobId } };
  }

  async getContests(authorization?: string) {
    await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();
    const { data, error } = await supabase
      .from("contests")
      .select(
        "id, title, status, category, deadline, prize_first, prize_second, prize_third, created_at, visibility, client_id, profiles!contests_client_id_fkey(full_name, email, username)",
      )
      .order("created_at", { ascending: false });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const contests = (data || []) as any[];
    const contestsWithCounts = await Promise.all(
      contests.map(async (contest) => {
        const [entryCountRes, winnerCountRes] = await Promise.all([
          supabase.rpc("get_contest_entry_count", { _contest_id: contest.id }),
          supabase
            .from("contest_entries")
            .select("id", { count: "exact", head: true })
            .eq("contest_id", contest.id)
            .eq("is_winner", true),
        ]);

        if (winnerCountRes.error) {
          throw new InternalServerErrorException(winnerCountRes.error.message);
        }

        return {
          ...contest,
          entry_count: entryCountRes.data || 0,
          winner_count: winnerCountRes.count || 0,
        };
      }),
    );

    return {
      success: true,
      data: {
        contests: contestsWithCounts,
      },
    };
  }

  async updateContestStatus(
    contestId: string,
    status: string,
    authorization?: string,
  ) {
    const adminId = await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();
    const { error } = await supabase
      .from("contests")
      .update({ status })
      .eq("id", contestId);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    const { error: logError } = await supabase.from("admin_activity_log").insert({
      admin_id: adminId,
      action: `Changed contest status to ${status}`,
      target_type: "contest",
      target_id: contestId,
    });
    if (logError) {
      throw new InternalServerErrorException(logError.message);
    }

    return { success: true, data: { id: contestId, status } };
  }

  async deleteContest(contestId: string, authorization?: string) {
    const adminId = await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();

    const [entriesDelete, commentsDelete, followsDelete] = await Promise.all([
      supabase.from("contest_entries").delete().eq("contest_id", contestId),
      supabase.from("contest_comments").delete().eq("contest_id", contestId),
      supabase.from("contest_follows").delete().eq("contest_id", contestId),
    ]);
    for (const result of [entriesDelete, commentsDelete, followsDelete]) {
      if (result.error) {
        throw new InternalServerErrorException(result.error.message);
      }
    }

    const { error: contestDeleteError } = await supabase
      .from("contests")
      .delete()
      .eq("id", contestId);
    if (contestDeleteError) {
      throw new InternalServerErrorException(contestDeleteError.message);
    }

    const { error: logError } = await supabase.from("admin_activity_log").insert({
      admin_id: adminId,
      action: "Deleted contest",
      target_type: "contest",
      target_id: contestId,
    });
    if (logError) {
      throw new InternalServerErrorException(logError.message);
    }

    return { success: true, data: { id: contestId } };
  }

  async setWithdrawalsFreeze(frozen: boolean, authorization?: string) {
    const adminId = await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();
    const { data: existing, error: existingError } = await supabase
      .from("platform_settings")
      .select("id")
      .eq("key", "withdrawals_frozen")
      .maybeSingle();
    if (existingError) {
      throw new InternalServerErrorException(existingError.message);
    }

    if (existing) {
      const { error } = await supabase
        .from("platform_settings")
        .update({
          value: !!frozen,
          updated_at: new Date().toISOString(),
          updated_by: adminId,
        })
        .eq("key", "withdrawals_frozen");
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
    } else {
      const { error } = await supabase
        .from("platform_settings")
        .insert({ key: "withdrawals_frozen", value: !!frozen, updated_by: adminId });
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
    }

    const { error: logError } = await supabase.from("admin_activity_log").insert({
      admin_id: adminId,
      action: frozen ? "freeze_withdrawals" : "unfreeze_withdrawals",
      target_type: "platform_settings",
      details: { frozen: !!frozen },
    });
    if (logError) {
      throw new InternalServerErrorException(logError.message);
    }

    return { success: true, data: { frozen: !!frozen } };
  }

  async cancelWithdrawal(withdrawalId: string, authorization?: string) {
    const adminId = await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();

    const { data: withdrawal, error: withdrawalError } = await supabase
      .from("withdrawal_requests")
      .select("id, user_id, amount")
      .eq("id", withdrawalId)
      .single();
    if (withdrawalError) {
      throw new InternalServerErrorException(withdrawalError.message);
    }

    const { error: reverseError } = await supabase.rpc(
      "reverse_withdrawal_atomic" as any,
      {
        _user_id: withdrawal.user_id,
        _withdrawal_id: withdrawal.id,
        _reference: `admin_cancel_${withdrawal.id}`,
        _reason: "Cancelled by admin",
      },
    );
    if (reverseError) {
      throw new InternalServerErrorException(reverseError.message);
    }

    const { error: logError } = await supabase.from("admin_activity_log").insert({
      admin_id: adminId,
      action: "cancel_withdrawal",
      target_type: "withdrawal",
      target_id: withdrawal.id,
      details: { amount: withdrawal.amount },
    });
    if (logError) {
      throw new InternalServerErrorException(logError.message);
    }

    return { success: true, data: { id: withdrawalId } };
  }

  async getDashboard(authorization?: string) {
    await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();

    const [logsRes, violatorsRes, disputesRes] = await Promise.all([
      supabase
        .from("moderation_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("user_violation_counts")
        .select("*")
        .order("total_violations", { ascending: false })
        .limit(50),
      supabase
        .from("disputes")
        .select(
          "*, contract:contracts!disputes_contract_id_fkey(*, client:profiles!contracts_client_id_fkey(full_name), freelancer:profiles!contracts_freelancer_id_fkey(full_name))",
        )
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    for (const result of [logsRes, violatorsRes, disputesRes]) {
      if (result.error) {
        throw new InternalServerErrorException(result.error.message);
      }
    }

    return {
      success: true,
      data: {
        moderationLogs: logsRes.data || [],
        violators: violatorsRes.data || [],
        disputes: disputesRes.data || [],
      },
    };
  }

  async getActivity(authorization?: string) {
    await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();
    const { data, error } = await supabase
      .from("admin_activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return { success: true, data: { logs: data || [] } };
  }

  async getDisputes(authorization?: string) {
    await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();
    const { data, error } = await supabase
      .from("disputes")
      .select(
        "*, contract:contracts!disputes_contract_id_fkey(*, client:profiles!contracts_client_id_fkey(full_name), freelancer:profiles!contracts_freelancer_id_fkey(full_name))",
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return { success: true, data: { disputes: data || [] } };
  }

  async getLegalDocuments(authorization?: string) {
    await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();
    const { data, error } = await supabase
      .from("legal_documents")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return { success: true, data: { documents: data || [] } };
  }

  async createLegalDocument(input: Record<string, any>, authorization?: string) {
    const adminId = await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();
    const { data, error } = await supabase
      .from("legal_documents")
      .insert({
        title: (input.title || "").trim(),
        slug: (input.slug || "").trim(),
        content: input.content || "",
        is_published: input.is_published !== false,
        sort_order: Number(input.sort_order || 0),
      })
      .select("*")
      .single();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    await this.logAdminAction(adminId, "create_legal_document", "legal_document", data.id, {
      slug: data.slug,
    });

    return { success: true, data: { document: data } };
  }

  async updateLegalDocument(documentId: string, input: Record<string, any>, authorization?: string) {
    const adminId = await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();
    const { data, error } = await supabase
      .from("legal_documents")
      .update({
        title: (input.title || "").trim(),
        slug: (input.slug || "").trim(),
        content: input.content || "",
        is_published: input.is_published === true,
        sort_order: Number(input.sort_order || 0),
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId)
      .select("*")
      .single();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    await this.logAdminAction(adminId, "update_legal_document", "legal_document", documentId, {
      slug: data.slug,
    });

    return { success: true, data: { document: data } };
  }

  async deleteLegalDocument(documentId: string, authorization?: string) {
    const adminId = await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();
    const { error } = await supabase
      .from("legal_documents")
      .delete()
      .eq("id", documentId);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    await this.logAdminAction(adminId, "delete_legal_document", "legal_document", documentId, {});
    return { success: true, data: { id: documentId } };
  }

  async setUserSuspension(
    userId: string,
    suspended: boolean,
    authorization?: string,
  ) {
    const adminId = await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();

    const { error } = await supabase
      .from("user_violation_counts")
      .update({ is_suspended: !!suspended })
      .eq("user_id", userId);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    await this.logAdminAction(adminId, "set_user_suspension", "user", userId, {
      suspended: !!suspended,
    });

    return { success: true, data: { userId, suspended: !!suspended } };
  }

  async resolveDispute(disputeId: string, status: string, authorization?: string) {
    const adminId = await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();

    const { error } = await supabase
      .from("disputes")
      .update({
        status,
        dispute_status: "resolved",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", disputeId);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    await this.logAdminAction(adminId, "resolve_dispute", "dispute", disputeId, {
      status,
    });

    return { success: true, data: { id: disputeId, status } };
  }

  async getVerifications(authorization?: string) {
    await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();

    const { data: verifications, error: verificationsError } = await supabase
      .from("kyc_verifications")
      .select("*")
      .order("created_at", { ascending: false });
    if (verificationsError) {
      throw new InternalServerErrorException(verificationsError.message);
    }

    const rows = verifications || [];
    if (!rows.length) {
      return { success: true, data: { verifications: [] } };
    }

    const userIds = [...new Set(rows.map((row: any) => row.user_id))];
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, role, username")
      .in("id", userIds);
    if (profilesError) {
      throw new InternalServerErrorException(profilesError.message);
    }

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    return {
      success: true,
      data: {
        verifications: rows.map((row: any) => ({
          ...row,
          profile: profileMap.get(row.user_id) || null,
        })),
      },
    };
  }

  async approveVerification(kycId: string, authorization?: string) {
    const adminId = await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();
    const kyc = await this.getKycOrThrow(kycId);

    const { error: kycError } = await supabase
      .from("kyc_verifications")
      .update({ kyc_status: "verified", verification_level: "identity_verified" })
      .eq("id", kycId);
    if (kycError) {
      throw new InternalServerErrorException(kycError.message);
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ is_verified: true })
      .eq("id", kyc.user_id);
    if (profileError) {
      throw new InternalServerErrorException(profileError.message);
    }

    await this.logAdminAction(adminId, "approve_kyc", "user", kyc.user_id, {
      kyc_id: kycId,
    });
    await this.notifyUser(
      kyc.user_id,
      "Identity Verified",
      "Your identity has been verified by an admin.",
      "verification",
    );

    return { success: true, data: { id: kycId } };
  }

  async rejectVerification(
    kycId: string,
    adminNotes: string,
    authorization?: string,
  ) {
    const adminId = await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();
    const kyc = await this.getKycOrThrow(kycId);

    const { error: kycError } = await supabase
      .from("kyc_verifications")
      .update({ kyc_status: "failed", admin_notes: adminNotes || null })
      .eq("id", kycId);
    if (kycError) {
      throw new InternalServerErrorException(kycError.message);
    }

    await this.logAdminAction(adminId, "reject_kyc", "user", kyc.user_id, {
      kyc_id: kycId,
      notes: adminNotes || null,
    });
    await this.notifyUser(
      kyc.user_id,
      "Verification Rejected",
      adminNotes || "Your identity verification was not approved.",
      "verification",
    );

    return { success: true, data: { id: kycId } };
  }

  async grantZentraVerification(kycId: string, authorization?: string) {
    const adminId = await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();
    const kyc = await this.getKycOrThrow(kycId);

    const { error: kycError } = await supabase
      .from("kyc_verifications")
      .update({
        zentra_verified: true,
        zentra_verified_at: new Date().toISOString(),
        zentra_verified_by: adminId,
        verification_level: "zentra_verified",
      })
      .eq("id", kycId);
    if (kycError) {
      throw new InternalServerErrorException(kycError.message);
    }

    await this.logAdminAction(
      adminId,
      "grant_zentra_verified",
      "user",
      kyc.user_id,
      { kyc_id: kycId },
    );
    await this.notifyUser(
      kyc.user_id,
      "ZentraGig Verified Engineer",
      "Congratulations! You've been awarded the ZentraGig Verified Engineer badge.",
      "verification",
    );

    return { success: true, data: { id: kycId } };
  }

  async revokeZentraVerification(kycId: string, authorization?: string) {
    const adminId = await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();
    const kyc = await this.getKycOrThrow(kycId);

    const { error: kycError } = await supabase
      .from("kyc_verifications")
      .update({
        zentra_verified: false,
        zentra_verified_at: null,
        zentra_verified_by: null,
        verification_level: "identity_verified",
      })
      .eq("id", kycId);
    if (kycError) {
      throw new InternalServerErrorException(kycError.message);
    }

    await this.logAdminAction(
      adminId,
      "revoke_zentra_verified",
      "user",
      kyc.user_id,
      { kyc_id: kycId },
    );

    return { success: true, data: { id: kycId } };
  }

  async revokeIdentityVerification(
    kycId: string,
    adminNotes: string,
    authorization?: string,
  ) {
    const adminId = await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();
    const kyc = await this.getKycOrThrow(kycId);

    const notes = adminNotes || "Identity verification revoked by admin";
    const { error: kycError } = await supabase
      .from("kyc_verifications")
      .update({
        kyc_status: "not_started",
        verification_level: "basic",
        zentra_verified: false,
        zentra_verified_at: null,
        zentra_verified_by: null,
        admin_notes: notes,
      })
      .eq("id", kycId);
    if (kycError) {
      throw new InternalServerErrorException(kycError.message);
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ is_verified: false })
      .eq("id", kyc.user_id);
    if (profileError) {
      throw new InternalServerErrorException(profileError.message);
    }

    await this.logAdminAction(adminId, "revoke_identity", "user", kyc.user_id, {
      kyc_id: kycId,
      notes,
    });
    await this.notifyUser(
      kyc.user_id,
      "Verification Revoked",
      notes,
      "verification",
    );

    return { success: true, data: { id: kycId } };
  }

  async getUsers(authorization?: string) {
    await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();

    const [profilesRes, rolesRes, permsRes, frozenRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("user_roles").select("user_id, role").eq("role", "admin"),
      supabase
        .from("admin_permissions")
        .select("user_id, permission")
        .eq("permission", "admin_management"),
      supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "withdrawal_frozen_users")
        .maybeSingle(),
    ]);

    for (const result of [profilesRes, rolesRes, permsRes, frozenRes]) {
      if (result.error) {
        throw new InternalServerErrorException(result.error.message);
      }
    }

    const adminIds = new Set((rolesRes.data || []).map((r: any) => r.user_id));
    const superAdminIds = new Set((permsRes.data || []).map((p: any) => p.user_id));
    const users = (profilesRes.data || []).map((u: any) => ({
      ...u,
      display_role: superAdminIds.has(u.id)
        ? "superadmin"
        : adminIds.has(u.id)
          ? "admin"
          : u.role,
    }));

    return {
      success: true,
      data: {
        users,
        frozenWithdrawalUsers:
          frozenRes.data?.value && typeof frozenRes.data.value === "object"
            ? (frozenRes.data.value as Record<string, boolean>)
            : {},
      },
    };
  }

  async getUserDetail(userId: string, authorization?: string) {
    await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();

    const [walletRes, violationsRes] = await Promise.all([
      supabase.from("wallets").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("user_violation_counts")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    if (walletRes.error) {
      throw new InternalServerErrorException(walletRes.error.message);
    }
    if (violationsRes.error) {
      throw new InternalServerErrorException(violationsRes.error.message);
    }

    return {
      success: true,
      data: {
        wallet: walletRes.data || null,
        violations: violationsRes.data || null,
      },
    };
  }

  async setUserVerification(
    userId: string,
    verified: boolean,
    authorization?: string,
  ) {
    const adminId = await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();

    const { error } = await supabase
      .from("profiles")
      .update({ is_verified: !!verified })
      .eq("id", userId);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    await this.logAdminAction(adminId, "toggle_verification", "user", userId, {
      verified: !!verified,
    });

    return { success: true, data: { userId, verified: !!verified } };
  }

  async setUserSuspensionUpsert(
    userId: string,
    suspended: boolean,
    authorization?: string,
  ) {
    const adminId = await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();

    const { error } = await supabase
      .from("user_violation_counts")
      .upsert(
        {
          user_id: userId,
          is_suspended: !!suspended,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    await this.logAdminAction(adminId, "toggle_suspension", "user", userId, {
      suspended: !!suspended,
    });

    return { success: true, data: { userId, suspended: !!suspended } };
  }

  async setUserWithdrawalFreeze(
    userId: string,
    frozen: boolean,
    userName: string,
    authorization?: string,
  ) {
    const adminId = await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();

    const { data: existing, error: existingError } = await supabase
      .from("platform_settings")
      .select("id, value")
      .eq("key", "withdrawal_frozen_users")
      .maybeSingle();
    if (existingError) {
      throw new InternalServerErrorException(existingError.message);
    }

    const current =
      existing?.value && typeof existing.value === "object"
        ? ({ ...(existing.value as Record<string, boolean>) } as Record<string, boolean>)
        : {};
    if (frozen) current[userId] = true;
    else delete current[userId];

    if (existing) {
      const { error } = await supabase
        .from("platform_settings")
        .update({
          value: current as any,
          updated_at: new Date().toISOString(),
          updated_by: adminId,
        })
        .eq("key", "withdrawal_frozen_users");
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
    } else {
      const { error } = await supabase.from("platform_settings").insert({
        key: "withdrawal_frozen_users",
        value: current as any,
        updated_by: adminId,
      });
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
    }

    await this.logAdminAction(
      adminId,
      frozen ? "freeze_user_withdrawal" : "unfreeze_user_withdrawal",
      "user",
      userId,
      { user_name: userName || null },
    );

    await this.notifyUser(
      userId,
      frozen ? "Withdrawals Restricted" : "Withdrawals Restored",
      frozen
        ? "Your withdrawals have been temporarily restricted by the administrator. Please contact support for more information."
        : "Your withdrawal access has been restored. You can now withdraw funds normally.",
      "security_alert",
    );

    return { success: true, data: { userId, frozen: !!frozen, frozenUsers: current } };
  }

  async sendWithdrawReminder(
    userId: string,
    walletBalance: number,
    escrowBalance: number,
    authorization?: string,
  ) {
    const adminId = await this.assertAdmin(authorization);
    const total = (walletBalance || 0) + (escrowBalance || 0);

    await this.notifyUser(
      userId,
      "Action Required: Withdraw Your Funds",
      `Your account has been flagged for closure. You currently have ${total} in your wallet. Please withdraw all funds immediately to avoid any issues. Contact support if you need assistance.`,
      "platform_announcement",
      "/dashboard",
    );

    await this.logAdminAction(adminId, "send_withdraw_reminder", "user", userId, {
      wallet_balance: walletBalance || 0,
      escrow_balance: escrowBalance || 0,
    });

    return { success: true, data: { userId } };
  }

  async closeUserAccount(userId: string, authorization?: string) {
    const adminId = await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();

    const { data, error } = await supabase.rpc("admin_close_user_account", {
      _admin_id: adminId,
      _target_user_id: userId,
    });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return { success: true, data };
  }

  async getSettings(authorization?: string) {
    await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();

    const [categoriesRes, tiersRes] = await Promise.all([
      supabase.from("categories").select("*").order("name"),
      supabase
        .from("platform_settings")
        .select("*")
        .eq("key", "commission_tiers")
        .maybeSingle(),
    ]);

    if (categoriesRes.error) {
      throw new InternalServerErrorException(categoriesRes.error.message);
    }
    if (tiersRes.error) {
      throw new InternalServerErrorException(tiersRes.error.message);
    }

    return {
      success: true,
      data: {
        categories: categoriesRes.data || [],
        commissionTiers: Array.isArray(tiersRes.data?.value) ? tiersRes.data?.value : [],
      },
    };
  }

  async addCategory(name: string, slug: string, authorization?: string) {
    await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();
    const { error } = await supabase.from("categories").insert({
      name: (name || "").trim(),
      slug: (slug || "").trim(),
    });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return { success: true, data: {} };
  }

  async updateCommissionTiers(tiers: any[], authorization?: string) {
    const adminId = await this.assertAdmin(authorization);
    const supabase = this.supabaseAdmin.getClient();
    const { error } = await supabase
      .from("platform_settings")
      .update({
        value: tiers as any,
        updated_at: new Date().toISOString(),
        updated_by: adminId,
      })
      .eq("key", "commission_tiers");
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return { success: true, data: {} };
  }

  private async getKycOrThrow(kycId: string) {
    const supabase = this.supabaseAdmin.getClient();
    const { data, error } = await supabase
      .from("kyc_verifications")
      .select("id, user_id")
      .eq("id", kycId)
      .single();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return data as { id: string; user_id: string };
  }

  private async notifyUser(
    userId: string,
    title: string,
    message: string,
    type: string,
    linkUrl?: string,
  ) {
    const supabase = this.supabaseAdmin.getClient();
    const { error } = await supabase.from("notifications").insert({
      user_id: userId,
      title,
      message,
      type,
      link_url: linkUrl || null,
    });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  private async logAdminAction(
    adminId: string,
    action: string,
    targetType: string,
    targetId: string,
    details: Record<string, any>,
  ) {
    const supabase = this.supabaseAdmin.getClient();
    const { error } = await supabase.from("admin_activity_log").insert({
      admin_id: adminId,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
    });
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  private async assertAdmin(authorization?: string) {
    const supabase = this.supabaseAdmin.getClient();
    const userId = await this.supabaseAdmin.getRequiredUserId(authorization);
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    if (!data) {
      throw new ForbiddenException("Admin access required.");
    }

    return userId;
  }
}
