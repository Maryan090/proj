import {
  ingestSignal,
  listSignals,
  markSignalProcessed,
  markSignalProcessing,
} from "../services/signalQueueService.js";
import { runDispatchFlow } from "./dispatchRoutes.js";

export async function handleSignalIngest(_request, response, context) {
  const result = await ingestSignal(context.body);
  response.status(result.deduplicated ? 200 : 201).json(result);
}

export async function handleSignalQueueList(_request, response, context) {
  response.json({
    signals: await listSignals({ status: context.query.get("status") || undefined }),
  });
}

export async function handleSignalQueueProcess(_request, response, context) {
  const eventId = context.params.event_id;
  const queuedSignal = await markSignalProcessing(eventId);
  const dispatchResult = await runDispatchFlow({
    signalId: queuedSignal.signal_id,
    incidentType: queuedSignal.incident_type,
    limit: Number(context.body?.limit || 3),
  });
  const updatedSignal = await markSignalProcessed(eventId, dispatchResult);

  response.json({
    signal_event: updatedSignal,
    dispatch: dispatchResult,
  });
}
