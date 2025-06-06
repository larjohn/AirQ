import { toast } from "sonner";
import { Pollutant, Region, Dataset, HealthTip, TrendChart, SeasonalityChart } from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";

// Define the base URL for API requests - fallback to mock data if API fails
export const API_URL = "http://localhost:8000"; 

// Define types for API responses
export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    using_fallback_model?: boolean;
    model_id?: string;
    model_created_at?: string;
    [key: string]: any;
  };
};

// Define the dataset preview response type for consistency
export type DatasetPreviewResponse = {
  columns: string[];
  preview: Record<string, any>[];
};

// Storage key for the auth token
const TOKEN_KEY = "air_quality_token";

// Default request timeout (in milliseconds) - Increased to 30 seconds for complex operations
export const DEFAULT_TIMEOUT = 30000;

// Circuit breaker configuration
const CIRCUIT_BREAKER = {
  maxFailures: 3,
  resetTimeout: 30000, // 30 seconds
  failureCount: 0,
  tripped: false,
  lastFailure: 0
};

// Mock data for offline mode - Updated with consistent types and values
const MOCK_DATA = {
  dashboard_overview: {
    region: "thessaloniki",
    current: {
      pollutants: {
        no2_conc: 42.1,
        o3_conc: 18.3,
        co_conc: 0.7
      },
      aqi_category: "Moderate"
    },
    forecast: [
      { ds: "2025-05-27", yhat: 43.2, category: "Moderate" },
      { ds: "2025-05-28", yhat: 49.1, category: "Unhealthy" },
      { ds: "2025-05-29", yhat: 38.5, category: "Moderate" },
      { ds: "2025-05-30", yhat: 52.3, category: "Unhealthy" },
      { ds: "2025-05-31", yhat: 35.2, category: "Good" },
      { ds: "2025-06-01", yhat: 41.8, category: "Moderate" },
      { ds: "2025-06-02", yhat: 46.7, category: "Moderate" }
    ],
    personalized: {
      labels: ["2021", "2022", "2023"],
      values: [33.1, 38.4, 45.2],
      deltas: [null, 5.3, 6.8],
      unit: "μg/m³",
      meta: {
        type: "personalized_trend",
        user_id: "user123",
        region: "thessaloniki"
      }
    },
    ai_tip: {
      tip: "1. **Limit outdoor activity** on days with high pollution levels\n2. **Wear a mask** if you're asthmatic or have respiratory conditions\n3. **Keep windows closed** during peak pollution hours (7-9 AM, 6-8 PM)",
      riskLevel: "Moderate",
      personalized: true
    }
  },
  forecast: [
    { 
      ds: new Date().toISOString(), 
      yhat: 50, 
      yhat_lower: 40, 
      yhat_upper: 60, 
      category: "Good" 
    },
    { 
      ds: new Date(Date.now() + 86400000).toISOString(), 
      yhat: 55, 
      yhat_lower: 45, 
      yhat_upper: 65, 
      category: "Good" 
    },
    { 
      ds: new Date(Date.now() + 172800000).toISOString(), 
      yhat: 60, 
      yhat_lower: 50, 
      yhat_upper: 70, 
      category: "Moderate" 
    },
  ],
  trend: {
    labels: ["2020", "2021", "2022", "2023"],
    values: [45, 42, 48, 50],
    deltas: [-3, 6, 2]
  },
  seasonality: {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    values: [40, 42, 45, 48, 50, 52, 55, 53, 48, 45, 43, 41]
  },
  availability_matrix: {
    availability: [
      {
        region: 'thessaloniki',
        availableYears: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
        pollutants: ['no2_conc', 'o3_conc', 'co_conc'],
        totalDatasets: 24
      },
      {
        region: 'ampelokipoi-menemeni',
        availableYears: [2018, 2019, 2020, 2021, 2022, 2023, 2024],
        pollutants: ['no2_conc', 'o3_conc'],
        totalDatasets: 14
      },
      {
        region: 'neapoli-sykies',
        availableYears: [2019, 2020, 2021, 2022, 2023, 2024],
        pollutants: ['no2_conc', 'co_conc'],
        totalDatasets: 12
      },
      {
        region: 'kalamaria',
        availableYears: [2017, 2019, 2020, 2021, 2022, 2023, 2024],
        pollutants: ['no2_conc', 'o3_conc', 'so2_conc'],
        totalDatasets: 21
      },
      {
        region: 'pavlos-melas',
        availableYears: [2020, 2021, 2022, 2023, 2024],
        pollutants: ['no2_conc'],
        totalDatasets: 5
      },
      {
        region: 'pylaia-chortiatis',
        availableYears: [2021, 2022, 2023, 2024],
        pollutants: ['no2_conc', 'o3_conc'],
        totalDatasets: 8
      }
    ],
    totalRegions: 6,
    yearRange: { min: 2017, max: 2024 },
    lastUpdated: new Date().toISOString()
  },
  model_comparison: {
    models: [
      {
        id: "model-1",
        region: "thessaloniki",
        pollutant: "no2_conc",
        frequency: "daily",
        forecast: Array.from({ length: 10 }, (_, i) => ({
          ds: new Date(Date.now() + i * 86400000).toISOString(),
          yhat: 40 + Math.random() * 20,
          yhat_lower: 35 + Math.random() * 15,
          yhat_upper: 50 + Math.random() * 25,
          category: "Moderate"
        }))
      },
      {
        id: "model-2",
        region: "kalamaria",
        pollutant: "no2_conc",
        frequency: "daily",
        forecast: Array.from({ length: 10 }, (_, i) => ({
          ds: new Date(Date.now() + i * 86400000).toISOString(),
          yhat: 30 + Math.random() * 15,
          yhat_lower: 25 + Math.random() * 10,
          yhat_upper: 40 + Math.random() * 20,
          category: "Good"
        }))
      }
    ]
  },
  model_metadata: {
    available: [
      { region: "thessaloniki", pollutant: "no2_conc", frequency: "daily" },
      { region: "kalamaria", pollutant: "no2_conc", frequency: "daily" },
      { region: "thessaloniki", pollutant: "o3_conc", frequency: "daily" },
      { region: "kalamaria", pollutant: "o3_conc", frequency: "weekly" }
    ]
  },
  model_info: {
    id: "model-123",
    region: "thessaloniki",
    pollutant: "no2_conc",
    frequency: "daily",
    forecast_periods: 365,
    created_at: new Date().toISOString(),
    trained_by: "admin@airquality.org",
    status: "ready",
    accuracy_mae: 2.45,
    accuracy_rmse: 3.12,
    model_type: "Prophet"
  },
  dataset_availability: {
    available: true
  }
};

