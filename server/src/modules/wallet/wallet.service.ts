import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const hiddenTypes = ["escrow_credit", "escrow_hold"];

@Injectable()
export class WalletService {
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

  async getOverview(authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);

    const [walletRes, walletTxRes] = await Promise.all([
      this.supabase.from("wallets").select("*").eq("user_id", userId).maybeSingle(),
      this.supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (walletRes.error) {
      throw new InternalServerErrorException(walletRes.error.message);
    }

    if (walletTxRes.error) {
      throw new InternalServerErrorException(walletTxRes.error.message);
    }

    const transactions = ((walletTxRes.data as any[]) || []).filter(
      (tx) => !hiddenTypes.includes(tx.type),
    );

    const pendingClearanceTxs = transactions.filter(
      (tx) => tx.clearance_at && new Date(tx.clearance_at) > new Date(),
    );

    return {
      success: true,
      data: {
        wallet: walletRes.data,
        transactions,
        pendingClearanceTxs,
      },
    };
  }

  async getBalance(authorization?: string) {
    const userId = await this.getRequiredUserId(authorization);
    const { data, error } = await this.supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return {
      success: true,
      data: {
        balance: data?.balance || 0,
      },
    };
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
