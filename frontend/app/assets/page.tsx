"use client";

import React, { useState, useEffect } from "react";
import { assetsApi } from "@/lib/api";
import { Asset } from "@/types/assets";
import { Navbar } from "@/components/navigation/navbar";
import { FileUpload } from "@/components/ui/file-upload";
import { useToast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadFile } from "@/lib/attachments";
import {
  FolderArchive,
  FileText,
  Copy,
  ExternalLink,
  Trash2,
  FileSpreadsheet,
  FileImage,
  Download,
  Search,
  Archive,
} from "lucide-react";

export default function AssetsPage() {
  const { toast } = useToast();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFolder, setActiveFolder] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedFolderUpload, setSelectedFolderUpload] = useState<string>("common");
  const [dataVersion, setDataVersion] = useState(0);

  const refreshAssets = () => setDataVersion((v) => v + 1);

  const folders = [
    { label: "All Assets", value: "all" },
    { label: "Common", value: "common" },
    { label: "RFQ Attachments", value: "rfq_attachments" },
    { label: "Technical Specs", value: "specifications" },
    { label: "Vendor Quotes", value: "quotes" },
  ];

  useEffect(() => {
    let ignore = false;
    async function loadAssets() {
      try {
        const folderParam = activeFolder === "all" ? undefined : activeFolder;
        const res = await assetsApi.list(folderParam);
        if (!ignore) {
          setAssets(res.data || []);
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : "Failed to load assets";
          toast({ title: "Fetch Failed", description: msg, variant: "destructive" });
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    loadAssets();
    return () => {
      ignore = true;
    };
  }, [activeFolder, toast, dataVersion]);

  const handleCopyUrl = async (asset: Asset) => {
    try {
      let url = asset.file_url;
      if (!url) {
        const freshUrlRes = await assetsApi.getUrl(asset.id);
        url = freshUrlRes.data;
      }
      if (url) {
        await navigator.clipboard.writeText(url);
        toast({
          title: "URL Copied",
          description: "Asset link copied to clipboard.",
          variant: "success",
        });
      }
    } catch {
      toast({
        title: "Copy Failed",
        description: "Could not copy asset URL to clipboard.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (assetId: string) => {
    if (!confirm("Are you sure you want to delete this asset file?")) return;
    try {
      await assetsApi.delete(assetId);
      toast({
        title: "Asset Deleted",
        description: "The file was successfully removed.",
        variant: "success",
      });
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete file";
      toast({ title: "Delete Failed", description: msg, variant: "destructive" });
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return "Unknown size";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const isImageFile = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    return ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext);
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)) {
      return <FileImage className="h-5 w-5 text-indigo-400" />;
    }
    if (["xlsx", "xls", "csv"].includes(ext)) {
      return <FileSpreadsheet className="h-5 w-5 text-emerald-400" />;
    }
    if (["pdf"].includes(ext)) {
      return <FileText className="h-5 w-5 text-rose-400" />;
    }
    if (["zip", "rar", "tar", "gz", "7z"].includes(ext)) {
      return <Archive className="h-5 w-5 text-amber-400" />;
    }
    return <FileText className="h-5 w-5 text-sky-400" />;
  };

  const filteredAssets = assets.filter((asset) => {
    if (!searchQuery.trim()) return true;
    return asset.filename.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-8">
        {/* Banner */}
        <div className="pb-6 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Document & Asset Repository
            </h1>
            <span className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 text-xs font-semibold text-indigo-400">
              {assets.length} Files
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Upload and manage engineering specs, quotation sheets, drawings, and procurement documentation.
          </p>
        </div>

        {/* Upload Dropzone */}
        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-white">Upload New Document</h2>
              <p className="text-xs text-zinc-400">
                Uploaded files are stored securely and can be referenced in RFQs and Quotes.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-400 font-medium">Target Folder:</label>
              <select
                value={selectedFolderUpload}
                onChange={(e) => setSelectedFolderUpload(e.target.value)}
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="common">Common</option>
                <option value="rfq_attachments">RFQ Attachments</option>
                <option value="specifications">Specifications</option>
                <option value="quotes">Quotes</option>
              </select>
            </div>
          </div>

          <FileUpload
            folder={selectedFolderUpload}
            onUploaded={() => {
              toast({
                title: "File Uploaded",
                description: "Asset saved successfully to repository.",
                variant: "success",
              });
              refreshAssets();
            }}
          />
        </div>

        {/* Folder filter tabs and search bar */}
        <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {folders.map((f) => (
              <button
                key={f.value}
                onClick={() => setActiveFolder(f.value)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  activeFolder === f.value
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search file names..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-1.5 pl-8 pr-3 text-xs text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Assets List */}
        <div className="mt-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3"
                >
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/20 p-12 text-center">
              <FolderArchive className="h-12 w-12 text-zinc-500" />
              <h3 className="mt-4 text-base font-bold text-white">No Assets Found</h3>
              <p className="mt-1 text-xs text-zinc-400 max-w-sm">
                {searchQuery
                  ? "No files match your search keyword."
                  : "No files uploaded to this folder yet. Drag and drop documents above to store them in your repository."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAssets.map((asset) => {
                const isImage = isImageFile(asset.filename);

                return (
                  <div
                    key={asset.id}
                    className="flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-lg backdrop-blur-md hover:border-zinc-700 transition-all"
                  >
                    <div className="space-y-3">
                      {/* Image Preview Thumbnail if image */}
                      {isImage && asset.file_url && (
                        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/80 aspect-video relative flex items-center justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={asset.file_url}
                            alt={asset.filename}
                            className="w-full h-full object-contain"
                            loading="lazy"
                          />
                        </div>
                      )}

                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-lg bg-zinc-800 p-2 shrink-0">
                          {getFileIcon(asset.filename)}
                        </div>
                        <div className="overflow-hidden flex-1">
                          <h4
                            className="text-xs font-bold text-white truncate"
                            title={asset.filename}
                          >
                            {asset.filename}
                          </h4>
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-400">
                            <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono">
                              {asset.folder.replace("assets/", "")}
                            </span>
                            <span>{formatFileSize(asset.file_size)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-[10px] text-zinc-500 pt-2 border-t border-zinc-800/60">
                        Uploaded: {new Date(asset.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 flex items-center justify-end gap-1.5 pt-3 border-t border-zinc-800/60">
                      <button
                        onClick={() => handleCopyUrl(asset)}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                        title="Copy File URL"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>

                      {asset.file_url && (
                        <button
                          onClick={() => {
                            if (asset.file_url) downloadFile(asset.file_url, asset.filename);
                          }}
                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-emerald-400 transition-colors"
                          title="Download File"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {asset.file_url && (
                        <a
                          href={asset.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-indigo-400 transition-colors"
                          title="Open in New Tab"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}

                      <button
                        onClick={() => handleDelete(asset.id)}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-rose-400 transition-colors"
                        title="Delete File"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
