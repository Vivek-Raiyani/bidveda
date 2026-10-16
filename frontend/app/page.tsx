"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { RoleGuard, PermissionGuard } from "@/lib/auth";
import { Permission, UserRole } from "@/types/permissions";
import { Navbar } from "@/components/navigation/navbar";
import {
  ShieldCheck,
  User as UserIcon,
  PlusCircle,
  FileText,
  Building,
  Briefcase,
  ShieldAlert,
  CheckCircle2,
  Lock,
  ArrowRight,
  FolderArchive,
  Layers,
  Sparkles,
} from "lucide-react";

export default function HomePage() {
  const { user, isAuthenticated, isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Unified Global Navbar */}
      <Navbar />

      {/* Main Content */}
      <main className="flex-1 mx-auto max-w-7xl px-4 sm:px-6 py-10 w-full">
        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-8 md:p-12 shadow-2xl">
          <div className="absolute right-0 top-0 -mr-16 -mt-16 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              Enterprise Sourcing & Quotation Engine
            </div>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-5xl">
              Next-Gen B2B Procurement & Bidding
            </h1>
            <p className="mt-4 text-base text-zinc-400 md:text-lg leading-relaxed">
              Streamline complex enterprise requests for quotation (RFQs), evaluate side-by-side vendor quotes in real-time comparison matrices, and securely manage specification assets.
            </p>

            {/* Quick CTA Buttons */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/rfqs"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all hover:scale-[1.02]"
              >
                <Briefcase className="h-4 w-4" />
                <span>Explore RFQs</span>
                <ArrowRight className="h-4 w-4" />
              </Link>

              {user?.role === UserRole.BUYER || user?.role === UserRole.ADMIN ? (
                <Link
                  href="/rfqs/create"
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/80 px-5 py-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-700 transition-all"
                >
                  <PlusCircle className="h-4 w-4 text-indigo-400" />
                  <span>Create Sourcing Request</span>
                </Link>
              ) : user?.role === UserRole.VENDOR ? (
                <Link
                  href="/quotes/my"
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/80 px-5 py-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-700 transition-all"
                >
                  <FileText className="h-4 w-4 text-emerald-400" />
                  <span>My Submitted Quotes</span>
                </Link>
              ) : null}

              <Link
                href="/assets"
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <FolderArchive className="h-4 w-4 text-zinc-400" />
                <span>Document Repository</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            href="/rfqs"
            className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition-all hover:border-indigo-500/40 hover:bg-zinc-900 shadow-lg"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20 group-hover:scale-110 transition-transform">
              <Briefcase className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
              RFQ Marketplace
            </h3>
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
              Discover opportunities across machinery, raw materials, IT hardware, and packaging. Filter by delivery location, status, and deadlines.
            </p>
          </Link>

          <Link
            href="/rfqs?tab=my"
            className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition-all hover:border-indigo-500/40 hover:bg-zinc-900 shadow-lg"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20 group-hover:scale-110 transition-transform">
              <Layers className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-bold text-white group-hover:text-sky-300 transition-colors">
              Side-by-Side Quote Comparison
            </h3>
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
              Comprehensive quote matrix with per-line-item pricing, delivery timelines, vendor shortlist tags, and one-click contract awards.
            </p>
          </Link>

          <Link
            href="/assets"
            className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition-all hover:border-indigo-500/40 hover:bg-zinc-900 shadow-lg"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 group-hover:scale-110 transition-transform">
              <FolderArchive className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
              Asset & Specification Center
            </h3>
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
              Upload and organize technical drawings, BOQs, specification sheets, and compliance certificates across storage folders.
            </p>
          </Link>
        </div>

        {/* Current Session & Permissions Inspector */}
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {/* Auth State Card */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-indigo-400" />
                Auth Session State
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  isAuthenticated
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-zinc-800 text-zinc-400"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isAuthenticated ? "bg-emerald-400" : "bg-zinc-500"
                  }`}
                />
                {isAuthenticated ? "Authenticated" : "Guest / Not signed in"}
              </span>
            </div>

            <div className="mt-6 space-y-4 text-sm">
              {isLoading ? (
                <div className="space-y-3">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-800" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-800" />
                </div>
              ) : isAuthenticated && user ? (
                <div className="space-y-3">
                  <div className="flex justify-between border-b border-zinc-800/60 pb-2">
                    <span className="text-zinc-400">User ID:</span>
                    <span className="font-mono text-xs text-zinc-300 truncate max-w-[200px]">
                      {user.id}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-800/60 pb-2">
                    <span className="text-zinc-400">Email:</span>
                    <span className="font-medium text-white">{user.email}</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-800/60 pb-2">
                    <span className="text-zinc-400">Full Name:</span>
                    <span className="font-medium text-white">
                      {user.first_name || "—"}{" "}
                      {user.last_name || ""}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-zinc-400">Assigned Role:</span>
                    <span className="rounded-lg bg-indigo-500/20 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-indigo-300 border border-indigo-500/30">
                      {user.role}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-5 text-center">
                  <Lock className="mx-auto h-8 w-8 text-zinc-600" />
                  <p className="mt-3 text-sm text-zinc-400">
                    No active session found. Sign in or register to test role-guarded
                    features.
                  </p>
                  <div className="mt-4 flex justify-center gap-3">
                    <Link
                      href="/login"
                      className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-indigo-500"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/register"
                      className="rounded-lg border border-zinc-700 bg-zinc-800 px-3.5 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
                    >
                      Create Account
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Role-Based Guarded Actions Showcase */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-indigo-400" />
                Role Guarded Actions
              </h2>
              <span className="text-xs text-zinc-400">
                Live Permission Checks
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {/* Buyer Guard */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Building className="h-4 w-4 text-sky-400" />
                    <span className="text-sm font-semibold text-zinc-200">
                      Buyer Zone (RFQ Creation)
                    </span>
                  </div>
                  <span className="rounded bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                    rfq:create
                  </span>
                </div>

                <div className="mt-3">
                  <PermissionGuard
                    permission={Permission.RFQ_CREATE}
                    fallback={
                      <p className="text-xs text-zinc-500 italic">
                        🔒 Restricted to Buyers & Admins. Your role cannot create RFQs.
                      </p>
                    }
                  >
                    <div className="flex items-center justify-between rounded-lg bg-sky-500/10 border border-sky-500/20 p-3 text-xs text-sky-300">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-sky-400" />
                        <span>Granted: You can create and publish RFQs</span>
                      </div>
                      <Link
                        href="/rfqs/create"
                        className="flex items-center gap-1 rounded bg-sky-600 px-2.5 py-1 font-semibold text-white shadow hover:bg-sky-500"
                      >
                        <PlusCircle className="h-3 w-3" />
                        New RFQ
                      </Link>
                    </div>
                  </PermissionGuard>
                </div>
              </div>

              {/* Vendor Guard */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Briefcase className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm font-semibold text-zinc-200">
                      Vendor Zone (Quote Bidding)
                    </span>
                  </div>
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                    quote:create
                  </span>
                </div>

                <div className="mt-3">
                  <PermissionGuard
                    permission={Permission.QUOTE_CREATE}
                    fallback={
                      <p className="text-xs text-zinc-500 italic">
                        🔒 Restricted to Vendors. Buyers cannot submit quotes.
                      </p>
                    }
                  >
                    <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-300">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        <span>Granted: You can submit competitive quotes</span>
                      </div>
                      <Link
                        href="/rfqs"
                        className="flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 font-semibold text-white shadow hover:bg-emerald-500"
                      >
                        <FileText className="h-3 w-3" />
                        Browse & Quote
                      </Link>
                    </div>
                  </PermissionGuard>
                </div>
              </div>

              {/* Admin Guard */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="h-4 w-4 text-purple-400" />
                    <span className="text-sm font-semibold text-zinc-200">
                      Admin Zone (Platform Governance)
                    </span>
                  </div>
                  <span className="rounded bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
                    user:ban
                  </span>
                </div>

                <div className="mt-3">
                  <RoleGuard
                    roles={[UserRole.ADMIN]}
                    fallback={
                      <p className="text-xs text-zinc-500 italic">
                        🔒 Restricted to Administrator accounts.
                      </p>
                    }
                  >
                    <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-3 text-xs text-purple-300 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-purple-400" />
                        <span>Administrator Privileges Verified</span>
                      </div>
                    </div>
                  </RoleGuard>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