// Helper to get the stored token
export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

// Helper to set the token
export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

// Helper to remove the token
export const removeToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

// Check if circuit breaker is tripped
const isCircuitBreakerTripped = () => {
  // Reset circuit breaker after timeout
  if (CIRCUIT_BREAKER.tripped && 
      Date.now() - CIRCUIT_BREAKER.lastFailure > CIRCUIT_BREAKER.resetTimeout) {
    console.log("Circuit breaker reset after timeout");
    CIRCUIT_BREAKER.tripped = false;
    CIRCUIT_BREAKER.failureCount = 0;
  }
  return CIRCUIT_BREAKER.tripped;
};

// Trip the circuit breaker
const tripCircuitBreaker = () => {
  CIRCUIT_BREAKER.failureCount++;
  CIRCUIT_BREAKER.lastFailure = Date.now();
  
  if (CIRCUIT_BREAKER.failureCount >= CIRCUIT_BREAKER.maxFailures) {
    console.warn("Circuit breaker tripped! Too many API failures");
    toast.error("API is currently unavailable. Using offline mode.", {
      id: "circuit-breaker",
      duration: 5000,
    });
  }
};

// Function to create a request with timeout
const fetchWithTimeout = async (url: string, options: RequestInit, timeout: number): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

// Base fetch function with authentication, timeouts, and better error handling
export const fetchWithAuth = async <T>(
  endpoint: string,
  options: RequestInit = {},
  timeout: number = DEFAULT_TIMEOUT
): Promise<ApiResponse<T>> => {
  try {
    // Check if circuit breaker is tripped
    if (isCircuitBreakerTripped()) {
      console.log(`Circuit breaker active, using mock data for: ${endpoint}`);
      // Return appropriate mock data based on the endpoint
      if (endpoint.includes('/dashboard/overview')) {
        return { success: true, data: MOCK_DATA.dashboard_overview as T };
      } else if (endpoint.includes('/models/predict')) {
        return { success: true, data: MOCK_DATA.forecast as T };
      } else if (endpoint.includes('/insights/trend')) {
        return { success: true, data: MOCK_DATA.trend as T };
      } else if (endpoint.includes('/insights/seasonality')) {
        return { success: true, data: MOCK_DATA.seasonality as T };
      } else if (endpoint.includes('/models/compare')) {
        return { success: true, data: MOCK_DATA.model_comparison as T };
      } else if (endpoint.includes('/models/metadata/filters')) {
        return { success: true, data: MOCK_DATA.model_metadata as T };
      } else if (endpoint.includes('/models/info/')) {
        return { success: true, data: MOCK_DATA.model_info as T };
      } else if (endpoint.includes('/models/check-exists')) {
        return { success: true, data: { exists: Math.random() > 0.5 } as T };
      } else if (endpoint.includes('/datasets/check-availability')) {
        return { success: true, data: { available: MOCK_DATA.dataset_availability.available } as T };
      } else if (endpoint.includes('/datasets/availability-matrix')) {
        return { success: true, data: MOCK_DATA.availability_matrix as T };
      }
      return { success: false, error: "API is currently unavailable. Using offline mode." };
    }
    
    console.log(`API Request to: ${API_URL}${endpoint}`);
    const token = getToken();

    const headers: HeadersInit = {
      ...options.headers,
    };

    // Only set Content-Type to application/json if we're NOT sending FormData
    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Add debug logging for FormData uploads
    if (options.body instanceof FormData) {
      console.log("Uploading with FormData:", [...(options.body as FormData).entries()]);
    }

    // Use fetchWithTimeout to prevent hanging requests
    const response = await fetchWithTimeout(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    }, timeout);

    // Handle non-JSON responses
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      console.error("Non-JSON response received:", await response.text());
      tripCircuitBreaker();
      // Return mock data when API fails
      if (endpoint.includes('/dashboard/overview')) {
        return { success: true, data: MOCK_DATA.dashboard_overview as T };
      } else if (endpoint.includes('/models/predict')) {
        return { success: true, data: MOCK_DATA.forecast as T };
      } else if (endpoint.includes('/insights/trend')) {
        return { success: true, data: MOCK_DATA.trend as T };
      } else if (endpoint.includes('/insights/seasonality')) {
        return { success: true, data: MOCK_DATA.seasonality as T };
      } else if (endpoint.includes('/models/compare')) {
        return { success: true, data: MOCK_DATA.model_comparison as T };
      } else if (endpoint.includes('/models/metadata/filters')) {
        return { success: true, data: MOCK_DATA.model_metadata as T };
      } else if (endpoint.includes('/models/info/')) {
        return { success: true, data: MOCK_DATA.model_info as T };
      } else if (endpoint.includes('/models/check-exists')) {
        return { success: true, data: { exists: Math.random() > 0.5 } as T };
      } else if (endpoint.includes('/datasets/check-availability')) {
        return { success: true, data: { available: MOCK_DATA.dataset_availability.available } as T };
      } else if (endpoint.includes('/datasets/availability-matrix')) {
        return { success: true, data: MOCK_DATA.availability_matrix as T };
      }
      return { success: false, error: "Invalid response format from server" };
    }

    // Parse JSON response
    let data;
    let meta;
    try {
      const responseData = await response.json();
      
      // Extract data and metadata from response
      if (responseData.data !== undefined) {
        data = responseData.data;
        // Capture any metadata if provided in the response
        if (responseData.meta) {
          meta = responseData.meta;
        }
      } else {
        data = responseData;
      }
    } catch (e) {
      console.error("Error parsing JSON response:", e);
      tripCircuitBreaker();
      // Return mock data when JSON parsing fails
      if (endpoint.includes('/dashboard/overview')) {
        return { success: true, data: MOCK_DATA.dashboard_overview as T };
      } else if (endpoint.includes('/models/predict')) {
        return { success: true, data: MOCK_DATA.forecast as T };
      } else if (endpoint.includes('/insights/trend')) {
        return { success: true, data: MOCK_DATA.trend as T };
      } else if (endpoint.includes('/insights/seasonality')) {
        return { success: true, data: MOCK_DATA.seasonality as T };
      } else if (endpoint.includes('/models/compare')) {
        return { success: true, data: MOCK_DATA.model_comparison as T };
      } else if (endpoint.includes('/models/metadata/filters')) {
        return { success: true, data: MOCK_DATA.model_metadata as T };
      } else if (endpoint.includes('/models/info/')) {
        return { success: true, data: MOCK_DATA.model_info as T };
      } else if (endpoint.includes('/models/check-exists')) {
        return { success: true, data: { exists: Math.random() > 0.5 } as T };
      } else if (endpoint.includes('/datasets/check-availability')) {
        return { success: true, data: { available: MOCK_DATA.dataset_availability.available } as T };
      } else if (endpoint.includes('/datasets/availability-matrix')) {
        return { success: true, data: MOCK_DATA.availability_matrix as T };
      }
      return { success: false, error: "Failed to parse server response" };
    }

    // Handle specific error codes
    if (response.status === 401) {
      console.error("Authentication error:", data);
      removeToken(); // Clear invalid token
      toast.error("Session expired. Please login again.");
      return { success: false, error: "Authentication required" };
    }
    
    if (response.status === 403) {
      console.error("Forbidden access:", data);
      toast.error("You don't have permission to access this resource");
      return { success: false, error: "Access denied" };
    }
    
    if (response.status === 400) {
      console.error("Bad request:", data);
      toast.error(data.detail || "Invalid request");
      return { success: false, error: data.detail || "Invalid request" };
    }

    if (!response.ok) {
      console.error("API Error Response:", data);
      tripCircuitBreaker();
      // Return mock data for specific endpoints
      if (endpoint.includes('/dashboard/overview')) {
        return { success: true, data: MOCK_DATA.dashboard_overview as T };
      } else if (endpoint.includes('/models/predict')) {
        return { success: true, data: MOCK_DATA.forecast as T };
      } else if (endpoint.includes('/insights/trend')) {
        return { success: true, data: MOCK_DATA.trend as T };
      } else if (endpoint.includes('/insights/seasonality')) {
        return { success: true, data: MOCK_DATA.seasonality as T };
      } else if (endpoint.includes('/models/compare')) {
        return { success: true, data: MOCK_DATA.model_comparison as T };
      } else if (endpoint.includes('/models/metadata/filters')) {
        return { success: true, data: MOCK_DATA.model_metadata as T };
      } else if (endpoint.includes('/models/info/')) {
        return { success: true, data: MOCK_DATA.model_info as T };
      } else if (endpoint.includes('/models/check-exists')) {
        return { success: true, data: { exists: Math.random() > 0.5 } as T };
      } else if (endpoint.includes('/datasets/check-availability')) {
        return { success: true, data: { available: MOCK_DATA.dataset_availability.available } as T };
      } else if (endpoint.includes('/datasets/availability-matrix')) {
        return { success: true, data: MOCK_DATA.availability_matrix as T };
      }
      return { success: false, error: data.detail || "API Error" };
    }

    // Reset failure count on success
    CIRCUIT_BREAKER.failureCount = 0;
    return { success: true, data, meta };
  } catch (error) {
    // Trip circuit breaker on failure
    tripCircuitBreaker();
    
    // Specific error handling for timeout (AbortError)
    if (error instanceof Error && error.name === "AbortError") {
      console.error("API Request timeout:", endpoint);
      // Return mock data for timeout
      if (endpoint.includes('/dashboard/overview')) {
        return { success: true, data: MOCK_DATA.dashboard_overview as T };
      } else if (endpoint.includes('/models/predict')) {
        return { success: true, data: MOCK_DATA.forecast as T };
      } else if (endpoint.includes('/insights/trend')) {
        return { success: true, data: MOCK_DATA.trend as T };
      } else if (endpoint.includes('/insights/seasonality')) {
        return { success: true, data: MOCK_DATA.seasonality as T };
      } else if (endpoint.includes('/models/compare')) {
        return { success: true, data: MOCK_DATA.model_comparison as T };
      } else if (endpoint.includes('/models/metadata/filters')) {
        return { success: true, data: MOCK_DATA.model_metadata as T };
      } else if (endpoint.includes('/models/info/')) {
        return { success: true, data: MOCK_DATA.model_info as T };
      } else if (endpoint.includes('/models/check-exists')) {
        return { success: true, data: { exists: Math.random() > 0.5 } as T };
      } else if (endpoint.includes('/datasets/check-availability')) {
        return { success: true, data: { available: MOCK_DATA.dataset_availability.available } as T };
      } else if (endpoint.includes('/datasets/availability-matrix')) {
        return { success: true, data: MOCK_DATA.availability_matrix as T };
      }
      return { success: false, error: "Request timed out. Using offline data." };
    }
    
    console.error("API Error:", error);
    // Return mock data for network errors
    if (endpoint.includes('/dashboard/overview')) {
      return { success: true, data: MOCK_DATA.dashboard_overview as T };
    } else if (endpoint.includes('/models/predict')) {
      return { success: true, data: MOCK_DATA.forecast as T };
    } else if (endpoint.includes('/insights/trend')) {
      return { success: true, data: MOCK_DATA.trend as T };
    } else if (endpoint.includes('/insights/seasonality')) {
      return { success: true, data: MOCK_DATA.seasonality as T };
    } else if (endpoint.includes('/models/compare')) {
      return { success: true, data: MOCK_DATA.model_comparison as T };
    } else if (endpoint.includes('/models/metadata/filters')) {
      return { success: true, data: MOCK_DATA.model_metadata as T };
    } else if (endpoint.includes('/models/info/')) {
      return { success: true, data: MOCK_DATA.model_info as T };
    } else if (endpoint.includes('/models/check-exists')) {
      return { success: true, data: { exists: Math.random() > 0.5 } as T };
    } else if (endpoint.includes('/datasets/check-availability')) {
      return { success: true, data: { available: MOCK_DATA.dataset_availability.available } as T };
    } else if (endpoint.includes('/datasets/availability-matrix')) {
      return { success: true, data: MOCK_DATA.availability_matrix as T };
    }
    return { success: false, error: "Network error. Using offline data." };
  }
};

