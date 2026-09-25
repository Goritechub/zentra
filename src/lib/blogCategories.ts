export interface BlogCategory {
  name: string;
  slug: string;
}

export const blogCategories: BlogCategory[] = [
  { name: "Career Advice", slug: "career-advice" },
  { name: "Industry News", slug: "industry-news" },
  { name: "Tutorials", slug: "tutorials" },
  { name: "Case Studies", slug: "case-studies" },
  { name: "Company Updates", slug: "company-updates" },
  { name: "Freelancing Tips", slug: "freelancing-tips" },
  { name: "Community Spotlight", slug: "community-spotlight" },
];

export const blogCategorySlugs = blogCategories.map((c) => c.slug);

export function getBlogCategoryBySlug(slug: string | null | undefined) {
  return blogCategories.find((c) => c.slug === slug);
}
