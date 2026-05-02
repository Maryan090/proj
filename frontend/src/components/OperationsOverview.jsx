export default function OperationsOverview({ cases, selectedSignalId }) {
  const topThreeCaseIds = new Set(cases.slice(0, 3).map((caseItem) => caseItem.signal_id));
  const surroundingCases = cases.filter((caseItem) => !topThreeCaseIds.has(caseItem.signal_id)).slice(0, 12);
  const selected = cases.find((caseItem) => caseItem.signal_id === selectedSignalId) || surroundingCases[0];
  const critical = cases.filter((caseItem) => caseItem.priority_score >= 85).length;
  const high = cases.filter((caseItem) => caseItem.priority_score < 85 && caseItem.priority_score >= 70).length;
  const active = cases.length;

  return (
    <section className="widget operations-widget">
      <div className="widget-heading">
        <p>Operational Area View</p>
        <span>next {surroundingCases.length} relevant cases</span>
      </div>

      <div className="ops-layout">
        <div className="ops-map">
          <div className="range-ring ring-one" />
          <div className="range-ring ring-two" />
          <div className="range-ring ring-three" />
          <div className="responder-pin">R</div>
          {surroundingCases.map((caseItem, index) => (
            <div
              className={`case-pin ${caseItem.signal_id === selectedSignalId ? "selected" : ""}`}
              key={caseItem.signal_id}
              style={{
                "--x": `${12 + ((index * 19) % 76)}%`,
                "--y": `${14 + ((index * 29) % 70)}%`,
              }}
              title={`${caseItem.name} · ${caseItem.priority_score.toFixed(1)}`}
            >
              {index + 1}
            </div>
          ))}
        </div>

        <div className="ops-side">
          <div className="ops-status-grid">
            <StatusTile label="Critical" value={critical} tone="critical" />
            <StatusTile label="High" value={high} tone="high" />
            <StatusTile label="Active" value={active} tone="active" />
          </div>

          <div className="ops-focus">
            <span>Selected Case</span>
            <strong>{selected?.name || "No case selected"}</strong>
            <p>
              {selected
                ? `${selected.incident_type.replaceAll("_", " ")} · ${selected.distance_miles} mi · score ${selected.priority_score.toFixed(1)}`
                : "Waiting for case data from the signal queue."}
            </p>
          </div>
        </div>
      </div>

      <div className="ops-case-strip">
        {surroundingCases.map((caseItem) => (
          <article className={caseItem.signal_id === selectedSignalId ? "active" : ""} key={caseItem.signal_id}>
            <span>{caseItem.priority_level}</span>
            <strong>{caseItem.name}</strong>
            <p>{caseItem.needs.slice(0, 2).join(" · ")}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function StatusTile({ label, value, tone }) {
  return (
    <div className={`ops-status ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