// Auth endpoints - updated to use Supabase directly
export const authApi = {
  // Updated to use Supabase authentication directly
  login: async (email: string, password: string) => {
    try {
      // Use Supabase's native authentication
      const { data, error } = await supabase.auth.signInWithPassword({
        email, 
        password
      });
      
      if (error) {
        console.error("Supabase auth error:", error);
        return { success: false, error: error.message };
      }
      
      if (data?.session?.access_token) {
        // Store the Supabase token
        setToken(data.session.access_token);
        console.log("Successfully authenticated with Supabase");
        return { success: true, data: { access_token: data.session.access_token } };
      } else {
        console.error("No access token in Supabase response");
        return { success: false, error: "Authentication failed" };
      }
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: "Authentication failed" };
    }
  },
  
  signup: async (email: string, password: string) => {
    // This is already handled by Auth.tsx directly with Supabase
    return { success: false, error: "Use direct Supabase signup" };
  },
  
  logout: () => {
    // Remove the token from localStorage
    removeToken();
    // Also sign out from Supabase
    supabase.auth.signOut();
  }
};

// User profile endpoints
export const userApi = {
  saveProfile: async (profileData: any) => {
    // Backend expects snake_case field names
    return fetchWithAuth("/users/profile/", {
      method: "POST",
      body: JSON.stringify(profileData), // Already in snake_case from the frontend
    });
  },
  getProfile: async () => {
    return fetchWithAuth("/users/profile/");
  },
  getRiskTimeline: async () => {
    return fetchWithAuth("/users/risk-timeline/");
  }
};

