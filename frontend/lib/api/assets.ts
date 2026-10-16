import { apiClient } from "./client";
import { Asset, AssetUploadResponse } from "@/types/assets";
import { DataResponse, MessageResponse } from "@/types/api";

export const assetsApi = {
  /**
   * Upload an asset file with optional folder categorization.
   */
  upload: async (
    file: File,
    folder: string = "common"
  ): Promise<DataResponse<AssetUploadResponse>> => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post<DataResponse<AssetUploadResponse>>(
      `/assets/upload?folder=${encodeURIComponent(folder)}`,
      formData
    );
  },

  /**
   * List all assets for the current user, optionally filtered by folder.
   */
  list: async (folder?: string): Promise<DataResponse<Asset[]>> => {
    return apiClient.get<DataResponse<Asset[]>>("/assets/", {
      params: folder ? { folder } : undefined,
    });
  },

  /**
   * Get fresh direct download/view URL for an asset.
   */
  getUrl: async (assetId: string): Promise<DataResponse<string>> => {
    return apiClient.get<DataResponse<string>>(`/assets/url/${assetId}`);
  },

  /**
   * Delete an asset by ID.
   */
  delete: async (assetId: string): Promise<MessageResponse> => {
    return apiClient.delete<MessageResponse>(`/assets/${assetId}`);
  },
};
