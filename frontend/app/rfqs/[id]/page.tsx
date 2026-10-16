"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { rfqApi, quoteApi } from "@/lib/api";
import { RFQ, StatusHistoryItem, RFQLineItemCreate } from "@/types/rfq";
import {
  Quote,
  RFQComparisonView,
  ComparisonQuoteColumn,
  QuoteItemCreate,
} from "@/types/quote";
import { UserRole } from "@/types/permissions";
import { Navbar } from "@/components/navigation/navbar";
import { RFQStatusBadge, QuoteStatusBadge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { FileUpload } from "@/components/ui/file-upload";
import {
  parseDescriptionAndAttachment,
  formatDescriptionWithAttachment,
  downloadFile,
  ParsedAttachment,
} from "@/lib/attachments";
import {
  ArrowLeft,
  Clock,
  DollarSign,
  Send,
  Award,
  Star,
  CheckCircle2,
  AlertTriangle,
  History,
  Layers,
  FileCheck,
  Building,
  RefreshCw,
  Loader2,
  Pencil,
  Download,
  ExternalLink,
  FileText,
  MapPin,
  Calendar,
  AlertCircle,
  Plus,
  Trash2,
  Paperclip,
  Save,
} from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

const DEFAULT_CATEGORIES = [
  "IT Hardware",
  "Office Supplies",
  "Industrial Machinery",
  "Office Supplies & IT",
  "Raw Materials",
  "Construction & Hardware",
  "Logistics & Packaging",
  "Electrical & Electronics",
  "Safety & Maintenance",
];

function toDatetimeLocalValue(isoString: string): string {
  try {
    const d = new Date(isoString);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  } catch {
    return "";
  }
}

export default function RFQDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const rfqId = resolvedParams.id;
  const { user } = useAuth();
  const { toast } = useToast();

  const [rfq, setRfq] = useState<RFQ | null>(null);
  const [comparison, setComparison] = useState<RFQComparisonView | null>(null);
  const [history, setHistory] = useState<StatusHistoryItem[]>([]);
  const [myQuote, setMyQuote] = useState<Quote | null>(null);
  const [now] = useState(() => Date.now());
  const [dataVersion, setDataVersion] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "comparison" | "history">("details");

  // Vendor Action Modals
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isReviseModalOpen, setIsReviseModalOpen] = useState(false);

  // Buyer Action Modals
  const [isAwardModalOpen, setIsAwardModalOpen] = useState(false);
  const [selectedAwardQuote, setSelectedAwardQuote] = useState<ComparisonQuoteColumn | null>(null);
  const [awardNotes, setAwardNotes] = useState("");

  // Edit RFQ Modal (Buyer - Draft State)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDeliveryLocation, setEditDeliveryLocation] = useState("");
  const [editBudget, setEditBudget] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAttachment, setEditAttachment] = useState<ParsedAttachment | null>(null);
  const [editLineItems, setEditLineItems] = useState<RFQLineItemCreate[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Quote form state (for vendors)
  const [quoteDeliveryDays, setQuoteDeliveryDays] = useState<number>(7);
  const [quoteNotes, setQuoteNotes] = useState<string>("");
  const [quotePrices, setQuotePrices] = useState<Record<string, number>>({});
  const [isActionLoading, setIsActionLoading] = useState(false);

  const isVendor = user?.role === UserRole.VENDOR;
  const isAdmin = user?.role === UserRole.ADMIN;
  const isOwner = user?.id === rfq?.buyer_id || isAdmin;

  const refreshData = () => setDataVersion((v) => v + 1);

  // Load RFQ and relevant quote data
  useEffect(() => {
    let ignore = false;
    async function loadRFQData() {
      try {
        const res = await rfqApi.getById(rfqId);
        if (ignore) return;
        setRfq(res.data);

        // Initialize quote prices map if empty
        if (res.data.line_items) {
          const initialPrices: Record<string, number> = {};
          res.data.line_items.forEach((item) => {
            initialPrices[item.id] = 0;
          });
          setQuotePrices(initialPrices);
        }

        // If buyer or admin, load comparison & history
        if (user?.role === UserRole.BUYER || user?.role === UserRole.ADMIN) {
          try {
            const compRes = await rfqApi.getComparison(rfqId);
            if (!ignore) setComparison(compRes.data);
          } catch {
            // May fail if DRAFT or no permission
          }
        }

        // If vendor, check if vendor has submitted a quote for this RFQ
        if (user?.role === UserRole.VENDOR) {
          try {
            const myQuotesRes = await quoteApi.listMy({ limit: 50 });
            const match = myQuotesRes.data.find((q) => q.rfq_id === rfqId);
            if (match && !ignore) {
              setMyQuote(match);
              // Pre-populate revision state
              setQuoteDeliveryDays(match.delivery_days);
              setQuoteNotes(match.notes || "");
              const revPrices: Record<string, number> = {};
              match.items.forEach((it) => {
                revPrices[it.line_item_id] = Number(it.unit_price);
              });
              setQuotePrices(revPrices);
            }
          } catch {
            // Ignore
          }
        }

        // Load status history
        try {
          const histRes = await rfqApi.getHistory(rfqId);
          if (!ignore) setHistory(histRes.data || []);
        } catch {
          // Ignore
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : "Failed to load RFQ";
          setError(msg);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadRFQData();
    return () => {
      ignore = true;
    };
  }, [rfqId, user, dataVersion]);

  // Open Edit RFQ Modal and pre-populate form
  const handleOpenEditModal = () => {
    if (!rfq) return;
    const parsed = parseDescriptionAndAttachment(rfq.description);

    setEditTitle(rfq.title);
    setEditCategory(rfq.category);
    setEditDeliveryLocation(rfq.delivery_location);
    setEditBudget(rfq.budget !== null && rfq.budget !== undefined ? String(rfq.budget) : "");
    setEditDeadline(toDatetimeLocalValue(rfq.deadline));
    setEditDescription(parsed.cleanDescription);
    setEditAttachment(parsed.attachment);
    setEditLineItems(
      rfq.line_items.map((it) => ({
        name: it.name,
        quantity: Number(it.quantity),
        unit: it.unit,
      }))
    );
    setIsEditModalOpen(true);
  };

  // Save RFQ Edits (Buyer - Draft State)
  const handleSaveRFQEdit = async () => {
    if (!rfq) return;

    if (!editTitle.trim()) {
      toast({ title: "Validation Error", description: "Title is required.", variant: "destructive" });
      return;
    }
    if (!editCategory.trim()) {
      toast({ title: "Validation Error", description: "Category is required.", variant: "destructive" });
      return;
    }
    if (!editDeliveryLocation.trim()) {
      toast({ title: "Validation Error", description: "Delivery location is required.", variant: "destructive" });
      return;
    }
    if (!editDeadline) {
      toast({ title: "Validation Error", description: "Deadline is required.", variant: "destructive" });
      return;
    }

    const deadlineDate = new Date(editDeadline);
    if (deadlineDate.getTime() <= Date.now()) {
      toast({ title: "Validation Error", description: "Deadline must be a future date and time.", variant: "destructive" });
      return;
    }

    if (editLineItems.length === 0) {
      toast({ title: "Validation Error", description: "At least one line item is required.", variant: "destructive" });
      return;
    }

    for (const item of editLineItems) {
      if (!item.name.trim()) {
        toast({ title: "Validation Error", description: "Each line item must have a name/description.", variant: "destructive" });
        return;
      }
      if (Number(item.quantity) <= 0) {
        toast({ title: "Validation Error", description: "Line item quantities must be greater than 0.", variant: "destructive" });
        return;
      }
    }

    setIsSavingEdit(true);
    try {
      const fullDescription = formatDescriptionWithAttachment(
        editDescription,
        editAttachment ? { name: editAttachment.name, url: editAttachment.url } : null
      );

      const payload = {
        title: editTitle.trim(),
        description: fullDescription || undefined,
        category: editCategory.trim(),
        delivery_location: editDeliveryLocation.trim(),
        budget: editBudget ? parseFloat(editBudget) : undefined,
        deadline: deadlineDate.toISOString(),
        line_items: editLineItems.map((it) => ({
          name: it.name.trim(),
          quantity: Number(it.quantity),
          unit: it.unit.trim() || "units",
        })),
      };

      const res = await rfqApi.update(rfq.id, payload);
      setRfq(res.data);
      setIsEditModalOpen(false);
      toast({
        title: "RFQ Updated",
        description: "Your draft RFQ specifications have been saved successfully.",
        variant: "success",
      });
      refreshData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update RFQ";
      toast({ title: "Update Failed", description: msg, variant: "destructive" });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Publish Draft RFQ
  const handlePublish = async () => {
    if (!rfq) return;
    setIsActionLoading(true);
    try {
      const res = await rfqApi.publish(rfq.id);
      setRfq(res.data);
      toast({
        title: "RFQ Published",
        description: "Your RFQ is now live in the marketplace for vendors.",
        variant: "success",
      });
      refreshData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to publish RFQ";
      toast({ title: "Publish Failed", description: msg, variant: "destructive" });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Submit Initial Quote (Vendor)
  const handleSubmitQuote = async () => {
    if (!rfq) return;
    if (quoteDeliveryDays <= 0) {
      toast({ title: "Validation Error", description: "Delivery days must be greater than 0.", variant: "destructive" });
      return;
    }

    const items: QuoteItemCreate[] = rfq.line_items.map((item) => ({
      line_item_id: item.id,
      unit_price: quotePrices[item.id] || 0,
    }));

    if (items.some((it) => it.unit_price <= 0)) {
      toast({ title: "Validation Error", description: "All line items must have a unit price greater than 0.", variant: "destructive" });
      return;
    }

    setIsActionLoading(true);
    try {
      const res = await quoteApi.submit(rfq.id, {
        delivery_days: Number(quoteDeliveryDays),
        notes: quoteNotes.trim() || undefined,
        items,
      });
      setMyQuote(res.data);
      setIsSubmitModalOpen(false);
      toast({
        title: "Quote Submitted",
        description: "Your quotation has been securely submitted to the buyer.",
        variant: "success",
      });
      refreshData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit quote";
      toast({ title: "Submission Failed", description: msg, variant: "destructive" });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Revise Quote (Vendor)
  const handleReviseQuote = async () => {
    if (!myQuote || !rfq) return;
    if (quoteDeliveryDays <= 0) {
      toast({ title: "Validation Error", description: "Delivery days must be greater than 0.", variant: "destructive" });
      return;
    }

    const items: QuoteItemCreate[] = rfq.line_items.map((item) => ({
      line_item_id: item.id,
      unit_price: quotePrices[item.id] || 0,
    }));

    if (items.some((it) => it.unit_price <= 0)) {
      toast({ title: "Validation Error", description: "All line items must have a unit price greater than 0.", variant: "destructive" });
      return;
    }

    setIsActionLoading(true);
    try {
      const res = await quoteApi.revise(myQuote.id, {
        delivery_days: Number(quoteDeliveryDays),
        notes: quoteNotes.trim() || undefined,
        items,
      });
      setMyQuote(res.data);
      setIsReviseModalOpen(false);
      toast({
        title: "Quote Revised",
        description: `Version ${res.data.version} submitted successfully.`,
        variant: "success",
      });
      refreshData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to revise quote";
      toast({ title: "Revision Failed", description: msg, variant: "destructive" });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Shortlist a Quote (Buyer)
  const handleShortlistQuote = async (quoteId: string) => {
    try {
      await quoteApi.shortlist(quoteId, { notes: "Shortlisted via comparison matrix" });
      toast({
        title: "Quote Shortlisted",
        description: "The quote status was marked as Shortlisted.",
        variant: "success",
      });
      refreshData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to shortlist quote";
      toast({ title: "Action Failed", description: msg, variant: "destructive" });
    }
  };

  // Award RFQ to Winning Quote (Buyer)
  const handleAwardRFQ = async () => {
    if (!selectedAwardQuote || !rfq) return;
    setIsActionLoading(true);
    try {
      const res = await rfqApi.award(rfq.id, {
        quote_id: selectedAwardQuote.quote_id,
        notes: awardNotes.trim() || undefined,
      });
      setIsAwardModalOpen(false);
      toast({
        title: "RFQ Successfully Awarded!",
        description: res.data.message || "Winning quote accepted and contract confirmed.",
        variant: "success",
      });
      refreshData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to award RFQ";
      toast({ title: "Award Failed", description: msg, variant: "destructive" });
    } finally {
      setIsActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
        <Navbar />
        <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-8 space-y-6">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </main>
      </div>
    );
  }

  if (error || !rfq) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md text-center p-8 rounded-2xl border border-zinc-800 bg-zinc-900/60">
            <AlertTriangle className="h-10 w-10 text-rose-400 mx-auto" />
            <h2 className="mt-3 text-lg font-bold text-white">Error Loading RFQ</h2>
            <p className="mt-2 text-sm text-zinc-400">{error || "RFQ not found"}</p>
            <Link
              href="/rfqs"
              className="mt-6 inline-block rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white"
            >
              Back to Marketplace
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const deadlineDate = new Date(rfq.deadline);
  const isDeadlinePassed = deadlineDate.getTime() < now;
  const canSubmitQuote =
    isVendor &&
    rfq.status === "published" &&
    !isDeadlinePassed &&
    !myQuote;
  const canReviseQuote =
    isVendor &&
    rfq.status === "published" &&
    !isDeadlinePassed &&
    !!myQuote &&
    myQuote.status !== "accepted" &&
    myQuote.status !== "rejected";

  // Calculate quote preview total
  const calculatedQuoteTotal = rfq.line_items.reduce((acc, item) => {
    const price = quotePrices[item.id] || 0;
    return acc + price * Number(item.quantity);
  }, 0);

  // Parse description and attachment cleanly
  const { cleanDescription, attachment } = parseDescriptionAndAttachment(rfq.description);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
        {/* Navigation & Actions Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <Link
            href="/rfqs"
            className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors w-fit"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to RFQs</span>
          </Link>

          <div className="flex items-center gap-2.5">
            {/* Draft Owner Actions: Edit RFQ & Publish RFQ */}
            {isOwner && rfq.status === "draft" && (
              <>
                <button
                  type="button"
                  onClick={handleOpenEditModal}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 hover:text-white transition-all shadow-sm"
                >
                  <Pencil className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Edit RFQ</span>
                </button>

                <button
                  type="button"
                  disabled={isActionLoading}
                  onClick={handlePublish}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all disabled:opacity-50"
                >
                  {isActionLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  <span>Publish RFQ</span>
                </button>
              </>
            )}

            {/* Vendor Quote Action Buttons */}
            {canSubmitQuote && (
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition-all"
              >
                <FileCheck className="h-4 w-4" />
                <span>Submit Quotation</span>
              </button>
            )}

            {canReviseQuote && (
              <button
                type="button"
                onClick={() => setIsReviseModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Revise Quote (v{myQuote.version})</span>
              </button>
            )}
          </div>
        </div>

        {/* Draft Notice Banner (for Buyer) */}
        {isOwner && rfq.status === "draft" && (
          <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-200">
                  Draft Mode — Visible Only to You
                </h4>
                <p className="text-xs text-amber-300/80 mt-0.5">
                  You can edit line items, budget, deadline, and attached files before publishing to suppliers.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleOpenEditModal}
                className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 transition-colors"
              >
                Edit RFQ
              </button>
              <button
                type="button"
                disabled={isActionLoading}
                onClick={handlePublish}
                className="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors disabled:opacity-50"
              >
                Publish Now
              </button>
            </div>
          </div>
        )}

        {/* Clean RFQ Details Card */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-7 shadow-xl">
          {/* Top badges & Title */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-indigo-400">
                {rfq.category}
              </span>
              <RFQStatusBadge status={rfq.status} />
              {rfq.buyer_name && (
                <span className="text-xs text-zinc-400 flex items-center gap-1.5 ml-auto">
                  <Building className="h-3.5 w-3.5 text-zinc-500" />
                  <span>{rfq.buyer_name}</span>
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {rfq.title}
            </h1>
          </div>

          {/* Key Metrics Bar */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 border-y border-zinc-800/80 py-4">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 flex items-center gap-1">
                <DollarSign className="h-3 w-3 text-emerald-400" />
                Target Budget
              </span>
              <div className="text-sm font-bold text-white">
                {rfq.budget !== null && rfq.budget !== undefined
                  ? `$${Number(rfq.budget).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                  : "Unspecified"}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 flex items-center gap-1">
                <Calendar className="h-3 w-3 text-amber-400" />
                Submission Deadline
              </span>
              <div className={`text-sm font-bold ${isDeadlinePassed ? "text-rose-400" : "text-zinc-200"}`}>
                {deadlineDate.toLocaleDateString()}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 flex items-center gap-1">
                <MapPin className="h-3 w-3 text-indigo-400" />
                Delivery Location
              </span>
              <div className="text-sm font-bold text-zinc-200 truncate">
                {rfq.delivery_location}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 flex items-center gap-1">
                <Layers className="h-3 w-3 text-sky-400" />
                Line Items
              </span>
              <div className="text-sm font-bold text-zinc-200">
                {rfq.line_items.length} item{rfq.line_items.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          {/* Clean Description / Scope */}
          {cleanDescription ? (
            <div className="mt-5 text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
              {cleanDescription}
            </div>
          ) : (
            <p className="mt-5 text-xs text-zinc-500 italic">No additional scope description provided.</p>
          )}

          {/* Clean Specification Attachment Card */}
          {attachment && (
            <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white truncate max-w-sm sm:max-w-md">
                      {attachment.name}
                    </span>
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-300">
                      {attachment.extension}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Attached specification / procurement document
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => downloadFile(attachment.url, attachment.name)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </button>
                <a
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>View</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Vendor Submitted Quote Banner (if vendor submitted) */}
        {myQuote && (
          <div className="mt-6 rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-5 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <span className="text-sm font-bold text-white">
                    You have submitted a quote (Version {myQuote.version})
                  </span>
                  <QuoteStatusBadge status={myQuote.status} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-zinc-300">
                  <span>
                    Total Amount:{" "}
                    <strong className="text-white">
                      ${Number(myQuote.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </strong>
                  </span>
                  <span>
                    Delivery Time:{" "}
                    <strong className="text-white">{myQuote.delivery_days} days</strong>
                  </span>
                  <span>
                    Submitted:{" "}
                    <strong className="text-zinc-400">
                      {new Date(myQuote.created_at).toLocaleDateString()}
                    </strong>
                  </span>
                </div>
                {myQuote.notes && (
                  <p className="mt-2 text-xs text-zinc-400 italic">
                    &ldquo;{myQuote.notes}&rdquo;
                  </p>
                )}
              </div>

              {canReviseQuote && (
                <button
                  type="button"
                  onClick={() => setIsReviseModalOpen(true)}
                  className="rounded-xl border border-indigo-500/40 bg-indigo-600/20 px-3.5 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-600/30 transition-colors"
                >
                  Revise Before Deadline
                </button>
              )}
            </div>
          </div>
        )}

        {/* Clean Tabs */}
        <div className="mt-8 flex items-center gap-2 border-b border-zinc-800 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("details")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "details"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Line Items ({rfq.line_items.length})</span>
          </button>

          {isOwner && comparison && (
            <button
              type="button"
              onClick={() => setActiveTab("comparison")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "comparison"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Award className="h-4 w-4 text-amber-400" />
              <span>Quotes Matrix ({comparison.quotes.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "history"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <History className="h-4 w-4" />
            <span>Audit History ({history.length})</span>
          </button>
        </div>

        {/* Tab 1: Line Items Table */}
        {activeTab === "details" && (
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Required Bill of Materials & Quantities
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Items suppliers will bid against in their quotations.
                </p>
              </div>

              {isOwner && rfq.status === "draft" && (
                <button
                  type="button"
                  onClick={handleOpenEditModal}
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  <Pencil className="h-3 w-3" />
                  <span>Edit Line Items</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950/80 text-[10px] uppercase font-bold tracking-wider text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="py-3 px-4 w-12">#</th>
                    <th className="py-3 px-4">Item Description</th>
                    <th className="py-3 px-4 text-right">Quantity</th>
                    <th className="py-3 px-4">Unit of Measure</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {rfq.line_items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-zinc-500">{idx + 1}</td>
                      <td className="py-3 px-4 font-medium text-white">{item.name}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-zinc-200">
                        {Number(item.quantity).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-zinc-400">{item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Comparison Grid & Award Matrix (Buyers / Admins) */}
        {activeTab === "comparison" && comparison && (
          <div className="mt-6 space-y-6">
            {comparison.quotes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/20 p-12 text-center">
                <FileCheck className="h-10 w-10 text-zinc-500 mx-auto" />
                <h3 className="mt-3 text-base font-bold text-white">No Quotes Submitted Yet</h3>
                <p className="mt-1 text-xs text-zinc-400">
                  Vendors have not submitted any bids for this RFQ yet. Once quotes arrive, side-by-side evaluation will be displayed here.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-zinc-950/90 text-zinc-400 border-b border-zinc-800">
                      <tr>
                        <th className="py-4 px-4 sticky left-0 bg-zinc-950 z-10 w-64">
                          Specification / Line Item
                        </th>
                        {comparison.quotes.map((q) => (
                          <th key={q.quote_id} className="py-4 px-5 min-w-[220px]">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-white text-sm">
                                  {q.vendor_name}
                                </span>
                                <QuoteStatusBadge status={q.status} />
                              </div>
                              <div className="text-[11px] text-zinc-400 font-normal">
                                Version {q.version} • {q.delivery_days} days delivery
                              </div>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/70">
                      {/* Line items pricing rows */}
                      {comparison.line_items.map((lineItem) => (
                        <tr key={lineItem.id} className="hover:bg-zinc-800/20">
                          <td className="py-3 px-4 sticky left-0 bg-zinc-900/90 font-medium text-zinc-200">
                            <div>{lineItem.name}</div>
                            <div className="text-[10px] text-zinc-500">
                              {Number(lineItem.quantity)} {lineItem.unit}
                            </div>
                          </td>
                          {comparison.quotes.map((q) => {
                            const p = q.item_prices.find((ip) => ip.line_item_id === lineItem.id);
                            return (
                              <td key={q.quote_id} className="py-3 px-5">
                                {p ? (
                                  <div>
                                    <div className="font-bold text-white">
                                      ${Number(p.unit_price).toFixed(2)}{" "}
                                      <span className="text-[10px] font-normal text-zinc-500">
                                        / {p.unit}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-zinc-400">
                                      Total: ${Number(p.total_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-zinc-600">-</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}

                      {/* Total Amount Summary Row */}
                      <tr className="bg-zinc-950/60 font-bold border-t-2 border-zinc-800">
                        <td className="py-4 px-4 sticky left-0 bg-zinc-950 text-indigo-400 uppercase tracking-wider text-[11px]">
                          Grand Total
                        </td>
                        {comparison.quotes.map((q) => (
                          <td key={q.quote_id} className="py-4 px-5">
                            <span className="text-base text-emerald-400">
                              ${Number(q.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                        ))}
                      </tr>

                      {/* Action Row */}
                      <tr className="bg-zinc-950/40">
                        <td className="py-4 px-4 sticky left-0 bg-zinc-950 text-zinc-400 text-xs">
                          Evaluation Actions
                        </td>
                        {comparison.quotes.map((q) => {
                          const isAwardable =
                            (rfq.status === "published" || rfq.status === "closed") &&
                            q.status !== "accepted" &&
                            q.status !== "rejected";

                          return (
                            <td key={q.quote_id} className="py-4 px-5">
                              <div className="flex flex-col gap-2">
                                {q.status !== "shortlisted" && q.status !== "accepted" && (
                                  <button
                                    type="button"
                                    onClick={() => handleShortlistQuote(q.quote_id)}
                                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 hover:bg-zinc-700 transition-colors"
                                  >
                                    <Star className="h-3.5 w-3.5 text-amber-400" />
                                    <span>Shortlist</span>
                                  </button>
                                )}

                                {isAwardable && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedAwardQuote(q);
                                      setIsAwardModalOpen(true);
                                    }}
                                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors"
                                  >
                                    <Award className="h-3.5 w-3.5" />
                                    <span>Award Contract</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Status History / Audit Trail */}
        {activeTab === "history" && (
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 shadow-xl">
            {history.length === 0 ? (
              <p className="text-center text-xs text-zinc-500 py-6">
                No status changes recorded for this request.
              </p>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-800">
                {history.map((h) => (
                  <div key={h.id} className="relative">
                    <div className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-zinc-900 bg-indigo-500 ring-2 ring-indigo-500/20" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white capitalize">
                          Transition to {h.to_status}
                        </span>
                        {h.from_status && (
                          <span className="text-[11px] text-zinc-500">
                            (from {h.from_status})
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        {new Date(h.created_at).toLocaleString()}
                        {h.changed_by_name && ` by ${h.changed_by_name}`}
                      </div>
                      {h.notes && (
                        <p className="mt-1 text-xs text-zinc-300 italic">
                          &ldquo;{h.notes}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Edit RFQ Modal (Buyer - Draft State) */}
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Draft RFQ"
          description="Update RFQ specifications, procurement timeline, line items, and attachments before publishing."
          maxWidth="2xl"
        >
          <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
            {/* Title */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                RFQ Title *
              </label>
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="e.g. IT Equipment for Bangalore Site"
                className="mt-1.5 block w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Category & Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Category *
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="mt-1.5 block w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  {Array.from(new Set([editCategory, ...DEFAULT_CATEGORIES])).filter(Boolean).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Delivery Location *
                </label>
                <input
                  type="text"
                  required
                  value={editDeliveryLocation}
                  onChange={(e) => setEditDeliveryLocation(e.target.value)}
                  placeholder="e.g. Bangalore, Site 4"
                  className="mt-1.5 block w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Budget & Deadline */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Estimated Budget (USD)
                </label>
                <div className="relative mt-1.5">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editBudget}
                    onChange={(e) => setEditBudget(e.target.value)}
                    placeholder="Optional budget"
                    className="block w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2 pl-7 pr-3 text-xs text-white placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Submission Deadline *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={editDeadline}
                  onChange={(e) => setEditDeadline(e.target.value)}
                  className="mt-1.5 block w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Description / Scope */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Scope / Requirements Description
              </label>
              <textarea
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Describe procurement requirements, warranty needs, delivery terms..."
                className="mt-1.5 block w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Attachment Management */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                Specification Document / Attachment
              </label>

              {editAttachment ? (
                <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Paperclip className="h-4 w-4 text-indigo-400 shrink-0" />
                    <span className="text-white font-medium truncate">{editAttachment.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditAttachment(null)}
                    className="text-xs text-rose-400 hover:text-rose-300 font-medium shrink-0 ml-3"
                  >
                    Remove File
                  </button>
                </div>
              ) : (
                <FileUpload
                  folder="rfq_attachments"
                  label="Upload New Specification Document"
                  onUploaded={(asset) => {
                    if (asset.url) {
                      setEditAttachment({
                        name: asset.filename,
                        url: asset.url,
                        extension: asset.filename.split(".").pop()?.toUpperCase() || "FILE",
                      });
                    }
                  }}
                  onRemoved={() => setEditAttachment(null)}
                />
              )}
            </div>

            {/* Line Items Editor */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Line Items ({editLineItems.length}) *
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setEditLineItems((prev) => [...prev, { name: "", quantity: 1, unit: "units" }])
                  }
                  className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Line Item</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {editLineItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-2.5 text-xs"
                  >
                    <input
                      type="text"
                      placeholder="Item name / specification"
                      required
                      value={item.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditLineItems((prev) =>
                          prev.map((it, i) => (i === idx ? { ...it, name: val } : it))
                        );
                      }}
                      className="flex-1 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                    />

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        required
                        value={item.quantity}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 1;
                          setEditLineItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, quantity: val } : it))
                          );
                        }}
                        className="w-20 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                      />

                      <input
                        type="text"
                        placeholder="Unit (e.g. units)"
                        required
                        value={item.unit}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditLineItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, unit: val } : it))
                          );
                        }}
                        className="w-24 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                      />

                      <button
                        type="button"
                        disabled={editLineItems.length <= 1}
                        onClick={() =>
                          setEditLineItems((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="p-1.5 text-zinc-500 hover:text-rose-400 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Remove line item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-xl border border-zinc-800 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingEdit}
                onClick={handleSaveRFQEdit}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-lg hover:bg-indigo-500 disabled:opacity-50"
              >
                {isSavingEdit ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </Modal>

        {/* Submit / Revise Quote Modal (Vendor) */}
        <Modal
          isOpen={isSubmitModalOpen || isReviseModalOpen}
          onClose={() => {
            setIsSubmitModalOpen(false);
            setIsReviseModalOpen(false);
          }}
          title={isReviseModalOpen ? `Revise Quote (v${(myQuote?.version || 1) + 1})` : "Submit Quotation"}
          description="Enter per-line-item pricing and committed delivery days for this RFQ."
          maxWidth="2xl"
        >
          <div className="space-y-5">
            {/* Delivery days */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Committed Delivery Timeline (Days) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={quoteDeliveryDays}
                  onChange={(e) => setQuoteDeliveryDays(parseInt(e.target.value) || 1)}
                  className="mt-1.5 block w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Total Quote Value (Estimated)
                </label>
                <div className="mt-1.5 flex h-9 items-center rounded-xl border border-zinc-800 bg-zinc-950/60 px-3.5 text-xs font-bold text-emerald-400">
                  ${calculatedQuoteTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Line items pricing inputs */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                Line Item Unit Prices *
              </label>
              <div className="max-h-60 overflow-y-auto space-y-2.5 pr-1">
                {rfq.line_items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3"
                  >
                    <div className="flex-1">
                      <div className="text-xs font-medium text-white">{item.name}</div>
                      <div className="text-[10px] text-zinc-500">
                        Required: {Number(item.quantity)} {item.unit}
                      </div>
                    </div>
                    <div className="w-36">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          value={quotePrices[item.id] || ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setQuotePrices((prev) => ({ ...prev, [item.id]: val }));
                          }}
                          placeholder="0.00"
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-1.5 pl-7 pr-3 text-xs text-white placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Vendor Notes & Terms (Optional)
              </label>
              <textarea
                rows={3}
                value={quoteNotes}
                onChange={(e) => setQuoteNotes(e.target.value)}
                placeholder="Include payment terms, warranty coverage, delivery incoterms..."
                className="mt-1.5 block w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setIsSubmitModalOpen(false);
                  setIsReviseModalOpen(false);
                }}
                className="rounded-xl border border-zinc-800 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isActionLoading}
                onClick={isReviseModalOpen ? handleReviseQuote : handleSubmitQuote}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-lg hover:bg-indigo-500 disabled:opacity-50"
              >
                {isActionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{isReviseModalOpen ? "Submit Revision" : "Confirm & Submit Quote"}</span>
              </button>
            </div>
          </div>
        </Modal>

        {/* Award Confirmation Modal (Buyer) */}
        <Modal
          isOpen={isAwardModalOpen}
          onClose={() => setIsAwardModalOpen(false)}
          title="Award Contract to Vendor"
          description="Finalize this procurement agreement and award the RFQ."
          maxWidth="md"
        >
          {selectedAwardQuote && (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-300 space-y-1">
                <div className="font-bold">Important Award Notice:</div>
                <p>
                  Awarding this RFQ will mark <strong>{selectedAwardQuote.vendor_name}</strong> as accepted, automatically reject other competing bids, and transition this RFQ to <strong>AWARDED</strong> status.
                </p>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Winning Vendor:</span>
                  <span className="font-bold text-white">{selectedAwardQuote.vendor_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Total Contract Value:</span>
                  <span className="font-bold text-emerald-400">
                    ${Number(selectedAwardQuote.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Delivery Period:</span>
                  <span className="font-bold text-white">{selectedAwardQuote.delivery_days} days</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Award Notes / Contract Reference
                </label>
                <textarea
                  rows={3}
                  value={awardNotes}
                  onChange={(e) => setAwardNotes(e.target.value)}
                  placeholder="e.g. Approved per Procurement Board resolution #204. PO to be issued shortly."
                  className="mt-1.5 block w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsAwardModalOpen(false)}
                  className="rounded-xl border border-zinc-800 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isActionLoading}
                  onClick={handleAwardRFQ}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-lg hover:bg-emerald-500 disabled:opacity-50"
                >
                  {isActionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Confirm Award</span>
                </button>
              </div>
            </div>
          )}
        </Modal>
      </main>
    </div>
  );
}
