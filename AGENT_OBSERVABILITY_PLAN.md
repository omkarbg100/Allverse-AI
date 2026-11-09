# Agent Observability / Request Steps

## Goal

Show the flow an agent follows for each user prompt, similar to ChatGPT's
"thinking / searching / adding" style updates, without a large refactor.

## Current Implementation (Minimal)

- Backend `/chat` returns:
  - `answer`
  - `images`
  - `artifacts`
  - `trace_id`
  - `steps`
- `steps` contains lifecycle labels such as:
  - `received_request`
  - `persisting_user_message`
  - `thinking`
  - `running_<agent>`
  - `completed`
- Frontend stores `trace_id` and `steps` on the assistant message and renders
  them under the response.

## Desired Next Step: Real Agent Flow

Make `steps` reflect the actual agent path, for example:

- `routing_to_search`
- `searching_web`
- `generating_response`
- `completed`

Or for PDF generation:

- `routing_to_pdf`
- `reading_source`
- `generating_document`
- `uploading_file`
- `completed`

## Non-Goals For Now

- No OpenTelemetry collector setup.
- No Langfuse integration yet.
- No live streaming/SSE yet.

## Future Options

- Add Langfuse callback handler for LLM generations, tokens, and latency.
- Add OpenTelemetry spans for FastAPI, HTTPX, Redis, and tool calls.
- Stream steps live to the frontend instead of returning them at the end.
