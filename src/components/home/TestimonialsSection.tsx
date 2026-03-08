import { Star, Quote } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const testimonials = [
  {
    name: "Olumide Akintola",
    role: "Real Estate Developer",
    company: "Akintola Properties",
    location: "Lagos",
    avatar: null,
    rating: 5,
    content: "ZentraGig connected me with an amazing engineer who delivered detailed floor plans for my 12-unit apartment project in just 5 days. The quality was outstanding and saved us weeks of work.",
  },
  {
    name: "Ngozi Okafor",
    role: "Manufacturing Director",
    company: "Precision Parts Ltd",
    location: "Ogun",
    avatar: null,
    rating: 5,
    content: "Finding skilled SolidWorks designers in Nigeria was challenging until I discovered ZentraGig. The freelancer we hired produced production-ready drawings that our factory could use immediately.",
  },
  {
    name: "Ibrahim Yusuf",
    role: "Civil Engineer",
    company: "Yusuf & Partners",
    location: "Kaduna",
    avatar: null,
    rating: 5,
    content: "As a freelancer on ZentraGig, I've been able to work with clients across Nigeria without leaving my home. The platform makes it easy to showcase my portfolio and get paid securely.",
  },
];

export function TestimonialsSection() {
  return (
    <section className="section-padding">
      <div className="container-wide">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            What Our Users Say
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Join thousands of satisfied clients and freelancers across Nigeria
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="relative bg-card rounded-2xl p-8 border border-border shadow-card"
            >
              {/* Quote icon */}
              <Quote className="absolute top-6 right-6 h-8 w-8 text-primary/10" />

              {/* Rating */}
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-accent text-accent" />
                ))}
              </div>

              {/* Content */}
              <p className="text-foreground leading-relaxed mb-6">
                "{testimonial.content}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-3 pt-4 border-t border-border">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={testimonial.avatar || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {testimonial.name.split(" ").map(n => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-foreground">{testimonial.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {testimonial.role} • {testimonial.location}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
