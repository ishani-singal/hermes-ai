'use client'

import { Card } from '@/components/ui/card'

const AboutContent = () => {
  const milestones = [
    {
      date: 'August 2024',
      title: 'Started Research',
      description: 'Began exploring maintenance challenges in manufacturing through plant visits across India and the U.S.',
    },
    {
      date: 'September 2024',
      title: 'Pivoted to Data Capture',
      description: "After 25+ discovery calls, identified poor data capture—not prediction—as the root cause of low OEE.",
    },
    {
      date: 'October 2024',
      title: 'Built 4 Prototypes',
      description: 'Rapid iteration through four POCs to test technical feasibility and validate technician workflows.',
    },
    {
      date: 'November 2024',
      title: 'MVP Development',
      description: "Finalized MVP features with design partners including Amy's Kitchen and Scout Motors. First pilot in India.",
    },
    {
      date: 'December 2024',
      title: 'Pilot Launch',
      description: "Testing Pro tier in India's SME base and conducting enterprise demos in the U.S.",
    },
  ]

  return (
    <>
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
          About <span className="text-brand">Hermes AI</span>
        </h1>
        <p className="text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
          We&apos;re on a mission to fix &quot;garbage in, garbage out&quot; in manufacturing by making accurate data capture effortless for technicians.
        </p>
      </section>

      {/* Story Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-6">Our Story</h2>
          <div className="space-y-4 text-lg text-slate-300 leading-relaxed">
            <p>
                Hermes AI was started in 2025 after seeing how fragile reliability becomes when logs are skipped and small warnings get missed.
                Our focus: capture truth at the source with multimodal input and make it effortless to comply with SOPs.
            </p>
            <p>
                Based in the U.S., we work with a handful of design partners across food & beverage and automotive to prove ROI in weeks, not quarters.
            </p>
            <p>
                Our mission is to give every technician a helpful copilot that speeds up maintenance while improving compliance.            
            </p>
          </div>
        </div>
      </section>

      {/* Journey Timeline */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-white mb-12">Our Journey</h2>
        <div className="max-w-4xl mx-auto space-y-8">
          {milestones.map((milestone, index) => (
            <div key={index} className="flex gap-6">
              <div className="flex flex-col items-center">
                <div className="w-4 h-4 rounded-full bg-brand flex-shrink-0" />
                {index < milestones.length - 1 && <div className="w-0.5 h-full bg-brand/30 mt-2" />}
              </div>

              <Card className="flex-1 border-white/10 bg-white/5 mb-4">
                <div className="p-6">
                  <p className="text-sm text-brand font-semibold mb-2">{milestone.date}</p>
                  <h3 className="text-xl font-bold text-white mb-2">{milestone.title}</h3>
                  <p className="text-slate-400">{milestone.description}</p>
                </div>
              </Card>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

export default AboutContent
