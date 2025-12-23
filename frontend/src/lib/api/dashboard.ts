import { getHeader } from "./header";
import { ApiResponseHandler } from "./api-error-handler";
import { API_ENDPOINTS } from "../apiConfig";

export interface PresentationResponse {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  data: any | null;
  file: string;
  n_slides: number;
  prompt: string;
  summary: string | null;
  theme: string;
  titles: string[];
  user_id: string;
  vector_store: any;
  thumbnail: string;
  slides: any[];
}

export class DashboardApi {
  static async getPresentations(): Promise<PresentationResponse[]> {
    try {
      const response = await fetch(
        API_ENDPOINTS.presentations.list(),
        {
          method: "GET",
        }
      );
      
      // Handle the special case where 404 means "no presentations found"
      if (response.status === 404) {
        console.log("No presentations found");
        return [];
      }
      
      return await ApiResponseHandler.handleResponse(response, "Failed to fetch presentations");
    } catch (error) {
      console.error("Error fetching presentations:", error);
      throw error;
    }
  }
  
  static async getPresentation(id: string) {
    try {
      const response = await fetch(
        API_ENDPOINTS.presentations.get(id),
        {
          method: "GET",
          headers: getHeader(),
        }
      );
      
      const data = await ApiResponseHandler.handleResponse(response, "Presentation not found");
      
      // Format the response to match PresentationData interface
      if (data && data.slides) {
        return {
          id: data.id,
          language: data.language || 'English',
          layout: data.layout || { name: '', ordered: false, slides: [] },
          n_slides: data.nSlides || data.n_slides || data.slides.length,
          title: data.title || '',
          slides: data.slides
        };
      }
      
      return data;
    } catch (error) {
      console.error("Error fetching presentation:", error);
      throw error;
    }
  }
  
  static async deletePresentation(presentation_id: string) {
    try {
      const response = await fetch(
        API_ENDPOINTS.presentations.delete(presentation_id),
        {
          method: "DELETE",
          headers: getHeader(),
        }
      );

      return await ApiResponseHandler.handleResponseWithResult(response, "Failed to delete presentation");
    } catch (error) {
      console.error("Error deleting presentation:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Failed to delete presentation",
      };
    }
  }
}

