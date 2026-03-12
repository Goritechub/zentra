import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { AuthCodeVerifyModal } from "@/components/AuthCodeVerifyModal";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { createNotification } from "@/lib/notifications";
import { formatNaira } from "@/lib/nigerian-data";
import { isPast, format, formatDistanceToNow, differenceInHours } from "date-fns";
import { toast } from "sonner";
import {
  Loader2,
  ArrowLeft,
  Trophy,
  Calendar,
  Users,
  FileText,
  Award,
  Upload,
  Eye,
  Lock,
  Star,
  MessageSquare,
  ThumbsUp,
  Heart,
  Reply,
  Send,
  Clock,
  Bell,
  BellOff,
  MapPin,
  Trash2,
  Edit3,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Status helpers — single source of truth for the whole file
// ---------------------------------------------------------------------------

/**
 * Derives the canonical contest status from DB record + live winners count.
 *
 *  "active"            — deadline in future, no winners yet
 *  "selecting_winners" — deadline passed, no winners published yet
 *  "completed"         — winners published (winners.length > 0)
 *                        OR db status is "ended" / "completed"
 */
function deriveContestStatus(contest: any, winnersCount: number): "active" | "selecting_winners" | "completed" {
  if (!contest) return "active";
  if (winnersCount > 0 || contest.status === "ended" || contest.status === "completed") return "completed";
  if (contest.status === "selecting_winners" || isPast(new Date(contest.deadline))) return "selecting_winners";
  return "active";
}

function getStatusLabel(status: ReturnType<typeof deriveContestStatus>) {
  if (status === "completed") return "Completed";
  if (status === "selecting_winners") return "Selecting Winners";
  return "Active";
}

function getStatusVariant(status: ReturnType<typeof deriveContestStatus>): "default" | "secondary" | "outline" {
  if (status === "completed") return "secondary";
  if (status === "selecting_winners") return "outline";
  return "default";
}

// ---------------------------------------------------------------------------
// CommentItem — outside main component so React sees a stable reference
// ---------------------------------------------------------------------------

interface CommentItemProps {
  comment: any;
  depth?: number;
  contest: any;
  user: any;
  commentLikes: any[];
  replyTo: string | null;
  replyText: string;
  postingComment: boolean;
  showMentions: boolean;
  mentionSuggestions: any[];
  mentionTarget: "comment" | "reply";
  commentsLocked: boolean;
  getReplies: (parentId: string) => any[];
  renderCommentText: (text: string) => React.ReactNode;
  getCommentLikeCount: (commentId: string) => number;
  hasUserLiked: (commentId: string) => boolean;
  isLikedByClient: (commentId: string) => boolean;
  onLike: (commentId: string) => void;
  onReplyToggle: (commentId: string) => void;
  onReplyTextChange: (value: string) => void;
  onPostReply: (parentId: string) => void;
  onInsertMention: (participant: any) => void;
}

const CommentItem = ({
  comment,
  depth = 0,
  contest,
  user,
  commentLikes,
  replyTo,
  replyText,
  postingComment,
  showMentions,
  mentionSuggestions,
  mentionTarget,
  commentsLocked,
  getReplies,
  renderCommentText,
  getCommentLikeCount,
  hasUserLiked,
  isLikedByClient,
  onLike,
  onReplyToggle,
  onReplyTextChange,
  onPostReply,
  onInsertMention,
}: CommentItemProps) => {
  const replies = getReplies(comment.id);
  const likeCount = getCommentLikeCount(comment.id);
  const liked = hasUserLiked(comment.id);
  const clientLiked = isLikedByClient(comment.id);

  return (
    <div className={`${depth > 0 ? "ml-6 pl-4 border-l-2 border-border" : ""}`}>
      <div className={`p-3 rounded-lg ${clientLiked ? "bg-primary/5 border border-primary/20" : "bg-muted/30"}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-foreground">{(comment.user as any)?.full_name || "User"}</span>
          {(comment.user as any)?.username && (
            <span className="text-xs text-muted-foreground">@{(comment.user as any).username}</span>
          )}
          {comment.user_id === contest.client_id && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              Contest Owner
            </Badge>
          )}
          {clientLiked && (
            <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-primary/20 text-primary border-0">
              <Heart className="h-2.5 w-2.5 mr-0.5" /> Liked by Client
            </Badge>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </span>
        </div>
        <p className="text-sm text-foreground/80">{renderCommentText(comment.content)}</p>
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={() => onLike(comment.id)}
            className={`flex items-center gap-1 text-xs ${
              liked ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ThumbsUp className="h-3 w-3" /> {likeCount > 0 && likeCount}
          </button>
          {user && !commentsLocked && (
            <button
              onClick={() => onReplyToggle(comment.id)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Reply className="h-3 w-3" /> Reply
            </button>
          )}
        </div>
      </div>

      {replyTo === comment.id && !commentsLocked && (
        <div className="ml-6 mt-2 relative">
          <div className="flex gap-2">
            <Input
              placeholder="Write a reply... (use @ to mention)"
              value={replyText}
              onChange={(e) => onReplyTextChange(e.target.value)}
              className="flex-1 h-8 text-sm"
              onKeyDown={(e) => e.key === "Enter" && !showMentions && onPostReply(comment.id)}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onPostReply(comment.id)}
              disabled={postingComment || !replyText.trim()}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
          {showMentions && mentionTarget === "reply" && (
            <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-32 overflow-y-auto">
              {mentionSuggestions.map((p) => (
                <button
                  key={p.id}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                  onClick={() => onInsertMention(p)}
                >
                  <span className="font-medium">{p.full_name}</span>
                  {p.username && <span className="text-muted-foreground ml-1">@{p.username}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {replies.map((r: any) => (
            <CommentItem
              key={r.id}
              comment={r}
              depth={depth + 1}
              contest={contest}
              user={user}
              commentLikes={commentLikes}
              replyTo={replyTo}
              replyText={replyText}
              postingComment={postingComment}
              showMentions={showMentions}
              mentionSuggestions={mentionSuggestions}
              mentionTarget={mentionTarget}
              commentsLocked={commentsLocked}
              getReplies={getReplies}
              renderCommentText={renderCommentText}
              getCommentLikeCount={getCommentLikeCount}
              hasUserLiked={hasUserLiked}
              isLikedByClient={isLikedByClient}
              onLike={onLike}
              onReplyToggle={onReplyToggle}
              onReplyTextChange={onReplyTextChange}
              onPostReply={onPostReply}
              onInsertMention={onInsertMention}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// WinnerCard
// ---------------------------------------------------------------------------
function WinnerCard({
  winner,
  contest,
  position,
  isLarge,
  isOpen,
  onViewEntry,
}: {
  winner: any;
  contest: any;
  position: number;
  isLarge?: boolean;
  isOpen: boolean;
  onViewEntry: (entryId: string) => void;
}) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const medals = ["🥇", "🥈", "🥉", "🏅", "🏅"];
  const posLabels = ["1st Place", "2nd Place", "3rd Place", "4th Place", "5th Place"];
  const medal = medals[position - 1] || "🏅";
  const posLabel = posLabels[position - 1] || `${position}th Place`;
  const prizeKeys = ["prize_first", "prize_second", "prize_third", "prize_fourth", "prize_fifth"];
  const prize = contest[prizeKeys[position - 1]] || 0;
  const name = (winner.freelancer as any)?.full_name || "Expert";
  const username = (winner.freelancer as any)?.username;
  const avatarUrl = (winner.freelancer as any)?.avatar_url;
  const initials = name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const justifications = contest.winner_justifications || {};
  const justification = justifications[String(position)] || "";
  const clientLocation = (contest.client as any)?.state || (contest.client as any)?.city || "";

  const JUSTIFICATION_TRUNCATE = 100;
  const isTruncated = justification.length > JUSTIFICATION_TRUNCATE;

  return (
    <div
      className={`relative bg-card rounded-2xl border border-border shadow-lg pt-10 pb-5 px-5 text-center transition-transform hover:shadow-xl ${
        isLarge ? "scale-105 z-10 border-primary/40 shadow-xl" : ""
      }`}
    >
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-3xl">{medal}</div>
      <div className="absolute -top-8 left-1/2 -translate-x-1/2">
        <Avatar className={`border-4 border-background shadow-md ${isLarge ? "h-16 w-16" : "h-14 w-14"}`}>
          <AvatarImage src={avatarUrl || undefined} />
          <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">{initials}</AvatarFallback>
        </Avatar>
      </div>

      <div className="mt-2">
        <button onClick={() => navigate(`/expert/${winner.freelancer_id}/profile`)} className="hover:underline">
          <p className={`font-bold text-foreground ${isLarge ? "text-lg" : "text-base"}`}>{name}</p>
        </button>
        {username && (
          <button onClick={() => navigate(`/expert/${winner.freelancer_id}/profile`)} className="hover:underline">
            <p className="text-xs text-muted-foreground">@{username}</p>
          </button>
        )}
        {clientLocation && (
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3" /> {clientLocation}
          </p>
        )}
      </div>

      <Badge variant="outline" className="mt-2 text-xs">
        {posLabel}
      </Badge>

      <p className={`font-bold text-primary mt-3 ${isLarge ? "text-2xl" : "text-xl"}`}>{formatNaira(prize)}</p>

      {justification && (
        <div className="mt-3 text-left">
          <p className="text-xs text-muted-foreground italic">
            "{expanded || !isTruncated ? justification : justification.slice(0, JUSTIFICATION_TRUNCATE) + "..."}"
          </p>
          {isTruncated && (
            <button onClick={() => setExpanded(!expanded)} className="text-xs text-primary hover:underline mt-1">
              {expanded ? "show less" : "...view more"}
            </button>
          )}
        </div>
      )}

      {isOpen && (
        <Button size="sm" variant="ghost" className="mt-3 text-xs" onClick={() => onViewEntry(winner.id)}>
          <Eye className="h-3 w-3 mr-1" /> View Entry
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function ContestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();

  const [contest, setContest] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [winners, setWinners] = useState<any[]>([]);
  const [nominees, setNominees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("description");
  const [trueEntryCount, setTrueEntryCount] = useState<number>(0);

  // Submit entry
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submissionDesc, setSubmissionDesc] = useState("");
  const [submissionFiles, setSubmissionFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Edit entry
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editFiles, setEditFiles] = useState<File[]>([]);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Publish winners
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [showAuthCode, setShowAuthCode] = useState(false);
  const [publishingWinners, setPublishingWinners] = useState(false);
  const [justifications, setJustifications] = useState<Record<string, string>>({});

  // Extend deadline
  const [showExtendDialog, setShowExtendDialog] = useState(false);
  const [newDeadline, setNewDeadline] = useState("");
  const [extendingDeadline, setExtendingDeadline] = useState(false);

  // Follow
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Comments
  const [comments, setComments] = useState<any[]>([]);
  const [commentLikes, setCommentLikes] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState<any[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionTarget, setMentionTarget] = useState<"comment" | "reply">("comment");
  const [contestParticipants, setContestParticipants] = useState<any[]>([]);
  const commentsRef = useRef<HTMLDivElement>(null);

  const isExpert = profile?.role === "freelancer";

  // ---------------------------------------------------------------------------
  // Derived state — all status logic flows from here
  // ---------------------------------------------------------------------------
  const contestStatus = deriveContestStatus(contest, winners.length);
  const isCompleted = contestStatus === "completed";
  const isSelectingWinners = contestStatus === "selecting_winners";
  const isActive = contestStatus === "active";

  const deadlinePassed = contest ? isPast(new Date(contest.deadline)) : false;
  const isOpen = contest?.visibility === "open";
  const isOwner = contest?.client_id === user?.id;

  const totalPrize = contest
    ? (contest.prize_first || 0) +
      (contest.prize_second || 0) +
      (contest.prize_third || 0) +
      (contest.prize_fourth || 0) +
      (contest.prize_fifth || 0)
    : 0;

  const allEntries = [...entries, ...nominees, ...winners];
  const hasAlreadyEntered = allEntries.some((e) => e.freelancer_id === user?.id);
  const acceptingEntries = isActive && !deadlinePassed;

  // "Proceed to select winners" banner: owner only, selecting state, no winners yet
  const canSelectWinners = isOwner && isSelectingWinners && winners.length === 0;

  const canExtendDeadline =
    isOwner &&
    !isCompleted &&
    deadlinePassed &&
    contest?.status === "active" &&
    !contest?.deadline_extended_once &&
    winners.length === 0;

  // Comments locked once contest is completed
  const commentsLocked = isCompleted;

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (id) {
      fetchContest();
      fetchComments();
      fetchLikes();
      if (user) fetchFollowState();
    }
  }, [id, user]);

  useEffect(() => {
    if (location.hash === "#comments" && commentsRef.current) {
      setTimeout(() => commentsRef.current?.scrollIntoView({ behavior: "smooth" }), 500);
    }
  }, [location.hash, comments]);

  // Auto-promote status to "selecting_winners" — only the contest owner triggers the DB write;
  // other viewers just see the derived state locally.
  useEffect(() => {
    if (contest && deadlinePassed && contest.status === "active" && winners.length === 0) {
      if (user && contest.client_id === user.id) {
        supabase
          .from("contests" as any)
          .update({ status: "selecting_winners" })
          .eq("id", id)
          .then(() => {
            setContest((prev: any) => ({ ...prev, status: "selecting_winners" }));
          });
      } else {
        // Non-owners see derived state without writing to DB
        setContest((prev: any) => ({ ...prev, status: "selecting_winners" }));
      }
    }
  }, [contest?.id, deadlinePassed, contest?.status, winners.length, user?.id]);

  const fetchFollowState = async () => {
    if (!user || !id) return;
    const { data } = await supabase
      .from("contest_follows" as any)
      .select("id")
      .eq("contest_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    setIsFollowing(!!data);
  };

  const handleToggleFollow = async () => {
    if (!user || !id) return;
    setFollowLoading(true);
    if (isFollowing) {
      await supabase
        .from("contest_follows" as any)
        .delete()
        .eq("contest_id", id)
        .eq("user_id", user.id);
      setIsFollowing(false);
      toast.success("Unfollowed contest");
    } else {
      await supabase.from("contest_follows" as any).insert({ contest_id: id, user_id: user.id } as any);
      setIsFollowing(true);
      toast.success("Following contest — you'll be notified of new comments");
    }
    setFollowLoading(false);
  };

  const fetchContest = async () => {
    const { data } = (await supabase
      .from("contests" as any)
      .select("*, client:profiles!contests_client_id_fkey(full_name, avatar_url, username, state, city)")
      .eq("id", id)
      .single()) as { data: any };
    setContest(data);

    // Fetch true entry count via SECURITY DEFINER function (bypasses RLS)
    const { data: countData } = await supabase.rpc("get_contest_entry_count", { _contest_id: id! } as any);
    setTrueEntryCount(typeof countData === "number" ? countData : 0);

    const { data: entriesData } = await supabase
      .from("contest_entries")
      .select("*, freelancer:profiles!contest_entries_freelancer_id_fkey(full_name, avatar_url, username)")
      .eq("contest_id", id!)
      .order("created_at", { ascending: false });

    const allFetched = (entriesData as any[]) || [];
    setWinners(
      allFetched.filter((e) => e.is_winner).sort((a, b) => (a.prize_position || 99) - (b.prize_position || 99)),
    );
    setNominees(allFetched.filter((e) => (e as any).is_nominee && !e.is_winner));
    setEntries(allFetched.filter((e) => !e.is_winner && !(e as any).is_nominee));

    const participants: any[] = [];
    if (data) {
      participants.push({
        id: data.client_id,
        full_name: (data.client as any)?.full_name,
        username: (data.client as any)?.username,
      });
    }
    allFetched.forEach((e) => {
      if (!participants.find((p) => p.id === e.freelancer_id)) {
        participants.push({
          id: e.freelancer_id,
          full_name: (e.freelancer as any)?.full_name,
          username: (e.freelancer as any)?.username,
        });
      }
    });
    setContestParticipants(participants);
    setLoading(false);
  };

  const fetchLikes = async () => {
    if (!id) return;
    const { data } = await supabase.from("contest_comment_likes").select("*");
    setCommentLikes((data as any[]) || []);
  };

  const fetchComments = useCallback(async () => {
    const { data: commentsData, error: commentsError } = await supabase
      .from("contest_comments")
      .select("*")
      .eq("contest_id", id)
      .order("created_at", { ascending: true });

    if (commentsError) {
      toast.error("Failed to load comments");
      return;
    }

    const rows = (commentsData as any[]) || [];
    const userIds = Array.from(new Set(rows.map((c) => c.user_id).filter(Boolean)));

    let profileMap = new Map<string, any>();
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, username")
        .in("id", userIds);
      if (profilesData) {
        profileMap = new Map(profilesData.map((p: any) => [p.id, p]));
      }
    }

    const hydrated = rows.map((c) => ({
      ...c,
      user: profileMap.get(c.user_id) || null,
    }));

    setComments(hydrated);

    const commentIds = rows.map((c) => c.id);
    if (commentIds.length > 0) {
      const { data: likesData } = await supabase.from("contest_comment_likes").select("*").in("comment_id", commentIds);
      setCommentLikes((likesData as any[]) || []);
    }

    setContestParticipants((prev) => {
      const updated = [...prev];
      hydrated.forEach((c: any) => {
        if (!updated.find((p) => p.id === c.user_id)) {
          updated.push({
            id: c.user_id,
            full_name: c.user?.full_name,
            username: c.user?.username,
          });
        }
      });
      return updated;
    });
  }, [id]);

  // ---------------------------------------------------------------------------
  // Entry helpers
  // ---------------------------------------------------------------------------

  const getMaxNominees = () => {
    if (!contest) return 1;
    let count = 1;
    if (contest.prize_second > 0) count = 2;
    if (contest.prize_third > 0) count = 3;
    if (contest.prize_fourth > 0) count = 4;
    if (contest.prize_fifth > 0) count = 5;
    return count;
  };

  const canEditEntry = (entry: any) => {
    if (entry.freelancer_id !== user?.id) return false;
    if (isCompleted || deadlinePassed) return false;
    if ((entry.edit_count || 0) >= 2) return false;
    const createdAt = new Date(entry.last_edited_at || entry.created_at);
    if (differenceInHours(new Date(), createdAt) > 8) return false;
    return true;
  };

  const canDeleteEntry = (entry: any) => {
    if (entry.freelancer_id !== user?.id) return false;
    if (deadlinePassed || isCompleted) return false;
    return true;
  };

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSubmitEntry = async () => {
    if (!submissionDesc.trim()) {
      toast.error("Please add a description");
      return;
    }
    setSubmitting(true);
    const urls: string[] = [];
    for (const file of submissionFiles) {
      const path = `entries/${user!.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("contest-banners").upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from("contest-banners").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    const { error } = await supabase.from("contest_entries").insert({
      contest_id: id,
      freelancer_id: user!.id,
      description: submissionDesc.trim(),
      attachments: urls,
    });
    if (error) toast.error("Failed to submit entry");
    else {
      toast.success("Entry submitted!");
      setShowSubmitDialog(false);
      setSubmissionDesc("");
      setSubmissionFiles([]);
      fetchContest();
    }
    setSubmitting(false);
  };

  const handleEditEntry = async () => {
    if (!editingEntry || !editDesc.trim()) {
      toast.error("Please add a description");
      return;
    }
    setEditSubmitting(true);
    let newAttachments = editingEntry.attachments || [];
    if (editFiles.length > 0) {
      const urls: string[] = [];
      for (const file of editFiles) {
        const path = `entries/${user!.id}/${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from("contest-banners").upload(path, file);
        if (!error) {
          const { data } = supabase.storage.from("contest-banners").getPublicUrl(path);
          urls.push(data.publicUrl);
        }
      }
      newAttachments = urls;
    }
    const { error } = await supabase
      .from("contest_entries")
      .update({
        description: editDesc.trim(),
        attachments: newAttachments,
        edit_count: (editingEntry.edit_count || 0) + 1,
        last_edited_at: new Date().toISOString(),
      })
      .eq("id", editingEntry.id);
    if (error) toast.error("Failed to update entry");
    else {
      toast.success("Entry updated!");
      setEditingEntry(null);
      setEditDesc("");
      setEditFiles([]);
      fetchContest();
    }
    setEditSubmitting(false);
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;
    const { error } = await supabase.from("contest_entries").delete().eq("id", entryId);
    if (error) toast.error("Failed to delete entry");
    else {
      toast.success("Entry deleted");
      fetchContest();
    }
  };

  const handleNominate = async (entryId: string) => {
    const max = getMaxNominees();
    if (nominees.length >= max) {
      toast.error(`You can only nominate up to ${max} entr${max === 1 ? "y" : "ies"} based on your prize structure.`);
      return;
    }
    await supabase
      .from("contest_entries")
      .update({ is_nominee: true } as any)
      .eq("id", entryId);
    toast.success("Entry nominated!");
    fetchContest();
  };

  const handleRemoveNominee = async (entryId: string) => {
    await supabase
      .from("contest_entries")
      .update({ is_nominee: false } as any)
      .eq("id", entryId);
    toast.success("Nominee removed");
    fetchContest();
  };

  const handlePublishWinners = async () => {
    const required = getMaxNominees();
    for (let i = 1; i <= required; i++) {
      if (!justifications[String(i)]?.trim()) {
        toast.error(`Please provide a justification for position ${i}`);
        setPublishingWinners(false);
        return;
      }
    }
    setPublishingWinners(true);

    await supabase
      .from("contests" as any)
      .update({ winner_justifications: justifications } as any)
      .eq("id", id);

    try {
      const { data, error } = await supabase.functions.invoke("publish-contest-winners", { body: { contest_id: id } });
      if (error || !data?.success) {
        toast.error(data?.error || "Failed to publish winners. Please try again.");
        setPublishingWinners(false);
        return;
      }
      toast.success("Winners published! Prize payouts completed.");
      setShowPublishConfirm(false);
      setJustifications({});
      fetchContest();
    } catch {
      toast.error("Failed to publish winners.");
    }
    setPublishingWinners(false);
  };

  const handleExtendDeadline = async () => {
    if (!newDeadline) {
      toast.error("Please select a new deadline");
      return;
    }
    setExtendingDeadline(true);
    const { error } = await supabase
      .from("contests" as any)
      .update({
        deadline: newDeadline,
        status: "active",
        deadline_extended_once: true,
      } as any)
      .eq("id", id);
    if (error) {
      toast.error("Failed to extend deadline");
    } else {
      toast.success("Deadline extended! Contest is active again.");
      setShowExtendDialog(false);
      setNewDeadline("");
      fetchContest();
    }
    setExtendingDeadline(false);
  };

  const handleViewEntry = (entryId: string) => {
    setActiveTab("entries");
    setTimeout(() => {
      const el = document.getElementById(`entry-${entryId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-primary", "ring-offset-2");
        setTimeout(() => el.classList.remove("ring-2", "ring-primary", "ring-offset-2"), 3000);
      }
    }, 300);
  };

  // ---------------------------------------------------------------------------
  // Comment helpers
  // ---------------------------------------------------------------------------

  const handleMentionSearch = (text: string, target: "comment" | "reply") => {
    const match = text.match(/@(\w*)$/);
    if (match) {
      const query = match[1].toLowerCase();
      const suggestions = contestParticipants
        .filter(
          (p) =>
            (p.username && p.username.toLowerCase().includes(query)) ||
            (p.full_name && p.full_name.toLowerCase().includes(query)),
        )
        .slice(0, 5);
      setMentionSuggestions(suggestions);
      setShowMentions(suggestions.length > 0);
      setMentionTarget(target);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (participant: any) => {
    const username = participant.username || participant.full_name?.replace(/\s+/g, "");
    if (mentionTarget === "comment") {
      setNewComment((prev) => prev.replace(/@\w*$/, `@${username} `));
    } else {
      setReplyText((prev) => prev.replace(/@\w*$/, `@${username} `));
    }
    setShowMentions(false);
  };

  const extractMentions = (text: string): string[] => {
    const matches = text.match(/@(\w+)/g);
    if (!matches) return [];
    return matches.map((m) => m.slice(1));
  };

  const notifyOnComment = async (commentText: string) => {
    if (!contest || !user || !id) return;
    if (contest.client_id !== user.id) {
      await createNotification({
        userId: contest.client_id,
        type: "contest_comment",
        title: "New comment on your contest",
        message: `${profile?.full_name || "Someone"} commented on "${contest.title}"`,
      });
    }
    const { data: followers } = await supabase
      .from("contest_follows" as any)
      .select("user_id")
      .eq("contest_id", id);
    if (followers) {
      for (const f of followers as any[]) {
        if (f.user_id === user.id) continue;
        if (f.user_id === contest.client_id) continue;
        await createNotification({
          userId: f.user_id,
          type: "contest_comment",
          title: "New comment on a contest you follow",
          message: `${profile?.full_name || "Someone"} commented on "${contest.title}"`,
        });
      }
    }
  };

  const handlePostComment = async (parentId?: string) => {
    if (commentsLocked) return;
    const text = parentId ? replyText : newComment;
    if (!text.trim() || !user) return;
    setPostingComment(true);

    const { data: inserted, error } = await supabase
      .from("contest_comments" as any)
      .insert({
        contest_id: id,
        user_id: user.id,
        parent_id: parentId || null,
        content: text.trim(),
      } as any)
      .select("*")
      .single();

    if (error) {
      toast.error("Failed to post comment");
      setPostingComment(false);
      return;
    }

    const mentionedUsernames = extractMentions(text);
    if (mentionedUsernames.length > 0 && inserted) {
      for (const username of mentionedUsernames) {
        const mentioned = contestParticipants.find((p) => p.username?.toLowerCase() === username.toLowerCase());
        if (mentioned && mentioned.id !== user.id) {
          await supabase.from("comment_mentions" as any).insert({
            comment_id: (inserted as any).id,
            mentioned_user_id: mentioned.id,
          } as any);
          await createNotification({
            userId: mentioned.id,
            type: "mention",
            title: "You were mentioned in a contest comment",
            message: `@${profile?.username || profile?.full_name} mentioned you in "${contest?.title}"`,
          });
        }
      }
    }

    await notifyOnComment(text);

    if (parentId) {
      setReplyTo(null);
      setReplyText("");
    } else setNewComment("");
    await fetchComments();
    setPostingComment(false);
  };

  const handleLikeComment = async (commentId: string) => {
    if (!user) return;
    const existing = commentLikes.find((l: any) => l.comment_id === commentId && l.user_id === user.id);
    if (existing) {
      await supabase
        .from("contest_comment_likes" as any)
        .delete()
        .eq("id", existing.id);
    } else {
      await supabase.from("contest_comment_likes" as any).insert({ comment_id: commentId, user_id: user.id } as any);
    }
    const commentIds = comments.map((c) => c.id);
    if (commentIds.length > 0) {
      const { data: likesData } = await supabase.from("contest_comment_likes").select("*").in("comment_id", commentIds);
      setCommentLikes((likesData as any[]) || []);
    }
  };

  const getCommentLikeCount = (commentId: string) => commentLikes.filter((l: any) => l.comment_id === commentId).length;
  const hasUserLiked = (commentId: string) =>
    user ? commentLikes.some((l: any) => l.comment_id === commentId && l.user_id === user.id) : false;
  const isLikedByClient = (commentId: string) =>
    contest ? commentLikes.some((l: any) => l.comment_id === commentId && l.user_id === contest.client_id) : false;

  const topLevelComments = comments.filter((c: any) => !c.parent_id);
  const getReplies = (parentId: string) => comments.filter((c: any) => c.parent_id === parentId);

  const renderCommentText = (text: string) => {
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        return (
          <span key={i} className="text-primary font-medium cursor-pointer hover:underline">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const handleReplyToggle = (commentId: string) => {
    setReplyTo(replyTo === commentId ? null : commentId);
    setReplyText("");
  };

  const handleReplyTextChange = (value: string) => {
    setReplyText(value);
    handleMentionSearch(value, "reply");
  };

  // ---------------------------------------------------------------------------
  // Loading / not-found guard
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!contest) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <p>Contest not found</p>
        </div>
        <Footer />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render constants
  // ---------------------------------------------------------------------------

  const maxNominees = getMaxNominees();
  const prizeLabels = ["🥇 1st Place", "🥈 2nd Place", "🥉 3rd Place", "🏅 4th Place", "🏅 5th Place"];
  const prizeKeys = ["prize_first", "prize_second", "prize_third", "prize_fourth", "prize_fifth"];
  const nomineeEmojis = ["🥇", "🥈", "🥉", "🏅", "🏅"];

  const commentItemProps = {
    contest,
    user,
    commentLikes,
    replyTo,
    replyText,
    postingComment,
    showMentions,
    mentionSuggestions,
    mentionTarget,
    commentsLocked,
    getReplies,
    renderCommentText,
    getCommentLikeCount,
    hasUserLiked,
    isLikedByClient,
    onLike: handleLikeComment,
    onReplyToggle: handleReplyToggle,
    onReplyTextChange: handleReplyTextChange,
    onPostReply: handlePostComment,
    onInsertMention: insertMention,
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide max-w-4xl">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>

          {/* Banner */}
          <div className="h-48 rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6 relative">
            {contest.banner_image ? (
              <img src={contest.banner_image} alt={contest.title} className="w-full h-full object-cover" />
            ) : (
              <Trophy className="h-20 w-20 text-primary/30" />
            )}
            <Badge variant={getStatusVariant(contestStatus)} className="absolute top-4 right-4 text-sm">
              {getStatusLabel(contestStatus)}
            </Badge>
          </div>

          {/* Owner "select winners" banner — hidden once winners are published */}
          {canSelectWinners && (
            <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-5 w-5 text-accent" />
                <p className="font-semibold text-foreground">Contest has ended. Select your winners.</p>
              </div>
              <div className="flex gap-2 mt-3">
                {canExtendDeadline && (
                  <Button size="sm" variant="outline" onClick={() => setShowExtendDialog(true)}>
                    <Calendar className="h-4 w-4 mr-1" /> Extend Deadline
                  </Button>
                )}
                <Button size="sm" onClick={() => setActiveTab("winners")}>
                  <Award className="h-4 w-4 mr-1" /> Proceed to Select Winners
                </Button>
              </div>
            </div>
          )}

          {/* Non-owner "selecting winners" notice */}
          {isSelectingWinners && !isOwner && (
            <div className="bg-muted/50 border border-border rounded-lg p-4 mb-6 flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">
                The client is currently reviewing entries and selecting winners.
              </p>
            </div>
          )}

          {/* Contest header */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{contest.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                by {(contest.client as any)?.full_name || "Client"}
                {(contest.client as any)?.username && (
                  <span className="text-primary ml-1">@{(contest.client as any).username}</span>
                )}
              </p>
              {contest.category && (
                <Badge variant="outline" className="mt-2">
                  {contest.category}
                </Badge>
              )}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">{formatNaira(totalPrize)}</p>
              <p className="text-xs text-muted-foreground">Total Prize Pool</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 mb-6">
            {isExpert && acceptingEntries && !hasAlreadyEntered && (
              <Button onClick={() => setShowSubmitDialog(true)}>
                <Upload className="h-4 w-4 mr-2" /> Submit Entry
              </Button>
            )}
            {hasAlreadyEntered && (
              <Badge variant="secondary" className="py-2 px-4">
                ✓ You've entered this contest
              </Badge>
            )}
            {isOwner && isSelectingWinners && winners.length === 0 && (
              <Button
                onClick={() => setShowPublishConfirm(true)}
                disabled={nominees.length !== maxNominees}
                title={nominees.length !== maxNominees ? `Nominate ${maxNominees} to publish` : ""}
              >
                <Award className="h-4 w-4 mr-2" /> Publish Winners ({nominees.length}/{maxNominees})
              </Button>
            )}
            {/* Follow — only visible while contest is not completed */}
            {user && !isOwner && !isCompleted && (
              <Button
                variant={isFollowing ? "outline" : "secondary"}
                size="sm"
                onClick={handleToggleFollow}
                disabled={followLoading}
              >
                {isFollowing ? (
                  <>
                    <BellOff className="h-4 w-4 mr-1" /> Unfollow
                  </>
                ) : (
                  <>
                    <Bell className="h-4 w-4 mr-1" /> Follow Contest
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="description">
                <FileText className="h-4 w-4 mr-1.5" /> Description
              </TabsTrigger>
              <TabsTrigger value="entries">
                <Users className="h-4 w-4 mr-1.5" /> Entries ({trueEntryCount})
              </TabsTrigger>
              <TabsTrigger value="winners">
                <Award className="h-4 w-4 mr-1.5" /> Winners
              </TabsTrigger>
            </TabsList>

            {/* ---------------------------------------------------------------- */}
            {/* DESCRIPTION                                                       */}
            {/* ---------------------------------------------------------------- */}
            <TabsContent value="description">
              <div className="bg-card rounded-xl border border-border p-6 space-y-6">
                <div>
                  <h2 className="font-semibold text-foreground mb-2">Description</h2>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{contest.description}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Runtime</p>
                    <p className="font-medium text-foreground flex items-center gap-1.5 mt-1">
                      <Calendar className="h-4 w-4 text-primary" />
                      {isCompleted
                        ? "Contest completed"
                        : deadlinePassed
                          ? "Deadline reached"
                          : `${formatDistanceToNow(new Date(contest.deadline))} remaining`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Deadline: {format(new Date(contest.deadline), "PPP p")}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Visibility</p>
                    <p className="font-medium text-foreground mt-1">{isOpen ? "Open Contest" : "Closed Contest"}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isOpen ? "Entries visible to everyone" : "Only entry count shown"}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-foreground mb-2">Prize Breakdown</h3>
                  <div className="space-y-2">
                    {prizeKeys.map((key, idx) => {
                      const prize = contest[key];
                      if (!prize || prize <= 0) return null;
                      return (
                        <div
                          key={key}
                          className={`flex justify-between p-3 rounded-lg ${
                            idx === 0 ? "bg-accent/10" : "bg-muted/50"
                          }`}
                        >
                          <span>{prizeLabels[idx]}</span>
                          <span className={idx === 0 ? "font-bold text-primary" : "font-semibold"}>
                            {formatNaira(prize)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {contest.rules && (
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Rules / How to Enter</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{contest.rules}</p>
                  </div>
                )}

                <div>
                  <h3 className="font-semibold text-foreground mb-2">Winner Selection</h3>
                  <p className="text-sm text-muted-foreground">
                    {contest.winner_selection_method === "client_selects"
                      ? "Client selects winners"
                      : contest.winner_selection_method || "Client selects winners"}
                  </p>
                </div>

                {/* Comments */}
                <div className="border-t border-border pt-6" ref={commentsRef} id="comments">
                  <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" /> Comments ({comments.length})
                  </h3>

                  {/* Locked notice replaces input when contest is over */}
                  {commentsLocked ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border mb-4">
                      <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                      <p className="text-sm text-muted-foreground">This contest has ended. Comments are closed.</p>
                    </div>
                  ) : user ? (
                    <div className="relative mb-6">
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="Write a comment... (use @ to mention users)"
                          value={newComment}
                          onChange={(e) => {
                            setNewComment(e.target.value);
                            handleMentionSearch(e.target.value, "comment");
                          }}
                          rows={2}
                          className="flex-1"
                        />
                        <Button
                          onClick={() => handlePostComment()}
                          disabled={postingComment || !newComment.trim()}
                          className="self-end"
                        >
                          {postingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                      </div>
                      {showMentions && mentionTarget === "comment" && (
                        <div className="absolute z-50 bottom-full mb-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-32 overflow-y-auto">
                          {mentionSuggestions.map((p) => (
                            <button
                              key={p.id}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                              onClick={() => insertMention(p)}
                            >
                              <span className="font-medium">{p.full_name}</span>
                              {p.username && <span className="text-muted-foreground ml-1">@{p.username}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}

                  {topLevelComments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No comments yet. Be the first to comment!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {topLevelComments.map((c: any) => (
                        <CommentItem key={c.id} comment={c} {...commentItemProps} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ---------------------------------------------------------------- */}
            {/* ENTRIES                                                           */}
            {/* ---------------------------------------------------------------- */}
            <TabsContent value="entries">
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-foreground">Entries ({trueEntryCount})</h2>
                  {isOwner && !isCompleted && (
                    <p className="text-xs text-muted-foreground">
                      Nominees: {nominees.length}/{maxNominees}
                    </p>
                  )}
                </div>

                {trueEntryCount === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No entries yet</p>
                  </div>
                ) : !isOpen && !isOwner ? (
                  /* Closed contest — blurred ghost list + overlay */
                  <div className="relative">
                    <div className="space-y-4 select-none pointer-events-none blur-sm opacity-60 max-h-96 overflow-hidden">
                      {Array.from({ length: trueEntryCount }).map((_, i) => (
                        <div key={i} className="border border-border rounded-lg p-4 bg-muted/30">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="h-4 w-32 bg-muted rounded" />
                              <div className="h-3 w-full bg-muted rounded" />
                              <div className="h-3 w-2/3 bg-muted rounded" />
                            </div>
                            <div className="h-4 w-20 bg-muted rounded" />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 rounded-lg">
                      <Lock className="h-10 w-10 text-muted-foreground mb-3" />
                      <p className="font-semibold text-foreground">
                        {trueEntryCount} {trueEntryCount === 1 ? "entry" : "entries"} submitted
                      </p>
                      <p className="text-sm text-muted-foreground mt-1 text-center px-8">
                        This is a closed contest. Entry details are only visible to the contest owner.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Open contest or owner — full list */
                  <div className="space-y-4">
                    {allEntries.map((entry: any) => {
                      const isMyEntry = entry.freelancer_id === user?.id;
                      const editable = canEditEntry(entry);
                      const deletable = canDeleteEntry(entry);
                      const editsLeft = 2 - (entry.edit_count || 0);

                      return (
                        <div
                          key={entry.id}
                          id={`entry-${entry.id}`}
                          className={`border rounded-lg p-4 transition-all ${
                            (entry as any).is_nominee ? "border-primary/50 bg-primary/5" : "border-border"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-foreground">
                                  {(entry.freelancer as any)?.full_name || "Expert"}
                                </p>
                                {(entry.freelancer as any)?.username && (
                                  <span className="text-xs text-muted-foreground">
                                    @{(entry.freelancer as any).username}
                                  </span>
                                )}
                                {(entry as any).is_nominee && !entry.is_winner && isOwner && (
                                  <Badge variant="outline" className="text-primary border-primary/50">
                                    <Star className="h-3 w-3 mr-1" /> Nominee
                                  </Badge>
                                )}
                                {entry.is_winner && (
                                  <Badge variant="default" className="bg-accent text-accent-foreground">
                                    <Award className="h-3 w-3 mr-1" />
                                    {entry.prize_position <= 3
                                      ? `${
                                          entry.prize_position === 1
                                            ? "1st"
                                            : entry.prize_position === 2
                                              ? "2nd"
                                              : "3rd"
                                        } Place`
                                      : `${entry.prize_position}th Place`}
                                  </Badge>
                                )}
                                {isMyEntry && entry.edit_count > 0 && (
                                  <span className="text-xs text-muted-foreground">(edited {entry.edit_count}x)</span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{entry.description}</p>
                            </div>
                            <div className="flex items-center gap-2 ml-2 shrink-0">
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(entry.created_at), "MMM d, yyyy")}
                              </p>
                              {isOwner &&
                                !entry.is_winner &&
                                !isCompleted &&
                                ((entry as any).is_nominee ? (
                                  <Button size="sm" variant="outline" onClick={() => handleRemoveNominee(entry.id)}>
                                    Remove
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleNominate(entry.id)}
                                    disabled={nominees.length >= maxNominees}
                                  >
                                    <Star className="h-3 w-3 mr-1" /> Nominate
                                  </Button>
                                ))}
                              {isMyEntry && !entry.is_winner && (
                                <div className="flex gap-1">
                                  {editable && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            setEditingEntry(entry);
                                            setEditDesc(entry.description || "");
                                          }}
                                        >
                                          <Edit3 className="h-3 w-3" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {editsLeft} edit{editsLeft !== 1 ? "s" : ""} remaining
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  {deletable && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-destructive hover:text-destructive"
                                      onClick={() => handleDeleteEntry(entry.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          {entry.attachments?.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              {entry.attachments.map((url: string, i: number) => (
                                <a
                                  key={i}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline flex items-center gap-1"
                                >
                                  <Eye className="h-3 w-3" /> Attachment {i + 1}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ---------------------------------------------------------------- */}
            {/* WINNERS                                                           */}
            {/* ---------------------------------------------------------------- */}
            <TabsContent value="winners">
              <div className="bg-card rounded-xl border border-border p-6">
                {/* Nominees — owner only, before publishing */}
                {isOwner && !isCompleted && nominees.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Star className="h-4 w-4 text-primary" /> Your Nominees ({nominees.length}/{maxNominees}) —
                      Private
                    </h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      These nominees are only visible to you. Publish to make them official winners.
                    </p>
                    <div className="space-y-3">
                      {nominees.map((n: any, idx: number) => (
                        <div
                          key={n.id}
                          className="flex items-center gap-4 p-3 rounded-lg bg-primary/5 border border-primary/20"
                        >
                          <span className="text-xl">{nomineeEmojis[idx] || "🏅"}</span>
                          <div className="flex-1">
                            <p className="font-medium text-foreground">
                              {(n.freelancer as any)?.full_name || "Expert"}
                            </p>
                            <p className="text-sm text-muted-foreground line-clamp-1">{n.description}</p>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => handleRemoveNominee(n.id)}>
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isOwner && !isCompleted && nominees.length === 0 && (
                  <div className="mb-6 p-4 rounded-lg bg-muted/50 border border-border">
                    <p className="text-sm text-muted-foreground">
                      No nominees yet. Go to the <strong>Entries</strong> tab to nominate entries. You can nominate up
                      to <strong>{maxNominees}</strong> entr
                      {maxNominees === 1 ? "y" : "ies"} based on your prize structure.
                    </p>
                  </div>
                )}

                {winners.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>
                      {isCompleted ? "No winners were selected." : "Winners will appear here when the contest ends."}
                    </p>
                  </div>
                ) : winners.length >= 3 ? (
                  <>
                    <div className="hidden md:grid grid-cols-3 gap-6 items-end pt-12 pb-4">
                      <div className="pt-6">
                        <WinnerCard
                          winner={winners[1]}
                          contest={contest}
                          position={2}
                          isOpen={isOpen}
                          onViewEntry={handleViewEntry}
                        />
                      </div>
                      <div className="pt-6">
                        <WinnerCard
                          winner={winners[0]}
                          contest={contest}
                          position={1}
                          isLarge
                          isOpen={isOpen}
                          onViewEntry={handleViewEntry}
                        />
                      </div>
                      <div className="pt-6">
                        <WinnerCard
                          winner={winners[2]}
                          contest={contest}
                          position={3}
                          isOpen={isOpen}
                          onViewEntry={handleViewEntry}
                        />
                      </div>
                    </div>
                    {winners.length > 3 && (
                      <div
                        className={`hidden md:grid gap-6 mt-6 ${
                          winners.length === 4 ? "grid-cols-1 max-w-sm mx-auto" : "grid-cols-2 max-w-lg mx-auto"
                        }`}
                      >
                        {winners.slice(3).map((w: any) => (
                          <WinnerCard
                            key={w.id}
                            winner={w}
                            contest={contest}
                            position={w.prize_position || 4}
                            isOpen={isOpen}
                            onViewEntry={handleViewEntry}
                          />
                        ))}
                      </div>
                    )}
                    <div className="md:hidden space-y-8 pt-12">
                      {winners.map((w: any) => (
                        <WinnerCard
                          key={w.id}
                          winner={w}
                          contest={contest}
                          position={w.prize_position || 1}
                          isLarge={w.prize_position === 1}
                          isOpen={isOpen}
                          onViewEntry={handleViewEntry}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <div
                    className={`grid gap-6 pt-12 ${
                      winners.length === 1 ? "max-w-sm mx-auto" : "grid-cols-1 sm:grid-cols-2"
                    }`}
                  >
                    {winners.map((w: any) => (
                      <WinnerCard
                        key={w.id}
                        winner={w}
                        contest={contest}
                        position={w.prize_position || 1}
                        isLarge={w.prize_position === 1}
                        isOpen={isOpen}
                        onViewEntry={handleViewEntry}
                      />
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />

      {/* Submit Entry Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Contest Entry</DialogTitle>
            <DialogDescription>Describe your submission and attach relevant files.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Textarea
              placeholder="Describe your entry..."
              value={submissionDesc}
              onChange={(e) => setSubmissionDesc(e.target.value)}
              rows={5}
            />
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Attachments (optional)</label>
              <input
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.dwg,.dxf,.zip"
                onChange={(e) => setSubmissionFiles(Array.from(e.target.files || []).slice(0, 5))}
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitEntry} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Entry Dialog */}
      <Dialog open={!!editingEntry} onOpenChange={() => setEditingEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Entry</DialogTitle>
            <DialogDescription>
              You have {2 - (editingEntry?.edit_count || 0)} edit
              {2 - (editingEntry?.edit_count || 0) !== 1 ? "s" : ""} remaining. Edits allowed within 8 hours of
              submission.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Textarea
              placeholder="Describe your entry..."
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={5}
            />
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Replace attachments (optional)</label>
              <input
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.dwg,.dxf,.zip"
                onChange={(e) => setEditFiles(Array.from(e.target.files || []).slice(0, 5))}
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEntry(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditEntry} disabled={editSubmitting}>
              {editSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Edit3 className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish Winners — Justifications */}
      <Dialog open={showPublishConfirm} onOpenChange={setShowPublishConfirm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Publish Winners</DialogTitle>
            <DialogDescription>
              Provide a justification for each winner. This will be shown publicly. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            {nominees.map((n: any, idx: number) => (
              <div key={n.id} className="p-3 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{nomineeEmojis[idx] || "🏅"}</span>
                  <span className="font-medium">{(n.freelancer as any)?.full_name || "Expert"}</span>
                  <span className="ml-auto font-bold text-primary">{formatNaira(contest[prizeKeys[idx]] || 0)}</span>
                </div>
                <Textarea
                  placeholder={`Why did you choose this entry for ${prizeLabels[idx]?.replace(
                    /^[^\s]+\s/,
                    "",
                  )}? (required, max 300 chars)`}
                  value={justifications[String(idx + 1)] || ""}
                  onChange={(e) =>
                    setJustifications((prev) => ({
                      ...prev,
                      [String(idx + 1)]: e.target.value,
                    }))
                  }
                  rows={2}
                  maxLength={300}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground text-right">
                  {(justifications[String(idx + 1)] || "").length}/300
                </p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPublishConfirm(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                for (let i = 1; i <= nominees.length; i++) {
                  if (!justifications[String(i)]?.trim()) {
                    toast.error(`Please provide a justification for position ${i}`);
                    return;
                  }
                }
                setShowPublishConfirm(false);
                setShowAuthCode(true);
              }}
              disabled={publishingWinners}
            >
              <Award className="h-4 w-4 mr-2" /> Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auth Code Verification */}
      <AuthCodeVerifyModal
        open={showAuthCode}
        onOpenChange={setShowAuthCode}
        onVerified={handlePublishWinners}
        title="Verify to Publish Winners"
        description="Enter your 6-digit authentication code to publish winners and release prize money."
      />

      {/* Extend Deadline Dialog */}
      <Dialog open={showExtendDialog} onOpenChange={setShowExtendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend Contest Deadline</DialogTitle>
            <DialogDescription>
              Set a new deadline to reopen the contest for more entries. You can only extend the deadline once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>New Deadline</Label>
              <Input type="datetime-local" value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExtendDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleExtendDeadline} disabled={extendingDeadline}>
              {extendingDeadline ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Calendar className="h-4 w-4 mr-2" />
              )}
              Extend Deadline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
