import type { HealthLiveResponse, HealthReadyResponse } from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<{ data: T; requestId: string; latencyMs: number }> {
    const url = `${this.baseUrl}${path}`;
    const start = performance.now();
    const requestId = `ui-${Math.random().toString(36).substring(2, 10)}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
      ...(options.headers as Record<string, string> || {}),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const latencyMs = Math.round(performance.now() - start);
      const resRequestId = response.headers.get('X-Request-ID') || requestId;

      if (!response.ok && response.status !== 503) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return { data: data as T, requestId: resRequestId, latencyMs };
    } catch (err: unknown) {
      const latencyMs = Math.round(performance.now() - start);
      const message = err instanceof Error ? err.message : 'Network error';
      throw new Error(`Failed to fetch ${path} (${latencyMs}ms): ${message}`);
    }
  }

  async getHealthLive(): Promise<{ data: HealthLiveResponse; requestId: string; latencyMs: number }> {
    return this.request<HealthLiveResponse>('/health/live');
  }

  async getHealthReady(): Promise<{ data: HealthReadyResponse; requestId: string; latencyMs: number }> {
    return this.request<HealthReadyResponse>('/health/ready');
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
