"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { quoteApi } from "@/lib/api";
import { Quote, QuoteStatus } from "@/types/quote";
import { Navbar } from "@/components/navigation/navbar";
import { QuoteStatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Briefcase,
  Clock,
  DollarSign,
  Layers,
  ChevronLeft,
  ChevronRight,
  FileCheck,
  RefreshCw,
  Search,
  ExternalLink,
} from "lucide-react";

export default function MyQuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<QuoteStatus | "">("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    let ignore = false;
    async function loadQuotes() {
      try {
        const res = await quoteApi.listMy({
          page,
          limit: 10,
          status: statusFilter || undefined,
        });
        if (!ignore) {
          setQuotes(res.data || []);
          if (res.pagination) {
            setTotalPages(res.pagination.total_pages || 1);
            setTotalItems(res.pagination.total_items || 0);
          }
        }
      } catch {
        // Handled silently
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    loadQuotes();
    return () => {
      ignore = true;
    };
  }, [page, statusFilter]);

  const filteredQuotes = quotes.filter((q) => {
    if (!searchQuery.trim()) return true;
    const term = searchQuery.toLowerCase();
    return (
      q.rfq_id.toLowerCase().includes(term) ||
      (q.notes && q.notes.toLowerCase().includes(term))
    );
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-8">
        {/* Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                My Quotations & Bids
              </h1>
              <span className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 text-xs font-semibold text-indigo-400">
                {totalItems} Submitted
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              Track quotation evaluations, review line-item pricing versions, and revise proposals before deadlines.
            </p>
          </div>

          <Link
            href="/rfqs"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all w-fit"
          >
            <Briefcase className="h-4 w-4" />
            <span>Browse RFQ Marketplace</span>
          </Link>
        </div>

        {/* Filter and Search Bar */}
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setStatusFilter("");
                setPage(1);
              }}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                statusFilter === ""
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              All ({totalItems})
            </button>
            <button
              onClick={() => {
                setStatusFilter(QuoteStatus.SUBMITTED);
                setPage(1);
              }}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                statusFilter === QuoteStatus.SUBMITTED
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              Submitted
            </button>
            <button
              onClick={() => {
                setStatusFilter(QuoteStatus.SHORTLISTED);
                setPage(1);
              }}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                statusFilter === QuoteStatus.SHORTLISTED
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              Shortlisted
            </button>
            <button
              onClick={() => {
                setStatusFilter(QuoteStatus.ACCEPTED);
                setPage(1);
              }}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                statusFilter === QuoteStatus.ACCEPTED
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              Accepted / Won
            </button>
            <button
              onClick={() => {
                setStatusFilter(QuoteStatus.REJECTED);
                setPage(1);
              }}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                statusFilter === QuoteStatus.REJECTED
                  ? "bg-rose-600 text-white shadow-sm"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              Rejected
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by RFQ ID or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-1.5 pl-8 pr-3 text-xs text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Quotes List */}
        <div className="mt-6">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-3"
                >
                  <div className="flex justify-between">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          ) : filteredQuotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/20 p-12 text-center">
              <FileCheck className="h-12 w-12 text-zinc-500" />
              <h3 className="mt-4 text-base font-bold text-white">No Quotations Found</h3>
              <p className="mt-1 text-xs text-zinc-400 max-w-sm">
                {searchQuery
                  ? "No submitted quotes match your search filter."
                  : "You haven't submitted any quotations in this category yet. Explore open RFQs to submit sealed bids."}
              </p>
              <Link
                href="/rfqs"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg hover:bg-indigo-500 transition-all"
              >
                <span>Find RFQs to Bid On</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredQuotes.map((quote) => {
                const isRevisable =
                  quote.status !== QuoteStatus.ACCEPTED &&
                  quote.status !== QuoteStatus.REJECTED;

                return (
                  <div
                    key={quote.id}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-lg hover:border-zinc-700 transition-all"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-[11px] font-mono text-zinc-300">
                          Proposal v{quote.version}
                        </span>
                        <QuoteStatusBadge status={quote.status} />
                        <span className="text-xs text-zinc-400">
                          Submitted on {new Date(quote.created_at).toLocaleDateString()}
                        </span>
                        <span className="font-mono text-[10px] text-zinc-400">
                          RFQ ID: {quote.rfq_id.slice(0, 8)}...
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-6 text-sm pt-1">
                        <div className="flex items-center gap-1.5 font-extrabold text-emerald-400 text-base">
                          <DollarSign className="h-4 w-4" />
                          <span>
                            ${Number(quote.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                          <Clock className="h-3.5 w-3.5 text-zinc-400" />
                          <span>{quote.delivery_days} days committed delivery</span>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                          <Layers className="h-3.5 w-3.5 text-zinc-400" />
                          <span>{quote.items?.length || 0} line items quoted</span>
                        </div>
                      </div>

                      {quote.notes && (
                        <p className="text-xs text-zinc-400 italic line-clamp-1 bg-zinc-950/40 rounded-lg p-2 border border-zinc-800/40">
                          &ldquo;{quote.notes}&rdquo;
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {isRevisable && (
                        <Link
                          href={`/rfqs/${quote.rfq_id}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-600/15 px-3.5 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-600/25 transition-colors shadow-sm"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span>Revise Proposal</span>
                        </Link>
                      )}

                      <Link
                        href={`/rfqs/${quote.rfq_id}`}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition-colors"
                      >
                        <span>View RFQ</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
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
