# Allverse AI — Multi-Agent AI Workspace

<p align="center">
  <strong>Every AI skill you need, in one calm workspace.</strong>
</p>

<p align="center">
  React frontend · Node.js microservices · Python LangGraph agent service · LiteLLM · local Ollama
</p>

---

## Screenshots

<p align="center">
  <img src="data/image.png" alt="Allverse AI landing page" width="900" />
</p>

<p align="center">
  <em>Landing page — one workspace for chat, code, documents, decks, images, and search.</em>
</p>

<p align="center">
  <img src="data/image%20copy.png" alt="Allverse AI multi-agent chat workspace" width="900" />
</p>

<p align="center">
  <em>Chat workspace — Auto routing plus Chat, Coding, PDF, PPT, Vision, and Search modes.</em>
</p>

---

## Overview

**Allverse AI** is a multi-agent AI platform that combines several specialized AI workflows in a single chat workspace.

A user request enters through the React frontend and the API Gateway, then a LangGraph router sends it to the right specialist agent. Agents can call a local LLM through a LiteLLM gateway, use web search, generate documents and presentations, create images, or read uploaded PDFs.

The platform is built as a set of independently deployable services:

- **React + Vite frontend** for the workspace UI
- **Node.js / Express microservices** for auth, chat, billing, and API routing
- **Python FastAPI service** for LangChain / LangGraph agent orchestration
- **LiteLLM** as a unified OpenAI-compatible model gateway
- **Ollama** for local model inference
- **MongoDB, Redis, Qdrant, and S3-compatible storage** for persistence, memory, retrieval, and files

The project is configured to run with one local Ollama model, `llama3.2:3b`, used by every agent.

---

## Features

### Multi-agent orchestration

- LangGraph state graph with a deterministic router
- Auto-routing based on uploaded file type and prompt keywords
- Manual agent selection from the UI
- Shared conversation memory across agents

### Specialized agents

- **Chat** — general conversation and explanations
- **Search** — Tavily web search followed by an AI summary
- **Coding** — code generation, review, debugging, and explanation
- **PDF** — generates downloadable PDF documents
- **PPT** — generates downloadable PowerPoint decks
- **Vision** — creates images from text prompts
- **PDF RAG** — answers questions from an uploaded PDF
- **Image Analyzer** — analyzes an uploaded image with a vision-capable model

### Artifacts and file handling

- Uploaded PDFs and images handled with multipart form data
- Generated PDF, PPTX, and image files stored in S3-compatible storage
- Time-limited presigned download links
- Generated code returned as project artifacts or Markdown

### AI infrastructure

- LiteLLM gateway with OpenAI-compatible API
- Local Ollama inference through `llama3.2:3b`
- Optional Groq fallback configuration
- Per-agent Redis rate limiting
- Redis conversation memory
- Qdrant vector store used by PDF RAG for chunk retrieval

### Authentication

- Email/password registration and login with scrypt password hashing
- Firebase Google sign-in support
- Demo login for local development
- Cookie-based sessions stored in Redis
- Protected gateway routes with user ID forwarding

### Platform

- Docker Compose full-stack startup
- Health-checkable services
- Pure local mode: no paid AI API required for chat
- Optional Tavily, Groq, Firebase, and Razorpay integrations

---

## Architecture

