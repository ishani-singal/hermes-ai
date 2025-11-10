'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sparkles, CheckCircle, Rocket, Users } from 'lucide-react'

const WhatsNewContent = () => {
  const updates = [
    {
      date: "December 2024",
      category: "Product",
      icon: <Rocket className="w-6 h-6" />,
      title: "Pilot Program Launch",
      description: "We're launching pilot programs with Amy's Kitchen and Scout Motors, bringing Hermes AI to real production floors. Testing our Pro tier in India's SME manufacturing base.",
      badge: "Current",
    },
    {
      date: "November 2024",
      category: "Development",
      icon: <CheckCircle className="w-6 h-6" />,
      title: "MVP Completion",
      description: "Completed our MVP with text, chat, and multilingual voice inputs. Photo/video capture and AI troubleshooting modules are in final testing.",
      badge: "Milestone",
    },
    {
      date: "October 2024",
      category: "Research",
      icon: <Users className="w-6 h-6" />,
      title: "Design Partner Program",
      description: "Secured design partners in food & beverage and automotive manufacturing—our highest conversion segments. Conducting weekly feedback sessions.",
      badge: "Milestone",
    },
    {
      date: "September 2024",
      category: "Discovery",
      icon: <Sparkles className="w-6 h-6" />,
      title: "Validated Problem & Pivot",
      description: "After 25+ discovery calls and 60+ Reddit responses, validated that data capture—not prediction—is the core issue. Pivoted from predictive maintenance to technician assistance.",
      badge: "Milestone",
    },
  ];

  const upcomingFeatures = [
    {
      title: "Advanced Analytics Dashboard",
      description: "Real-time OEE tracking and downtime analysis with predictive insights",
      timeline: "Q1 2025",
    },
    {
      title: "CMMS Integrations",
      description: "Native integrations with leading CMMS platforms for seamless data flow",
      timeline: "Q1 2025",
    },
    {
      title: "Offline Mode",
      description: "Full functionality without internet connectivity for remote facilities",
      timeline: "Q2 2025",
    },
    {
      title: "Custom Workflow Builder",
      description: "No-code tool for plants to customize data capture workflows",
      timeline: "Q2 2025",
    },
  ];

  return (
    <>
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
          What&apos;s <span className="text-brand">New</span>
        </h1>
        <p className="text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
          Stay updated on our journey to transform manufacturing data capture and reduce downtime across the industry.
        </p>
      </section>

      {/* Recent Updates */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-white mb-12">Recent Updates</h2>
        <div className="space-y-6 max-w-4xl mx-auto">
          {updates.map((update, index) => (
            <Card key={index} className="border-white/10 bg-white/5 shadow-md hover:shadow-lg transition-shadow">
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-brand/20 flex items-center justify-center text-brand">
                    {update.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <Badge variant="info">{update.badge}</Badge>
                      <span className="text-sm text-slate-400">{update.date}</span>
                      <span className="text-sm text-slate-400">•</span>
                      <span className="text-sm text-slate-400">{update.category}</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{update.title}</h3>
                    <p className="text-slate-400">{update.description}</p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Upcoming Features */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-white mb-12">Coming Soon</h2>
        <div className="grid md:grid-cols-2 gap-6 max-w-6xl mx-auto">
          {upcomingFeatures.map((feature, index) => (
            <Card key={index} className="border-white/10 bg-white/5 shadow-md">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">{feature.title}</h3>
                  <Badge variant="default" className="ml-2 bg-slate-700 text-slate-200">{feature.timeline}</Badge>
                </div>
                <p className="text-slate-400">{feature.description}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="container mx-auto px-4 py-16">
        <Card className="bg-gradient-to-r from-brand/20 to-blue-500/20 border-white/10 shadow-lg">
          <div className="p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Stay in the Loop
            </h2>
            <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto leading-relaxed">
              Follow us on LinkedIn for the latest updates, manufacturing insights, and product announcements.
            </p>
            <a
              href="https://www.linkedin.com/company/hermesai/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="primary" size="lg" className="bg-gradient-to-r from-brand-light to-brand hover:from-brand hover:to-brand-dark text-white">
                Follow on LinkedIn
              </Button>
            </a>
          </div>
        </Card>
      </section>

      {/* Trusted Partners */}
      <section className="container mx-auto px-4 py-16">
        <Card className="border-brand/50 bg-gradient-to-r from-brand/10 to-brand/5 shadow-lg">
          <div className="p-12 text-center">
            <div className="mb-6">
              <span className="inline-block bg-brand text-white px-4 py-2 rounded-full text-sm font-semibold mb-4">
                ⭐ Recognition
              </span>
            </div>
            <h3 className="text-3xl font-bold text-white mb-4">Trusted Manufacturing Partner</h3>
            <p className="text-lg text-slate-300 mb-6 max-w-2xl mx-auto leading-relaxed">
              We&apos;re proud to be recognized as a trusted partner in the manufacturing industry by Assets Ascension.
            </p>
            <a
              href="https://assetsascension.com/trusted-partners"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-brand hover:bg-brand-dark text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Visit Trusted Partners Directory →
            </a>
          </div>
        </Card>
      </section>

      {/* Testimonial/Quote Section */}
      <section className="container mx-auto px-4 py-16">
        <Card className="border-white/10 bg-white/5 shadow-md max-w-4xl mx-auto">
          <div className="p-12">
            <blockquote className="text-center">
              <p className="text-xl text-slate-300 italic mb-4 leading-relaxed">
                &quot;We realized the hardest systems to hack aren&apos;t digital—they&apos;re human trust and attention. 
                That&apos;s why we built Hermes AI to work with technicians, not replace them.&quot;
              </p>
              <footer className="text-white font-semibold">
                — CEO & Co-Founder
              </footer>
            </blockquote>
          </div>
        </Card>
      </section>
    </>
  )
}

export default WhatsNewContent
