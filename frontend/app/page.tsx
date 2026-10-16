"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { rfqApi, quoteApi, usersApi } from "@/lib/api";
import { UserRole } from "@/types/permissions";
import { Navbar } from "@/components/navigation/navbar";
import {
  Briefcase,
  PlusCircle,
  FileText,
  FolderArchive,
  ArrowRight,
  ShieldCheck,
  Layers,
  Sparkles,
  CheckCircle2,
  Lock,
  UserCheck,
} from "lucide-react";

export default function HomePage() {
  const { user, isAuthenticated, isLoading } = useAuth();

  // Role-specific lightweight stats
  const [buyerStats, setBuyerStats] = useState<{
    totalMyRfqs: number;
    draftRfqs: number;
    publishedRfqs: number;
  }>({ totalMyRfqs: 0, draftRfqs: 0, publishedRfqs: 0 });

  const [vendorStats, setVendorStats] = useState<{
    totalOpenRfqs: number;
    myQuotesCount: number;
    shortlistedQuotes: number;
  }>({ totalOpenRfqs: 0, myQuotesCount: 0, shortlistedQuotes: 0 });

  const [adminStats, setAdminStats] = useState<{
    totalUsers: number;
    totalRfqs: number;
  }>({ totalUsers: 0, totalRfqs: 0 });

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    let ignore = false;

    async function fetchStats() {
      if (user?.role === UserRole.BUYER) {
        try {
          const res = await rfqApi.listMy({ limit: 50 });
          if (ignore) return;
          const myRfqs = res.data || [];
          setBuyerStats({
            totalMyRfqs: res.pagination?.total_items ?? myRfqs.length,
            draftRfqs: myRfqs.filter((r) => r.status === "draft").length,
            publishedRfqs: myRfqs.filter((r) => r.status === "published").length,
          });
        } catch {
          // stats are best-effort
        }
      } else if (user?.role === UserRole.VENDOR) {
        try {
          const [openRes, myQuotesRes] = await Promise.all([
            rfqApi.list({ status: "published", limit: 1 }),
            quoteApi.listMy({ limit: 50 }),
          ]);
          if (ignore) return;
          const quotes = myQuotesRes.data || [];
          setVendorStats({
            totalOpenRfqs: openRes.pagination?.total_items ?? 0,
            myQuotesCount: myQuotesRes.pagination?.total_items ?? quotes.length,
            shortlistedQuotes: quotes.filter(
              (q) => q.status === "shortlisted" || q.status === "accepted"
            ).length,
          });
        } catch {
          // stats are best-effort
        }
      } else if (user?.role === UserRole.ADMIN) {
        try {
          const [uRes, rRes] = await Promise.all([
            usersApi.list({ limit: 1 }),
            rfqApi.list({ limit: 1 }),
          ]);
          if (ignore) return;
          setAdminStats({
            totalUsers: uRes.pagination?.total_items ?? 0,
            totalRfqs: rRes.pagination?.total_items ?? 0,
          });
        } catch {
          // stats are best-effort
        }
      }
    }

    fetchStats();
    return () => {
      ignore = true;
    };
  }, [isAuthenticated, user]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-indigo-500/30">
      <Navbar />

      <main className="flex-1 mx-auto max-w-7xl px-4 sm:px-6 py-10 w-full space-y-10">
        {/* State A: Loading Skeleton */}
        {isLoading && (
          <div className="h-72 rounded-3xl border border-zinc-800 bg-zinc-900/40 animate-pulse flex items-center justify-center text-zinc-600 text-sm">
            Initializing workspace...
          </div>
        )}

        {/* State B: Authenticated User Role-Specific Dashboard */}
        {!isLoading && isAuthenticated && user && (
          <div className="space-y-8">
            {/* Personalized Role Greeting Banner */}
            <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 p-7 sm:p-10 shadow-2xl">
              <div className="absolute right-0 top-0 -mr-20 -mt-20 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
              
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                      {user.role === UserRole.BUYER
                        ? "Procurement & Buyer Workspace"
                        : user.role === UserRole.VENDOR
                        ? "Supplier & Bidding Workspace"
                        : "Platform Administration"}
                    </span>
                    <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] font-mono text-zinc-400 uppercase">
                      {user.role}
                    </span>
                  </div>

                  <h1 className="mt-4 text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                    Welcome back, {user.first_name || user.email.split("@")[0]}
                  </h1>
                  <p className="mt-2 text-sm text-zinc-400 max-w-2xl leading-relaxed">
                    {user.role === UserRole.BUYER
                      ? "Manage your procurement requirements, evaluate side-by-side vendor quotes, and award contracts with confidence."
                      : user.role === UserRole.VENDOR
                      ? "Discover published requests for quotation, price line items with sealed bidding privacy, and track proposal awards."
                      : "Oversee system accounts, manage platform RFQ lifecycles, and enforce compliance across the marketplace."}
                  </p>
                </div>

                {/* Quick Header CTA */}
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  {user.role === UserRole.BUYER && (
                    <Link
                      href="/rfqs/create"
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all hover:scale-[1.02]"
                    >
                      <PlusCircle className="h-4 w-4" />
                      <span>New Sourcing Request</span>
                    </Link>
                  )}
                  {user.role === UserRole.VENDOR && (
                    <Link
                      href="/rfqs"
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all hover:scale-[1.02]"
                    >
                      <Briefcase className="h-4 w-4" />
                      <span>Browse Opportunities</span>
                    </Link>
                  )}
                  {user.role === UserRole.ADMIN && (
                    <Link
                      href="/admin"
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all hover:scale-[1.02]"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      <span>Admin Control Center</span>
                    </Link>
                  )}
                </div>
              </div>

              {/* Dynamic Stats Strip */}
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-zinc-800/80">
                {user.role === UserRole.BUYER && (
                  <>
                    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4">
                      <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        My Total Sourcing Requests
                      </div>
                      <div className="mt-2 text-2xl font-black text-white">
                        {buyerStats.totalMyRfqs}
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-500">
                        Total RFQs created by your team
                      </div>
                    </div>
                    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4">
                      <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        Live in Marketplace
                      </div>
                      <div className="mt-2 text-2xl font-black text-indigo-400">
                        {buyerStats.publishedRfqs}
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-500">
                        Open for vendor bidding
                      </div>
                    </div>
                    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4">
                      <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        Draft Requests
                      </div>
                      <div className="mt-2 text-2xl font-black text-amber-400">
                        {buyerStats.draftRfqs}
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-500">
                        Pending specification & publishing
                      </div>
                    </div>
                  </>
                )}

                {user.role === UserRole.VENDOR && (
                  <>
                    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4">
                      <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        Open Marketplace RFQs
                      </div>
                      <div className="mt-2 text-2xl font-black text-white">
                        {vendorStats.totalOpenRfqs}
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-500">
                        Available opportunities to bid on
                      </div>
                    </div>
                    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4">
                      <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        My Submitted Proposals
                      </div>
                      <div className="mt-2 text-2xl font-black text-emerald-400">
                        {vendorStats.myQuotesCount}
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-500">
                        Sealed quotations delivered
                      </div>
                    </div>
                    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4">
                      <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        Shortlisted / Won
                      </div>
                      <div className="mt-2 text-2xl font-black text-indigo-400">
                        {vendorStats.shortlistedQuotes}
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-500">
                        Proposals favored by buyers
                      </div>
                    </div>
                  </>
                )}

                {user.role === UserRole.ADMIN && (
                  <>
                    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4">
                      <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        Registered Accounts
                      </div>
                      <div className="mt-2 text-2xl font-black text-white">
                        {adminStats.totalUsers}
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-500">
                        Buyers, suppliers, and admins
                      </div>
                    </div>
                    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4">
                      <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        Total Platform RFQs
                      </div>
                      <div className="mt-2 text-2xl font-black text-sky-400">
                        {adminStats.totalRfqs}
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-500">
                        Across all categories & states
                      </div>
                    </div>
                    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-4">
                      <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        Security Status
                      </div>
                      <div className="mt-2 text-xl font-bold text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="h-5 w-5" />
                        <span>Enforced</span>
                      </div>
                      <div className="mt-1 text-[11px] text-zinc-500">
                        HttpOnly Auth & RBAC Isolation
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Role Action Shortcuts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {user.role === UserRole.BUYER && (
                <>
                  <Link
                    href="/rfqs?tab=my"
                    className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition-all hover:border-indigo-500/40 hover:bg-zinc-900 shadow-lg"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20 group-hover:scale-110 transition-transform">
                      <Layers className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
                      My Sourcing Requests
                    </h3>
                    <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                      Review drafts, monitor incoming supplier quotations, and manage live RFQs.
                    </p>
                    <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-indigo-400">
                      <span>Open Workspace</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </Link>

                  <Link
                    href="/rfqs/create"
                    className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition-all hover:border-indigo-500/40 hover:bg-zinc-900 shadow-lg"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20 group-hover:scale-110 transition-transform">
                      <PlusCircle className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-base font-bold text-white group-hover:text-sky-300 transition-colors">
                      Create Sourcing Request
                    </h3>
                    <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                      Define bill-of-materials, delivery parameters, target budgets, and technical specs.
                    </p>
                    <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-sky-400">
                      <span>Start Request</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </Link>

                  {/* <Link
                    href="/assets"
                    className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition-all hover:border-indigo-500/40 hover:bg-zinc-900 shadow-lg"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 group-hover:scale-110 transition-transform">
                      <FolderArchive className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                      Document Repository
                    </h3>
                    <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                      Securely store engineering drawings, BOQ spreadsheets, and compliance certificates.
                    </p>
                    <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                      <span>View Files</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </Link> */}
                </>
              )}

              {user.role === UserRole.VENDOR && (
                <>
                  <Link
                    href="/rfqs"
                    className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition-all hover:border-indigo-500/40 hover:bg-zinc-900 shadow-lg"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20 group-hover:scale-110 transition-transform">
                      <Briefcase className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
                      Browse RFQ Marketplace
                    </h3>
                    <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                      Filter live procurement opportunities across categories and delivery regions.
                    </p>
                    <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-indigo-400">
                      <span>Find RFQs</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </Link>

                  <Link
                    href="/quotes/my"
                    className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition-all hover:border-indigo-500/40 hover:bg-zinc-900 shadow-lg"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 group-hover:scale-110 transition-transform">
                      <FileText className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                      My Submitted Quotations
                    </h3>
                    <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                      Track proposal evaluations, revise pricing before deadlines, and view award outcomes.
                    </p>
                    <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                      <span>Track Quotes</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </Link>

                  {/* <Link
                    href="/assets"
                    className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition-all hover:border-indigo-500/40 hover:bg-zinc-900 shadow-lg"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20 group-hover:scale-110 transition-transform">
                      <FolderArchive className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-base font-bold text-white group-hover:text-sky-300 transition-colors">
                      Technical Documents
                    </h3>
                    <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                      Upload catalog specs, supplier certificates, and compliance documentation.
                    </p>
                    <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-sky-400">
                      <span>Manage Files</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </Link> */}
                </>
              )}

              {user.role === UserRole.ADMIN && (
                <>
                  <Link
                    href="/admin"
                    className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition-all hover:border-indigo-500/40 hover:bg-zinc-900 shadow-lg"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20 group-hover:scale-110 transition-transform">
                      <UserCheck className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-base font-bold text-white group-hover:text-purple-300 transition-colors">
                      User Management
                    </h3>
                    <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                      Provision enterprise accounts, assign Buyer / Vendor roles, and enforce account security.
                    </p>
                    <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-purple-400">
                      <span>Open Users</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </Link>

                  <Link
                    href="/admin"
                    className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition-all hover:border-indigo-500/40 hover:bg-zinc-900 shadow-lg"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20 group-hover:scale-110 transition-transform">
                      <Layers className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
                      RFQ Oversight
                    </h3>
                    <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                      Monitor global sourcing activity, audit bidding statuses, and inspect proposal comparisons.
                    </p>
                    <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-indigo-400">
                      <span>Open Oversight</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </Link>

                  {/* <Link
                    href="/assets"
                    className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition-all hover:border-indigo-500/40 hover:bg-zinc-900 shadow-lg"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 group-hover:scale-110 transition-transform">
                      <FolderArchive className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                      Asset Repository
                    </h3>
                    <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                      Manage platform attachments, technical drawings, and user specification storage.
                    </p>
                    <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                      <span>View Assets</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </Link> */}
                </>
              )}
            </div>
          </div>
        )}

        {/* State C: Unauthenticated Landing Experience */}
        {!isLoading && !isAuthenticated && (
          <div className="space-y-12">
            {/* Hero Banner */}
            <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-950 p-8 md:p-14 shadow-2xl">
              <div className="absolute right-0 top-0 -mr-20 -mt-20 h-96 w-96 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />
              <div className="relative z-10 max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                  Enterprise Procurement & Quotation Architecture
                </div>
                <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl leading-[1.1]">
                  Intelligent B2B Sourcing & Sealed Bidding
                </h1>
                <p className="mt-5 text-base text-zinc-400 md:text-lg leading-relaxed max-w-2xl">
                  Empower buyers to publish granular itemized RFQs and evaluate side-by-side vendor quotes in real time. Vendors submit sealed pricing with zero bid leakage.
                </p>

                {/* Main CTAs */}
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-indigo-600/30 hover:bg-indigo-500 transition-all hover:scale-[1.02]"
                  >
                    <span>Sign In to Portal</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/80 px-6 py-3.5 text-sm font-semibold text-zinc-200 hover:bg-zinc-700 transition-all"
                  >
                    <span>Create Free Account</span>
                  </Link>
                  <Link
                    href="/rfqs"
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-5 py-3.5 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                  >
                    <Briefcase className="h-4 w-4 text-zinc-400" />
                    <span>Explore RFQ Marketplace</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Core Capability Pillars */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20">
                  <Lock className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-bold text-white">
                  Sealed Bidding Privacy
                </h3>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  Supplier proposals and line-item prices remain strictly sealed until the buyer evaluation phase. Zero data leakage between competing vendors.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20">
                  <Layers className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-bold text-white">
                  Side-by-Side Matrix
                </h3>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  Evaluate quotes across unit prices, delivery commitments, and line-item variances. Shortlist preferred vendors and award contracts in one click.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
                  <FolderArchive className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-bold text-white">
                  Technical Asset Center
                </h3>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  Attach technical drawings, engineering specifications, and compliance standards directly into RFQ line items with secure presigned uploads.
                </p>
              </div>
            </div>

            {/* Enterprise Security Assurance Banner */}
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/20 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-zinc-400 text-xs">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-indigo-400 shrink-0" />
                <span>
                  Protected by HttpOnly JWT sessions, role-based capability boundaries, and immutable status audit trails.
                </span>
              </div>
              <div className="flex items-center gap-4 text-zinc-500">
                <span>Buyer Isolation</span>
                <span>•</span>
                <span>Vendor Sealed Bids</span>
                <span>•</span>
                <span>Audit Trail Logs</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
