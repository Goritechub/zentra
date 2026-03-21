import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class SupabaseAdminService {
  private readonly client: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>("SUPABASE_URL");
    const serviceRoleKey = this.configService.get<string>("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new InternalServerErrorException("Supabase server configuration is missing.");
    }

    this.client = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  getClient() {
    return this.client;
  }

  async getRequiredUserId(authorization?: string) {
    const token = this.extractBearerToken(authorization);

    if (!token) {
      throw new UnauthorizedException("Missing bearer token.");
    }

    const {
      data: { user },
      error,
    } = await this.client.auth.getUser(token);

    if (error || !user) {
      throw new UnauthorizedException("Invalid or expired session.");
    }

    return user.id;
  }

  async getOptionalUserId(authorization?: string) {
    const token = this.extractBearerToken(authorization);

    if (!token) {
      return null;
    }

    const {
      data: { user },
      error,
    } = await this.client.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return user.id;
  }

  private extractBearerToken(authorization?: string) {
    return authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : null;
  }
}
