'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Check } from 'lucide-react'

const PricingContent = () => {
  const plans = [
    {
      name: "Lite",
      price: "$100",
      period: "/plant/month",
      description: "Perfect for small factories looking to digitize operations",
      features: [
        "Up to 200 employees",
        "Digital SOPs",
        "Photo & video proof of work",
        "Basic work order capture",
        "Mobile access",
        "Email support",
      ],
      cta: "Start with Lite",
      variant: "outline" as const,
    },
    {
      name: "Pro",
      price: "$50",
      period: "/seat/month",
      description: "Ideal for mid-sized plants focused on reliability and compliance",
      features: [
        "200-1,000 employees",
        "Everything in Lite, plus:",
        "Voice input & AI transcription",
        "Real-time SOP compliance checks",
        "Advanced analytics dashboard",
        "Multi-language support",
        "Priority support",
      ],
      cta: "Choose Pro",
      variant: "primary" as const,
      popular: true,
    },
    {
      name: "Enterprise",
      price: "$15K",
      period: "/plant/month",
      description: "Complete solution for large manufacturers tracking downtime and OEE",
      features: [
        "1,000+ employees",
        "Everything in Pro, plus:",
        "Full OEE tracking",
        "Predictive maintenance insights",
        "Custom integrations",
        "Multi-plant deployment",
        "Dedicated account manager",
        "Custom training & onboarding",
      ],
      cta: "Contact Sales",
      variant: "outline" as const,
    },
  ];

  return (
    <>
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
          Simple, Transparent <span className="text-brand">Pricing</span>
        </h1>
        <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-4 leading-relaxed">
          Choose the plan that fits your manufacturing needs. Every plan includes our core AI-powered data capture.
        </p>
        <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed mb-8">
          Typical savings: <span className="text-brand font-semibold">$22.5K/month</span> with 
          <span className="text-brand font-semibold"> 50% ROI</span> and payback in under one month
        </p>
        <div>
          <a
            href="https://drive.google.com/file/d/1YZI3BvQaAyPgjuQOIp9HmggpAhQ6ku1_/view?usp=drive_link"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand hover:text-brand-light underline font-semibold transition-colors"
          >
            Watch a demo →
          </a>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <Card 
              key={plan.name} 
              className={`relative border-white/10 bg-white/5 shadow-md hover:shadow-lg transition-all overflow-hidden ${
                plan.popular ? 'ring-2 ring-brand scale-105' : ''
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-brand-light to-brand text-white px-4 py-1 rounded-full text-sm font-semibold shadow-md">
                    Most Popular
                  </span>
                </div>
              )}
              <div className="p-8">
                <div className="text-center pb-8 pt-0">
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <p className="text-slate-400 mb-4">{plan.description}</p>
                  <div className="flex items-baseline justify-center">
                    <span className="text-4xl font-bold text-white">{plan.price}</span>
                    <span className="text-slate-400 ml-2">{plan.period}</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start space-x-3">
                      <Check className="w-5 h-5 text-brand mt-0.5 flex-shrink-0" />
                      <span className="text-slate-300">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className="w-full">
                  <Button 
                    variant={plan.popular ? "primary" : "outline"} 
                    size="lg" 
                    className="w-full"
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ROI Calculator Section */}
      <section className="container mx-auto px-4 py-16">
        <Card className="bg-white/5 border-white/10">
          <div className="p-12">
            <h2 className="text-3xl font-bold text-center text-white mb-8">
              Understanding Your ROI
            </h2>
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-4xl font-bold text-brand mb-2">$15K/hr</div>
                <p className="text-slate-400">Average downtime cost</p>
              </div>
              <div>
                <div className="text-4xl font-bold text-brand mb-2">70%</div>
                <p className="text-slate-400">Reduction in data-entry effort</p>
              </div>
              <div>
                <div className="text-4xl font-bold text-brand mb-2">80%</div>
                <p className="text-slate-400">Improvement in documentation</p>
              </div>
            </div>
            <div className="mt-12 text-center">
              <p className="text-lg text-slate-300 max-w-3xl mx-auto leading-relaxed">
                Our Enterprise tier customers typically see ROI within the first month, with ongoing savings 
                from reduced downtime, improved OEE tracking, and better preventive maintenance planning.
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* FAQ Section */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-white mb-12">
          Frequently Asked Questions
        </h2>
        <div className="max-w-3xl mx-auto space-y-6">
          {[
            {
              q: "Can I try Hermes AI before committing?",
              a: "Yes! We offer pilot programs for design partners. Contact us to discuss a trial at your facility.",
            },
            {
              q: "What about multi-plant deployments?",
              a: "Enterprise plans support multiple plants with volume discounts. Contact our sales team for custom pricing.",
            },
            {
              q: "Do you support languages other than English?",
              a: "Yes! Pro and Enterprise plans include full multilingual support for diverse manufacturing teams.",
            },
            {
              q: "What integrations do you support?",
              a: "We integrate with major CMMS platforms. Enterprise customers can request custom integrations.",
            },
          ].map((faq, i) => (
            <Card key={i} className="border-white/10 bg-white/5">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-white mb-2">{faq.q}</h3>
                <p className="text-slate-400">{faq.a}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </>
  )
}

export default PricingContent
