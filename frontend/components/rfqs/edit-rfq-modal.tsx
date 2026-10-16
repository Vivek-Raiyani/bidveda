"use client";

import React, { useState } from "react";
import { rfqApi } from "@/lib/api";
import { RFQ, RFQLineItemCreate } from "@/types/rfq";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { FileUpload } from "@/components/ui/file-upload";
import {
  parseDescriptionAndAttachment,
  formatDescriptionWithAttachment,
  ParsedAttachment,
} from "@/lib/attachments";
import { Plus, Trash2, Paperclip, Save, Loader2 } from "lucide-react";

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

interface EditRFQModalProps {
  isOpen: boolean;
  onClose: () => void;
  rfq: RFQ;
  onSaved: (updatedRfq: RFQ) => void;
}

export function EditRFQModal({ isOpen, onClose, rfq, onSaved }: EditRFQModalProps) {
  const { toast } = useToast();

  const [title, setTitle] = useState(rfq.title);
  const [category, setCategory] = useState(rfq.category);
  const [deliveryLocation, setDeliveryLocation] = useState(rfq.delivery_location);
  const [budget, setBudget] = useState(rfq.budget !== null && rfq.budget !== undefined ? String(rfq.budget) : "");
  const [deadline, setDeadline] = useState(() => toDatetimeLocalValue(rfq.deadline));
  const [description, setDescription] = useState(() => parseDescriptionAndAttachment(rfq.description).cleanDescription);
  const [attachment, setAttachment] = useState<ParsedAttachment | null>(() => parseDescriptionAndAttachment(rfq.description).attachment);
  const [lineItems, setLineItems] = useState<RFQLineItemCreate[]>(() =>
    rfq.line_items && rfq.line_items.length > 0
      ? rfq.line_items.map((it) => ({
          name: it.name,
          quantity: Number(it.quantity),
          unit: it.unit,
        }))
      : [{ name: "", quantity: 1, unit: "units" }]
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Validation Error", description: "Title is required.", variant: "destructive" });
      return;
    }
    if (!category.trim()) {
      toast({ title: "Validation Error", description: "Category is required.", variant: "destructive" });
      return;
    }
    if (!deliveryLocation.trim()) {
      toast({ title: "Validation Error", description: "Delivery location is required.", variant: "destructive" });
      return;
    }
    if (!deadline) {
      toast({ title: "Validation Error", description: "Deadline is required.", variant: "destructive" });
      return;
    }

    const deadlineDate = new Date(deadline);
    if (deadlineDate.getTime() <= Date.now()) {
      toast({ title: "Validation Error", description: "Deadline must be a future date and time.", variant: "destructive" });
      return;
    }

    if (lineItems.length === 0) {
      toast({ title: "Validation Error", description: "At least one line item is required.", variant: "destructive" });
      return;
    }

    for (const item of lineItems) {
      if (!item.name.trim()) {
        toast({ title: "Validation Error", description: "Each line item must have a name.", variant: "destructive" });
        return;
      }
      if (Number(item.quantity) <= 0) {
        toast({ title: "Validation Error", description: "Quantities must be greater than 0.", variant: "destructive" });
        return;
      }
    }

    setIsSaving(true);
    try {
      const fullDescription = formatDescriptionWithAttachment(
        description,
        attachment ? { name: attachment.name, url: attachment.url } : null
      );

      const payload = {
        title: title.trim(),
        description: fullDescription || undefined,
        category: category.trim(),
        delivery_location: deliveryLocation.trim(),
        budget: budget ? parseFloat(budget) : undefined,
        deadline: deadlineDate.toISOString(),
        line_items: lineItems.map((it) => ({
          name: it.name.trim(),
          quantity: Number(it.quantity),
          unit: it.unit.trim() || "units",
        })),
      };

      const res = await rfqApi.update(rfq.id, payload);
      toast({
        title: "RFQ Updated",
        description: "Your draft specifications have been updated successfully.",
        variant: "success",
      });
      onSaved(res.data);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update RFQ";
      toast({ title: "Update Failed", description: msg, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Draft RFQ"
      description="Update specifications, timeline, bill of materials, and documentation before publishing."
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
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
            >
              {Array.from(new Set([category, ...DEFAULT_CATEGORIES])).filter(Boolean).map((cat) => (
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
              value={deliveryLocation}
              onChange={(e) => setDeliveryLocation(e.target.value)}
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
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
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
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
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
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe procurement requirements, warranty needs, delivery terms..."
            className="mt-1.5 block w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {/* Attachment Management */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            Specification Document / Attachment
          </label>

          {attachment ? (
            <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <Paperclip className="h-4 w-4 text-indigo-400 shrink-0" />
                <span className="text-white font-medium truncate">{attachment.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                className="text-xs text-rose-400 hover:text-rose-300 font-medium shrink-0 ml-3"
              >
                Remove File
              </button>
            </div>
          ) : (
            <FileUpload
              folder="rfq_attachments"
              label="Upload Specification Document"
              onUploaded={(asset) => {
                if (asset.url) {
                  setAttachment({
                    name: asset.filename,
                    url: asset.url,
                    extension: asset.filename.split(".").pop()?.toUpperCase() || "FILE",
                  });
                }
              }}
              onRemoved={() => setAttachment(null)}
            />
          )}
        </div>

        {/* Line Items Editor */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Line Items ({lineItems.length}) *
            </label>
            <button
              type="button"
              onClick={() =>
                setLineItems((prev) => [...prev, { name: "", quantity: 1, unit: "units" }])
              }
              className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Line Item</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {lineItems.map((item, idx) => (
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
                    setLineItems((prev) =>
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
                      setLineItems((prev) =>
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
                      setLineItems((prev) =>
                        prev.map((it, i) => (i === idx ? { ...it, unit: val } : it))
                      );
                    }}
                    className="w-24 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />

                  <button
                    type="button"
                    disabled={lineItems.length <= 1}
                    onClick={() =>
                      setLineItems((prev) => prev.filter((_, i) => i !== idx))
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
            onClick={onClose}
            className="rounded-xl border border-zinc-800 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-lg hover:bg-indigo-500 disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            <span>Save Changes</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