```text
                         ┌──────────────────────────┐
                         │        React + Vite      │
                         │        Frontend :5173    │
                         └────────────┬─────────────┘
                                      │
                                      ▼
                         ┌──────────────────────────┐
                         │       API Gateway        │
                         │         :8000            │
                         └────────────┬─────────────┘
                                      │
        ┌──────────────┬──────────────┼──────────────┐
        │              │              │              │
        ▼              ▼              ▼              ▼
   ┌─────────┐   ┌──────────┐   ┌───────────┐  ┌─────────┐
   │  Auth   │   │   Chat   │   │  Billing  │  │  Agent  │
   │  :8001  │   │  :8002   │   │   :8004   │  │  :8003  │
   └────┬────┘   └────┬─────┘   └─────┬─────┘  └────┬────┘
        │             │               │             │
        ▼             ▼               ▼             ▼
   ┌─────────┐   ┌──────────┐   ┌───────────┐  ┌─────────────┐
   │ MongoDB │   │  Redis   │   │ Razorpay  │  │  LangGraph  │
   └─────────┘   └──────────┘   └───────────┘  │ Orchestrator│
                                                └──────┬──────┘
                                                       │
                                                       ▼
                                                ┌─────────────┐
                                                │   LiteLLM   │
                                                │    :4000    │
                                                └──────┬──────┘
                                                       │
                          ┌────────────────────────────┼─────────────────────────┐
                          ▼                            ▼                         ▼
                   ┌─────────────┐              ┌─────────────┐           ┌─────────────┐
                   │   Ollama    │              │    Groq     │           │   Tavily    │
                   │ llama3.2:3b │              │  (optional) │           │  (optional) │
                   └─────────────┘              └─────────────┘           └─────────────┘
                                                       │
                                         ┌─────────────┼─────────────┐
                                         ▼             ▼             ▼
                                   ┌──────────┐ ┌───────────┐ ┌─────────────┐
                                   │  Qdrant  │ │ S3 Mock   │ │   Redis     │
                                   │  :6333   │ │   :9000   │ │   Memory    │
                                   └──────────┘ └───────────┘ └─────────────┘
```

---

## Agent Routing

The router is deterministic and runs inside the LangGraph workflow.

| Input | Routed agent |
|---|---|
| `agent` field set to a specific mode | That agent |
| PDF upload + rewrite/create keywords | PDF |
| PDF upload + question | PDF RAG |
| Image upload | Image Analyzer |
| Questions about PDFs, documents, downloads | PDF |
| Prompts mentioning PPT, slides, presentation, deck | PPT |
| Prompts asking to draw, design, or generate images | Vision |
| Prompts mentioning latest/news/web search/weather | Search |
| Prompts about code, debugging, frameworks, or APIs | Coding |
| Everything else | Chat |

Search always feeds its results into the chat agent before returning the final answer.

### Agent details

| Agent | What it does | Credits |
|---|---|---|
| Chat | General conversation using Redis memory | 1 |
| Search | Tavily search + AI summary | 5 |
| Coding | Intent detection, code generation, review, explanations | 10 |
| PDF | Generates a PDF from a structured LLM response | 10 |
| PPT | Generates a PowerPoint deck from a structured LLM response | 10 |
| Vision | Enhances a prompt, generates an image, stores it in S3 | 10 |
| PDF RAG | Extracts PDF text and answers strictly from it | 10 |
| Image Analyzer | Sends the uploaded image to a vision-capable model | 10 |

Agent credit costs are defined in `backend/services/auth/controllers/auth.controller.js`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, Redux Toolkit, Tailwind CSS 4 |
| UI libraries | React Markdown, remark-gfm, Monaco Editor, Lucide icons, Motion |
| API Gateway | Node.js 20, Express 5, express-http-proxy, cookie-parser, morgan |
| Microservices | Node.js, Express 5, Mongoose, ioredis |
| AI service | Python 3.12, FastAPI, Uvicorn |
| Agent framework | LangChain, LangGraph |
| Model gateway | LiteLLM (OpenAI-compatible API) |
| Local model | Ollama — `llama3.2:3b` |
| Cloud fallback | Groq (optional) |
| Web search | Tavily (optional) |
| Databases | MongoDB 7, Redis 7, Qdrant |
| Object storage | Adobe S3 Mock (`agent-files` bucket) |
| Auth | Firebase Admin (optional), scrypt, Redis sessions |
| Payments | Razorpay (optional) |
| Containers | Docker, Docker Compose |

---

## Project Structure

