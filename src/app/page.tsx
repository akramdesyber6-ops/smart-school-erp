'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/lib/stores/useAuthStore';
import { processSecureRedirects } from '@/lib/routes/routing_security';
import {
  BookOpen,
  Users,
  BarChart3,
  CheckCircle,
  Zap,
  Shield,
  ArrowRight,
} from 'lucide-react';

export default function LandingPage(): JSX.Element {
  const router = useRouter();
  const { profile, activeSchoolId } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  // Session Detection & Auto-Redirect
  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      if (profile && activeSchoolId) {
        try {
          const redirectPath = await processSecureRedirects(
            { role: profile.role, roles: profile.roles },
            { pathname: '/' }
          );
          if (redirectPath) {
            router.push(redirectPath);
            return;
          }
        } catch (err) {
          console.error('Redirect error:', err);
        }
      }
      setIsLoading(false);
    };

    checkAuthAndRedirect();
  }, [profile, activeSchoolId, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-indigo-500/20 animate-pulse">
            <BookOpen className="h-6 w-6 text-indigo-400" />
          </div>
          <p className="text-slate-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-900/50 border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Smart School ERP
            </h1>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-slate-300 hover:text-white transition">
              Features
            </a>
            <a href="#modules" className="text-slate-300 hover:text-white transition">
              Modules
            </a>
            <a href="#modules" className="text-slate-300 hover:text-white transition">
              Assessments
            </a>
            <button
              onClick={() => router.push('/login')}
              className="inline-flex items-center gap-2 px-6 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 transition font-medium"
            >
              Secure Portal Login
              <ArrowRight className="h-4 w-4" />
            </button>
          </nav>
          <div className="md:hidden">
            <button
              onClick={() => router.push('/login')}
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 transition"
            >
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 sm:py-32 lg:py-40">
        {/* Background gradient orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-2000" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-8">
            <div className="inline-block">
              <div className="px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium">
                🎓 Dual-Curriculum Support • CBC & NCDC
              </div>
            </div>

            <h2 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight space-y-2">
              <div className="bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
                Transform Your School
              </div>
              <div className="text-white text-4xl sm:text-5xl lg:text-6xl">with Intelligent ERP</div>
            </h2>

            <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Manage school operations, academic records, and student progress with role-aware tools for East African schools.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
              <button
                onClick={() => router.push('/login')}
                className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 transition font-semibold shadow-lg hover:shadow-indigo-500/50"
              >
                <Shield className="h-5 w-5" />
                Secure Login
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold mb-4">Built for Uganda&apos;s Schools</h3>
            <p className="text-xl text-slate-300">Comprehensive features designed specifically for East African education standards</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Shield,
                title: 'Multi-Tenant Security',
                description: 'Enterprise-grade Row Level Security (RLS) ensures each school&apos;s data remains completely isolated and protected.',
              },
              {
                icon: Users,
                title: 'Role-Based Access Control',
                description: 'Granular permissions for Admin, Teachers, Students, and Parents with custom dashboards.',
              },
              {
                icon: BookOpen,
                title: 'Lesson Planning',
                description: 'AI-assisted lesson plan generation compliant with NCDC and CBC standards.',
              },
              {
                icon: BarChart3,
                title: 'Real-Time Analytics',
                description: 'Live dashboards tracking enrollment, attendance, performance metrics, and progress trends.',
              },
              {
                icon: Zap,
                title: 'Automated Workflows',
                description: 'Auto-calculate Ugandan divisions, competency descriptors, and attendance reports.',
              },
              {
                icon: CheckCircle,
                title: 'Compliance Ready',
                description: 'Meets Uganda Ministry of Education standards for EMIS reporting and academic records.',
              },
            ].map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div
                  key={idx}
                  className="group relative p-6 rounded-2xl bg-slate-800/50 border border-slate-700 hover:border-indigo-500/50 transition hover:bg-slate-800 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 to-purple-600/10 opacity-0 group-hover:opacity-100 transition" />
                  <div className="relative">
                    <Icon className="h-8 w-8 text-indigo-400 mb-4" />
                    <h4 className="text-lg font-semibold mb-2">{feature.title}</h4>
                    <p className="text-slate-300 text-sm leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Modules Section */}
      <section id="modules" className="py-16 sm:py-24 bg-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold mb-4">Dual Gradebook Engine</h3>
            <p className="text-xl text-slate-300">Seamlessly support both CBC and NCDC curricula with intelligent grading</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* NCDC Module */}
            <div className="relative p-8 rounded-2xl bg-gradient-to-br from-blue-900/30 to-blue-800/30 border border-blue-700/50 overflow-hidden group hover:border-blue-600 transition">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent opacity-0 group-hover:opacity-100 transition" />
              <div className="relative">
                <div className="inline-block px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-300 text-xs font-semibold mb-4">
                  Traditional Curriculum
                </div>
                <h4 className="text-2xl font-bold mb-4">NCDC O/A Level Grading</h4>
                <div className="space-y-4 mb-6">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Weighted Assessment</p>
                      <p className="text-sm text-slate-300">BOT (10%) + MOT (20%) + EOT (70%) = Final Score</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Ugandan Divisions</p>
                      <p className="text-sm text-slate-300">Auto-mapped grades: D1 (75%), D2-D5, D6-D8, F9 (&lt;35%)</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Real-Time Calculation</p>
                      <p className="text-sm text-slate-300">Live percentage and grade updates as marks are entered</p>
                    </div>
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-300 text-sm font-medium">
                  Senior 5 Science Stream
                </div>
              </div>
            </div>

            {/* CBC Module */}
            <div className="relative p-8 rounded-2xl bg-gradient-to-br from-purple-900/30 to-purple-800/30 border border-purple-700/50 overflow-hidden group hover:border-purple-600 transition">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 to-transparent opacity-0 group-hover:opacity-100 transition" />
              <div className="relative">
                <div className="inline-block px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-semibold mb-4">
                  Competency-Based Curriculum
                </div>
                <h4 className="text-2xl font-bold mb-4">CBC Competency Tracking</h4>
                <div className="space-y-4 mb-6">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Three-Tier Scoring</p>
                      <p className="text-sm text-slate-300">Level 1 (Initiating) → 2 (Progressing) → 3 (Achieving)</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Detailed Observations</p>
                      <p className="text-sm text-slate-300">Rich narrative feedback on student progress and areas for growth</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Activities of Integration (AOI)</p>
                      <p className="text-sm text-slate-300">Track holistic, cross-curricular learning competencies</p>
                    </div>
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 text-sm font-medium">
                  Senior 1 Blue Stream
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-16 sm:py-24 border-t border-slate-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <h3 className="text-4xl font-bold">Ready to Transform Your School?</h3>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Join Uganda&apos;s leading schools leveraging Smart School ERP for intelligent education management.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push('/login')}
              className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 transition font-semibold shadow-lg hover:shadow-indigo-500/50"
            >
              <Shield className="h-5 w-5" />
              Secure Login Now
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-700 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-indigo-400" />
              <p className="text-slate-400">© 2026 Smart School ERP. Built for Uganda.</p>
            </div>
            <div className="flex items-center gap-6 text-slate-400 text-sm">
              <a href="#" className="hover:text-white transition">
                Privacy Policy
              </a>
              <a href="#" className="hover:text-white transition">
                Terms of Service
              </a>
              <a href="#" className="hover:text-white transition">
                Support
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
