import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { URL } from "node:url";
import { fileURLToPath } from "node:url";

import { handleDispatchCreate, handleDispatchPreview } from "./routes/dispatchRoutes.js";
import { handleResponderChat } from "./routes/llmRoutes.js";
import { handleMlMetrics } from "./routes/mlRoutes.js";
import { handleResponderCases } from "./routes/responderCaseRoutes.js";
import { handleResponderList } from "./routes/responderRoutes.js";
import {
  handleSignalIngest,
  handleSignalQueueList,
  handleSignalQueueProcess,
} from "./routes/signalQueueRoutes.js";
import { handleSignalEvent, handleSignalLookup } from "./routes/signalRoutes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnvFile(resolve(__dirname, ".env"));

const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || "127.0.0.1";

const routes = [
  ["GET", /^\/health$/, health],
  ["POST", /^\/api\/signals$/, handleSignalEvent],
  ["GET", /^\/api\/signals\/([^/]+)$/, handleSignalLookup, ["signal_id"]],
  ["POST", /^\/api\/signal-events$/, handleSignalIngest],
  ["GET", /^\/api\/signal-events$/, handleSignalQueueList],
  ["POST", /^\/api\/signal-events\/([^/]+)\/process$/, handleSignalQueueProcess, ["event_id"]],
  ["GET", /^\/api\/responders$/, handleResponderList],
  ["GET", /^\/api\/responder-cases$/, handleResponderCases],
  ["GET", /^\/api\/ml\/metrics$/, handleMlMetrics],
  ["POST", /^\/api\/llm\/chat$/, handleResponderChat],
  ["POST", /^\/api\/dispatch$/, handleDispatchCreate],
  ["GET", /^\/api\/dispatch\/([^/]+)$/, handleDispatchPreview, ["signal_id"]],
];

const server = createServer(async (request, response) => {
  decorateResponse(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    const route = matchRoute(request.method, requestUrl.pathname);

    if (!route) {
      response.status(404).json({ error: "Route not found" });
      return;
    }

    const body = await readJsonBody(request);
    await route.handler(request, response, {
      body,
      query: requestUrl.searchParams,
      params: route.params,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    response.status(statusCode).json({
      error: error.message || "Internal server error",
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Backend API running at http://${HOST}:${PORT}`);
});

function matchRoute(method, pathname) {
  for (const [routeMethod, pattern, handler, paramNames = []] of routes) {
    const match = pathname.match(pattern);
    if (routeMethod === method && match) {
      const params = Object.fromEntries(paramNames.map((name, index) => [name, match[index + 1]]));
      return { handler, params };
    }
  }
  return null;
}

function decorateResponse(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.status = (statusCode) => {
    response.statusCode = statusCode;
    return response;
  };
  response.json = (payload) => {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(payload, null, 2));
  };
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    if (!["POST", "PUT", "PATCH"].includes(request.method)) {
      resolve({});
      return;
    }

    let body = "";
    request.on("data", (chunk) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(Object.assign(new Error("Request body must be valid JSON"), { statusCode: 400 }));
      }
    });
    request.on("error", reject);
  });
}

function health(_request, response) {
  response.json({
    status: "ok",
    service: "disaster-ai-dispatch-backend",
    llm_mode: process.env.OPENAI_API_KEY ? "openai" : "mock",
  });
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;

  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
