import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class ProfileService {
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

  async getMyProfile(authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);

    const [generalProfile, editFlags, freelancerProfile, certifications, workExperience] = await Promise.all([
      this.supabase
        .from("profiles")
        .select("full_name, phone, whatsapp, state, city, avatar_url, occupation")
        .eq("id", userId)
        .maybeSingle(),
      this.supabase
        .from("profiles")
        .select("full_name_edited, username_edited")
        .eq("id", userId)
        .single(),
      this.supabase
        .from("freelancer_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      this.supabase
        .from("certifications")
        .select("*")
        .eq("user_id", userId)
        .order("year_obtained", { ascending: false }),
      this.supabase
        .from("work_experience")
        .select("*")
        .eq("user_id", userId)
        .order("start_year", { ascending: false }),
    ]);

    for (const result of [generalProfile, editFlags, freelancerProfile, certifications, workExperience]) {
      if (result.error) {
        throw new InternalServerErrorException(result.error.message);
      }
    }

    return {
      success: true,
      data: {
        generalProfile: generalProfile.data || null,
        editFlags: editFlags.data || null,
        freelancerProfile: freelancerProfile.data || null,
        certifications: certifications.data || [],
        workExperience: workExperience.data || [],
      },
    };
  }

  async getDeleteChecks(authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);

    const [walletRes, activeContractsRes, activeJobsRes, authCodeRes] = await Promise.all([
      this.supabase
        .from("wallets")
        .select("balance, escrow_balance")
        .eq("user_id", userId)
        .maybeSingle(),
      this.supabase
        .from("contracts")
        .select("id", { count: "exact", head: true })
        .or(`client_id.eq.${userId},freelancer_id.eq.${userId}`)
        .in("status", ["active", "pending_funding", "in_review", "draft", "interviewing"]),
      this.supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("client_id", userId)
        .in("status", ["open", "in_progress"]),
      this.supabase
        .from("auth_codes")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    for (const result of [walletRes, activeContractsRes, activeJobsRes, authCodeRes]) {
      if (result.error) {
        throw new InternalServerErrorException(result.error.message);
      }
    }

    const walletBalance = (walletRes.data?.balance || 0) + (walletRes.data?.escrow_balance || 0);

    return {
      success: true,
      data: {
        walletBalance,
        activeContracts: activeContractsRes.count || 0,
        activeJobs: activeJobsRes.count || 0,
        hasAuthCode: !!authCodeRes.data,
      },
    };
  }

  async updateAvatar(avatarUrl: string, authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);
    const { error } = await this.supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", userId);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return { success: true, data: { avatarUrl } };
  }

  async updateMyProfile(input: Record<string, any>, authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);

    const {
      phone,
      whatsapp,
      state,
      city,
      occupation,
      fullName,
      fullNameEdited,
      role,
      freelancerProfileId,
      freelancerData,
      certifications,
      workExperience,
      deletedCertIds,
      deletedExpIds,
    } = input || {};

    const profileUpdate: Record<string, any> = {
      phone: phone || null,
      whatsapp: whatsapp || null,
      state: state || null,
      city: city || null,
      occupation: occupation || null,
    };
    if (!fullNameEdited && fullName) {
      profileUpdate.full_name = fullName;
      profileUpdate.full_name_edited = true;
    }

    const { error: profileError } = await this.supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", userId);
    if (profileError) {
      throw new InternalServerErrorException(profileError.message);
    }

    if (role === "freelancer") {
      const payload = {
        user_id: userId,
        title: freelancerData?.title || null,
        bio: freelancerData?.bio || null,
        skills: Array.isArray(freelancerData?.skills) ? freelancerData.skills : [],
        hourly_rate: freelancerData?.hourly_rate ?? null,
        min_project_rate: freelancerData?.min_project_rate ?? null,
        years_experience: freelancerData?.years_experience ?? null,
        availability: freelancerData?.availability || "flexible",
        show_whatsapp: !!freelancerData?.show_whatsapp,
      };

      if (freelancerProfileId) {
        const { error } = await this.supabase
          .from("freelancer_profiles")
          .update(payload)
          .eq("id", freelancerProfileId);
        if (error) {
          throw new InternalServerErrorException(error.message);
        }
      } else {
        const { error } = await this.supabase
          .from("freelancer_profiles")
          .insert(payload);
        if (error) {
          throw new InternalServerErrorException(error.message);
        }
      }

      if (Array.isArray(deletedCertIds) && deletedCertIds.length > 0) {
        const { error } = await this.supabase
          .from("certifications")
          .delete()
          .in("id", deletedCertIds);
        if (error) {
          throw new InternalServerErrorException(error.message);
        }
      }

      for (const cert of certifications || []) {
        if (!cert?.name) continue;
        const certData = {
          user_id: userId,
          name: cert.name,
          issuer: cert.issuer || null,
          year_obtained: cert.year_obtained || null,
          credential_url: cert.credential_url || null,
        };
        if (cert.id) {
          const { error } = await this.supabase
            .from("certifications")
            .update(certData)
            .eq("id", cert.id);
          if (error) {
            throw new InternalServerErrorException(error.message);
          }
        } else {
          const { error } = await this.supabase
            .from("certifications")
            .insert(certData);
          if (error) {
            throw new InternalServerErrorException(error.message);
          }
        }
      }

      if (Array.isArray(deletedExpIds) && deletedExpIds.length > 0) {
        const { error } = await this.supabase
          .from("work_experience")
          .delete()
          .in("id", deletedExpIds);
        if (error) {
          throw new InternalServerErrorException(error.message);
        }
      }

      for (const exp of workExperience || []) {
        if (!exp?.company || !exp?.role) continue;
        const expData = {
          user_id: userId,
          company: exp.company,
          role: exp.role,
          start_year: exp.start_year,
          end_year: exp.end_year,
          is_current: !!exp.is_current,
          description: exp.description || null,
        };
        if (exp.id) {
          const { error } = await this.supabase
            .from("work_experience")
            .update(expData)
            .eq("id", exp.id);
          if (error) {
            throw new InternalServerErrorException(error.message);
          }
        } else {
          const { error } = await this.supabase
            .from("work_experience")
            .insert(expData);
          if (error) {
            throw new InternalServerErrorException(error.message);
          }
        }
      }
    }

    return { success: true, data: {} };
  }

  private async getRequiredUserId(authorization?: string) {
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : null;

    if (!token) throw new UnauthorizedException("Missing bearer token.");

    const {
      data: { user },
      error,
    } = await this.supabase.auth.getUser(token);

    if (error || !user) throw new UnauthorizedException("Invalid or expired session.");

    return user.id;
  }
}
