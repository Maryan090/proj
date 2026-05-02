import { getResponders } from "../services/dataService.js";
import { answerResponderQuestion } from "../services/llmDispatchService.js";

export async function handleResponderChat(_request, response, context) {
  const question = context.body?.question;
  const responderId = context.body?.responder_id;
  const selectedCase = context.body?.selected_case || null;
  const cases = Array.isArray(context.body?.cases) ? context.body.cases : [];

  const responders = await getResponders();
  const responder = responders.find((item) => item.responder_id === responderId) || null;

  const result = await answerResponderQuestion({
    question,
    responder: responder
      ? {
          responder_id: responder.responder_id,
          name: `${responder.first_name} ${responder.last_name}`,
          profession: responder.profession,
          agency: responder.agency,
          status: responder.status,
          capabilities: {
            can_transport_patient: responder.can_transport_patient,
            can_handle_oxygen_support: responder.can_handle_oxygen_support,
            can_handle_mobility_transfer: responder.can_handle_mobility_transfer,
            wheelchair_accessible_vehicle: responder.wheelchair_accessible_vehicle,
          },
        }
      : null,
    selectedCase,
    cases,
  });

  response.json(result);
}
