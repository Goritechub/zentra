import { createNotification as createNotificationApi } from "@/api/notifications.api";

/**
 * Insert a notification for a user. Call from client-side after contract status changes.
 */
export async function createNotification({
  userId,
  type,
  title,
  message,
  contractId,
  linkUrl,
}: {
  userId: string;
  type: string;
  title: string;
  message: string;
  contractId?: string | null;
  linkUrl?: string | null;
}) {
  return createNotificationApi({ userId, type, title, message, contractId, linkUrl });
}

/**
 * Resolve the target URL for a notification based on its type and associated data.
 */
export function getNotificationUrl(notification: {
  type: string;
  contract_id?: string | null;
  link_url?: string | null;
}): string | null {
  // Explicit link takes priority
  if (notification.link_url) return notification.link_url;

  // Fallback routing based on type
  const type = notification.type;

  if (notification.contract_id) {
    return `/contract/${notification.contract_id}`;
  }

  // Type-based fallbacks when no contract_id or link_url
  const typeRoutes: Record<string, string> = {
    contest_winner: "/dashboard/contest-entries",
    contest_comment: "/contests",
    contest_reminder: "/dashboard/my-contests",
    contest_deadline: "/dashboard/my-contests",
    contest_auto_award: "/dashboard/my-contests",
    contest_no_nominees: "/dashboard/my-contests",
    mention: "/contests",
    offer_declined: "/dashboard/offers",
    payment_received: "/transactions",
    payout_success: "/transactions",
    payout_failed: "/transactions",
    proposal_rejected: "/dashboard/expert-proposals",
    interview_started: "/dashboard/expert-proposals",
    hired: "/dashboard/contracts",
    kyc_verified: "/my-profile",
    kyc_failed: "/my-profile",
  };

  return typeRoutes[type] || null;
}
