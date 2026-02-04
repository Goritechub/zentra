import { Link } from "react-router-dom";
import { 
  Building2, 
  Cog, 
  Zap, 
  Box, 
  Layers, 
  PenTool, 
  Boxes,
  RotateCcw,
  Landmark
} from "lucide-react";

const categories = [
  {
    name: "Architectural Drafting",
    slug: "architectural-drafting",
    description: "Floor plans, elevations & construction drawings",
    icon: Building2,
    color: "from-blue-500 to-blue-600",
  },
  {
    name: "Mechanical CAD",
    slug: "mechanical-cad",
    description: "Machine parts & mechanical systems",
    icon: Cog,
    color: "from-orange-500 to-orange-600",
  },
  {
    name: "Electrical CAD",
    slug: "electrical-cad",
    description: "Wiring diagrams & panel designs",
    icon: Zap,
    color: "from-yellow-500 to-yellow-600",
  },
  {
    name: "3D Modeling",
    slug: "3d-modeling",
    description: "Product visualization & rendering",
    icon: Box,
    color: "from-purple-500 to-purple-600",
  },
  {
    name: "BIM/Revit",
    slug: "bim-revit",
    description: "Building Information Modeling",
    icon: Layers,
    color: "from-emerald-500 to-emerald-600",
  },
  {
    name: "AutoCAD 2D",
    slug: "autocad-2d",
    description: "Technical 2D drawings",
    icon: PenTool,
    color: "from-red-500 to-red-600",
  },
  {
    name: "SolidWorks",
    slug: "solidworks",
    description: "Design & simulation",
    icon: Boxes,
    color: "from-cyan-500 to-cyan-600",
  },
  {
    name: "Fusion 360",
    slug: "fusion-360",
    description: "Product design & manufacturing",
    icon: RotateCcw,
    color: "from-pink-500 to-pink-600",
  },
  {
    name: "Civil/Structural",
    slug: "civil-structural",
    description: "Civil & structural drawings",
    icon: Landmark,
    color: "from-slate-500 to-slate-600",
  },
];

export function CategoriesSection() {
  return (
    <section className="section-padding bg-subtle-gradient">
      <div className="container-wide">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Browse by Category
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Find specialized CAD professionals for your specific project needs
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {categories.map((category, index) => (
            <Link
              key={category.slug}
              to={`/freelancers?category=${category.slug}`}
              className="group relative overflow-hidden rounded-xl bg-card p-6 card-hover border border-border"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br ${category.color} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <category.icon className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {category.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {category.description}
                  </p>
                </div>
              </div>
              
              {/* Hover arrow */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-2 transition-all duration-300">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
