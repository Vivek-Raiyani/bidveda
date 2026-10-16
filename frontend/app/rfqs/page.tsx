"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { rfqApi } from "@/lib/api";
import { RFQListItem, RFQStatus, RFQFilterParams } from "@/types/rfq";
import { UserRole } from "@/types/permissions";
import { Navbar } from "@/components/navigation/navbar";
import { RFQStatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  PlusCircle,
  MapPin,
  Layers,
  DollarSign,
  FileText,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

function RFQListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const tabParam = searchParams.get("tab") || "all";
  const [activeTab, setActiveTab] = useState<"all" | "my">(
    tabParam === "my" ? "my" : "all"
  );

  useEffect(() => {
    if (tabParam === "my") {
      setActiveTab("my");
    } else if (tabParam === "all") {
      setActiveTab("all");
    }
  }, [tabParam]);

  const [rfqs, setRfqs] = useState<RFQListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [statusFilter, setStatusFilter] = useState<RFQStatus | "">("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const isBuyerOrAdmin =
    user?.role === UserRole.BUYER || user?.role === UserRole.ADMIN;

  const [searchTrigger, setSearchTrigger] = useState(0);

  useEffect(() => {
    let ignore = false;
    async function loadRFQs() {
      setError(null);
      try {
        const params: RFQFilterParams = {
          page,
          limit: 9,
        };
        if (searchQuery.trim()) params.q = searchQuery.trim();
        if (category.trim()) params.category = category.trim();
        if (deliveryLocation.trim())
          params.delivery_location = deliveryLocation.trim();
        if (statusFilter) params.status = statusFilter;

        const res =
          activeTab === "my" && isBuyerOrAdmin
            ? await rfqApi.listMy(params)
            : await rfqApi.list(params);

        if (!ignore) {
          setRfqs(res.data || []);
          if (res.pagination) {
            setTotalPages(res.pagination.total_pages || 1);
            setTotalItems(res.pagination.total_items || 0);
          }
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : "Failed to load RFQs";
          setError(msg);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadRFQs();
    return () => {
      ignore = true;
    };
  }, [
    activeTab,
    isBuyerOrAdmin,
    page,
    searchQuery,
    category,
    deliveryLocation,
    statusFilter,
    searchTrigger,
  ]);

  const handleTabChange = (tab: "all" | "my") => {
    setActiveTab(tab);
    setPage(1);
    router.replace(`/rfqs?tab=${tab}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearchTrigger((t) => t + 1);
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setCategory("");
    setDeliveryLocation("");
    setStatusFilter("");
    setPage(1);
  };

  const categories = [
    "Industrial Machinery",
    "Office Supplies & IT",
    "Raw Materials",
    "Construction & Hardware",
    "Logistics & Packaging",
    "Electrical & Electronics",
    "Safety & Maintenance",
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-8">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                RFQ Marketplace
              </h1>
              <span className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 text-xs font-semibold text-indigo-400">
                {totalItems} Requests
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              Browse enterprise procurement opportunities, submit competitive quotes, or track your sourcing.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isBuyerOrAdmin && (
              <Link
                href="/rfqs/create"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all hover:scale-[1.02]"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Create New RFQ</span>
              </Link>
            )}
          </div>
        </div>

        {/* Tab & Filter Bar */}
        <div className="mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Tabs */}
            <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-zinc-800 w-fit">
              <button
                onClick={() => handleTabChange("all")}
                className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  activeTab === "all"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                All Opportunities
              </button>
              {isBuyerOrAdmin && (
                <button
                  onClick={() => handleTabChange("my")}
                  className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    activeTab === "my"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  My Sourcing Requests
                </button>
              )}
            </div>

            {/* Quick search input */}
            <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search RFQs by keyword or title..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 py-2 pl-10 pr-20 text-sm text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700"
              >
                Filter
              </button>
            </form>
          </div>

          {/* Extended Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                Delivery Location
              </label>
              <input
                type="text"
                value={deliveryLocation}
                onChange={(e) => {
                  setDeliveryLocation(e.target.value);
                  setPage(1);
                }}
                placeholder="e.g. Mumbai, Berlin..."
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as RFQStatus);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 focus:border-indigo-500 focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
                <option value="awarded">Awarded</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleResetFilters}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-800/60 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mt-6 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-400">
            {error}
          </div>
        )}

        {/* RFQ Cards Grid */}
        <div className="mt-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5 space-y-4"
                >
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-6 w-3/4" />
                  <div className="space-y-2 pt-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : rfqs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/20 p-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20">
                <FileText className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-white">
                No RFQs found
              </h3>
              <p className="mt-1 max-w-sm text-sm text-zinc-400">
                {activeTab === "my"
                  ? "You haven't created any RFQs yet. Draft your first request for quotation."
                  : "No procurement requests match your current search criteria."}
              </p>
              {isBuyerOrAdmin && (
                <Link
                  href="/rfqs/create"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-indigo-500 transition-all"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>Create RFQ</span>
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {rfqs.map((rfq) => {
                const deadlineDate = new Date(rfq.deadline);
                const isExpired = deadlineDate.getTime() < now;

                return (
                  <Link
                    key={rfq.id}
                    href={`/rfqs/${rfq.id}`}
                    className="group relative flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-lg backdrop-blur-md transition-all duration-200 hover:border-indigo-500/40 hover:bg-zinc-900 hover:shadow-indigo-500/5 hover:-translate-y-0.5"
                  >
                    <div>
                      {/* Top Meta */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400 truncate max-w-[150px]">
                          {rfq.category}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {rfq.status === "draft" && (
                            <span className="rounded-md bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                              Draft
                            </span>
                          )}
                          <RFQStatusBadge status={rfq.status} />
                        </div>
                      </div>

                      {/* Title */}
                      <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-2">
                        {rfq.title}
                      </h3>

                      {/* Details & Specifications */}
                      <div className="mt-4 space-y-2 border-t border-zinc-800/80 pt-3 text-xs text-zinc-400">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                          <span className="truncate">{rfq.delivery_location}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Layers className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                          <span>{rfq.items_count} Line Item{rfq.items_count === 1 ? "" : "s"}</span>
                        </div>

                        {rfq.budget !== null && rfq.budget !== undefined && (
                          <div className="flex items-center gap-2 text-zinc-300 font-medium">
                            <DollarSign className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                            <span>
                              Budget: ${Number(rfq.budget).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Status & Deadline */}
                    <div className="mt-5 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-zinc-400">
                        <Clock className={`h-3.5 w-3.5 ${isExpired ? "text-rose-400" : "text-amber-400"}`} />
                        <span className={isExpired ? "text-rose-400" : "text-zinc-300"}>
                          {isExpired ? "Deadline Expired" : `Due ${deadlineDate.toLocaleDateString()}`}
                        </span>
                      </div>

                      {rfq.quotes_count !== undefined && rfq.quotes_count !== null && (
                        <div className="rounded-md bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-300">
                          {rfq.quotes_count} {rfq.quotes_count === 1 ? "quote" : "quotes"}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between border-t border-zinc-800 pt-4 text-xs text-zinc-400">
            <span>
              Page {page} of {totalPages} ({totalItems} items)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Prev</span>
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function RFQListPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
          <Navbar />
          <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-8 space-y-6">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Skeleton className="h-48 w-full rounded-2xl" />
              <Skeleton className="h-48 w-full rounded-2xl" />
              <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
          </main>
        </div>
      }
    >
      <RFQListContent />
    </Suspense>
  );
}
