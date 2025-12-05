import axios from 'axios';
import type { GenerateRequest, StatusResponse, GenerateMoreRequest, PipelineStage } from '@/types';

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

  async updateEpic(
    jobId: string,
    epicId: string,
    name: string,
    description: string
  ): Promise<any> {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);

    const response = await axios.put(
      `${API_BASE_URL}/update-epic/${jobId}/${epicId}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return response.data;
  },

  async updateStory(
    jobId: string,
    storyId: string,
    title: string,
    role: string,
    goal: string,
    benefit: string
  ): Promise<any> {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('role', role);
    formData.append('goal', goal);
    formData.append('benefit', benefit);

    const response = await axios.put(
      `${API_BASE_URL}/update-story/${jobId}/${storyId}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return response.data;
  },

  async updateAcceptanceCriteria(
    jobId: string,
    storyId: string,
    criteria: string[]
  ): Promise<any> {
    const formData = new FormData();
    formData.append('criteria', JSON.stringify(criteria));

    const response = await axios.put(
      `${API_BASE_URL}/update-acceptance-criteria/${jobId}/${storyId}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return response.data;
  },

  async regenerateStoryTests(jobId: string, storyId: string): Promise<any> {
    const response = await axios.post(
      `${API_BASE_URL}/regenerate-story-tests/${jobId}/${storyId}`
    );
    return response.data;
  },

  async regenerateStoryEntities(jobId: string, storyId: string): Promise<any> {
    const response = await axios.post(
      `${API_BASE_URL}/regenerate-story-entities/${jobId}/${storyId}`
    );
    return response.data;
  },

  async deleteEpic(jobId: string, epicId: string): Promise<any> {
    const response = await axios.delete(
      `${API_BASE_URL}/delete-epic/${jobId}/${epicId}`
    );
    return response.data;
  },

  async deleteStory(jobId: string, storyId: string): Promise<any> {
    const response = await axios.delete(
      `${API_BASE_URL}/delete-story/${jobId}/${storyId}`
    );
    return response.data;
  },

  async deleteTest(jobId: string, testId: string, testType: 'functional' | 'gherkin'): Promise<any> {
    const formData = new FormData();
    formData.append('test_type', testType);

    const response = await axios.delete(
      `${API_BASE_URL}/delete-test/${jobId}/${testId}`,
      {
        data: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  async updateFunctionalTest(
    jobId: string,
    testId: string,
    title: string,
    objective: string,
    preconditions: string[],
    testSteps: string[],
    expectedResults: string[]
  ): Promise<any> {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('objective', objective);
    formData.append('preconditions', JSON.stringify(preconditions));
    formData.append('test_steps', JSON.stringify(testSteps));
    formData.append('expected_results', JSON.stringify(expectedResults));

    const response = await axios.put(
      `${API_BASE_URL}/update-functional-test/${jobId}/${testId}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return response.data;
  },

  async updateGherkinTest(
    jobId: string,
    testId: string,
    featureName: string,
    scenarioName: string,
    given: string[],
    when: string[],
    then: string[]
  ): Promise<any> {
    const formData = new FormData();
    formData.append('feature_name', featureName);
    formData.append('scenario_name', scenarioName);
    formData.append('given', JSON.stringify(given));
    formData.append('when', JSON.stringify(when));
    formData.append('then', JSON.stringify(then));

    const response = await axios.put(
      `${API_BASE_URL}/update-gherkin-test/${jobId}/${testId}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return response.data;
  },

  // Staged Pipeline Endpoints
  async proceedToStage(jobId: string, nextStage: PipelineStage): Promise<any> {
    const response = await axios.post(
      `${API_BASE_URL}/proceed-to-stage/${jobId}?next_stage=${nextStage}`
    );
    return response.data;
  },

  async generateMore(jobId: string, request: GenerateMoreRequest): Promise<any> {
    const response = await axios.post(
      `${API_BASE_URL}/generate-more/${jobId}`,
      request
    );
    return response.data;
  },
};
