import { apiClient } from "@/lib/api-client";

/** Backend re-encodes to WebP and resizes via sharp before storing in Cloudinary. */
export const uploadsService = {
  uploadListingPhoto: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post("/uploads/listing-photo", formData, { headers: {} });
  },
};