// Dashboard endpoints
export const dashboardApi = {
  getOverview: async () => {
    return fetchWithAuth<{
      region: string;
      current: {
        pollutants: {
          no2_conc: number;
          o3_conc: number;
          co_conc: number;
        };
        aqi_category: string;
      };
      forecast: Array<{
        ds: string;
        yhat: number;
        category: string;
      }>;
      personalized: {
        labels: string[];
        values: number[];
        deltas: (number | null)[];
        unit: string;
        meta: {
          type: string;
          user_id: string;
          region: string;
        };
      };
      ai_tip: {
        tip: string;
        riskLevel: string;
        personalized: boolean;
      };
    }>("/dashboard/overview/");
  }
};

// Dataset endpoints
export const datasetApi = {
  upload: async (formData: FormData) => {
    console.log("Uploading with FormData:", [...formData.entries()]);
    
    return fetchWithAuth<{ dataset_id: string, file_url: string }>("/datasets/upload/", {
      method: "POST",
      body: formData,
    });
  },
  
  list: async () => {
    return fetchWithAuth<Dataset[]>("/datasets/list/");
  },
  
  preview: async (datasetId: string) => {
    const response = await fetchWithAuth<{
      columns: string[],
      preview?: Record<string, any>[],
      rows?: Record<string, any>[]
    }>(`/datasets/preview/${datasetId}`);

    if (response.success && response.data) {
      const transformedData: DatasetPreviewResponse = {
        columns: response.data.columns,
        preview: response.data.preview || response.data.rows || []
      };
      return { success: true, data: transformedData };
    }
    
    return { 
      success: response.success, 
      error: response.error,
      data: undefined
    };
  },
  
  delete: async (datasetId: string) => {
    return fetchWithAuth(`/datasets/${datasetId}`, {
      method: "DELETE",
    });
  },
  
  checkAvailability: async (region: string) => {
    const queryParams = new URLSearchParams({ region }).toString();
    return fetchWithAuth<{ available: boolean }>(`/datasets/check-availability/?${queryParams}`);
  },

  getAvailabilityMatrix: async () => {
    return fetchWithAuth<{
      availability: Array<{
        region: string;
        availableYears: number[];
        pollutants: string[];
        totalDatasets: number;
      }>;
      totalRegions: number;
      yearRange: { min: number; max: number };
      lastUpdated: string;
    }>('/datasets/availability-matrix');
  }
};

