import {
  Building2,
  Cog,
  Zap,
  Box,
  Layers,
  PenTool,
  Boxes,
  RotateCcw,
  Landmark,
  Cpu,
  Bot,
  Factory,
  Printer,
  Wrench,
  CircuitBoard,
  Atom,
  type LucideIcon,
} from "lucide-react";

export interface ServiceCategory {
  name: string;
  slug: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

/**
 * Single source of truth for all service/job/contest categories.
 * Every dropdown, filter, and homepage section should import from here.
 */
export const serviceCategories: ServiceCategory[] = [
  {
    name: "Architectural Drafting",
    slug: "architectural-drafting",
    description: "Floor plans, elevations & construction drawings",
    icon: Building2,
    color: "from-blue-500 to-blue-600",
  },
  {
    name: "Mechanical Engineering",
    slug: "mechanical-engineering",
    description: "Machine design, thermodynamics & mechanical systems",
    icon: Cog,
    color: "from-orange-500 to-orange-600",
  },
  {
    name: "Electrical Engineering",
    slug: "electrical-engineering",
    description: "Power systems, wiring diagrams & panel designs",
    icon: Zap,
    color: "from-yellow-500 to-yellow-600",
  },
  {
    name: "CAD & 3D Modeling",
    slug: "cad-3d-modeling",
    description: "Technical drawings, product visualization & rendering",
    icon: Box,
    color: "from-purple-500 to-purple-600",
  },
  {
    name: "BIM/Revit",
    slug: "bim-revit",
    description: "Building Information Modeling & Revit projects",
    icon: Layers,
    color: "from-emerald-500 to-emerald-600",
  },
  {
    name: "Civil & Structural",
    slug: "civil-structural",
    description: "Civil engineering & structural analysis drawings",
    icon: Landmark,
    color: "from-slate-500 to-slate-600",
  },
  {
    name: "Embedded Systems",
    slug: "embedded-systems",
    description: "Microcontrollers, firmware & hardware integration",
    icon: CircuitBoard,
    color: "from-teal-500 to-teal-600",
  },
  {
    name: "Robotics",
    slug: "robotics",
    description: "Robot design, automation & control systems",
    icon: Bot,
    color: "from-indigo-500 to-indigo-600",
  },
  {
    name: "Manufacturing",
    slug: "manufacturing",
    description: "Production design, tooling & process engineering",
    icon: Factory,
    color: "from-amber-500 to-amber-600",
  },
  {
    name: "3D Printing",
    slug: "3d-printing",
    description: "Additive manufacturing & rapid prototyping",
    icon: Printer,
    color: "from-pink-500 to-pink-600",
  },
  {
    name: "Product Design",
    slug: "product-design",
    description: "Industrial & consumer product development",
    icon: Wrench,
    color: "from-red-500 to-red-600",
  },
  {
    name: "Other STEM Work",
    slug: "other-stem",
    description: "Other engineering, science & technical projects",
    icon: Atom,
    color: "from-cyan-500 to-cyan-600",
  },
];

/** Flat list of category names for dropdowns */
export const categoryNames = serviceCategories.map((c) => c.name);

/** Get category by slug */
export const getCategoryBySlug = (slug: string) =>
  serviceCategories.find((c) => c.slug === slug);

/** Get category by name */
export const getCategoryByName = (name: string) =>
  serviceCategories.find((c) => c.name === name);
