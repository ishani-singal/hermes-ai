'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { ArrowRight, Zap, Clipboard, Wrench } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
      {/* Background accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-20 bg-white/5 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 relative bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg p-1.5">
                <Image 
                  src="/brand/logo.png" 
                  alt="Hermes AI" 
                  width={40} 
                  height={40}
                  className="object-contain w-full h-full"
                />
              </div>
              <div className="leading-tight">
                <span className="text-lg font-bold text-white block">Hermes AI</span>
                <span className="text-xs text-slate-300">Technician Assistant</span>
              </div>
            </Link>
            
            <div className="flex gap-3">
              <Link href="/login">
                <Button variant="ghost" className="text-white hover:bg-white/10">
                  Sign In
                </Button>
              </Link>
              <Link href="/signup">
                <Button variant="primary" className="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white">
                  Sign Up
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
        <div className="text-center mb-16">
          <div className="inline-block mb-6 px-4 py-2 rounded-full bg-teal-500/20 border border-teal-400/30">
            <span className="text-sm font-semibold text-teal-300">Manufacturing AI Copilot</span>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold mb-6 leading-tight">
            Work Smarter with
            <span className="block bg-gradient-to-r from-teal-400 via-teal-300 to-blue-400 bg-clip-text text-transparent">
              Hermes AI
            </span>
          </h1>

          <p className="text-xl sm:text-2xl text-slate-300 mb-8 max-w-2xl mx-auto leading-relaxed">
            Your AI-powered copilot for maintenance, equipment management, and intelligent work order tracking. Boost productivity and reduce downtime.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button size="lg" variant="primary" className="w-full sm:w-auto bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white">
                Sign Up
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-white/20 text-white hover:bg-white/10 bg-transparent">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-20 grid md:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-8 hover:bg-white/10 hover:border-teal-400/50 transition-all duration-300 hover:shadow-xl hover:shadow-teal-500/10">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/0 to-teal-500/0 group-hover:from-teal-500/5 group-hover:to-blue-500/5 rounded-xl transition-all"></div>
            <div className="relative z-10">
              <div className="w-14 h-14 bg-teal-500/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-teal-500/30 transition-colors">
                <Zap className="w-7 h-7 text-teal-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">AI Chat Assistant</h3>
              <p className="text-slate-400 leading-relaxed">Get instant help with maintenance procedures, troubleshooting, and equipment questions powered by AI.</p>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-8 hover:bg-white/10 hover:border-teal-400/50 transition-all duration-300 hover:shadow-xl hover:shadow-teal-500/10">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/0 to-teal-500/0 group-hover:from-teal-500/5 group-hover:to-blue-500/5 rounded-xl transition-all"></div>
            <div className="relative z-10">
              <div className="w-14 h-14 bg-teal-500/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-teal-500/30 transition-colors">
                <Clipboard className="w-7 h-7 text-teal-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Work Order Management</h3>
              <p className="text-slate-400 leading-relaxed">Track and manage maintenance tasks with intelligent automation, insights, and real-time updates.</p>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-8 hover:bg-white/10 hover:border-teal-400/50 transition-all duration-300 hover:shadow-xl hover:shadow-teal-500/10">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/0 to-teal-500/0 group-hover:from-teal-500/5 group-hover:to-blue-500/5 rounded-xl transition-all"></div>
            <div className="relative z-10">
              <div className="w-14 h-14 bg-teal-500/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-teal-500/30 transition-colors">
                <Wrench className="w-7 h-7 text-teal-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Equipment Tracking</h3>
              <p className="text-slate-400 leading-relaxed">Maintain comprehensive records of all your manufacturing equipment and assets with detailed history.</p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-20 text-center">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-12">
            <h2 className="text-3xl font-bold mb-4">Ready to transform your operations?</h2>
            <p className="text-slate-300 mb-8 max-w-xl mx-auto">
              Join manufacturing teams already using Hermes AI to reduce downtime, improve efficiency, and empower technicians.
            </p>
            <Link href="/signup">
              <Button size="lg" variant="primary" className="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white">
                Sign Up
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-slate-400 text-sm">
            <p>© 2024 Hermes AI — Technician Assistant. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
