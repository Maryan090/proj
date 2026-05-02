import { useEffect, useMemo, useState } from "react";
import { fetchResponderCases } from "./api/caseApi.js";
import { fetchDispatch } from "./api/dispatchApi.js";
import { fetchMlMetrics } from "./api/mlApi.js";
import { fetchResponders } from "./api/responderApi.js";
import PriorityDashboard from "./components/PriorityDashboard.jsx";
import DispatchSummary from "./components/DispatchSummary.jsx";
import ResponderLogin from "./components/ResponderLogin.jsx";
import ResponderCaseQueue from "./components/ResponderCaseQueue.jsx";
import ResponderAnalytics from "./components/ResponderAnalytics.jsx";
import OperationsOverview from "./components/OperationsOverview.jsx";
import LoginPage from "./components/LoginPage.jsx";

export default function App() {
  const [signalId, setSignalId] = useState("");
  const [dispatch, setDispatch] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [responderProfiles, setResponderProfiles] = useState([]);
  const [selectedResponderId, setSelectedResponderId] = useState("");
  const [relevantCases, setRelevantCases] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  async function loadDispatch(nextSignalId, nextIncidentType) {
    setLoading(true);
    setError("");
    try {
      const payload = await fetchDispatch(nextSignalId, nextIncidentType, 3);
      setDispatch(payload);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function loadResponders() {
      try {
        const responders = await fetchResponders();
        if (responders.length) {
          setResponderProfiles(responders);
          if (!selectedResponderId || !responders.some((responder) => responder.responder_id === selectedResponderId)) {
            setSelectedResponderId(responders[0].responder_id);
          }
        }
      } catch (requestError) {
        setError(requestError.message);
      }
    }

    loadResponders();
  }, [selectedResponderId]);

  useEffect(() => {
    async function loadMetrics() {
      try {
        setMetrics(await fetchMlMetrics());
      } catch {
        setMetrics(null);
      }
    }

    loadMetrics();
  }, []);

  const selectedResponder = useMemo(
    () => responderProfiles.find((responder) => responder.responder_id === selectedResponderId) || responderProfiles[0],
    [selectedResponderId],
  );
  const modelMetrics = useMemo(() => buildModelMetrics(metrics), [metrics]);
  const dashboardStats = useMemo(
    () => buildDashboardStats(dispatch, relevantCases, selectedResponder),
    [dispatch, relevantCases, selectedResponder],
  );

  useEffect(() => {
    async function loadRelevantCases() {
      if (!isLoggedIn || !selectedResponder?.responder_id) return;
      setError("");
      try {
        const cases = await fetchResponderCases(selectedResponder.responder_id);
        setRelevantCases(cases);
        if (!signalId && cases[0]) setSignalId(cases[0].signal_id);
      } catch (requestError) {
        setError(requestError.message);
        setRelevantCases([]);
      }
    }

    loadRelevantCases();
  }, [isLoggedIn, selectedResponder?.responder_id]);

  function handleCaseSelect(caseItem) {
    setSignalId(caseItem.signal_id);
    loadDispatch(caseItem.signal_id, caseItem.incident_type);
  }

  function handleLogin(nextResponderId = selectedResponderId) {
    setSelectedResponderId(nextResponderId);
    setIsLoggedIn(true);
  }

  function handleLogout() {
    setIsLoggedIn(false);
  }

  if (!isLoggedIn) {
    return (
      <LoginPage
        responders={responderProfiles}
        selectedResponderId={selectedResponderId}
        onResponderChange={setSelectedResponderId}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">AD</div>
        <div>
          <p className="eyebrow">AI Disaster Response</p>
          <h1>Responder Operations Dashboard</h1>
        </div>
        <div className="status-cluster">
          <span className="status-dot" />
          <span>{dispatch?.dispatch_summary?.mode === "openai_responses_api" ? "OpenAI LLM" : "Local Fallback"}</span>
          <button className="text-action" type="button" onClick={handleLogout}>
            Switch
          </button>
        </div>
      </header>

      <ResponderLogin
        responder={selectedResponder}
      />
      {error ? <p className="dashboard-error">{error}</p> : null}

      <section className="kpi-grid">
        {dashboardStats.map((stat) => (
          <article className="widget kpi-card" key={stat.label}>
            <p>{stat.label}</p>
            <strong>{stat.value}</strong>
            <span>{stat.detail}</span>
            <div className="sparkline" style={{ "--spark": stat.spark }} />
          </article>
        ))}
      </section>

      <section className="dashboard-grid">
        <ResponderAnalytics cases={relevantCases} responder={selectedResponder} />
        <ResponderCaseQueue
          cases={relevantCases}
          selectedCaseId={signalId}
          onSelectCase={handleCaseSelect}
          loading={loading}
        />
        <OperationsOverview cases={relevantCases} selectedSignalId={signalId} />
        <DispatchSummary
          cases={relevantCases}
          responder={selectedResponder}
          selectedSignalId={signalId}
          summary={dispatch?.dispatch_summary}
        />
      </section>
    </main>
  );
}

function buildDashboardStats(dispatch, relevantCases, selectedResponder) {
  const selectedCase = relevantCases.find((caseItem) => caseItem.signal_id === dispatch?.signal?.signal_id) || relevantCases[0];
  const score = dispatch?.prediction?.priority_score ?? 0;
  const responders = dispatch?.responder_options || [];
  const nearest = responders[0]?.distance_miles ?? 0;
  const probability = Math.round((dispatch?.prediction?.escalation_probability ?? selectedCase?.escalation_probability / 100 ?? 0) * 100);
  const critical = relevantCases.filter((caseItem) => caseItem.priority_score >= 85).length;
  const selectedScore = score || selectedCase?.priority_score || 0;
  const selectedProbability = probability || selectedCase?.escalation_probability || 0;

  return [
    {
      label: "Relevant Cases",
      value: relevantCases.length || "--",
      detail: selectedResponder?.profession || "loading responders",
      spark: `${Math.min(95, Math.max(18, relevantCases.length * 16))}%`,
    },
    {
      label: "Critical Now",
      value: critical || "--",
      detail: "sorted by ML priority",
      spark: `${Math.min(95, Math.max(18, critical * 24))}%`,
    },
    {
      label: "Selected Priority",
      value: selectedScore ? selectedScore.toFixed(1) : "--",
      detail: dispatch?.prediction?.priority_level?.toUpperCase() || selectedCase?.priority_level?.toUpperCase() || "WAITING",
      spark: `${Math.min(95, Math.max(18, selectedScore))}%`,
    },
    {
      label: "Selected Escalation",
      value: `${selectedProbability}%`,
      detail: nearest ? `${nearest} mi closest` : "waiting on responder match",
      spark: `${Math.min(95, Math.max(18, selectedProbability))}%`,
    },
  ];
}

function buildModelMetrics(metrics) {
  if (!metrics?.models) {
    return [
      { label: "Escalation F1", value: "--", tone: "teal" },
      { label: "Escalation ROC", value: "--", tone: "blue" },
      { label: "Priority R2", value: "--", tone: "gold" },
      { label: "Top-3 Match", value: "--", tone: "green" },
    ];
  }

  return [
    { label: "Escalation F1", value: metrics.models.escalation_required.f1.toFixed(3), tone: "teal" },
    { label: "Escalation ROC", value: metrics.models.escalation_required.roc_auc.toFixed(3), tone: "blue" },
    { label: "Priority R2", value: metrics.models.priority_score_assigned.r2.toFixed(3), tone: "gold" },
    { label: "Top-3 Match", value: metrics.models.matched_responder_profession.top_3_accuracy.toFixed(3), tone: "green" },
  ];
}
