export async function createDispatchSummary({ signalEvent, mlResult, responderOptions }) {
  if (process.env.OPENAI_API_KEY) {
    try {
      return await createOpenAiDispatchSummary({ signalEvent, mlResult, responderOptions });
    } catch (error) {
      const fallback = createMockDispatchSummary({ signalEvent, mlResult, responderOptions });
      return {
        ...fallback,
        mode: "mock_summary_after_llm_error",
        llm_error: sanitizeLlmError(error.message),
      };
    }
  }

  return createMockDispatchSummary({ signalEvent, mlResult, responderOptions });
}

export async function answerResponderQuestion({ question, responder, selectedCase, cases = [] }) {
  const cleanQuestion = String(question || "").trim();
  if (!cleanQuestion) {
    throw Object.assign(new Error("question is required"), { statusCode: 400 });
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      return await createOpenAiResponderAnswer({ question: cleanQuestion, responder, selectedCase, cases });
    } catch (error) {
      return {
        mode: "mock_chat_after_llm_error",
        answer: createLocalResponderAnswer(cleanQuestion, selectedCase),
        llm_error: sanitizeLlmError(error.message),
      };
    }
  }

  return {
    mode: "mock_chat",
    answer: createLocalResponderAnswer(cleanQuestion, selectedCase),
  };
}

function sanitizeLlmError(message = "") {
  return message
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted_api_key]")
    .replace(/sk-proj-[A-Za-z0-9_-]+/g, "[redacted_api_key]");
}

async function createOpenAiDispatchSummary({ signalEvent, mlResult, responderOptions }) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.2",
      instructions:
        "You generate concise emergency dispatch decision support text. Use only the provided ML prediction, customer profile, and responder options. Do not invent facts. Do not claim a responder has been dispatched unless the input says so. Keep a human operator in the loop.",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify(
                {
                  signal: {
                    signal_id: signalEvent.signal_id,
                    customer_id: signalEvent.customer_id,
                    incident_type: signalEvent.incident_type,
                    received_at: signalEvent.received_at,
                  },
                  customer: publicCustomerProfile(signalEvent.customer),
                  prediction: mlResult.prediction,
                  responder_options: responderOptions,
                },
                null,
                2,
              ),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "dispatch_summary",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              summary: { type: "string" },
              key_risk_factors: {
                type: "array",
                items: { type: "string" },
              },
              recommended_action: { type: "string" },
              responder_reasoning: { type: "string" },
              dashboard_note: { type: "string" },
            },
            required: [
              "summary",
              "key_risk_factors",
              "recommended_action",
              "responder_reasoning",
              "dashboard_note",
            ],
          },
        },
      },
      max_output_tokens: 700,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error?.message || `OpenAI API request failed with ${response.status}`);
  }

  const text = payload.output_text || extractOutputText(payload);
  if (!text) {
    throw new Error("OpenAI response did not include output text");
  }

  return {
    mode: "openai_responses_api",
    ...JSON.parse(text),
  };
}

async function createOpenAiResponderAnswer({ question, responder, selectedCase, cases }) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.2",
      instructions:
        "You are a concise responder support assistant for a disaster response dashboard. Answer general responder questions and queue-specific questions using the provided responder profile, selected case, and relevant queued cases. You may explain common disaster support needs such as evacuation help, oxygen or power-dependent equipment, accessible transport, communication support, mobility transfer, wellness checks, and medical escalation. Do not invent patient-specific facts that are not in the data. Do not give clinical treatment instructions, do not replace emergency command, and keep answers under 110 words.",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify(
                {
                  question,
                  responder,
                  selected_case: selectedCase,
                  relevant_cases: cases.slice(0, 12),
                },
                null,
                2,
              ),
            },
          ],
        },
      ],
      max_output_tokens: 220,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error?.message || `OpenAI API request failed with ${response.status}`);
  }

  const answer = payload.output_text || extractOutputText(payload);
  if (!answer) {
    throw new Error("OpenAI response did not include output text");
  }

  return {
    mode: "openai_responses_api",
    answer,
  };
}

