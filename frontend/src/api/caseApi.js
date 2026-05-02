const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:4000";

export async function fetchResponderCases(responderId) {
  const url = new URL("/api/responder-cases", API_BASE_URL);
  url.searchParams.set("responder_id", responderId);

  const response = await fetch(url);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Responder cases request failed");
  }

  return payload.cases;
}
