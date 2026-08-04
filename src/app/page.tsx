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
  ChevronDown,
  ChevronUp,
  Code,
  Copy,
  Eye,
  EyeOff,
  ArrowRight,
} from 'lucide-react';

interface TestAccount {
  name: string;
  role: string;
  email: string;
  password: string;
  description: string;
}

const TEST_ACCOUNTS: TestAccount[] = [
  {
    name: 'Grace Kiggundu',
    role: 'School Admin',
    email: 'grace.admin@kampalaelite.ug',
    password: 'DemoPass123!',
    description: 'Full school administrative access. Manage users, classes, streams, and reports.',
  },
  {
    name: 'Robert Mukuka',
    role: 'CBC Teacher',
    email: 'robert.mukuka@kampalaelite.ug',
    password: 'DemoPass123!',
    description: 'Teach Senior 1 (CBC). Input competency scores, lesson plans, observations.',
  },
  {
    name: 'Dr. Patrick Ouma',
    role: 'NCDC Teacher',
    email: 'patrick.ouma@kampalaelite.ug',
    password: 'DemoPass123!',
    description: 'Teach Senior 5 (NCDC). Input BOT/MOT/EOT marks, automated Ugandan grading.',
  },
  {
    name: 'Amina Ssekandi',
    role: 'Student (CBC)',
    email: 'amina.student@kampalaelite.ug',
    password: 'DemoPass123!',
    description: 'View grades, competency feedback, attendance, lesson materials.',
  },
];

interface CopyState {
  [key: string]: boolean;
}

