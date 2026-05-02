const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:4000";

export async function fetchMlMetrics() {
  const response = await fetch(`${API_BASE_URL}/api/ml/metrics`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "ML metrics request failed");
  }

  return payload;
}
