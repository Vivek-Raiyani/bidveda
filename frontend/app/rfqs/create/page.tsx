"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { rfqApi } from "@/lib/api";
import { RFQLineItemCreate } from "@/types/rfq";
import { UserRole } from "@/types/permissions";
import { Navbar } from "@/components/navigation/navbar";
import { FileUpload } from "@/components/ui/file-upload";
import { useToast } from "@/components/ui/toast";
import { formatDescriptionWithAttachment } from "@/lib/attachments";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Send,
  Loader2,
  Layers,
  DollarSign,
  Tag,
  FileText,
  AlertCircle,
} from "lucide-react";

export default function CreateRFQPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Industrial Machinery");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [budget, setBudget] = useState<string>("");
  const [deadline, setDeadline] = useState("");

  const [lineItems, setLineItems] = useState<RFQLineItemCreate[]>([
    { name: "", quantity: 1, unit: "units" },
  ]);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Line item manipulation
  const handleAddItem = () => {
    setLineItems((prev) => [...prev, { name: "", quantity: 1, unit: "units" }]);
  };

  const handleRemoveItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (
    index: number,
    field: keyof RFQLineItemCreate,
    value: string | number
  ) => {
    setLineItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const validate = () => {
    if (!title.trim() || title.trim().length < 3) {
      setError("RFQ title must be at least 3 characters.");
      return false;
    }
    if (!category.trim()) {
      setError("Category is required.");
      return false;
    }
    if (!deliveryLocation.trim()) {
      setError("Delivery location is required.");
      return false;
    }
    if (!deadline) {
      setError("Submission deadline is required.");
      return false;
    }

    const deadlineTimestamp = new Date(deadline).getTime();
    if (isNaN(deadlineTimestamp) || deadlineTimestamp <= Date.now()) {
      setError("Deadline must be a future date and time.");
      return false;
    }

    if (lineItems.length === 0) {
      setError("At least one line item is required.");
      return false;
    }

    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i];
      if (!item.name.trim()) {
        setError(`Line item #${i + 1} must have a name.`);
        return false;
      }
      if (Number(item.quantity) <= 0) {
        setError(`Line item #${i + 1} quantity must be greater than 0.`);
        return false;
      }
      if (!item.unit.trim()) {
        setError(`Line item #${i + 1} must have a unit.`);
        return false;
      }
    }

    setError(null);
    return true;
  };

  const handleSubmit = async (publishImmediately: boolean) => {
    if (!validate()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        title: title.trim(),
        description: formatDescriptionWithAttachment(
          description,
          attachmentUrl ? { name: attachmentName || "Attachment", url: attachmentUrl } : null
        ) || undefined,
        category: category.trim(),
        delivery_location: deliveryLocation.trim(),
        budget: budget ? parseFloat(budget) : undefined,
        deadline: new Date(deadline).toISOString(),
        line_items: lineItems.map((item) => ({
          name: item.name.trim(),
          quantity: Number(item.quantity),
          unit: item.unit.trim(),
        })),
      };

      const res = await rfqApi.create(payload);
      const createdRfq = res.data;

      if (publishImmediately) {
        await rfqApi.publish(createdRfq.id);
        toast({
          title: "RFQ Published",
          description: "Your RFQ is now live in the marketplace for vendor bidding.",
          variant: "success",
        });
      } else {
        toast({
          title: "Draft Saved",
          description: "Your RFQ has been saved as a draft.",
          variant: "success",
        });
      }

      router.push(`/rfqs/${createdRfq.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create RFQ";
      setError(msg);
      toast({
        title: "Creation Failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = [
    "Industrial Machinery",
    "Office Supplies & IT",
    "Raw Materials",
    "Construction & Hardware",
    "Logistics & Packaging",
    "Electrical & Electronics",
    "Safety & Maintenance",
    "Professional Services",
  ];

  if (!authLoading && (!isAuthenticated || (user?.role !== UserRole.BUYER && user?.role !== UserRole.ADMIN))) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md text-center p-8 rounded-2xl border border-zinc-800 bg-zinc-900/60">
            <AlertCircle className="h-10 w-10 text-rose-400 mx-auto" />
            <h2 className="mt-3 text-lg font-bold text-white">Access Restricted</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Only buyers and administrators can create Requests for Quotation (RFQs).
            </p>
            <Link
              href="/rfqs"
              className="mt-6 inline-block rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white"
            >
              Browse RFQ Marketplace
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 sm:px-6 py-8">
        {/* Back Link */}
        <Link
          href="/rfqs"
          className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to RFQs</span>
        </Link>

        {/* Header */}
        <div className="pb-6 border-b border-zinc-800">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Create Request for Quotation
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Define specifications, delivery requirements, and line items to solicit competitive bids from verified vendors.
          </p>
        </div>

        {error && (
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-400">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={(e) => e.preventDefault()} className="mt-8 space-y-8">
          {/* Section 1: Overview & Scope */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-5">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-400" />
              <span>General Information</span>
            </h2>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                RFQ Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Procurement of 500 Industrial Pneumatic Valves"
                className="mt-2 block w-full rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Category *
                </label>
                <div className="relative mt-2">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="block w-full rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Delivery Location / Site *
                </label>
                <div className="relative mt-2">
                  <input
                    type="text"
                    required
                    value={deliveryLocation}
                    onChange={(e) => setDeliveryLocation(e.target.value)}
                    placeholder="e.g. Warehouse 4B, Mumbai Port"
                    className="block w-full rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Estimated Budget (Optional, USD)
                </label>
                <div className="relative mt-2">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500">
                    <DollarSign className="h-4 w-4" />
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="50000.00"
                    className="block w-full rounded-xl border border-zinc-800 bg-zinc-950/80 pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Submission Deadline (UTC) *
                </label>
                <div className="relative mt-2">
                  <input
                    type="datetime-local"
                    required
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="block w-full rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 [color-scheme:dark]"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Detailed Scope of Work & Terms
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Include quality specifications, compliance certificates, warranty terms, and packaging guidelines..."
                className="mt-2 block w-full rounded-xl border border-zinc-800 bg-zinc-950/80 p-3.5 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Section 2: Line Items */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="h-4 w-4 text-indigo-400" />
                  <span>Required Line Items</span>
                </h2>
                <p className="mt-1 text-xs text-zinc-400">
                  Vendors will submit individual unit pricing against each item.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-3">
              {lineItems.map((item, index) => (
                <div
                  key={index}
                  className="flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5"
                >
                  <div className="flex-1 w-full">
                    <label className="block text-[10px] font-semibold uppercase text-zinc-500 sm:hidden mb-1">
                      Item #{index + 1} Name
                    </label>
                    <input
                      type="text"
                      required
                      value={item.name}
                      onChange={(e) =>
                        handleItemChange(index, "name", e.target.value)
                      }
                      placeholder={`Line item #${index + 1} description`}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="w-full sm:w-28">
                    <label className="block text-[10px] font-semibold uppercase text-zinc-500 sm:hidden mb-1">
                      Quantity
                    </label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="any"
                      value={item.quantity}
                      onChange={(e) =>
                        handleItemChange(
                          index,
                          "quantity",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      placeholder="Qty"
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="w-full sm:w-28">
                    <label className="block text-[10px] font-semibold uppercase text-zinc-500 sm:hidden mb-1">
                      Unit
                    </label>
                    <input
                      type="text"
                      required
                      value={item.unit}
                      onChange={(e) =>
                        handleItemChange(index, "unit", e.target.value)
                      }
                      placeholder="e.g. units, kg"
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex sm:items-center">
                    <button
                      type="button"
                      disabled={lineItems.length <= 1}
                      onClick={() => handleRemoveItem(index)}
                      className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-rose-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Technical Specifications & Attachments */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Tag className="h-4 w-4 text-indigo-400" />
              <span>Specification Documents & Assets</span>
            </h2>
            <p className="text-xs text-zinc-400">
              Attach engineering drawings, bill of quantities (BOQ), or technical requirement sheets stored in your asset bucket.
            </p>

            <FileUpload
              folder="rfq_attachments"
              label="Upload Technical Document"
              onUploaded={(asset) => {
                setAttachmentUrl(asset.url || null);
                setAttachmentName(asset.filename || null);
              }}
              onRemoved={() => {
                setAttachmentUrl(null);
                setAttachmentName(null);
              }}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <Link
              href="/rfqs"
              className="w-full sm:w-auto text-center rounded-xl border border-zinc-800 px-5 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-900 transition-colors"
            >
              Cancel
            </Link>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmit(false)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-zinc-700 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>Save as Draft</span>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmit(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span>Publish Immediately</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
