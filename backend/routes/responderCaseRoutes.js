import { getCustomers, getResponders } from "../services/dataService.js";
import { listResponderCases } from "../services/signalQueueService.js";

export async function handleResponderCases(_request, response, context) {
  const responderId = context.query.get("responder_id");
  if (!responderId) {
    throw Object.assign(new Error("responder_id is required"), { statusCode: 400 });
  }

  const responders = await getResponders();
  const responder = responders.find((item) => item.responder_id === responderId);
  if (!responder) {
    throw Object.assign(new Error(`No responder found for ${responderId}`), { statusCode: 404 });
  }

  const customers = await getCustomers();
  const customersById = new Map(customers.map((customer) => [customer.customer_id, customer]));
  const cases = await listResponderCases(responder);
  const fallbackCases = await listFallbackCasesForResponder(responder);
  const exactEventIds = new Set(cases.map((signal) => signal.event_id));
  const relevantCases = [
    ...cases,
    ...fallbackCases.filter((signal) => !exactEventIds.has(signal.event_id)),
  ];

  response.json({
    responder_id: responderId,
    cases: relevantCases.map((signal) => {
      const customer = customersById.get(signal.customer_id);
      return {
        event_id: signal.event_id,
        signal_id: signal.signal_id,
        customer_id: signal.customer_id,
        name: customer ? `${customer.first_name} ${customer.last_name}` : signal.customer_id,
        age: customer?.age ?? null,
        city: customer?.city || "",
        state: customer?.state || "",
        incident_type: signal.incident_type,
        priority_score: Number(signal.priority_score || 0),
        priority_level: signal.priority_level || "unknown",
        escalation_probability: Number(signal.escalation_probability || 0),
        recommended_profession: signal.recommended_responder_profession,
        distance_miles: customer ? haversineMiles(customer.latitude, customer.longitude, responder.latitude, responder.longitude) : 0,
        status: signal.status,
        needs: buildNeeds(customer),
        match_reason: buildMatchReason(signal, responder),
      };
    }),
  });
}

async function listFallbackCasesForResponder(responder) {
  const allSignals = await import("../services/signalQueueService.js").then((module) => module.listSignals());
  return allSignals
    .map((signal) => ({
      ...signal,
      fallback_score: scoreFallbackMatch(signal, responder),
    }))
    .filter((signal) => signal.fallback_score > 0)
    .sort((a, b) => {
      if (b.fallback_score !== a.fallback_score) return b.fallback_score - a.fallback_score;
      return Number(b.priority_score || 0) - Number(a.priority_score || 0);
    });
}

function scoreFallbackMatch(signal, responder) {
  let score = 0;
  const profession = String(responder.profession);

  if (signal.recommended_responder_profession === profession) score += 100;
  if (["EMT", "nurse", "physician", "paramedic"].includes(profession) && signal.escalation_required) score += 65;
  if (profession === "firefighter" && ["flood", "tornado_damage", "chemical_spill"].includes(signal.incident_type)) score += 55;
  if (profession === "police" && Number(signal.priority_score || 0) >= 85) score += 45;
  if (profession === "utility_technician" && signal.incident_type === "power_outage") score += 50;
  if (profession === "social_worker" && Number(signal.priority_score || 0) < 85) score += 35;
  if (profession === "mental_health_crisis" && Number(signal.priority_score || 0) < 90) score += 35;
  if (responder.can_handle_oxygen_support && signal.escalation_required) score += 20;
  if (responder.can_handle_mobility_transfer) score += 15;
  if (responder.can_transport_patient || responder.wheelchair_accessible_vehicle) score += 15;

  return score;
}

function buildMatchReason(signal, responder) {
  if (signal.recommended_responder_profession === responder.profession) {
    return `Direct profession match: ${responder.profession}`;
  }
  if (responder.profession === "utility_technician" && signal.incident_type === "power_outage") {
    return "Fallback match: power outage support";
  }
  if (signal.escalation_required && ["EMT", "nurse", "physician", "paramedic"].includes(responder.profession)) {
    return "Fallback match: medical escalation support";
  }
  return "Fallback match based on incident needs and responder capabilities";
}

function buildNeeds(customer) {
  if (!customer) return [];
  return [
    ...String(customer.medical_conditions || "").split("|").filter((item) => item && item !== "none"),
    ...String(customer.disability_types || "").split("|").filter((item) => item && item !== "none"),
    ...String(customer.equipment_dependencies || "").split("|").filter((item) => item && item !== "none"),
    customer.oxygen_dependent ? "oxygen dependent" : null,
    customer.needs_accessible_transport ? "accessible transport" : null,
  ]
    .filter(Boolean)
    .slice(0, 5);
}

function haversineMiles(lat1, lon1, lat2, lon2) {
  const radius = 3958.8;
  const phi1 = radians(Number(lat1));
  const phi2 = radians(Number(lat2));
  const deltaPhi = radians(Number(lat2) - Number(lat1));
  const deltaLambda = radians(Number(lon2) - Number(lon1));
  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  return Number((2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
}

function radians(value) {
  return (value * Math.PI) / 180;
}
