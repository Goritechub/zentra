import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { SupabaseAdminService } from "../shared/supabase-admin.service";

@Injectable()
export class ExpertReadService {
  constructor(private readonly supabaseAdmin: SupabaseAdminService) {}

  async getMySkills(authorization?: string) {
    const supabase = this.supabaseAdmin.getClient();
    const userId = await this.supabaseAdmin.getRequiredUserId(authorization);

    const { data, error } = await supabase
      .from("freelancer_profiles")
      .select("id, skills")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return {
      success: true,
      data: {
        profileId: data?.id || null,
        skills: data?.skills || [],
      },
    };
  }

  async saveMySkills(skills: string[], authorization?: string) {
    const supabase = this.supabaseAdmin.getClient();
    const userId = await this.supabaseAdmin.getRequiredUserId(authorization);

    const { data: existingProfile, error: existingError } = await supabase
      .from("freelancer_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingError) {
      throw new InternalServerErrorException(existingError.message);
    }

    if (existingProfile?.id) {
      const { error } = await supabase
        .from("freelancer_profiles")
        .update({ skills })
        .eq("id", existingProfile.id);

      if (error) {
        throw new InternalServerErrorException(error.message);
      }

      return {
        success: true,
        data: {
          profileId: existingProfile.id,
          skills,
        },
      };
    }

    const { data: createdProfile, error: createError } = await supabase
      .from("freelancer_profiles")
      .insert({ user_id: userId, skills })
      .select("id")
      .single();

    if (createError) {
      throw new InternalServerErrorException(createError.message);
    }

    return {
      success: true,
      data: {
        profileId: createdProfile.id,
        skills,
      },
    };
  }

  async getExpertProfileOverview(expertId: string, _authorization?: string) {
    const supabase = this.supabaseAdmin.getClient();

    const [profileRes, freelancerProfileRes, certificationsRes, experienceRes, servicesRes] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", expertId).single(),
        supabase.from("freelancer_profiles").select("*").eq("user_id", expertId).maybeSingle(),
        supabase
          .from("certifications")
          .select("*")
          .eq("user_id", expertId)
          .order("year_obtained", { ascending: false }),
        supabase
          .from("work_experience")
          .select("*")
          .eq("user_id", expertId)
          .order("start_year", { ascending: false }),
        supabase
          .from("service_offers")
          .select("id, title, price, category")
          .eq("freelancer_id", expertId)
          .eq("is_active", true)
          .limit(10),
      ]);

    for (const result of [
      profileRes,
      freelancerProfileRes,
      certificationsRes,
      experienceRes,
      servicesRes,
    ]) {
      if (result.error) {
        throw new InternalServerErrorException(result.error.message);
      }
    }

    if (!profileRes.data) {
      throw new NotFoundException("Expert not found.");
    }

    const freelancerProfile = freelancerProfileRes.data || null;
    let portfolio: any[] = [];

    if (freelancerProfile?.id) {
      const { data: portfolioData, error: portfolioError } = await supabase
        .from("portfolio_items")
        .select("*")
        .eq("freelancer_profile_id", freelancerProfile.id);

      if (portfolioError) {
        throw new InternalServerErrorException(portfolioError.message);
      }

      portfolio = portfolioData || [];
    }

    const { data: contractsData, count: completedContractCount, error: contractsError } =
      await supabase
        .from("contracts")
        .select(
          "id, job_title, job_description, job_category, amount, status, started_at, completed_at",
          { count: "exact" },
        )
        .eq("freelancer_id", expertId)
        .in("status", ["completed", "active"])
        .order("created_at", { ascending: false })
        .limit(20);

    if (contractsError) {
      throw new InternalServerErrorException(contractsError.message);
    }

    let pastContracts = (contractsData || []).map((contract) => ({
      ...contract,
      review: null,
    }));

    if (pastContracts.length) {
      const contractIds = pastContracts.map((contract) => contract.id);
      const { data: contractReviews, error: contractReviewsError } = await supabase
        .from("reviews")
        .select(
          "contract_id, rating, comment, reviewer:profiles!reviews_reviewer_id_fkey(full_name)",
        )
        .eq("reviewee_id", expertId)
        .in("contract_id", contractIds);

      if (contractReviewsError) {
        throw new InternalServerErrorException(contractReviewsError.message);
      }

      const reviewMap = new Map<string, any>();
      for (const review of contractReviews || []) {
        reviewMap.set(review.contract_id, {
          rating: review.rating,
          comment: review.comment,
          reviewer_name: (review.reviewer as any)?.full_name || null,
        });
      }

      pastContracts = pastContracts.map((contract) => ({
        ...contract,
        review: reviewMap.get(contract.id) || null,
      }));
    }

    const { data: reviews, error: reviewsError } = await supabase
      .from("reviews")
      .select(
        "*, reviewer:profiles!reviews_reviewer_id_fkey(full_name, avatar_url), contract:contracts!reviews_contract_id_fkey(job_title, amount)",
      )
      .eq("reviewee_id", expertId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (reviewsError) {
      throw new InternalServerErrorException(reviewsError.message);
    }

    return {
      success: true,
      data: {
        profile: profileRes.data,
        freelancerProfile,
        certifications: certificationsRes.data || [],
        workExperience: experienceRes.data || [],
        services: servicesRes.data || [],
        portfolio,
        pastContracts,
        completedContractCount: completedContractCount || 0,
        reviews: reviews || [],
      },
    };
  }
}
