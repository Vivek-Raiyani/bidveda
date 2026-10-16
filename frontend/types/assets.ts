export interface AssetUploadRequest {
  filename: string;
  content_type: string;
  file_size: number;
  folder?: string;
}

export interface AssetPresignedResponse {
  asset_id: string;
  upload_url: string;
  fields: Record<string, unknown>;
  provider: string;
}

export interface Asset {
  id: string;
  filename: string;
  folder: string;
  file_url?: string | null;
  content_type?: string | null;
  file_size?: number | null;
  created_at: string;
  status: string;
}

export interface AssetUploadResponse {
  id: string;
  url?: string | null;
  filename: string;
}
