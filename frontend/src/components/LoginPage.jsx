import { useState } from "react";

export default function LoginPage({ responders, selectedResponderId, onResponderChange, onLogin }) {
  const selectedResponder = responders.find((responder) => responder.responder_id === selectedResponderId);
  const [nameQuery, setNameQuery] = useState(selectedResponder?.name || "");
  const [loginError, setLoginError] = useState("");

  function handleQueryChange(event) {
    const nextQuery = event.target.value;
    setNameQuery(nextQuery);
    setLoginError("");
  }

  function handleLoginClick() {
    const exact = responders.find((responder) => responder.name.toLowerCase() === nameQuery.trim().toLowerCase());
    if (exact) {
      onResponderChange(exact.responder_id);
      onLogin(exact.responder_id);
      return;
    }
    setLoginError(`Responder name not found. Try ${responders.slice(0, 4).map((responder) => responder.name).join(", ")}.`);
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="login-brand">AD</div>
        <p className="eyebrow">Responder Access</p>
        <h1>AI Dispatch Workspace</h1>
        <p className="login-copy">
          Enter your responder name to open a dashboard filtered to the people most relevant
          to that responder's profession and capabilities.
        </p>

        <label>
          <span>Responder Name</span>
          <input
            value={nameQuery}
            onChange={handleQueryChange}
            placeholder="Enter responder name"
            disabled={!responders.length}
          />
        </label>
        {loginError ? <p className="error-message">{loginError}</p> : null}

        <button type="button" onClick={handleLoginClick} disabled={!responders.length}>
          {responders.length ? "Open Responder Dashboard" : "Loading Responders"}
        </button>
      </section>
    </main>
  );
}
