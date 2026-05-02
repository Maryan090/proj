import { useMemo, useState } from "react";
import { askResponderAssistant } from "../api/llmApi.js";

export default function DispatchSummary({ summary, responder, selectedSignalId, cases = [] }) {
  const selectedCase = useMemo(
    () => cases.find((caseItem) => caseItem.signal_id === selectedSignalId) || cases[0],
    [cases, selectedSignalId],
  );
  const factors = summary?.key_risk_factors || [];
  const defaultExplanation = selectedCase
    ? `The system helps the most needed people first by sorting active signals by ML priority, escalation probability, responder fit, and distance. ${selectedCase.name} is currently scored ${selectedCase.priority_score.toFixed(1)} with ${selectedCase.escalation_probability}% escalation risk.`
    : "The system helps the most needed people first by sorting active signals by ML priority, escalation probability, responder fit, and distance.";
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Ask a question.",
    },
  ]);
  const [chatLoading, setChatLoading] = useState(false);

  async function handleAsk(event) {
    event.preventDefault();
    const cleanQuestion = question.trim();
    if (!cleanQuestion || chatLoading) return;

    setQuestion("");
    setMessages((current) => [...current, { role: "user", text: cleanQuestion }]);
    setChatLoading(true);

    try {
      const result = await askResponderAssistant({
        question: cleanQuestion,
        responderId: responder?.responder_id,
        selectedCase,
        cases,
      });
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: result.answer,
          mode: result.mode,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: error.message,
          mode: "error",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <section className="widget summary-widget">
      <div className="widget-heading">
        <p>LLM Responder Support</p>
        <span>{summary?.mode || "ready"}</span>
      </div>
      <p className="summary-copy">{summary?.summary || defaultExplanation}</p>

      <div className="risk-chip-row">
        {factors.map((factor) => (
          <span key={factor}>{factor}</span>
        ))}
      </div>

      <div className="summary-block">
        <span>Recommended Action</span>
        <strong>{summary?.recommended_action || buildDefaultAction(selectedCase, responder)}</strong>
      </div>

      <div className="summary-block muted">
        <span>Responder Reasoning</span>
        <p>{summary?.responder_reasoning || buildDefaultReasoning(selectedCase, responder)}</p>
      </div>

      <div className="llm-chat">
        <div className="llm-chat-log">
          {messages.map((message, index) => (
            <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
              <span>{message.role === "user" ? "You" : "GPT"}</span>
              <FormattedChatText text={message.text} />
            </div>
          ))}
          {chatLoading ? (
            <div className="chat-message assistant">
              <span>GPT</span>
              Thinking...
            </div>
          ) : null}
        </div>
        <form className="llm-chat-form" onSubmit={handleAsk}>
          <input
            aria-label="Ask GPT a responder question"
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask..."
            type="text"
            value={question}
          />
          <button type="submit">{chatLoading ? "Ask..." : "Ask GPT"}</button>
        </form>
      </div>
    </section>
  );
}

function buildDefaultAction(selectedCase, responder) {
  if (!selectedCase) return "Review the queue and select the highest-priority case.";
  return `${responder?.first_name || "Responder"} should review ${selectedCase.name}, ${selectedCase.distance_miles} mi away, before accepting the case.`;
}

function FormattedChatText({ text }) {
  const cleanText = String(text || "").replaceAll("**", "");
  const parts = cleanText
    .split(/\n|(?=\s+-\s+)/)
    .map((part) => part.trim().replace(/^-\s*/, ""))
    .filter(Boolean);

  if (parts.length <= 1) {
    return <p>{cleanText}</p>;
  }

  return (
    <>
      <p>{parts[0]}</p>
      <ul>
        {parts.slice(1).map((part) => (
          <li key={part}>{part}</li>
        ))}
      </ul>
    </>
  );
}

function buildDefaultReasoning(selectedCase, responder) {
  if (!selectedCase) return "Waiting for active signal data from the backend queue.";
  return `This case appears because it matches ${responder?.profession || "the responder role"} needs and is ranked against urgency, escalation risk, and distance.`;
}
