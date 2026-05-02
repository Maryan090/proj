import { useState } from "react";
import { fetchSignalCustomer } from "../api/dispatchApi.js";

export default function ResponderCaseQueue({ cases, selectedCaseId, onSelectCase, loading }) {
  const topCases = cases.slice(0, 3);
  const [hoverDetails, setHoverDetails] = useState({});

  async function loadHoverDetails(caseItem) {
    if (hoverDetails[caseItem.signal_id]) return;
    setHoverDetails((current) => ({
      ...current,
      [caseItem.signal_id]: { loading: true },
    }));

    try {
      const customer = await fetchSignalCustomer(caseItem.signal_id);
      setHoverDetails((current) => ({
        ...current,
        [caseItem.signal_id]: { customer },
      }));
    } catch (error) {
      setHoverDetails((current) => ({
        ...current,
        [caseItem.signal_id]: { error: error.message },
      }));
    }
  }

  return (
    <section className="widget case-queue-widget">
      <div className="widget-heading">
        <p>Top 3 Relevant People</p>
        <span>{cases.length} matching cases</span>
      </div>

      <div className="case-list">
        {!topCases.length ? (
          <div className="empty-state">No active queued cases match this responder yet.</div>
        ) : null}
        {topCases.map((caseItem, index) => (
          <button
            className={`case-row ${selectedCaseId === caseItem.signal_id ? "selected" : ""}`}
            key={caseItem.signal_id}
            type="button"
            onMouseEnter={() => loadHoverDetails(caseItem)}
            onFocus={() => loadHoverDetails(caseItem)}
            onClick={() => onSelectCase(caseItem)}
          >
            <span className="case-rank">{index + 1}</span>
            <div className="case-main">
              <strong>{caseItem.name}</strong>
              <span>{caseItem.city}, {caseItem.state} · {formatIncident(caseItem.incident_type)}</span>
              <div className="case-tags">
                {caseItem.needs.slice(0, 3).map((need) => (
                  <i key={need}>{need}</i>
                ))}
              </div>
            </div>
            <div className="case-score">
              <strong>{caseItem.priority_score.toFixed(1)}</strong>
              <span>{caseItem.distance_miles} mi</span>
              {selectedCaseId === caseItem.signal_id && loading ? <em>loading</em> : null}
            </div>
            <CasePopover caseItem={caseItem} details={hoverDetails[caseItem.signal_id]} />
          </button>
        ))}
      </div>
    </section>
  );
}

function CasePopover({ caseItem, details }) {
  const customer = details?.customer;

  if (details?.loading) {
    return (
      <aside className="case-popover">
        <strong>{caseItem.customer_id}</strong>
        <p>Loading customer profile from backend...</p>
      </aside>
    );
  }

  if (details?.error) {
    return (
      <aside className="case-popover">
        <strong>{caseItem.customer_id}</strong>
        <p>{details.error}</p>
      </aside>
    );
  }

  return (
    <aside className="case-popover">
      <strong>{customer?.customer_id || caseItem.customer_id}</strong>
      <p>{buildCustomerSummary(customer, caseItem)}</p>
      <span>Escalation probability: {caseItem.escalation_probability}%</span>
      <span>Mobility: {customer?.mobility_level || "unknown"}</span>
      <span>Language: {customer?.primary_language || "unknown"}</span>
    </aside>
  );
}

function buildCustomerSummary(customer, caseItem) {
  if (!customer) return caseItem.hover;
  return [
    `${customer.first_name} ${customer.last_name}`,
    `${customer.city}, ${customer.state}`,
    `medical: ${customer.medical_conditions}`,
    `equipment: ${customer.equipment_dependencies}`,
    `communication: ${customer.communication_needs}`,
  ].join(" | ");
}

function formatIncident(value) {
  return value.replaceAll("_", " ");
}
