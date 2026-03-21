import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class AuthService {
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

  async getBootstrap(authorization?: string) {
    const startedAt = Date.now();
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : null;

    if (!token) {
      throw new UnauthorizedException("Missing bearer token.");
    }

    const getUserStartedAt = Date.now();
    const {
      data: { user },
      error: authError,
    } = await this.supabase.auth.getUser(token);
    console.info("[auth/bootstrap] getUser resolved", {
      durationMs: Date.now() - getUserStartedAt,
      hasUser: !!user,
      hasError: !!authError,
    });

    if (authError || !user) {
      throw new UnauthorizedException("Invalid or expired session.");
    }

    const profileAndRoleStartedAt = Date.now();
    const [{ data: profile, error: profileError }, { data: adminRole, error: roleError }] = await Promise.all([
      this.supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url, role")
        .eq("id", user.id)
        .maybeSingle(),
      this.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle(),
    ]);
    console.info("[auth/bootstrap] profile+role resolved", {
      durationMs: Date.now() - profileAndRoleStartedAt,
      hasProfile: !!profile,
      hasProfileError: !!profileError,
      hasRole: !!adminRole,
      hasRoleError: !!roleError,
      userId: user.id,
    });

    if (profileError) {
      throw new InternalServerErrorException(profileError.message);
    }

    if (roleError) {
      throw new InternalServerErrorException(roleError.message);
    }

    const isAdmin = !!adminRole;

    const response = {
      success: true,
      data: {
        user: profile
          ? {
              id: user.id,
              fullName: profile.full_name,
              username: profile.username,
              avatarUrl: profile.avatar_url,
              role: isAdmin ? "admin" : profile.role,
              onboardingComplete: isAdmin || Boolean(profile.role && profile.username),
              isAdmin,
            }
          : null,
      },
    };

    console.info("[auth/bootstrap] complete", {
      userId: user.id,
      durationMs: Date.now() - startedAt,
      hasProfile: !!profile,
      isAdmin,
    });

    return response;
  }

  async lookupUser(identifier?: string) {
    const value = (identifier || "").trim();
    if (!value) {
      return {
        success: true,
        data: {
          found: false,
          email: null,
        },
      };
    }

    const isEmail = value.includes("@");
    const query = isEmail
      ? this.supabase
          .from("profiles")
          .select("email")
          .eq("email", value.toLowerCase())
          .maybeSingle()
      : this.supabase
          .from("profiles")
          .select("email")
          .eq("username", value)
          .maybeSingle();

    const { data, error } = await query;
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return {
      success: true,
      data: {
        found: !!data,
        email: data?.email || null,
      },
    };
  }

  async updateMyRole(role: "client" | "freelancer", authorization?: string) {
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : null;
    if (!token) {
      throw new UnauthorizedException("Missing bearer token.");
    }

    const {
      data: { user },
      error: authError,
    } = await this.supabase.auth.getUser(token);
    if (authError || !user) {
      throw new UnauthorizedException("Invalid or expired session.");
    }

    const { error } = await this.supabase
      .from("profiles")
      .update({ role })
      .eq("id", user.id);
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return {
      success: true,
      data: {
        role,
      },
    };
  }

  async getUsernameAvailability(username?: string, excludeUserId?: string) {
    const normalized = this.normalizeUsername(username);
    if (!normalized) {
      return {
        success: true,
        data: {
          available: false,
          username: null,
        },
      };
    }

    let query = this.supabase
      .from("profiles")
      .select("id")
      .eq("username", normalized)
      .limit(1);

    if (excludeUserId) {
      query = query.neq("id", excludeUserId);
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return {
      success: true,
      data: {
        available: !data,
        username: normalized,
      },
    };
  }

  async updateMyOccupation(occupation?: string, authorization?: string) {
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : null;
    if (!token) {
      throw new UnauthorizedException("Missing bearer token.");
    }

    const {
      data: { user },
      error: authError,
    } = await this.supabase.auth.getUser(token);
    if (authError || !user) {
      throw new UnauthorizedException("Invalid or expired session.");
    }

    const nextOccupation = (occupation || "").trim();
    const { error } = await this.supabase
      .from("profiles")
      .update({ occupation: nextOccupation || null })
      .eq("id", user.id);

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return {
      success: true,
      data: {
        occupation: nextOccupation || null,
      },
    };
  }

  async completeOnboarding(
    role: "client" | "freelancer",
    username?: string,
    authorization?: string,
  ) {
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : null;
    if (!token) {
      throw new UnauthorizedException("Missing bearer token.");
    }

    const {
      data: { user },
      error: authError,
    } = await this.supabase.auth.getUser(token);
    if (authError || !user) {
      throw new UnauthorizedException("Invalid or expired session.");
    }

    const normalizedUsername = this.normalizeUsername(username);
    if (!normalizedUsername) {
      throw new BadRequestException("Valid username is required.");
    }

    const { data: existingUsername, error: usernameError } = await this.supabase
      .from("profiles")
      .select("id")
      .eq("username", normalizedUsername)
      .neq("id", user.id)
      .limit(1)
      .maybeSingle();

    if (usernameError) {
      throw new InternalServerErrorException(usernameError.message);
    }

    if (existingUsername) {
      throw new BadRequestException("This username is already taken.");
    }

    const { data: updatedProfile, error: updateError } = await this.supabase
      .from("profiles")
      .update({ role, username: normalizedUsername })
      .eq("id", user.id)
      .select("role, username")
      .maybeSingle();

    if (updateError) {
      throw new InternalServerErrorException(updateError.message);
    }

    if (!updatedProfile) {
      throw new InternalServerErrorException("Profile update returned no data.");
    }

    return {
      success: true,
      data: {
        role: updatedProfile.role,
        username: updatedProfile.username,
      },
    };
  }

  private normalizeUsername(username?: string) {
    const value = (username || "").trim().toLowerCase();
    if (!value) return null;
    if (value.length < 3 || value.length > 30) return null;
    if (!/^[a-z0-9_]+$/.test(value)) return null;
    return value;
  }
}
