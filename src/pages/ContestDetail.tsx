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
import { isPast, format, formatDistanceToNow } from "date-fns";
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
  AtSign,
} from "lucide-react";

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
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submissionDesc, setSubmissionDesc] = useState("");
  const [submissionFiles, setSubmissionFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [showAuthCode, setShowAuthCode] = useState(false);
  const [publishingWinners, setPublishingWinners] = useState(false);
  const [showExtendDialog, setShowExtendDialog] = useState(false);
  const [newDeadline, setNewDeadline] = useState("");
  const [extendingDeadline, setExtendingDeadline] = useState(false);

  // Comments state
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

  const isClient = profile?.role === "client";
  const isExpert = profile?.role === "freelancer";

  useEffect(() => {
    if (id) {
      fetchContest();
      fetchComments();
    }
  }, [id]);

  // Scroll to comments if navigated with hash
  useEffect(() => {
    if (location.hash === "#comments" && commentsRef.current) {
      setTimeout(() => commentsRef.current?.scrollIntoView({ behavior: "smooth" }), 500);
    }
  }, [location.hash, comments]);

  const fetchContest = async () => {
    const { data } = (await supabase
      .from("contests" as any)
      .select("*, client:profiles!contests_client_id_fkey(full_name, avatar_url, username)")
      .eq("id", id)
      .single()) as { data: any };
    setContest(data);

    const { data: entriesData } = await supabase
      .from("contest_entries")
      .select("*, freelancer:profiles!contest_entries_freelancer_id_fkey(full_name, avatar_url, username)")
      .eq("contest_id", id!)
      .order("created_at", { ascending: false });

    const allEntries = (entriesData as any[]) || [];
    setWinners(
      allEntries.filter((e) => e.is_winner).sort((a, b) => (a.prize_position || 99) - (b.prize_position || 99)),
    );
    setNominees(allEntries.filter((e) => (e as any).is_nominee && !e.is_winner));
    setEntries(allEntries.filter((e) => !e.is_winner && !(e as any).is_nominee));

    // Build participants list for @mentions
    const participants: any[] = [];
    if (data) {
      participants.push({
        id: data.client_id,
        full_name: (data.client as any)?.full_name,
        username: (data.client as any)?.username,
      });
    }
    allEntries.forEach((e) => {
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

  const fetchComments = useCallback(async () => {
    console.log("FETCHCOMMENTS RUNNING ✅", id);

    const { data, error } = await supabase
      .from("contest_comments")
      .select("*")
      .eq("contest_id", id)
      .order("created_at", { ascending: true });

    console.log("comments raw", data, error);

    if (error) {
      toast.error("Failed to load comments");
      return;
    }

    setComments((data as any[]) || []);
  }, [id]);

  const deadlinePassed = contest ? isPast(new Date(contest.deadline)) : false;
  const isSelectingWinners = contest?.status === "selecting_winners";
  const isCompleted = contest?.status === "ended" || contest?.status === "completed";
  const ended = isCompleted;
  const acceptingEntries = !deadlinePassed && !isSelectingWinners && !isCompleted && contest?.status === "active";
  const isOpen = contest?.visibility === "open";
  const isOwner = contest?.client_id === user?.id;
  const totalPrize = contest
    ? (contest.prize_first || 0) + (contest.prize_second || 0) + (contest.prize_third || 0)
    : 0;
  const allEntries = [...entries, ...nominees, ...winners];
  const hasAlreadyEntered = allEntries.some((e) => e.freelancer_id === user?.id);

  // Calculate max nominees based on prize structure
  const getMaxNominees = () => {
    if (!contest) return 1;
    let count = 1;
    if (contest.prize_second > 0) count = 2;
    if (contest.prize_third > 0) count = 3;
    return count;
  };

  const getStatusLabel = () => {
    if (isCompleted) return "Completed";
    if (isSelectingWinners) return "Selecting Winners";
    if (deadlinePassed && contest?.status === "active") return "Selecting Winners";
    return "Active";
  };

  const getStatusVariant = (): "default" | "secondary" | "outline" => {
    if (isCompleted) return "secondary";
    if (isSelectingWinners || deadlinePassed) return "outline";
    return "default";
  };

  // Auto-update status to selecting_winners when deadline passes
  useEffect(() => {
    if (contest && deadlinePassed && contest.status === "active" && isOwner) {
      supabase
        .from("contests" as any)
        .update({ status: "selecting_winners" })
        .eq("id", id)
        .then(() => {
          setContest((prev: any) => ({ ...prev, status: "selecting_winners" }));
        });
    }
  }, [contest, deadlinePassed]);

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

  const handleNominate = async (entryId: string) => {
    const maxNominees = getMaxNominees();
    if (nominees.length >= maxNominees) {
      toast.error(
        `You can only nominate up to ${maxNominees} entr${maxNominees === 1 ? "y" : "ies"} based on your prize structure.`,
      );
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
    if (nominees.length === 0) {
      toast.error("No nominees selected");
      return;
    }
    setPublishingWinners(true);

    const sortedNominees = [...nominees].slice(0, 3);
    for (let i = 0; i < sortedNominees.length; i++) {
      await supabase
        .from("contest_entries")
        .update({ is_winner: true, prize_position: i + 1, is_nominee: false } as any)
        .eq("id", sortedNominees[i].id);
    }

    await supabase
      .from("contests" as any)
      .update({ status: "ended" })
      .eq("id", id);

    // Notify winners
    for (let i = 0; i < sortedNominees.length; i++) {
      const prize = i === 0 ? contest.prize_first : i === 1 ? contest.prize_second : contest.prize_third;
      await createNotification({
        userId: sortedNominees[i].freelancer_id,
        type: "contest_winner",
        title: `🏆 You won ${i === 0 ? "1st" : i === 1 ? "2nd" : "3rd"} place!`,
        message: `Congratulations! You won ${formatNaira(prize)} in "${contest.title}"`,
      });
    }

    toast.success("Winners published! Escrow payouts triggered.");
    setShowPublishConfirm(false);
    fetchContest();
    setPublishingWinners(false);
  };

  const handleExtendDeadline = async () => {
    if (!newDeadline) {
      toast.error("Please select a new deadline");
      return;
    }
    setExtendingDeadline(true);
    await supabase
      .from("contests" as any)
      .update({ deadline: newDeadline, status: "active" })
      .eq("id", id);
    toast.success("Deadline extended! Contest is active again.");
    setShowExtendDialog(false);
    setNewDeadline("");
    fetchContest();
    setExtendingDeadline(false);
  };

  // @Mention handling
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

  // Extract mentions from text
  const extractMentions = (text: string): string[] => {
    const matches = text.match(/@(\w+)/g);
    if (!matches) return [];
    return matches.map((m) => m.slice(1));
  };

  // Comments
  const handlePostComment = async (parentId?: string) => {
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

    // Handle @mentions
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
    fetchComments();
  };

  const getCommentLikeCount = (commentId: string) => commentLikes.filter((l: any) => l.comment_id === commentId).length;
  const hasUserLiked = (commentId: string) =>
    user ? commentLikes.some((l: any) => l.comment_id === commentId && l.user_id === user.id) : false;
  const isLikedByClient = (commentId: string) =>
    contest ? commentLikes.some((l: any) => l.comment_id === commentId && l.user_id === contest.client_id) : false;

  const topLevelComments = comments.filter((c: any) => !c.parent_id);
  const getReplies = (parentId: string) => comments.filter((c: any) => c.parent_id === parentId);

  // Render @mentions in text
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

  const maxNominees = getMaxNominees();

  const CommentItem = ({ comment, depth = 0 }: { comment: any; depth?: number }) => {
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
              onClick={() => handleLikeComment(comment.id)}
              className={`flex items-center gap-1 text-xs ${liked ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}
            >
              <ThumbsUp className="h-3 w-3" /> {likeCount > 0 && likeCount}
            </button>
            {user && (
              <button
                onClick={() => {
                  setReplyTo(replyTo === comment.id ? null : comment.id);
                  setReplyText("");
                }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Reply className="h-3 w-3" /> Reply
              </button>
            )}
          </div>
        </div>
        {replyTo === comment.id && (
          <div className="ml-6 mt-2 relative">
            <div className="flex gap-2">
              <Input
                placeholder="Write a reply... (use @ to mention)"
                value={replyText}
                onChange={(e) => {
                  setReplyText(e.target.value);
                  handleMentionSearch(e.target.value, "reply");
                }}
                className="flex-1 h-8 text-sm"
                onKeyDown={(e) => e.key === "Enter" && !showMentions && handlePostComment(comment.id)}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handlePostComment(comment.id)}
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
                    onClick={() => insertMention(p)}
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
              <CommentItem key={r.id} comment={r} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

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
            <Badge variant={getStatusVariant()} className="absolute top-4 right-4 text-sm">
              {getStatusLabel()}
            </Badge>
          </div>

          {/* Selecting Winners message */}
          {(isSelectingWinners || (deadlinePassed && !isCompleted)) && (
            <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-5 w-5 text-accent" />
                <p className="font-semibold text-foreground">
                  Contest has ended. {isOwner ? "Select your winners." : "The client is currently selecting winners."}
                </p>
              </div>
              {isOwner && (
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" onClick={() => setShowExtendDialog(true)}>
                    <Calendar className="h-4 w-4 mr-1" /> Extend Deadline
                  </Button>
                  <Button size="sm" onClick={() => navigate(`#winners`)}>
                    <Award className="h-4 w-4 mr-1" /> Proceed to Select Winners
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Header */}
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
            {isOwner && (isSelectingWinners || (deadlinePassed && !isCompleted)) && nominees.length > 0 && (
              <Button onClick={() => setShowPublishConfirm(true)}>
                <Award className="h-4 w-4 mr-2" /> Publish Winners ({nominees.length})
              </Button>
            )}
          </div>

          {/* Tabs */}
          <Tabs defaultValue="description">
            <TabsList className="mb-6">
              <TabsTrigger value="description">
                <FileText className="h-4 w-4 mr-1.5" /> Description
              </TabsTrigger>
              <TabsTrigger value="entries">
                <Users className="h-4 w-4 mr-1.5" /> Entries ({allEntries.length})
              </TabsTrigger>
              <TabsTrigger value="winners">
                <Award className="h-4 w-4 mr-1.5" /> Winners
              </TabsTrigger>
            </TabsList>

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
                    <div className="flex justify-between p-3 rounded-lg bg-accent/10">
                      <span>🥇 1st Place</span>
                      <span className="font-bold text-primary">{formatNaira(contest.prize_first)}</span>
                    </div>
                    {contest.prize_second > 0 && (
                      <div className="flex justify-between p-3 rounded-lg bg-muted/50">
                        <span>🥈 2nd Place</span>
                        <span className="font-semibold">{formatNaira(contest.prize_second)}</span>
                      </div>
                    )}
                    {contest.prize_third > 0 && (
                      <div className="flex justify-between p-3 rounded-lg bg-muted/50">
                        <span>🥉 3rd Place</span>
                        <span className="font-semibold">{formatNaira(contest.prize_third)}</span>
                      </div>
                    )}
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

                {/* Comments Section */}
                <div className="border-t border-border pt-6" ref={commentsRef} id="comments">
                  <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" /> Comments ({comments.length})
                  </h3>

                  {user && (
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
                  )}

                  {topLevelComments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No comments yet. Be the first to comment!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {topLevelComments.map((c: any) => (
                        <CommentItem key={c.id} comment={c} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="entries">
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-foreground">Entries ({allEntries.length})</h2>
                  {isOwner && !isCompleted && (
                    <p className="text-xs text-muted-foreground">
                      Nominees: {nominees.length}/{maxNominees}
                    </p>
                  )}
                </div>

                {allEntries.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No entries yet</p>
                  </div>
                ) : !isOpen && !isOwner ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Lock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">{allEntries.length} entries submitted</p>
                    <p className="text-sm mt-1">This is a closed contest. Entry details are hidden.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {allEntries.map((entry: any) => (
                      <div
                        key={entry.id}
                        className={`border rounded-lg p-4 ${(entry as any).is_nominee ? "border-primary/50 bg-primary/5" : "border-border"}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
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
                                  {entry.prize_position === 1 ? "1st" : entry.prize_position === 2 ? "2nd" : "3rd"}{" "}
                                  Place
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{entry.description}</p>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
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
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="winners">
              <div className="bg-card rounded-xl border border-border p-6">
                {/* Nominees section - only visible to owner before publishing */}
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
                          <span className="text-xl">{idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}</span>
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
                      to <strong>{maxNominees}</strong> entr{maxNominees === 1 ? "y" : "ies"} based on your prize
                      structure.
                    </p>
                  </div>
                )}

                {/* Published Winners */}
                {winners.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>
                      {isCompleted ? "No winners were selected." : "Winners will appear here when the contest ends."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {winners.map((w: any) => (
                      <div
                        key={w.id}
                        className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border border-border"
                      >
                        <div className="text-3xl">
                          {w.prize_position === 1 ? "🥇" : w.prize_position === 2 ? "🥈" : "🥉"}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">
                            {(w.freelancer as any)?.full_name || "Expert"}
                          </p>
                          {(w.freelancer as any)?.username && (
                            <p className="text-xs text-muted-foreground">@{(w.freelancer as any).username}</p>
                          )}
                          <p className="text-sm text-muted-foreground line-clamp-1">{w.description}</p>
                        </div>
                        <p className="font-bold text-primary">
                          {formatNaira(
                            w.prize_position === 1
                              ? contest.prize_first
                              : w.prize_position === 2
                                ? contest.prize_second
                                : contest.prize_third,
                          )}
                        </p>
                      </div>
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

      {/* Publish Winners — First Confirmation */}
      <Dialog open={showPublishConfirm} onOpenChange={setShowPublishConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish Winners</DialogTitle>
            <DialogDescription>
              Are you sure you want to publish winners and release prize money? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {nominees.map((n: any, idx: number) => (
              <div key={n.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <span className="text-lg">{idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}</span>
                <span className="font-medium">{(n.freelancer as any)?.full_name || "Expert"}</span>
                <span className="ml-auto font-bold text-primary">
                  {formatNaira(
                    idx === 0 ? contest.prize_first : idx === 1 ? contest.prize_second : contest.prize_third,
                  )}
                </span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPublishConfirm(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
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

      {/* Publish Winners — Auth Code Verification */}
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
            <DialogDescription>Set a new deadline to reopen the contest for more entries.</DialogDescription>
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
