import axios from 'axios';
import type { GenerateRequest, StatusResponse } from '@/types';

const API_BASE_URL = 'http://localhost:8000/api';

export const api = {
  async generate(file: File, request: GenerateRequest): Promise<{ job_id: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('payload', JSON.stringify(request));

    const response = await axios.post(`${API_BASE_URL}/generate`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },

  async getStatus(jobId: string): Promise<StatusResponse> {
    const response = await axios.get(`${API_BASE_URL}/status/${jobId}`);
    return response.data;
  },

  async generateMoreTests(
    jobId: string,
    storyId: string,
    instructions: string = ""
  ): Promise<{ story_id: string; new_tests_count: number }> {
    const formData = new FormData();
    formData.append('job_id', jobId);
    formData.append('instructions', instructions);

    const response = await axios.post(`${API_BASE_URL}/stories/${storyId}/more-tests`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },

  getDownloadUrl(jobId: string): string {
    return `${API_BASE_URL}/download/${jobId}`;
  },

  async validateBRD(file: File, request: GenerateRequest): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('payload', JSON.stringify(request));

    const response = await axios.post(`${API_BASE_URL}/validate-brd`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },

  async updateGapFix(
    jobId: string,
    gapId: string,
    action: string,
    finalText?: string
  ): Promise<any> {
    const formData = new FormData();
    formData.append('gap_id', gapId);
    formData.append('action', action);
    if (finalText) {
      formData.append('final_text', finalText);
    }

    const response = await axios.post(`${API_BASE_URL}/update-gap-fix/${jobId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },

  async proceedToGeneration(jobId: string): Promise<any> {
    const response = await axios.post(`${API_BASE_URL}/proceed-to-generation/${jobId}`);
    return response.data;
  },
};
