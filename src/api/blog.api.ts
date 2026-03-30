import { api } from "./axios";

export interface BlogAuthor {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
}

export interface BlogPost {
  id: string;
  title: string;
  content: string;
  cover_image: string | null;
  tags: string[] | null;
  created_at: string;
  likes_count: number;
  is_published: boolean;
  author: BlogAuthor;
  liked_by_user: boolean;
}

export async function getBlogPosts(page = 1, search?: string, tag?: string) {
  const response = await api.get<{ success: boolean; data: { posts: BlogPost[]; total: number } }>(
    "/blog/posts",
    { params: { page, search: search || undefined, tag: tag || undefined } },
  );
  return response.data.data;
}

export async function createBlogPost(payload: {
  title: string;
  content: string;
  coverImage?: string;
  tags?: string[];
}) {
  const response = await api.post<{ success: boolean }>("/blog/posts", payload);
  return response.data;
}

export async function likeBlogPost(postId: string) {
  const response = await api.post<{ success: boolean }>(`/blog/posts/${postId}/like`);
  return response.data;
}

export async function unlikeBlogPost(postId: string) {
  const response = await api.delete<{ success: boolean }>(`/blog/posts/${postId}/like`);
  return response.data;
}