```text
allverse-ai/
│
├── data/                              # README screenshots
│
├── frontend/
│   ├── src/
│   │   ├── components/                # Chat UI, sidebar, artifacts, billing
│   │   ├── features/                  # API calls
│   │   ├── pages/                     # Landing and Home workspace
│   │   ├── redux/                     # User, conversation, message slices
│   │   └── utils/
│   └── Dockerfile
│
├── backend/
│   ├── gateway/                       # API Gateway (:8000)
│   ├── shared/                        # Shared Redis client
│   └── services/
│       ├── auth/                      # Auth service (:8001)
│       ├── chat/                      # Chat service (:8002)
│       ├── billing/                   # Billing service (:8004)
│       └── agent/                     # FastAPI AI service (:8003)
│           ├── agents/                # Chat, search, coding, pdf, ppt, vision, ...
│           ├── config/                # Settings, model factory, Redis, S3, Tavily
│           ├── controllers/
│           ├── graph/                 # LangGraph state, router, workflow
│           ├── routes/
│           ├── utils/                 # PDF/PPT generation, JSON repair, S3 helpers
│           └── Dockerfile
│
├── litellm/
│   └── config.yaml                    # LiteLLM model routing
│
├── docker-compose.yml                 # Full local stack
├── .env                               # Root compose configuration
└── README.md
```

---

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Ollama](https://ollama.com/) running on the host machine
- Git

Optional:

- Node.js 20+ and npm for running services outside Docker
- Python 3.12+ for running the agent service outside Docker

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd allverse-ai
```

### 2. Pull the local model

The project uses a single model for every agent:

```bash
ollama pull llama3.2:3b
```

Make sure Ollama is running and reachable at `http://localhost:11434`:

```bash
ollama list
curl http://localhost:11434/api/tags
```

Docker containers reach the host Ollama through `host.docker.internal:11434`.

### 3. Configure environment files

Copy the root example file if you do not already have `.env`:

```bash
cp .env.example .env
```

The full stack reads:

- `.env` — Docker Compose variables and shared configuration
- `backend/services/auth/.env`
- `backend/services/chat/.env`
- `backend/services/billing/.env`
- `backend/services/agent/.env`
- `backend/gateway/.env`

For a purely local setup, the default values are enough. Optional integrations:

| Variable | Purpose |
|---|---|
| `TAVILY_API_KEY` | Enables the Search agent |
| `GROQ_API_KEY` | Enables the optional Groq fallback |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Enables billing checkout |
| `VITE_FIREBASE_API_KEY` / `serviceAccountKey.json` | Enables Firebase Google sign-in |
| `ALLOW_DEV_LOGIN=true` | Enables the demo user when Firebase is not configured |

### 4. Start the full stack

```bash
docker compose up -d --build
```

### 5. Open the app

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API Gateway | http://localhost:8000 |
| Auth Service | http://localhost:8001 |
| Chat Service | http://localhost:8002 |
| Agent Service | http://localhost:8003 |
| Billing Service | http://localhost:8004 |
| LiteLLM | http://localhost:4001 |
| Qdrant dashboard | http://localhost:6333/dashboard |
| S3 Mock | http://localhost:9000 |
| MongoDB | `localhost:27017` |
| Redis | `localhost:6379` |

With `ALLOW_DEV_LOGIN=true`, use the **Continue as Demo User** option on the landing page.

### Stop the stack

```bash
docker compose down
```

### Rebuild only the AI service after code changes

```bash
docker compose up -d --build agent
```

---

## Model Configuration

All agents use **`llama3.2:3b`**. The relevant configuration lives in two places:

1. `litellm/config.yaml` — LiteLLM model list and aliases
2. `backend/services/agent/.env` / `backend/services/agent/config/settings.py` — agent model names

The LiteLLM config defines:

- `llama3.2:3b`
- `allverse-chat`
- `allverse-coding`
- `allverse-vision`

All aliases currently point to the same Ollama model. Groq fallbacks are not enabled by default.

To switch to a different installed Ollama model, update both files, pull the model, and restart:

```bash
ollama pull <model-name>
docker compose restart litellm
docker compose up -d --build agent
```

Notes:

- The **Image Analyzer** requires a vision-capable model (for example `llava`). `llama3.2:3b` cannot analyze images.
- PDF RAG embeds document chunks with FastEmbed (`BAAI/bge-small-en-v1.5`, ONNX/CPU, runs inside the agent container) and stores them in Qdrant. The model (~130 MB) is downloaded and cached on the first PDF request.

---

## API Reference

All frontend traffic goes through the API Gateway at `http://localhost:8000`.

### Auth

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register with name, email, password |
| `POST` | `/api/auth/login` | Log in with email/password, Firebase token, or `dev-login` |
| `GET` | `/api/auth/logout` | Clear the session |
| `POST` | `/api/auth/deduct-credits` | Internal credit deduction |
| `POST` | `/api/auth/update-plan` | Internal plan update after payment |
| `GET` | `/api/me` | Current user profile |

### Chat

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/chat/create-conversation` | Create a conversation |
| `GET` | `/api/chat/get-conversations` | List the user's conversations |
| `POST` | `/api/chat/update-conversation` | Rename or update a conversation |
| `POST` | `/api/chat/save-message` | Persist a message |
| `GET` | `/api/chat/get-messages/:conversationId` | Get messages for a conversation |

### Agent

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/agent/chat` | Run an agent |

`POST /api/agent/chat` accepts `multipart/form-data`:

| Field | Required | Description |
|---|---|---|
| `prompt` | Yes | User request |
| `conversationId` | Yes | Conversation ID |
| `agent` | No | `auto`, `chat`, `search`, `coding`, `pdf`, `ppt`, `vision`, `pdf_rag`, `image_analyzer` |
| `file` | No | PDF or image upload |

The gateway adds the authenticated `x-user-id` header before forwarding to the agent service.

### Billing

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/billing/create` | Create a Razorpay order |
| `POST` | `/api/billing/verify` | Verify a Razorpay payment |

---

## Health Checks

```bash
# Containers
docker compose ps

# Node services
curl http://localhost:8000/
curl http://localhost:8001/
curl http://localhost:8002/
curl http://localhost:8004/

# Python AI service
curl http://localhost:8003/health

# LiteLLM
curl http://localhost:4001/health/readiness

# Ollama
curl http://localhost:11434/api/tags
```

Quick model smoke test through LiteLLM:

```bash
curl -s http://localhost:4001/v1/chat/completions \
  -H "Authorization: Bearer sk-allverse-litellm-master-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2:3b",
    "messages": [{"role": "user", "content": "Reply with: OK"}],
    "max_tokens": 20
  }'
