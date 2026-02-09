import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, 
  MapPin, 
  Star, 
  CheckCircle2, 
  Filter,
  SlidersHorizontal,
  X,
  MessageSquare
} from "lucide-react";
import { getAllStates, cadSoftwareList, formatNaira } from "@/lib/nigerian-data";

// Sample freelancers data
const sampleFreelancers = [
  {
    id: "1",
    name: "Adewale Okonkwo",
    title: "Senior Architectural Draftsman",
    avatar: null,
    state: "Lagos",
    city: "Victoria Island",
    rating: 4.9,
    reviews: 47,
    hourlyRate: 25000,
    skills: ["AutoCAD", "Revit", "SketchUp", "ArchiCAD"],
    isVerified: true,
    completedJobs: 52,
    bio: "10+ years experience in architectural drafting for residential and commercial projects.",
  },
  {
    id: "2",
    name: "Chioma Eze",
    title: "Mechanical CAD Engineer",
    avatar: null,
    state: "Abuja FCT",
    city: "Wuse",
    rating: 4.8,
    reviews: 34,
    hourlyRate: 30000,
    skills: ["SolidWorks", "AutoCAD", "Inventor", "CATIA"],
    isVerified: true,
    completedJobs: 38,
    bio: "Specialized in mechanical parts design and manufacturing drawings.",
  },
  {
    id: "3",
    name: "Emeka Nwosu",
    title: "BIM Specialist",
    avatar: null,
    state: "Rivers",
    city: "Port Harcourt",
    rating: 5.0,
    reviews: 28,
    hourlyRate: 35000,
    skills: ["Revit", "Navisworks", "BIM 360", "Dynamo"],
    isVerified: true,
    completedJobs: 31,
    bio: "Expert in Building Information Modeling for large-scale construction projects.",
  },
  {
    id: "4",
    name: "Fatima Bello",
    title: "Civil Engineering Designer",
    avatar: null,
    state: "Kano",
    city: "Kano City",
    rating: 4.7,
    reviews: 21,
    hourlyRate: 22000,
    skills: ["Civil 3D", "AutoCAD", "Revit", "MicroStation"],
    isVerified: true,
    completedJobs: 24,
    bio: "Civil engineering drawings, road designs, and drainage systems.",
  },
  {
    id: "5",
    name: "Tunde Afolabi",
    title: "3D Product Designer",
    avatar: null,
    state: "Oyo",
    city: "Ibadan",
    rating: 4.9,
    reviews: 56,
    hourlyRate: 28000,
    skills: ["Fusion 360", "Blender", "KeyShot", "3ds Max"],
    isVerified: true,
    completedJobs: 61,
    bio: "Creating stunning 3D product visualizations and prototypes.",
  },
  {
    id: "6",
    name: "Amina Mohammed",
    title: "Electrical CAD Specialist",
    avatar: null,
    state: "Kaduna",
    city: "Kaduna City",
    rating: 4.6,
    reviews: 19,
    hourlyRate: 20000,
    skills: ["AutoCAD Electrical", "EPLAN", "Revit MEP"],
    isVerified: false,
    completedJobs: 22,
    bio: "Electrical layouts, panel designs, and wiring diagrams.",
  },
  {
    id: "7",
    name: "Obinna Chukwu",
    title: "SolidWorks Expert",
    avatar: null,
    state: "Anambra",
    city: "Onitsha",
    rating: 4.8,
    reviews: 42,
    hourlyRate: 32000,
    skills: ["SolidWorks", "PDM", "Simulation", "Sheet Metal"],
    isVerified: true,
    completedJobs: 45,
    bio: "Mechanical design, simulation, and sheet metal expertise.",
  },
  {
    id: "8",
    name: "Yemi Adeyemi",
    title: "Interior Design Specialist",
    avatar: null,
    state: "Lagos",
    city: "Lekki",
    rating: 4.9,
    reviews: 38,
    hourlyRate: 27000,
    skills: ["SketchUp", "3ds Max", "AutoCAD", "V-Ray"],
    isVerified: true,
    completedJobs: 40,
    bio: "Beautiful interior visualizations and space planning.",
  },
];

