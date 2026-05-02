export default function ResponderAnalytics({ cases, responder }) {
  const critical = cases.filter((caseItem) => caseItem.priority_score >= 85).length;
  const avgDistance = cases.length
    ? cases.reduce((sum, caseItem) => sum + caseItem.distance_miles, 0) / cases.length
    : 0;
  const incidentCounts = countBy(cases, "incident_type");
  const maxCount = Math.max(1, ...Object.values(incidentCounts));

  return (
    <section className="widget responder-analytics-widget">
      <div className="widget-heading">
        <p>Relevant Case Analytics</p>
        <span>{responder?.profession || "loading"}</span>
      </div>

      <div className="analytics-split">
        <div className="analytics-number">
          <span>Critical</span>
          <strong>{critical}</strong>
          <p>people need this responder type now</p>
        </div>
        <div className="analytics-number">
          <span>Avg Distance</span>
          <strong>{avgDistance.toFixed(1)} mi</strong>
          <p>from current staging area</p>
        </div>
      </div>

      <div className="horizontal-chart">
        {!Object.keys(incidentCounts).length ? <p className="empty-state">No matching active incidents.</p> : null}
        {Object.entries(incidentCounts).map(([incident, count]) => (
          <div key={incident}>
            <span>{incident.replaceAll("_", " ")}</span>
            <div>
              <i style={{ width: `${(count / maxCount) * 100}%` }} />
            </div>
            <strong>{count}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    counts[item[key]] = (counts[item[key]] || 0) + 1;
    return counts;
  }, {});
}
