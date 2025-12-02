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
};
