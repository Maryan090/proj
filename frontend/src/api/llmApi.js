const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:4000";

export async function askResponderAssistant({ question, responderId, selectedCase, cases }) {
  const response = await fetch(`${API_BASE_URL}/api/llm/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      question,
      responder_id: responderId,
      selected_case: selectedCase,
      cases,
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Responder assistant request failed");
  }

  return payload;
}