// Model training endpoints with improved error handling
export const modelApi = {
  train: async (trainData: { 
    pollutant: string; 
    region: string; 
    frequency?: string; 
    periods?: number;
    overwrite?: boolean; // Added overwrite parameter
  }) => {
    const queryParams = new URLSearchParams(trainData as any).toString();
    return fetchWithAuth(`/models/train/?${queryParams}`, {
      method: "POST"
    }, 10000); // Longer timeout for training requests
  },
  
  list: async () => {
    return fetchWithAuth("/models/list/");
  },
  
  getForecast: async (modelId: string) => {
    return fetchWithAuth(`/models/forecast/${modelId}`);
  },
  
  // Add model deletion method
  delete: async (modelId: string) => {
    return fetchWithAuth(`/models/delete/${modelId}`, {
      method: "DELETE"
    });
  },
  
  // Add new model preview method
  getModelPreview: async (modelId: string, limit?: number) => {
    const queryParams = limit ? new URLSearchParams({ limit: limit.toString() }).toString() : '';
    const endpoint = `/models/preview/${modelId}${queryParams ? `?${queryParams}` : ''}`;
    
    return fetchWithAuth(`${endpoint}`);
  },
  
  // Original forecast range method (kept for backward compatibility)
  getForecastRange: async ({
    region,
    pollutant,
    frequency,
    limit
  }: {
    region: string;
    pollutant: string;
    frequency: string;
    limit: number;
  }) => {
    try {
      const response = await fetch(
        `${API_URL}/models/forecast-range/?region=${region}&pollutant=${pollutant}&frequency=${frequency}&limit=${limit}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.detail || "Failed to get forecast range",
        };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error("API error in getForecastRange:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  },

  // Add method to check if a model exists
  checkExists: async ({
    region,
    pollutant,
    frequency
  }: {
    region: string;
    pollutant: string;
    frequency: string;
  }) => {
    const queryParams = new URLSearchParams({
      region,
      pollutant,
      frequency
    }).toString();
    
    return fetchWithAuth<{ exists: boolean }>(`/models/check-exists/?${queryParams}`);
  },
  
  // Add method to get model info
  getInfo: async (modelId: string) => {
    return fetchWithAuth(`/models/info/${modelId}`);
  },
  
  // Add method to compare models
  compareModels: async (modelIds: string[]) => {
    return fetchWithAuth('/models/compare/', {
      method: "POST",
      body: JSON.stringify({ model_ids: modelIds }),
    });
  },
  
  // Add method to get metadata filters
  getMetadataFilters: async () => {
    return fetchWithAuth('/models/metadata/filters');
  },
};

// Prediction endpoints with improved error handling
export const predictionApi = {
  forecast: async (params: { 
    pollutant: string; 
    region: string;
    frequency?: string;
    limit?: number;
    start_date?: string;
    end_date?: string;
  }) => {
    const queryParams = new URLSearchParams(params as any).toString();
    return fetchWithAuth<Array<{ 
      ds: string; 
      yhat: number; 
      yhat_lower: number; 
      yhat_upper: number;
      category: string; 
    }>>(`/models/predict/?${queryParams}`, {}, 8000);
  },
  
  // Updated method to properly handle user profile data and pollution endpoint
  getForecastWithRisk: async (params: { 
    pollutant: string; 
    region: string;
    frequency?: string;
    periods?: number;
    start_date?: string;
    end_date?: string;
    user_profile?: {
      age?: number;
      has_asthma?: boolean;
      has_heart_disease?: boolean;
      has_lung_disease?: boolean;
      has_diabetes?: boolean;
      is_smoker?: boolean;
    };
  }) => {
    // Create query parameters but handle user_profile specially
    const { user_profile, ...otherParams } = params;
    const queryParams = new URLSearchParams(otherParams as any);
    
    // Add user_profile fields individually to avoid [object Object] in query string
    if (user_profile) {
      Object.entries(user_profile).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(`user_profile_${key}`, String(value));
        }
      });
    }
    
    console.log("Final query params:", queryParams.toString());
    
    return fetchWithAuth<{
      forecast: Array<{
        ds: string;
        yhat: number;
        category: string;
        risk_score: number;
      }>,
      current: {
        ds: string;
        yhat: number;
        category: string;
        risk_score: number;
      }
    }>(`/models/forecast/risk-timeline/?${queryParams.toString()}`, {}, 8000);
  },
  
  compare: async (compareData: { pollutant: string; regions: string[] }) => {
    return fetchWithAuth("/models/predict/compare/", {
      method: "POST",
      body: JSON.stringify(compareData),
    }, 8000);
  }
};

// Health suggestions endpoints
export const healthApi = {
  getTip: async (params: { pollutant: string; region: string }) => {
    // Add include_profile=true parameter to get personalized health tips
    const queryParams = new URLSearchParams({
      ...params,
      include_profile: 'true'
    } as any).toString();
    
    return fetchWithAuth<HealthTip>(`/health/tip/?${queryParams}`);
  },
  
  // Add new AI health tip endpoint with longer timeout
  getAIHealthTip: async (params: { 
    region: string; 
    pollutant: string; 
    start_date: string; 
    end_date: string; 
  }) => {
    const queryParams = new URLSearchParams(params as any).toString();
    // Use 45 second timeout for AI processing
    return fetchWithAuth<{
      tip: string;
      riskLevel: string;
      personalized: boolean;
    }>(`/models/forecast/health-tip/?${queryParams}`, {}, 45000);
  }
};

// Insights endpoints
export const insightApi = {
  getTrend: async (params: { pollutant: string; region: string; year?: number }) => {
    const queryParams = new URLSearchParams(params as any).toString();
    return fetchWithAuth<{
      region: string;
      pollutant: string;
      trend: TrendChart;
    }>(`/insights/trend/?${queryParams}`);
  },
  getTopPolluted: async (params: { pollutant: string; year: number }) => {
    const queryParams = new URLSearchParams(params as any).toString();
    return fetchWithAuth<Array<{ name: string; value: number }>>(`/insights/top-polluted/?${queryParams}`);
  },
  getSeasonality: async (params: { pollutant: string; region: string; year?: number }) => {
    const queryParams = new URLSearchParams(params as any).toString();
    return fetchWithAuth<{
      region: string;
      pollutant: string;
      seasonal_avg: SeasonalityChart;
    }>(`/insights/seasonality/?${queryParams}`);
  },
  getAvailableDatasets: async () => {
    return fetchWithAuth<{
      [region: string]: {
        [pollutant: string]: {
          years: number[];
        };
      };
    }>('/insights/available-datasets/');
  },
  getPersonalized: async (params: { pollutant: string; region: string }) => {
    const queryParams = new URLSearchParams(params as any).toString();
    return fetchWithAuth(`/insights/personalized/?${queryParams}`);
  },
  getSummary: async (params: { pollutant: string; region: string; year: number }) => {
    const queryParams = new URLSearchParams(params as any).toString();
    return fetchWithAuth(`/insights/summary/?${queryParams}`);
  },
  getHistorical: async (params: { pollutant: string; region: string; year: number }) => {
    const queryParams = new URLSearchParams(params as any).toString();
    return fetchWithAuth(`/insights/historical/?${queryParams}`);
  }
};

// AQI alerts endpoints
export const alertApi = {
  subscribe: async (alertData: { region: string; pollutant: string; threshold: string }) => {
    // Updated to accept string thresholds instead of numeric ("Good", "Moderate", etc.)
    return fetchWithAuth("/alerts/subscribe/", {
      method: "POST",
      body: JSON.stringify(alertData),
    });
  },
  list: async () => {
    return fetchWithAuth("/alerts/my-subscriptions/");
  },
  delete: async (alertId: string) => {
    return fetchWithAuth(`/alerts/unsubscribe/${alertId}`, {
      method: "DELETE"
    });
  },
  checkAlerts: async (sendEmail: boolean = false) => {
    return fetchWithAuth(`/alerts/check-alerts/?send_email=${sendEmail}`);
  }
};

// Metadata endpoints with caching and fallback to reduce API calls
export const metadataApi = {
  // Cache for pollutants data
  _pollutantsCache: null as Array<{label: string, value: Pollutant}> | null,
  // Cache for regions data
  _regionsCache: null as Array<{label: string, value: string}> | null,
  
  getPollutants: async () => {
    // Return cached data if available
    if (metadataApi._pollutantsCache) {
      return { success: true, data: metadataApi._pollutantsCache };
    }
    
    const response = await fetchWithAuth<Array<{label: string, value: string}>>("/metadata/pollutants");
    
    // If API succeeds, cache the result
    if (response.success && response.data) {
      // Cast the data to ensure it matches the expected Pollutant type
      const typedData = response.data.map(item => ({
        label: item.label,
        value: item.value as Pollutant
      }));
      metadataApi._pollutantsCache = typedData;
    }
    
    // If API fails, return mock data
    if (!response.success) {
      console.log("Using mock pollutant data due to API failure");
      const mockData = [
        { value: "NO2" as Pollutant, label: "Nitrogen Dioxide (NO₂)" },
        { value: "O3" as Pollutant, label: "Ozone (O₃)" },
        { value: "PM10" as Pollutant, label: "Particulate Matter 10 (PM₁₀)" },
        { value: "PM25" as Pollutant, label: "Particulate Matter 2.5 (PM₂.₅)" },
        { value: "SO2" as Pollutant, label: "Sulfur Dioxide (SO₂)" }
      ];
      // Cache mock data too
      metadataApi._pollutantsCache = mockData;
      return { success: true, data: mockData };
    }
    
    return response;
  },
  
  getRegions: async () => {
    // Return cached data if available
    if (metadataApi._regionsCache) {
      return { success: true, data: metadataApi._regionsCache };
    }
    
    const response = await fetchWithAuth<Array<{label: string, value: string}>>("/metadata/regions");
    
    // If API succeeds, cache the result
    if (response.success && response.data) {
      metadataApi._regionsCache = response.data;
    }
    
    // If API fails, return standardized region data from the constant
    if (!response.success) {
      console.log("Using standard region data due to API failure");
      const standardRegions = [
        { value: "thessaloniki", label: "Thessaloniki" },
        { value: "ampelokipoi-menemeni", label: "Ampelokipoi - Menemeni" },
        { value: "neapoli-sykies", label: "Neapoli - Sykies" },
        { value: "kalamaria", label: "Kalamaria" },
        { value: "pavlos-melas", label: "Pavlos Melas" },
        { value: "pylaia-chortiatis", label: "Pylaia - Chortiatis" },
        { value: "panorama", label: "Panorama" },
      ];
      // Cache standard data
      metadataApi._regionsCache = standardRegions;
      return { success: true, data: standardRegions };
    }
    
    return response;
  },
  
  // Method to clear cache if needed
  clearCache: () => {
    metadataApi._pollutantsCache = null;
    metadataApi._regionsCache = null;
  }
};
