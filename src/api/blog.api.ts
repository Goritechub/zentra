import { api } from "./axios";
import type { BlogBlock } from "@/types/blog";

export interface BlogAuthor {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
}

export type BlogPostStatus =
  | "draft"
  | "submitted"
  | "changes_requested"
  | "scheduled"
  | "published"
  | "archived";

export interface BlogPost {
  id: string;
  title: string;
  content: string;
  blocks: BlogBlock[] | null;
  blocks_schema_version: number;
  category: string | null;
  cover_image: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  likes_count: number;
  status: BlogPostStatus;
  published_at: string | null;
  scheduled_for: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_message: string | null;
  author: BlogAuthor;
  liked_by_user: boolean;
}

export async function getBlogTagFacets() {
  const response = await api.get<{ success: boolean; data: { tags: { tag: string; count: number }[] } }>(
    "/blog/tags",
  );
  return response.data.data;
}

export async function getBlogPosts(page = 1, search?: string, tag?: string, category?: string, author?: string) {
  const response = await api.get<{ success: boolean; data: { posts: BlogPost[]; total: number } }>(
    "/blog/posts",
    {
      params: {
        page,
        search: search || undefined,
        tag: tag || undefined,
        category: category || undefined,
        author: author || undefined,
      },
    },
  );
  return response.data.data;
}

export async function createBlogPost(payload: {
  title?: string;
  content?: string;
  blocks?: BlogBlock[];
  coverImage?: string;
  tags?: string[];
  category?: string;
}) {
  const response = await api.post<{ success: boolean; data: { id: string } }>("/blog/posts", payload);
  return response.data.data;
}

export async function submitBlogPostForReview(
  postId: string,
  payload?: Partial<{
    title: string;
    content: string;
    blocks: BlogBlock[];
    coverImage: string;
    tags: string[];
    category: string;
  }>,
) {
  const response = await api.patch<{ success: boolean }>(`/blog/posts/${postId}/submit`, payload);
  return response.data;
}

export async function uploadBlogImages(files: File[]) {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  const response = await api.post<{ success: boolean; data: { urls: string[] } }>(
    "/blog/posts/upload-images",
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return response.data.data;
}

export async function fetchBlogLinkPreview(url: string) {
  const response = await api.post<{
    success: boolean;
    data: { url: string; title?: string; description?: string; image?: string };
  }>("/blog/link-preview", { url });
  return response.data.data;
}

export async function fetchBlogVideoEmbed(url: string) {
  const response = await api.post<{
    success: boolean;
    data: { provider: "youtube" | "vimeo"; videoId: string; embedUrl: string; title?: string };
  }>("/blog/video-embed", { url });
  return response.data.data;
}

export async function likeBlogPost(postId: string) {
  const response = await api.post<{ success: boolean }>(`/blog/posts/${postId}/like`);
  return response.data;
}

export async function unlikeBlogPost(postId: string) {
  const response = await api.delete<{ success: boolean }>(`/blog/posts/${postId}/like`);
  return response.data;
}

export async function getBlogPostById(id: string) {
  const response = await api.get<{ success: boolean; data: { post: BlogPost } }>(`/blog/posts/${id}`);
  return response.data.data.post;
}

export async function getPendingBlogPosts() {
  const response = await api.get<{ success: boolean; data: { posts: BlogPost[] } }>("/blog/posts/pending");
  return response.data.data;
}

export async function getModerationBlogPosts() {
  const response = await api.get<{ success: boolean; data: { posts: BlogPost[] } }>("/blog/posts/moderation");
  return response.data.data;
}

export async function publishBlogPost(postId: string) {
  const response = await api.patch<{ success: boolean }>(`/blog/posts/${postId}/publish`);
  return response.data;
}

export async function requestBlogPostChanges(postId: string, message: string) {
  const response = await api.patch<{ success: boolean }>(`/blog/posts/${postId}/request-changes`, { message });
  return response.data;
}

export async function archiveBlogPost(postId: string) {
  const response = await api.patch<{ success: boolean }>(`/blog/posts/${postId}/archive`);
  return response.data;
}

export async function updateBlogPost(
  postId: string,
  payload: Partial<{
    title: string;
    content: string;
    blocks: BlogBlock[];
    coverImage: string;
    tags: string[];
    category: string;
  }>,
) {
  const response = await api.patch<{ success: boolean }>(`/blog/posts/${postId}`, payload);
  return response.data;
}