```

### Docker development

- Frontend runs Vite dev server inside the container on port `5173`.
- Backend services use `npm run start`.
- The agent service runs `uvicorn` on port `8003`.
- LiteLLM runs on container port `4000`, exposed as `4001`.
- S3 Mock runs on container port `9090`, exposed as `9000`.

### Production deployment on AWS ECS

The repository includes an ECS deployment toolkit in [`deploy/aws/`](deploy/aws/README.md).
It extends the existing five application services with:

- `redis-service`, `mongodb-service`, `qdrant-service`, `litellm-service` on Fargate
- `ollama-service` on GPU-backed EC2 (Fargate has no GPU support)
- EFS access points for MongoDB, Redis, Qdrant and Ollama model storage
- Cloud Map private DNS (`allverse.local`) for internal service-to-service traffic
- S3 access through the ECS task role (no static AWS keys)

See [`deploy/aws/README.md`](deploy/aws/README.md) for the architecture, AWS CLI
commands, required GitHub Actions variables/secrets and manual console steps.

---

## Known Limitations

- `llama3.2:3b` is a small model. Responses are functional but less capable than larger models, especially for large code-generation artifacts.
- Image analysis requires a vision-capable model. Use `llava` or configure a Groq vision model.
- The Search agent requires a valid `TAVILY_API_KEY`.
- Billing checkout requires valid Razorpay credentials.
- PDF RAG stores one Qdrant collection per conversation, recreated on every upload, and retrieves the top 5 chunks per question. If embedding/retrieval fails it falls back to passing the extracted text directly to the model.
- Presigned S3 links use `http://localhost:9000` and expire after 10 minutes.

---

## Security Notes

- Do not commit `.env` files or API keys.
- Firebase service account credentials and payment keys are sensitive.
- Sessions are stored server-side in Redis and referenced by an HTTP-only cookie.
- Gateway-protected routes require a valid session.
- Generated files are served through time-limited presigned URLs.
- Service-to-service calls use internal Docker network hostnames.

---

## License

This project is intended for educational and development purposes. Review the repository license before using it in production.
