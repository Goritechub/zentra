export const ALL_ADMIN_PERMISSIONS = [
  { key: "users", label: "Users", description: "Manage user accounts and profiles" },
  { key: "jobs", label: "Jobs", description: "Manage job postings and proposals" },
  { key: "contests", label: "Contests", description: "Manage contests and entries" },
  { key: "contracts", label: "Contracts", description: "Manage contracts and milestones" },
  { key: "payments", label: "Payments", description: "Manage wallets, escrow, transactions, and withdrawals" },
  { key: "disputes", label: "Disputes", description: "Manage disputes and resolutions" },
  { key: "reviews", label: "Reviews", description: "Manage reviews and ratings" },
  { key: "platform_settings", label: "Platform Settings", description: "Configure platform settings" },
  { key: "activity_log", label: "Activity Log", description: "View admin activity logs" },
  { key: "admin_management", label: "Admin Management", description: "Create and manage admin accounts" },
];

export const PERMISSION_PRESETS = [
  {
    name: "Super Admin",
    description: "Full platform control",
    permissions: ALL_ADMIN_PERMISSIONS.map((p) => p.key),
  },
  {
    name: "Moderator",
    description: "Jobs and reviews only",
    permissions: ["jobs", "reviews"],
  },
  {
    name: "Dispute Adjudicator",
    description: "Disputes and contracts",
    permissions: ["disputes", "contracts"],
  },
  {
    name: "Finance Admin",
    description: "Payments and wallets",
    permissions: ["payments"],
  },
];
