# Disaster Response AI Dispatch Project

Hackathon project for receiving a device `signal_id`, matching it to a disabled customer profile, prioritizing who needs help, and recommending first responders by profession, capability, location, and availability.

## Current Structure

- `data/`: large synthetic CSV datasets and schema notes.
- `scripts/generate_fake_data.mjs`: reproducible synthetic data generator.
- `backend/`: Node API for signal lookup, ML dispatch prediction, responder matching, and dashboard-ready summaries.
- `backend/ml/`: training, evaluation metrics, saved ML models, and dispatch prediction script.
- `frontend/`: React dashboard for visualizing ML predictions, responder matches, and LLM summaries.

## File Responsibilities

### Backend

- `backend/server.js`: Main HTTP API server. Loads `backend/.env`, enables CORS, routes requests, parses JSON bodies, and exposes the health check plus signal/dispatch APIs.
- `backend/package.json`: Backend npm scripts. `npm start` runs the API server and `npm run dev` runs it in watch mode.
- `backend/.env.example`: Template for local secrets and model settings. Copy to `backend/.env` and add `OPENAI_API_KEY`.
- `backend/README.md`: Backend-specific setup, route, and dispatch-flow documentation.
- `backend/routes/signalRoutes.js`: Route handlers for signal intake and signal lookup. Uses the signal service to find the customer connected to a device.
- `backend/routes/dispatchRoutes.js`: Route handlers for the full AI dispatch workflow. Calls customer lookup, ML prediction, responder ranking, and LLM summary generation.
- `backend/services/dataService.js`: Loads and parses CSV data from `data/`. Caches customers, responders, disaster zones, shelters, and historical cases in memory.
- `backend/services/signalLookupService.js`: Matches incoming `signal_id` values to customer profiles and creates timestamped signal events.
- `backend/services/priorityService.js`: Calls the trained Python ML predictor and returns priority score, escalation probability, priority level, and recommended responder profession.
- `backend/services/responderMatchingService.js`: Prepares ranked responder options for the API response and adds human-readable match reasons.
- `backend/services/llmDispatchService.js`: Generates the dispatcher summary. Uses OpenAI Responses API when `OPENAI_API_KEY` is set and falls back to a local mock summary if the API is unavailable.

### ML

- `backend/ml/README.md`: ML-specific training plan, commands, model outputs, and metrics explanation.
- `backend/ml/requirements.txt`: Python dependencies for training and prediction: `pandas`, `scikit-learn`, and `joblib`.
- `backend/ml/ml_common.py`: Shared ML utilities. Loads CSVs, joins customer and historical case data, converts timestamps into `received_hour` and `received_month`, and defines model feature columns.
- `backend/ml/train_models.py`: Trains all three models, evaluates them, saves `.joblib` model files, and writes `metrics.json`.
- `backend/ml/predict_dispatch.py`: Loads saved models and runs live prediction for one `signal_id`. Also ranks responders using distance, availability, profession, and capability scoring.
- `backend/ml/models/escalation_model.joblib`: Saved binary classifier for `escalation_required`.
- `backend/ml/models/priority_model.joblib`: Saved regression model for the 0-100 urgency score.
- `backend/ml/models/responder_profession_model.joblib`: Saved multiclass classifier for recommended responder profession.
- `backend/ml/models/metrics.json`: Saved evaluation metrics from the latest training run.

### Data And Scripts

- `data/customers.csv`: Synthetic disabled/customer registry. `signal_id` is the device ID and maps to `customer_id`.
- `data/responders.csv`: Synthetic first responders with profession, agency, location, status, vehicle, and capability fields.
- `data/disaster_zones.csv`: Simulated disaster context such as incident type, severity, power outage, road access, and cell service.
- `data/shelters.csv`: Synthetic shelter capacity and accessibility-resource data.
- `data/historical_cases.csv`: Synthetic training/testing data for urgency prediction, escalation prediction, and responder profession prediction.
- `data/incoming_signals.csv`: Example schema for a real-time disaster signal stream. Tracks repeated signals, source gateway, device health, queue status, processing result, and assignment.
- `data/schema_notes.json`: Machine-readable notes about the intended lookup, prediction, and matching flow.
- `data/README.md`: Explanation of the synthetic data files and how they support the backend/ML flow.
- `scripts/generate_fake_data.mjs`: Recreates all synthetic CSV files with repeatable fake data.

