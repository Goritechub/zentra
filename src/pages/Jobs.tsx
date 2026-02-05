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
  Clock, 
  Briefcase,
  Calendar,
  X,
  Building2,
  ArrowRight,
  MessageSquare
} from "lucide-react";
import { getAllStates, formatNaira } from "@/lib/nigerian-data";
import { formatDistanceToNow } from "date-fns";

// Sample jobs data
const sampleJobs = [
  {
    id: "1",
    title: "Architectural Drawings for 5-Bedroom Duplex",
    description: "Need complete architectural drawings including floor plans, elevations, sections, and electrical/plumbing layouts for a 5-bedroom duplex in Lagos.",
    clientName: "Akintola Properties",
    clientAvatar: null,
    budgetMin: 250000,
    budgetMax: 400000,
    state: "Lagos",
    city: "Lekki",
    isRemote: true,
    requiredSkills: ["AutoCAD", "Revit", "Architectural Design"],
    deliveryDays: 14,
    proposalCount: 8,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    status: "open",
  },
  {
    id: "2",
    title: "Mechanical Parts Design for Manufacturing",
    description: "Looking for a SolidWorks expert to design custom machine parts for our manufacturing line. Must include detailed assembly drawings and BOM.",
    clientName: "Precision Parts Ltd",
    clientAvatar: null,
    budgetMin: 150000,
    budgetMax: 250000,
    state: "Ogun",
    city: "Ota",
    isRemote: true,
    requiredSkills: ["SolidWorks", "Mechanical Design", "Sheet Metal"],
    deliveryDays: 10,
    proposalCount: 5,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    status: "open",
  },
  {
    id: "3",
    title: "BIM Model for Office Complex",
    description: "Complete BIM modeling for a 10-story office complex. Must be experienced with Revit and Navisworks for coordination.",
    clientName: "Sterling Developers",
    clientAvatar: null,
    budgetMin: 800000,
    budgetMax: 1200000,
    state: "Abuja FCT",
    city: "Central Area",
    isRemote: false,
    requiredSkills: ["Revit", "Navisworks", "BIM 360"],
    deliveryDays: 30,
    proposalCount: 12,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    status: "open",
  },
  {
    id: "4",
    title: "Electrical Layout for Factory",
    description: "Need detailed electrical CAD drawings for a new factory including panel layouts, cable routing, and lighting plans.",
    clientName: "Industrial Solutions",
    clientAvatar: null,
    budgetMin: 180000,
    budgetMax: 300000,
    state: "Rivers",
    city: "Port Harcourt",
    isRemote: true,
    requiredSkills: ["AutoCAD Electrical", "Revit MEP"],
    deliveryDays: 7,
    proposalCount: 4,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    status: "open",
  },
  {
    id: "5",
    title: "3D Product Visualization for E-commerce",
    description: "Need high-quality 3D renders of our product line (15 items) for our e-commerce website. Photorealistic quality required.",
    clientName: "HomeStyle NG",
    clientAvatar: null,
    budgetMin: 100000,
    budgetMax: 180000,
    state: "Lagos",
    city: "Victoria Island",
    isRemote: true,
    requiredSkills: ["Blender", "3ds Max", "Product Visualization"],
    deliveryDays: 14,
    proposalCount: 9,
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    status: "open",
  },
  {
    id: "6",
    title: "Civil Engineering Drawings for Road Project",
    description: "Detailed civil engineering drawings for a 2km road construction project including cross-sections, drainage, and pavement design.",
    clientName: "Highway Constructors",
    clientAvatar: null,
    budgetMin: 500000,
    budgetMax: 800000,
    state: "Kaduna",
    city: "Kaduna City",
    isRemote: true,
    requiredSkills: ["Civil 3D", "AutoCAD", "Road Design"],
    deliveryDays: 21,
    proposalCount: 6,
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    status: "open",
  },
];

export default function JobsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedState, setSelectedState] = useState<string>("");
  const [remoteOnly, setRemoteOnly] = useState(false);

  const states = getAllStates();

  // Filter jobs
  const filteredJobs = sampleJobs.filter((job) => {
    const matchesSearch =
      searchTerm === "" ||
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.requiredSkills.some((s) => s.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesState = selectedState === "" || job.state === selectedState;
    const matchesRemote = !remoteOnly || job.isRemote;

    return matchesSearch && matchesState && matchesRemote;
  });

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedState("");
    setRemoteOnly(false);
  };

  const hasActiveFilters = searchTerm || selectedState || remoteOnly;

  const handleMessageClient = (e: React.MouseEvent, jobId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate("/auth");
      return;
    }
    // In a real app, we'd get the client_id from the job
    // For now, we'll navigate to messages with the job context
    navigate(`/messages?job=${jobId}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30">
        {/* Hero */}
        <div className="bg-hero-gradient text-white py-12">
          <div className="container-wide">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              Browse CAD Jobs in Nigeria
            </h1>
            <p className="text-white/80 text-lg max-w-2xl">
              Find CAD projects that match your skills. Apply to jobs from clients across Nigeria.
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
                  placeholder="Search jobs by title, skill, or keyword..."
                  className="pl-10 h-12"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <Select value={selectedState} onValueChange={setSelectedState}>
                  <SelectTrigger className="w-[180px] h-12">
                    <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="All States" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All States</SelectItem>
                    {states.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant={remoteOnly ? "default" : "outline"}
                  onClick={() => setRemoteOnly(!remoteOnly)}
                  className="h-12"
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  Remote Only
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
              Showing <span className="font-semibold text-foreground">{filteredJobs.length}</span> jobs
            </p>
          </div>

          {/* Jobs List */}
          <div className="space-y-4">
            {filteredJobs.map((job) => (
              <Link
                key={job.id}
                to={`/job/${job.id}`}
                className="block bg-card rounded-xl border border-border p-6 card-hover"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* Title & Client */}
                    <div className="flex items-start gap-4 mb-3">
                      <Avatar className="h-12 w-12 hidden sm:flex">
                        <AvatarImage src={job.clientAvatar || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {job.clientName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold text-lg text-foreground hover:text-primary transition-colors">
                          {job.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">{job.clientName}</p>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-muted-foreground line-clamp-2 mb-4">
                      {job.description}
                    </p>

                    {/* Skills */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {job.requiredSkills.map((skill) => (
                        <Badge key={skill} variant="secondary" className="font-medium">
                          {skill}
                        </Badge>
                      ))}
                    </div>

                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {job.isRemote ? "Remote" : `${job.city}, ${job.state}`}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {job.deliveryDays} days delivery
                      </div>
                      <div className="flex items-center gap-1">
                        <Briefcase className="h-4 w-4" />
                        {job.proposalCount} proposals
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Posted {formatDistanceToNow(job.createdAt, { addSuffix: true })}
                      </div>
                    </div>
                  </div>

                  {/* Budget */}
                  <div className="md:text-right">
                    <p className="text-sm text-muted-foreground mb-1">Budget</p>
                    <p className="text-xl font-bold text-primary">
                      {formatNaira(job.budgetMin)} - {formatNaira(job.budgetMax)}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={(e) => handleMessageClient(e, job.id)}
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Message
                      </Button>
                      <Button variant="default" size="sm">
                        Apply
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Empty State */}
          {filteredJobs.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Briefcase className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No jobs found</h3>
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
