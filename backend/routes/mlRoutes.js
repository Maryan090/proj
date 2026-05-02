import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function handleMlMetrics(_request, response) {
  const metricsPath = resolve(__dirname, "../ml/models/metrics.json");
  const metrics = JSON.parse(await readFile(metricsPath, "utf8"));
  response.json(metrics);
}
