import axios from 'axios';
import type { GenerateRequest, StatusResponse, GenerateMoreRequest, PipelineStage } from '@/types';

const API_BASE_URL = 'http://localhost:8000/api';

export const api = {
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
    const response = await axios.post(`${API_BASE_URL}/update-gap-fix/${jobId}`, {
      gap_id: gapId,
      action,
      final_text: finalText,
    });

    return response.data;
  },

  async updateEpic(
    jobId: string,
    epicId: string,
    name: string,
    description: string
  ): Promise<any> {
    const response = await axios.put(
      `${API_BASE_URL}/update-epic/${jobId}/${epicId}`,
      { name, description }
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
    const response = await axios.put(
      `${API_BASE_URL}/update-story/${jobId}/${storyId}`,
      { title, role, goal, benefit }
    );

    return response.data;
  },

  async updateAcceptanceCriteria(
    jobId: string,
    storyId: string,
    criteria: string[]
  ): Promise<any> {
    const response = await axios.put(
      `${API_BASE_URL}/update-acceptance-criteria/${jobId}/${storyId}`,
      { criteria }
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
    const response = await axios.delete(
      `${API_BASE_URL}/delete-test/${jobId}/${testId}`,
      {
        data: { test_type: testType },
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
    const response = await axios.put(
      `${API_BASE_URL}/update-functional-test/${jobId}/${testId}`,
      {
        title,
        objective,
        preconditions,
        test_steps: testSteps,
        expected_results: expectedResults,
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
    const response = await axios.put(
      `${API_BASE_URL}/update-gherkin-test/${jobId}/${testId}`,
      {
        feature_name: featureName,
        scenario_name: scenarioName,
        given,
        when,
        then,
      }
    );

    return response.data;
  },

  // Staged Pipeline Endpoints
  async proceedToStage(jobId: string, nextStage: PipelineStage): Promise<any> {
    const response = await axios.post(
      `${API_BASE_URL}/proceed-to-stage/${jobId}`,
      { next_stage: nextStage }
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
