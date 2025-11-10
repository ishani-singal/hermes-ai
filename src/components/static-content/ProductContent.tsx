'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Mic, Camera, MessageSquare, CheckCircle, TrendingUp, Shield } from 'lucide-react'

const ProductContent = () => {
  const features = [
    {
      icon: <Mic className="w-12 h-12 text-brand" />,
      title: "Voice Input",
      description: "Technicians speak naturally—Hermes AI captures structured data without typing or forms.",
    },
    {
      icon: <Camera className="w-12 h-12 text-brand" />,
      title: "Photo & Video Capture",
      description: "Snap a photo or record a video—AI automatically extracts details and creates work orders.",
    },
    {
      icon: <MessageSquare className="w-12 h-12 text-brand" />,
      title: "Multilingual Support",
      description: "Works in any language—breaking barriers for diverse manufacturing teams.",
    },
    {
      icon: <CheckCircle className="w-12 h-12 text-brand" />,
      title: "Real-Time SOP Compliance",
      description: "AI checks SOPs in real time, ensuring every step is followed correctly.",
    },
    {
      icon: <TrendingUp className="w-12 h-12 text-brand" />,
      title: "Predictive Insights",
      description: "Surface patterns for faster troubleshooting and preventive maintenance.",
    },
    {
      icon: <Shield className="w-12 h-12 text-brand" />,
      title: "Accurate Data",
      description: "Turn technicians into reliable data sources—no sensors or manual entry required.",
    },
  ];

  const benefits = [
    "Reduce downtime costs by up to $22.5K per month",
    "70% reduction in operator data-entry effort",
    "80% improvement in documentation consistency",
    "Complete shift-to-shift knowledge transfer",
    "50% monthly ROI with payback under one month",
  ];

  return (
    <>
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
          The AI Assistant for <span className="text-brand">Manufacturing Technicians</span>
        </h1>
        <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-8 leading-relaxed">
          Hermes AI transforms how technicians capture maintenance data—using voice, photos, and video 
          to automatically generate structured work orders and insights.
        </p>
      </section>

      {/* Demo Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-white mb-4">
            See Hermes AI in Action
          </h2>
          <p className="text-xl text-slate-300 text-center mb-8 leading-relaxed">
            Watch how technicians capture maintenance data in seconds using voice, photos, and video
          </p>
          <Card className="border-white/10 bg-white/5 shadow-lg overflow-hidden">
              <div className="p-0">
                <div className="aspect-video bg-slate-800 flex items-center justify-center">
                  <iframe
                    title="Hermes AI Demo Video"
                    width="100%"
                    height="100%"
                    src="https://player.vimeo.com/video/1135203098?h=1135203098&amp;badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479"
                    allow="autoplay; fullscreen; picture-in-picture"
                    className="rounded"
                  ></iframe>
                </div>
              </div>
            </Card>
        </div>
      </section>

      {/* Problem & Solution */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold text-white mb-4">The Problem</h2>
            <p className="text-lg text-slate-300 mb-6 leading-relaxed">
              Maintenance data is unreliable because technicians don&apos;t have time to document work. 
              This results in &quot;garbage in, garbage out&quot; CMMS data, poor visibility, and costly downtime 
              averaging $15K per hour.
            </p>
            <ul className="space-y-3">
              {["80% of technicians skip logs daily", "75% dissatisfied with OEE accuracy", "No time for detailed documentation"].map((item) => (
                <li key={item} className="flex items-start space-x-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0" />
                  <span className="text-slate-300">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white mb-4">The Solution</h2>
            <p className="text-lg text-slate-300 mb-6 leading-relaxed">
              Hermes AI makes accurate data effortless. Technicians just speak, photograph, or record 
              their work, and our multimodal AI structures everything automatically.
            </p>
            <ul className="space-y-3">
              {benefits.map((item) => (
                <li key={item} className="flex items-start space-x-2">
                  <CheckCircle className="w-5 h-5 text-brand mt-0.5 flex-shrink-0" />
                  <span className="text-slate-300">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-4xl font-bold text-center text-white mb-12">
          How Hermes AI Works
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div key={feature.title} className="group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-8 hover:bg-white/10 hover:border-brand/50 transition-all duration-300 hover:shadow-xl hover:shadow-brand/10">
              <div className="absolute inset-0 bg-gradient-to-br from-brand/0 to-brand/0 group-hover:from-brand/5 group-hover:to-blue-500/5 rounded-xl transition-all"></div>
              <div className="relative z-10">
                <div className="mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-12">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-4">
            Ready to Transform Your Manufacturing Data?
          </h2>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto text-center leading-relaxed">
            Join leading manufacturers reducing downtime and improving OEE with effortless data capture.
          </p>
          <div className="text-center">
            <a href="/signup">
              <Button size="lg" variant="primary">
                Get Started
              </Button>
            </a>
          </div>
        </div>
      </section>
    </>
  )
}

export default ProductContent
