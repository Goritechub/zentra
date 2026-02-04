import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin, CheckCircle2, ArrowRight } from "lucide-react";
import { formatNaira } from "@/lib/nigerian-data";

// Sample featured freelancers data
const featuredFreelancers = [
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
    skills: ["AutoCAD", "Revit", "SketchUp"],
    isVerified: true,
    completedJobs: 52,
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
    skills: ["SolidWorks", "AutoCAD", "Inventor"],
    isVerified: true,
    completedJobs: 38,
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
    skills: ["Revit", "Navisworks", "BIM 360"],
    isVerified: true,
    completedJobs: 31,
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
    skills: ["Civil 3D", "AutoCAD", "Revit"],
    isVerified: true,
    completedJobs: 24,
  },
];

export function FeaturedFreelancers() {
  return (
    <section className="section-padding bg-muted/30">
      <div className="container-wide">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              Featured CAD Experts
            </h2>
            <p className="text-muted-foreground text-lg">
              Top-rated professionals ready to work on your project
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/freelancers">
              View All Experts
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredFreelancers.map((freelancer) => (
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
                    {freelancer.name.split(" ").map(n => n[0]).join("")}
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
              <p className="text-sm text-muted-foreground mt-1">
                {freelancer.title}
              </p>

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
              </div>

              {/* Price */}
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">Starting at</p>
                <p className="text-lg font-bold text-primary">
                  {formatNaira(freelancer.hourlyRate)}<span className="text-sm font-normal text-muted-foreground">/hr</span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