function createMockDispatchSummary({ signalEvent, mlResult, responderOptions }) {
  const riskFactors = buildRiskFactors(signalEvent.customer, signalEvent.incident_type);
  const topResponder = responderOptions[0];

  return {
    mode: "mock_summary",
    summary: `${signalEvent.customer.full_name} is ${mlResult.prediction.priority_level} priority with a score of ${mlResult.prediction.priority_score}. Recommended responder type is ${mlResult.prediction.recommended_responder_profession}.`,
    key_risk_factors: riskFactors,
    recommended_action: topResponder
      ? `Dispatch ${topResponder.name}, ${topResponder.profession}, from ${topResponder.agency}.`
      : `Dispatch the nearest available ${mlResult.prediction.recommended_responder_profession}.`,
    responder_reasoning: topResponder?.recommendation_reason || "No responder option was returned.",
    dashboard_note:
      "This summary is generated from ML outputs and responder ranking. Keep a human emergency operator in the loop.",
  };
}

function createLocalResponderAnswer(question, selectedCase) {
  const generalAnswer =
    "In this dashboard, someone may need help because they have a high ML priority score, high escalation risk, medical needs, power-dependent equipment, oxygen dependence, mobility or transfer needs, accessible transport needs, communication support needs, or they are in a dangerous incident area like flooding, heat, outage, smoke, or structural damage.";

  if (!selectedCase) {
    return generalAnswer;
  }

  const lower = question.toLowerCase();
  if (
    lower.includes("what would") ||
    lower.includes("what can") ||
    lower.includes("what kind") ||
    lower.includes("someone need") ||
    lower.includes("people need") ||
    lower.includes("help with")
  ) {
    return generalAnswer;
  }

  if (lower.includes("why") || lower.includes("priority") || lower.includes("first")) {
    return `${selectedCase.name} is prioritized because the ML score is ${Number(selectedCase.priority_score || 0).toFixed(1)} with ${selectedCase.escalation_probability}% escalation probability. The system sorts by urgency first, then responder fit and distance.`;
  }

  if (lower.includes("need") || lower.includes("bring") || lower.includes("know")) {
    const needs = selectedCase.needs?.length ? selectedCase.needs.join(", ") : "no extra needs listed";
    return `For ${selectedCase.name}, review these needs before going: ${needs}. Incident type is ${String(selectedCase.incident_type).replaceAll("_", " ")} and distance is ${selectedCase.distance_miles} miles.`;
  }

  return `Selected case: ${selectedCase.name}. Priority is ${Number(selectedCase.priority_score || 0).toFixed(1)}, escalation is ${selectedCase.escalation_probability}%, and the incident is ${String(selectedCase.incident_type).replaceAll("_", " ")}. Use command guidance before taking action.`;
}

function publicCustomerProfile(customer) {
  return {
    customer_id: customer.customer_id,
    age: customer.age,
    city: customer.city,
    state: customer.state,
    primary_language: customer.primary_language,
    communication_needs: customer.communication_needs,
    disability_types: customer.disability_types,
    mobility_level: customer.mobility_level,
    medical_conditions: customer.medical_conditions,
    medications: customer.medications,
    equipment_dependencies: customer.equipment_dependencies,
    power_dependent_equipment: customer.power_dependent_equipment,
    oxygen_dependent: customer.oxygen_dependent,
    needs_accessible_transport: customer.needs_accessible_transport,
    evacuation_assistance_level: customer.evacuation_assistance_level,
    baseline_priority_score: customer.baseline_priority_score,
    notes: customer.notes,
  };
}

function extractOutputText(payload) {
  return payload.output
    ?.flatMap((item) => item.content || [])
    .filter((content) => content.type === "output_text")
    .map((content) => content.text)
    .join("");
}

function buildRiskFactors(customer, incidentType) {
  const factors = [];
  if (customer.oxygen_dependent) factors.push("oxygen dependent");
  if (customer.power_dependent_equipment) factors.push("power-dependent equipment");
  if (customer.needs_accessible_transport) factors.push("accessible transport needed");
  if (String(customer.disability_types).includes("mobility")) factors.push("mobility disability");
  if (String(customer.medical_conditions).toLowerCase().includes("copd")) factors.push("COPD");
  if (String(customer.communication_needs).includes("ASL")) factors.push("ASL or communication support");
  factors.push(`incident type: ${incidentType}`);
  return factors;
}
