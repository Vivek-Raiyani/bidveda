"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, CheckCircle2, AlertCircle, Loader2, Trash2 } from "lucide-react";
import { assetsApi } from "@/lib/api";
import { AssetUploadResponse } from "@/types/assets";

interface FileUploadProps {
  folder?: string;
  onUploaded?: (asset: AssetUploadResponse) => void;
  onRemoved?: () => void;
  accept?: string;
  label?: string;
  helpText?: string;
}

export function FileUpload({
  folder = "rfq_attachments",
  onUploaded,
  onRemoved,
  accept,
  label = "Upload Attachment",
  helpText = "PDF, DOCX, XLSX, PNG, JPG up to 25MB",
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedAsset, setUploadedAsset] = useState<AssetUploadResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsUploading(true);

    try {
      const res = await assetsApi.upload(file, folder);
      setUploadedAsset(res.data);
      onUploaded?.(res.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to upload file";
      setError(msg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = () => {
    setUploadedAsset(null);
    onRemoved?.();
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {label}
        </label>
      )}

      {uploadedAsset ? (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-sm">
          <div className="flex items-center gap-3 overflow-hidden">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
            <div className="truncate">
              <span className="font-medium text-emerald-200">
                {uploadedAsset.filename}
              </span>
              {uploadedAsset.url && (
                <a
                  href={uploadedAsset.url}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 text-xs text-indigo-400 underline hover:text-indigo-300"
                >
                  View File
                </a>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-rose-400 transition-colors"
            title="Remove attachment"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-800 bg-zinc-950/60 p-6 text-center transition-all hover:border-indigo-500/50 hover:bg-zinc-900/50 ${
            isUploading ? "pointer-events-none opacity-60" : ""
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileChange}
            className="hidden"
          />

          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
              <p className="text-sm font-medium text-zinc-300">
                Uploading to storage...
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-xl bg-indigo-500/10 p-3 text-indigo-400 ring-1 ring-indigo-500/20 group-hover:scale-105 transition-transform">
                <UploadCloud className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  Click or drag file to attach
                </p>
                <p className="mt-1 text-xs text-zinc-500">{helpText}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-rose-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
