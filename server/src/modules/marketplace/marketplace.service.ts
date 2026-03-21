import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class MarketplaceService {
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

  async getMyServices(authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);

    const { data, error } = await this.supabase
      .from("service_offers")
      .select("*")
      .eq("freelancer_id", userId)
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

  async getMyContestEntries(authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);

    const { data, error } = await this.supabase
      .from("contest_entries")
      .select(
        "*, contest:contests(id, title, description, deadline, status, prize_first, prize_second, prize_third, prize_fourth, prize_fifth, client_id, client:profiles!contests_client_id_fkey(full_name))",
      )
      .eq("freelancer_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return {
      success: true,
      data: {
        entries: data || [],
      },
    };
  }

  async getMyPortfolio(authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);

    const { data: freelancerProfile, error: profileError } = await this.supabase
      .from("freelancer_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      throw new InternalServerErrorException(profileError.message);
    }

    if (!freelancerProfile) {
      return {
        success: true,
        data: {
          profileId: null,
          items: [],
        },
      };
    }

    const { data: items, error: itemsError } = await this.supabase
      .from("portfolio_items")
      .select("*")
      .eq("freelancer_profile_id", freelancerProfile.id)
      .order("created_at", { ascending: false });

    if (itemsError) {
      throw new InternalServerErrorException(itemsError.message);
    }

    return {
      success: true,
      data: {
        profileId: freelancerProfile.id,
        items: items || [],
      },
    };
  }

  async createPortfolioItem(
    input: {
      title?: string;
      description?: string | null;
      projectType?: string | null;
      softwareUsed?: string[];
      images?: string[];
    },
    authorization?: string,
  ) {
    const userId = await this.getRequiredUserId(authorization);
    const profileId = await this.getFreelancerProfileId(userId);

    if (!profileId) {
      throw new UnauthorizedException("Freelancer profile required.");
    }

    const { data, error } = await this.supabase
      .from("portfolio_items")
      .insert({
        freelancer_profile_id: profileId,
        title: (input.title || "").trim(),
        description: input.description?.trim() || null,
        project_type: input.projectType?.trim() || null,
        software_used: input.softwareUsed || [],
        images: input.images || [],
      })
      .select("*")
      .single();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return { success: true, data: { item: data } };
  }

  async deletePortfolioItem(itemId: string, authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);
    const profileId = await this.getFreelancerProfileId(userId);

    if (!profileId) {
      throw new UnauthorizedException("Freelancer profile required.");
    }

    const { error } = await this.supabase
      .from("portfolio_items")
      .delete()
      .eq("id", itemId)
      .eq("freelancer_profile_id", profileId);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return { success: true, data: { id: itemId } };
  }

  async createMyService(input: Record<string, any>, authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);

    const payload = this.normalizeServicePayload(input, userId);
    const { data, error } = await this.supabase
      .from("service_offers")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return { success: true, data: { service: data } };
  }

  async updateMyService(
    serviceId: string,
    input: Record<string, any>,
    authorization?: string,
  ) {
    const userId = await this.getRequiredUserId(authorization);

    const payload = this.normalizeServicePayload(input, userId);
    const { data, error } = await this.supabase
      .from("service_offers")
      .update(payload)
      .eq("id", serviceId)
      .eq("freelancer_id", userId)
      .select("*")
      .single();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return { success: true, data: { service: data } };
  }

  async setMyServiceActive(
    serviceId: string,
    isActive: boolean,
    authorization?: string,
  ) {
    const userId = await this.getRequiredUserId(authorization);
    const { error } = await this.supabase
      .from("service_offers")
      .update({ is_active: !!isActive })
      .eq("id", serviceId)
      .eq("freelancer_id", userId);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return { success: true, data: { id: serviceId, isActive: !!isActive } };
  }

  async deleteMyService(serviceId: string, authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);
    const { error } = await this.supabase
      .from("service_offers")
      .delete()
      .eq("id", serviceId)
      .eq("freelancer_id", userId);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return { success: true, data: { id: serviceId } };
  }

  async getContestFollowState(contestId: string, authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);
    const { data, error } = await this.supabase
      .from("contest_follows")
      .select("id")
      .eq("contest_id", contestId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return { success: true, data: { isFollowing: !!data } };
  }

  async followContest(contestId: string, authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);
    const { error } = await this.supabase
      .from("contest_follows")
      .insert({ contest_id: contestId, user_id: userId } as any);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return { success: true, data: { contestId, isFollowing: true } };
  }

  async unfollowContest(contestId: string, authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);
    const { error } = await this.supabase
      .from("contest_follows")
      .delete()
      .eq("contest_id", contestId)
      .eq("user_id", userId);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return { success: true, data: { contestId, isFollowing: false } };
  }

  async getContestFollowers(contestId: string, authorization?: string) {
    await this.getRequiredUserId(authorization);
    const { data, error } = await this.supabase
      .from("contest_follows")
      .select("user_id")
      .eq("contest_id", contestId);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return { success: true, data: { followers: data || [] } };
  }

  async getContestCommentLikes(contestId: string, authorization?: string) {
    await this.getRequiredUserId(authorization);
    const { data: commentRows, error: commentsError } = await this.supabase
      .from("contest_comments")
      .select("id")
      .eq("contest_id", contestId);
    if (commentsError) {
      throw new InternalServerErrorException(commentsError.message);
    }
    const commentIds = (commentRows || []).map((row: any) => row.id);
    if (!commentIds.length) {
      return { success: true, data: { likes: [] } };
    }
    const { data, error } = await this.supabase
      .from("contest_comment_likes")
      .select("*")
      .in("comment_id", commentIds);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return { success: true, data: { likes: data || [] } };
  }

  async toggleContestCommentLike(commentId: string, contestId: string, authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);
    const { data: existing, error: existingError } = await this.supabase
      .from("contest_comment_likes")
      .select("id")
      .eq("comment_id", commentId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existingError) {
      throw new InternalServerErrorException(existingError.message);
    }

    if (existing?.id) {
      const { error } = await this.supabase.from("contest_comment_likes").delete().eq("id", existing.id);
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
    } else {
      const { error } = await this.supabase
        .from("contest_comment_likes")
        .insert({ comment_id: commentId, user_id: userId } as any);
      if (error) {
        throw new InternalServerErrorException(error.message);
      }
    }

    return this.getContestCommentLikes(contestId, authorization);
  }

  async getContestDetail(contestId: string, authorization?: string) {
    await this.getOptionalUserId(authorization);

    const { data: contest, error: contestError } = await this.supabase
      .from("contests")
      .select("*, client:profiles!contests_client_id_fkey(full_name, avatar_url, username, state, city)")
      .eq("id", contestId)
      .maybeSingle();

    if (contestError) {
      throw new InternalServerErrorException(contestError.message);
    }

    if (!contest) {
      throw new NotFoundException("Contest not found.");
    }

    const [{ data: countData, error: countError }, { data: entriesData, error: entriesError }] =
      await Promise.all([
        this.supabase.rpc("get_contest_entry_count", { _contest_id: contestId } as any),
        this.supabase
          .from("contest_entries")
          .select("*, freelancer:profiles!contest_entries_freelancer_id_fkey(full_name, avatar_url, username)")
          .eq("contest_id", contestId)
          .order("created_at", { ascending: false }),
      ]);

    if (countError) {
      throw new InternalServerErrorException(countError.message);
    }

    if (entriesError) {
      throw new InternalServerErrorException(entriesError.message);
    }

    const allEntries = entriesData || [];
    const winners = allEntries
      .filter((entry: any) => entry.is_winner)
      .sort((a: any, b: any) => (a.prize_position || 99) - (b.prize_position || 99));
    const nominees = allEntries.filter((entry: any) => entry.is_nominee && !entry.is_winner);
    const entries = allEntries.filter((entry: any) => !entry.is_winner && !entry.is_nominee);

    const participants: any[] = [];
    participants.push({
      id: contest.client_id,
      full_name: (contest.client as any)?.full_name || null,
      username: (contest.client as any)?.username || null,
    });

    for (const entry of allEntries) {
      if (!participants.find((participant) => participant.id === entry.freelancer_id)) {
        participants.push({
          id: entry.freelancer_id,
          full_name: (entry.freelancer as any)?.full_name || null,
          username: (entry.freelancer as any)?.username || null,
        });
      }
    }

    return {
      success: true,
      data: {
        contest,
        trueEntryCount: typeof countData === "number" ? countData : 0,
        entries,
        nominees,
        winners,
        participants,
      },
    };
  }

  async getContestComments(contestId: string, authorization?: string) {
    await this.getOptionalUserId(authorization);

    const { data: commentsData, error: commentsError } = await this.supabase
      .from("contest_comments")
      .select("*")
      .eq("contest_id", contestId)
      .order("created_at", { ascending: true });

    if (commentsError) {
      throw new InternalServerErrorException(commentsError.message);
    }

    const rows = commentsData || [];
    const userIds = [...new Set(rows.map((comment: any) => comment.user_id).filter(Boolean))];

    let profileMap = new Map<string, any>();
    if (userIds.length) {
      const { data: profilesData, error: profilesError } = await this.supabase
        .from("profiles")
        .select("id, full_name, avatar_url, username")
        .in("id", userIds);

      if (profilesError) {
        throw new InternalServerErrorException(profilesError.message);
      }

      profileMap = new Map((profilesData || []).map((profile: any) => [profile.id, profile]));
    }

    const comments = rows.map((comment: any) => ({
      ...comment,
      user: profileMap.get(comment.user_id) || null,
    }));

    return {
      success: true,
      data: {
        comments,
      },
    };
  }

  async createContestComment(contestId: string, input: Record<string, any>, authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);

    const { data, error } = await this.supabase
      .from("contest_comments")
      .insert({
        contest_id: contestId,
        user_id: userId,
        parent_id: input.parent_id || null,
        content: (input.content || "").trim(),
      } as any)
      .select("*")
      .single();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return { success: true, data: { comment: data } };
  }

  async submitContestEntry(contestId: string, input: Record<string, any>, authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);
    const { data, error } = await this.supabase
      .from("contest_entries")
      .insert({
        contest_id: contestId,
        freelancer_id: userId,
        description: (input.description || "").trim(),
        attachments: Array.isArray(input.attachments) ? input.attachments : [],
      } as any)
      .select("id")
      .single();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return { success: true, data: { id: data?.id } };
  }

  async deleteContestEntry(entryId: string, authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);
    const { data: entry, error: entryError } = await this.supabase
      .from("contest_entries")
      .select("id, freelancer_id")
      .eq("id", entryId)
      .maybeSingle();
    if (entryError) {
      throw new InternalServerErrorException(entryError.message);
    }
    if (!entry) {
      throw new NotFoundException("Entry not found.");
    }
    if (entry.freelancer_id !== userId) {
      throw new UnauthorizedException("You can only delete your own entries.");
    }

    const { error } = await this.supabase.from("contest_entries").delete().eq("id", entryId);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return { success: true, data: { id: entryId } };
  }

  async updateContestEntry(entryId: string, input: Record<string, any>, authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);

    const { data: entry, error: entryError } = await this.supabase
      .from("contest_entries")
      .select("id, freelancer_id")
      .eq("id", entryId)
      .maybeSingle();

    if (entryError) {
      throw new InternalServerErrorException(entryError.message);
    }

    if (!entry) {
      throw new NotFoundException("Entry not found.");
    }

    if (entry.freelancer_id !== userId) {
      throw new UnauthorizedException("You can only update your own entry.");
    }

    const { data: updated, error: updateError } = await this.supabase
      .from("contest_entries")
      .update({
        description: (input.description || "").trim(),
        attachments: Array.isArray(input.attachments) ? input.attachments : [],
        edit_count: Number(input.edit_count || 0),
        last_edited_at: input.last_edited_at || new Date().toISOString(),
      } as any)
      .eq("id", entryId)
      .eq("freelancer_id", userId)
      .select("*")
      .single();

    if (updateError) {
      throw new InternalServerErrorException(updateError.message);
    }

    return { success: true, data: { entry: updated } };
  }

  async setContestEntryNominee(entryId: string, isNominee: boolean, authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);

    const { data: entry, error: entryError } = await this.supabase
      .from("contest_entries")
      .select("id, contest_id")
      .eq("id", entryId)
      .maybeSingle();

    if (entryError) {
      throw new InternalServerErrorException(entryError.message);
    }

    if (!entry) {
      throw new NotFoundException("Entry not found.");
    }

    await this.getContestOwnedByUser(entry.contest_id, userId);

    const { error: updateError } = await this.supabase
      .from("contest_entries")
      .update({ is_nominee: !!isNominee } as any)
      .eq("id", entryId);

    if (updateError) {
      throw new InternalServerErrorException(updateError.message);
    }

    return { success: true, data: { id: entryId, isNominee: !!isNominee } };
  }

  async createCommentMention(commentId: string, mentionedUserId: string, authorization?: string) {
    await this.getRequiredUserId(authorization);
    const { error } = await this.supabase.from("comment_mentions").insert({
      comment_id: commentId,
      mentioned_user_id: mentionedUserId,
    } as any);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return { success: true, data: { commentId, mentionedUserId } };
  }

  async updateContestStatus(contestId: string, status: string, authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);
    const { data: contest, error: contestError } = await this.supabase
      .from("contests")
      .select("id, client_id")
      .eq("id", contestId)
      .maybeSingle();
    if (contestError) {
      throw new InternalServerErrorException(contestError.message);
    }
    if (!contest) {
      throw new NotFoundException("Contest not found.");
    }
    if (contest.client_id !== userId) {
      throw new UnauthorizedException("Only the contest owner can update status.");
    }
    const { error } = await this.supabase
      .from("contests")
      .update({ status })
      .eq("id", contestId);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return { success: true, data: { id: contestId, status } };
  }

  async updateContestWinnerJustifications(
    contestId: string,
    winnerJustifications: Record<string, string>,
    authorization?: string,
  ) {
    const userId = await this.getRequiredUserId(authorization);
    await this.getContestOwnedByUser(contestId, userId);

    const { error } = await this.supabase
      .from("contests")
      .update({ winner_justifications: winnerJustifications || {} } as any)
      .eq("id", contestId);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return { success: true, data: { id: contestId, winnerJustifications: winnerJustifications || {} } };
  }

  async extendContestDeadline(contestId: string, deadline: string, authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);
    await this.getContestOwnedByUser(contestId, userId);

    const { error } = await this.supabase
      .from("contests")
      .update({
        deadline,
        status: "active",
        deadline_extended_once: true,
      } as any)
      .eq("id", contestId);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return { success: true, data: { id: contestId, deadline } };
  }

  async publishContestWinners(contestId: string, authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);
    await this.getContestOwnedByUser(contestId, userId);

    const { data, error } = await this.supabase.functions.invoke("publish-contest-winners", {
      body: { contest_id: contestId },
    });

    if (error || !data?.success) {
      throw new InternalServerErrorException(data?.error || error?.message || "Failed to publish winners.");
    }

    return { success: true, data };
  }

  private normalizeServicePayload(input: Record<string, any>, userId: string) {
    return {
      freelancer_id: userId,
      title: (input.title || "").trim(),
      description: (input.description || "").trim(),
      category: input.category || null,
      pricing_type: input.pricing_type || "fixed",
      price: input.price ?? null,
      delivery_days: input.delivery_days ?? null,
      delivery_unit: input.delivery_unit || "days",
      revisions_allowed: input.revisions_allowed ?? null,
      skills: Array.isArray(input.skills) ? input.skills : [],
      images: Array.isArray(input.images) ? input.images : [],
      banner_image: input.banner_image || null,
      is_active: input.is_active !== false,
    };
  }

  private async getFreelancerProfileId(userId: string) {
    const { data, error } = await this.supabase
      .from("freelancer_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return data?.id || null;
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

  private async getOptionalUserId(authorization?: string) {
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : null;
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

    return user.id;
  }

  private async getContestOwnedByUser(contestId: string, userId: string) {
    const { data: contest, error: contestError } = await this.supabase
      .from("contests")
      .select("id, client_id")
      .eq("id", contestId)
      .maybeSingle();

    if (contestError) {
      throw new InternalServerErrorException(contestError.message);
    }

    if (!contest) {
      throw new NotFoundException("Contest not found.");
    }

    if (contest.client_id !== userId) {
      throw new UnauthorizedException("Only the contest owner can perform this action.");
    }

    return contest;
  }
}