export default function LandingPage(): JSX.Element {
  const router = useRouter();
  const { profile, activeSchoolId } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});
  const [copied, setCopied] = useState<CopyState>({});

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

  const togglePasswordVisibility = (email: string) => {
    setShowPasswords((prev) => ({
      ...prev,
      [email]: !prev[email],
    }));
  };

  const copyToClipboard = (text: string, identifier: string) => {
    navigator.clipboard.writeText(text);
    setCopied((prev) => ({
      ...prev,
      [identifier]: true,
    }));
    setTimeout(() => {
      setCopied((prev) => ({
        ...prev,
        [identifier]: false,
      }));
    }, 2000);
  };

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
            <a href="#sandbox" className="text-slate-300 hover:text-white transition">
              Testing
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
              Kampala Elite Academy and Uganda's leading schools trust Smart School ERP for seamless student management,
              dual-curriculum grading, and real-time progress tracking—all built for East Africa.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
              <button
                onClick={() => router.push('/login')}
                className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 transition font-semibold shadow-lg hover:shadow-indigo-500/50"
              >
                <Shield className="h-5 w-5" />
                Secure Login
              </button>
              <button
                onClick={() => setSandboxOpen(!sandboxOpen)}
                className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg border border-slate-600 hover:border-slate-400 hover:bg-slate-800/50 transition font-semibold"
              >
                <Code className="h-5 w-5" />
                View Test Credentials
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold mb-4">Built for Uganda's Schools</h3>
            <p className="text-xl text-slate-300">Comprehensive features designed specifically for East African education standards</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Shield,
                title: 'Multi-Tenant Security',
                description: 'Enterprise-grade Row Level Security (RLS) ensures each school\'s data remains completely isolated and protected.',
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

      {/* Developer Sandbox Panel */}
      <section id="sandbox" className="py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            onClick={() => setSandboxOpen(!sandboxOpen)}
            className="flex items-center justify-between p-6 rounded-2xl bg-gradient-to-r from-amber-900/30 to-orange-900/30 border border-amber-700/50 hover:border-amber-600 transition cursor-pointer group"
          >
            <div className="flex items-center gap-4">
              <Code className="h-6 w-6 text-amber-400" />
              <div>
                <h3 className="text-lg font-semibold">👨‍💻 Developer Sandbox & Testing Accounts</h3>
                <p className="text-sm text-slate-300 mt-1">Demo credentials for platform personas—use to explore all features</p>
              </div>
            </div>
            {sandboxOpen ? (
              <ChevronUp className="h-5 w-5 text-amber-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-amber-400" />
            )}
          </div>

          {sandboxOpen && (
            <div className="mt-6 space-y-4">
              {TEST_ACCOUNTS.map((account, idx) => (
                <div
                  key={idx}
                  className="relative p-6 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-slate-600 transition overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-600/10 to-transparent opacity-0 group-hover:opacity-100 transition" />
                  <div className="relative">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="text-lg font-semibold">{account.name}</h4>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/20 border border-indigo-500/40 text-indigo-300">
                            {account.role}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400">{account.description}</p>
                      </div>
                      <button
                        onClick={() => router.push('/login')}
                        className="whitespace-nowrap inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition font-medium text-sm"
                      >
                        <ArrowRight className="h-4 w-4" />
                        Login
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Email */}
                      <div className="p-3 rounded-lg bg-slate-700/50 border border-slate-600">
                        <label className="text-xs font-semibold text-slate-400 uppercase">Email</label>
                        <div className="flex items-center gap-2 mt-2">
                          <code className="text-sm font-mono text-slate-200 break-all flex-1">{account.email}</code>
                          <button
                            onClick={() => copyToClipboard(account.email, `email-${idx}`)}
                            className="p-1.5 rounded hover:bg-slate-600 transition flex-shrink-0"
                            title="Copy email"
                          >
                            {copied[`email-${idx}`] ? (
                              <CheckCircle className="h-4 w-4 text-green-400" />
                            ) : (
                              <Copy className="h-4 w-4 text-slate-400" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Password */}
                      <div className="p-3 rounded-lg bg-slate-700/50 border border-slate-600">
                        <label className="text-xs font-semibold text-slate-400 uppercase">Password</label>
                        <div className="flex items-center gap-2 mt-2">
                          <code className="text-sm font-mono text-slate-200 flex-1">
                            {showPasswords[`pass-${idx}`] ? account.password : '••••••••••'}
                          </code>
                          <button
                            onClick={() => togglePasswordVisibility(`pass-${idx}`)}
                            className="p-1.5 rounded hover:bg-slate-600 transition flex-shrink-0"
                            title="Toggle password visibility"
                          >
                            {showPasswords[`pass-${idx}`] ? (
                              <EyeOff className="h-4 w-4 text-slate-400" />
                            ) : (
                              <Eye className="h-4 w-4 text-slate-400" />
                            )}
                          </button>
                          <button
                            onClick={() => copyToClipboard(account.password, `pass-${idx}`)}
                            className="p-1.5 rounded hover:bg-slate-600 transition flex-shrink-0"
                            title="Copy password"
                          >
                            {copied[`pass-${idx}`] ? (
                              <CheckCircle className="h-4 w-4 text-green-400" />
                            ) : (
                              <Copy className="h-4 w-4 text-slate-400" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="mt-6 p-4 rounded-lg bg-amber-900/20 border border-amber-700/50">
                <p className="text-sm text-amber-200">
                  <strong>⚠️ Development Environment:</strong> These credentials are for local/staging testing only. Never use in production.
                  All demo accounts access the same "Kampala Elite Academy" tenant.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-16 sm:py-24 border-t border-slate-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <h3 className="text-4xl font-bold">Ready to Transform Your School?</h3>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Join Uganda's leading schools leveraging Smart School ERP for intelligent education management.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push('/login')}
              className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 transition font-semibold shadow-lg hover:shadow-indigo-500/50"
            >
              <Shield className="h-5 w-5" />
              Secure Login Now
            </button>
            <button
              onClick={() => setSandboxOpen(!sandboxOpen)}
              className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg border border-slate-600 hover:border-slate-400 hover:bg-slate-800/50 transition font-semibold"
            >
              <Code className="h-5 w-5" />
              Test Drive
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