export default function FreelancersPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedSkill, setSelectedSkill] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const states = getAllStates();

  // Filter freelancers
  const filteredFreelancers = sampleFreelancers.filter((freelancer) => {
    const matchesSearch =
      searchTerm === "" ||
      freelancer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      freelancer.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      freelancer.skills.some((s) => s.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesState = selectedState === "" || freelancer.state === selectedState;
    const matchesSkill = selectedSkill === "" || freelancer.skills.includes(selectedSkill);
    const matchesVerified = !verifiedOnly || freelancer.isVerified;

    return matchesSearch && matchesState && matchesSkill && matchesVerified;
  });

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedState("");
    setSelectedSkill("");
    setVerifiedOnly(false);
  };

  const hasActiveFilters = searchTerm || selectedState || selectedSkill || verifiedOnly;

  const handleMessageClick = (e: React.MouseEvent, freelancerId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate("/auth");
      return;
    }
    navigate(`/messages?user=${freelancerId}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30">
        {/* Hero */}
        <div className="bg-hero-gradient text-white py-12">
          <div className="container-wide">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              Find CAD Experts in Nigeria
            </h1>
            <p className="text-white/80 text-lg max-w-2xl">
              Browse verified CAD professionals across all Nigerian states. Filter by skill, location, and budget.
            </p>
          </div>
        </div>

        <div className="container-wide py-8">
          {/* Search and Filters */}
          <div className="bg-card rounded-xl border border-border p-4 mb-8 shadow-card">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search by name, skill, or title..."
                  className="pl-10 h-12"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <Select value={selectedState} onValueChange={(val) => setSelectedState(val === "all" ? "" : val)}>
                  <SelectTrigger className="w-[180px] h-12">
                    <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="All States" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    {states.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedSkill} onValueChange={(val) => setSelectedSkill(val === "all" ? "" : val)}>
                  <SelectTrigger className="w-[180px] h-12">
                    <SlidersHorizontal className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="All Skills" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Skills</SelectItem>
                    {cadSoftwareList.map((skill) => (
                      <SelectItem key={skill} value={skill}>
                        {skill}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant={verifiedOnly ? "default" : "outline"}
                  onClick={() => setVerifiedOnly(!verifiedOnly)}
                  className="h-12"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Verified Only
                </Button>

                {hasActiveFilters && (
                  <Button variant="ghost" onClick={clearFilters} className="h-12">
                    <X className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Results Count */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{filteredFreelancers.length}</span> experts
            </p>
          </div>

          {/* Freelancer Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredFreelancers.map((freelancer) => (
              <Link
                key={freelancer.id}
                to={`/freelancer/${freelancer.id}`}
                className="group bg-card rounded-xl border border-border p-6 card-hover"
              >
                {/* Avatar & Verified Badge */}
                <div className="flex items-start justify-between mb-4">
                  <Avatar className="h-16 w-16 border-2 border-background shadow-lg">
                    <AvatarImage src={freelancer.avatar || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                      {freelancer.name.split(" ").map((n) => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  {freelancer.isVerified && (
                    <div className="verified-badge">
                      <CheckCircle2 className="h-3 w-3" />
                      Verified
                    </div>
                  )}
                </div>

                {/* Name & Title */}
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {freelancer.name}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">{freelancer.title}</p>

                {/* Location */}
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                  <MapPin className="h-3.5 w-3.5" />
                  {freelancer.city}, {freelancer.state}
                </div>

                {/* Rating */}
                <div className="flex items-center gap-2 mt-3">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-accent text-accent" />
                    <span className="font-semibold text-foreground">{freelancer.rating}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    ({freelancer.reviews} reviews)
                  </span>
                </div>

                {/* Skills */}
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {freelancer.skills.slice(0, 3).map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-xs font-medium">
                      {skill}
                    </Badge>
                  ))}
                  {freelancer.skills.length > 3 && (
                    <Badge variant="secondary" className="text-xs font-medium">
                      +{freelancer.skills.length - 3}
                    </Badge>
                  )}
                </div>

                {/* Price */}
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Starting at</p>
                      <p className="text-lg font-bold text-primary">
                        {formatNaira(freelancer.hourlyRate)}
                        <span className="text-sm font-normal text-muted-foreground">/hr</span>
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => handleMessageClick(e, freelancer.id)}
                      className="flex-shrink-0"
                    >
                      <MessageSquare className="h-4 w-4 mr-1" />
                      Message
                    </Button>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Empty State */}
          {filteredFreelancers.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No freelancers found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search or filters to find more results.
              </p>
              <Button onClick={clearFilters}>Clear Filters</Button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