### Frontend

- `frontend/package.json`: Frontend npm scripts and React/Vite dependencies.
- `frontend/index.html`: Browser entry point for the React app.
- `frontend/src/main.jsx`: React mount file that renders the app.
- `frontend/src/App.jsx`: Main responder dashboard screen. Loads dispatch data, manages responder login state, filters relevant cases, and lays out visualization widgets.
- `frontend/src/api/dispatchApi.js`: API client for calling the backend dispatch endpoint.
- `frontend/src/api/responderApi.js`: API client for loading responder profiles from the backend CSV database.
- `frontend/src/api/caseApi.js`: API client for loading responder-specific active cases from the backend signal queue.
- `frontend/src/api/mlApi.js`: API client for loading saved ML model metrics from the backend.
- `frontend/src/components/LoginPage.jsx`: First screen of the app. Uses stored fake responder profiles as login options and opens the responder-specific dashboard.
- `frontend/src/components/ResponderLogin.jsx`: Responder workspace selector. Simulates responder login and filters the dashboard to that responder's profession/capabilities.
- `frontend/src/components/ResponderAnalytics.jsx`: Analytics widget for cases relevant to the logged-in responder, including critical case counts and incident-type bars.
- `frontend/src/components/ResponderCaseQueue.jsx`: Top-three relevant people list. Hovering a case reveals key medical/accessibility details in a popover.
- `frontend/src/components/PriorityDashboard.jsx`: ML visualization widget with priority gauge, risk bars, stacked priority chart, and model metric cards.
- `frontend/src/components/DispatchSummary.jsx`: LLM result widget showing summary, key risk factors, recommended action, and responder reasoning.
- `frontend/src/styles/main.css`: Dashboard styling, responsive layout, KPI cards, charts, gauge, donut, and widget visuals.

## Data Flow

1. Backend receives a `signal_id` from a device/tag.
2. Backend creates the request timestamp.
3. Backend finds the matching customer through `data/customers.csv`.
4. AI/ML prioritizes urgency using customer, disaster zone, shelter, and historical case data.
5. AI recommends the best responder options based on profession and capabilities.
6. React dashboard shows prioritized cases and responder assignment options.

## ML Commands

```bash
python3 -m pip install -r backend/ml/requirements.txt
python3 backend/ml/train_models.py
python3 backend/ml/predict_dispatch.py SIG-0000001 --incident-type power_outage
```

## Backend Commands

```bash
cd backend
npm start
```

To turn on the real OpenAI LLM summary:

```bash
export OPENAI_API_KEY="your_api_key_here"
export OPENAI_MODEL="gpt-5.2"
cd backend
npm start
```

The backend also supports a local `backend/.env` file:

```text
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-5.2
```

Useful API routes:

- `GET /health`
- `POST /api/signals` with `{ "signal_id": "SIG-0000001", "incident_type": "power_outage" }`
- `GET /api/signals/SIG-0000001`
- `POST /api/signal-events`
- `GET /api/signal-events`
- `POST /api/signal-events/:event_id/process`
- `GET /api/responders`
- `GET /api/responder-cases?responder_id=RESP-000614`
- `GET /api/ml/metrics`
- `POST /api/dispatch` with `{ "signal_id": "SIG-0000001", "incident_type": "power_outage", "limit": 3 }`
- `GET /api/dispatch/SIG-0000001?incident_type=power_outage&limit=3`

## Frontend Commands

Run the backend first, then open the frontend:

```bash
cd backend
npm start
```

```bash
cd frontend
npm install
npm run dev
```

The frontend calls `http://127.0.0.1:4000` by default.
