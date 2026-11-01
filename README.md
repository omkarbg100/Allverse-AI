# Cortex AI — Multi-Agent AI Platform

<img width="1536" height="1024" alt="Agentic" src="https://github.com/user-attachments/assets/5f013e8b-5fdb-4827-ae08-f851fcc93a3c" />


<p align="center">
  <strong>An intelligent multi-agent workspace for chat, search, coding, and document-based AI workflows.</strong>
</p>

<p align="center">
  Built with MERN, LangChain, LangGraph, Qdrant, Redis, Firebase, and a microservices architecture.
</p>

---

## Overview

**Cortex AI** is a production-style Multi-Agent AI Platform that brings multiple specialized AI capabilities into a single conversational workspace.

Instead of relying on a single AI workflow, Cortex AI uses specialized agents that can route tasks based on the user's intent. The platform can handle general conversations, search and summarize information, work with retrieved knowledge, and assist with coding tasks.

The system is designed around a scalable **microservices architecture**, with dedicated services for authentication, conversations, agent orchestration, and supporting infrastructure.

---

## ✨ Key Features

### 🤖 Multi-Agent AI

Cortex AI uses specialized agents coordinated through LangGraph and LangChain.

- **Chat Agent** — Handles general conversational requests
- **Search Agent** — Retrieves and summarizes web information
- **Coding Agent** — Assists with code generation and development tasks
- Intelligent routing between specialized agents
- Conditional multi-agent workflows
- Agent-to-agent workflow orchestration

### 🔎 AI Search & RAG

The Search Agent combines retrieval with AI generation to provide context-aware responses.

- Web data retrieval
- Document retrieval
- Semantic search
- Embedding-based retrieval
- Retrieval-Augmented Generation
- Context-aware AI responses
- Qdrant vector database

### 🧠 AI Memory

Redis provides short-term session and conversation memory.

- Session management
- Conversation context
- Short-term AI memory
- Fast state retrieval
- Cross-service session continuity

### 💬 AI Chat Workspace

The frontend provides a modern ChatGPT-style experience.

- Streaming AI responses
- Conversation history
- Markdown rendering
- Responsive sidebar
- Multi-session conversations
- Specialized AI modes

### 💻 Coding Assistance

The Coding Agent helps developers work with code using natural-language instructions.

- Code generation
- Code explanation
- Refactoring assistance
- Development questions
- AI-powered coding workflows

### 🔐 Authentication

Secure authentication is implemented using Firebase Authentication and JWT.

- User authentication
- Protected routes
- JWT-based authorization
- Secure service communication
- Multi-user support

### ⚙️ Microservices Architecture

The backend is separated into independent services.

- Auth Service
- Chat Service
- Agent Service
- Billing Service
- API Gateway
- Independent service deployment
- Container-ready architecture

### 🐳 Containerized Infrastructure

Services can be containerized and managed using Docker.

- Docker support
- Docker Compose
- Independent services
- Local multi-service development
- Cloud deployment readiness

---

# 🏗️ System Architecture

```text
                         ┌──────────────────────┐
                         │      Cortex AI       │
                         │   React + Redux UI   │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │     API Gateway      │
                         │  Request Routing     │
                         └──────────┬───────────┘
                                    │
             ┌──────────────────────┼──────────────────────┐
             │                      │                      │
             ▼                      ▼                      ▼
      ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
      │    Auth     │       │    Chat     │       │    Agent    │
      │   Service   │       │   Service   │       │   Service   │
      └─────────────┘       └──────┬──────┘       └──────┬──────┘
                                   │                      │
                                   │                      ▼
                                   │              ┌──────────────┐
                                   │              │  LangGraph   │
                                   │              │ Orchestrator │
                                   │              └──────┬───────┘
                                   │                     │
                                   │          ┌──────────┼──────────┐
                                   │          │          │          │
                                   │          ▼          ▼          ▼
                                   │       Chat       Search     Coding
                                   │       Agent       Agent      Agent
                                   │                     │
                                   │                     ▼
                                   │              ┌──────────────┐
                                   │              │    Qdrant    │
                                   │              │ Vector Store │
                                   │              └──────────────┘
                                   │
                                   ▼
                            ┌──────────────┐
                            │    Redis     │
                            │ Session & AI │
                            │    Memory    │
                            └──────────────┘

                            ┌──────────────┐
                            │   MongoDB    │
                            │ Application  │
                            │     Data     │
                            └──────────────┘
```

---

# 🧠 Agent Orchestration

LangGraph is responsible for managing the agent workflow.

A request enters the platform through the API Gateway and is routed to the appropriate agent workflow.

```text
User Request
     │
     ▼
API Gateway
     │
     ▼
Agent Router
     │
     ├───────────────┐
     │               │
     ▼               ▼
  Simple          Specialized
  Request           Request
     │               │
     ▼               ▼
 Chat Agent    ┌──────┼──────┐
               │      │      │
               ▼      ▼      ▼
            Search  Coding   RAG
             Agent   Agent  Workflow
```

This architecture allows Cortex AI to dynamically select the appropriate workflow instead of using the same processing pipeline for every request.

---

# 🔎 Retrieval-Augmented Generation

Cortex AI uses **Qdrant** as the vector database for semantic retrieval.

The general RAG workflow is:

```text
Documents / Web Data
        │
        ▼
    Processing
        │
        ▼
    Embeddings
        │
        ▼
     Qdrant
        │
        ▼
 Semantic Retrieval
        │
        ▼
 Retrieved Context
        │
        ▼
     AI / LLM
        │
        ▼
    Final Answer
```

This allows the platform to retrieve relevant information before generating an AI response.

---

# ⚡ Redis Session & Memory

Redis provides fast storage for short-lived application state and AI conversation context.

```text
User Request
     │
     ▼
API Gateway
     │
     ▼
Session Lookup
     │
     ▼
Redis
     │
     ├── Session State
     ├── Conversation Context
     └── Short-Term Memory
     │
     ▼
Agent Workflow
     │
     ▼
Updated Context
```

This enables conversations to maintain context across multiple requests and services.

---

# 🔐 Authentication Flow

Firebase Authentication handles user authentication while JWTs are used for secure authorization.

```text
User
 │
 ▼
Firebase Authentication
 │
 ▼
Authentication Token
 │
 ▼
API Gateway
 │
 ▼
JWT Validation
 │
 ▼
Authorized Service
```

Protected services can verify the user's identity before processing requests.

---

# 🧩 Microservices

The backend is divided into independent services to improve scalability and maintainability.

| Service | Responsibility |
|---|---|
| **API Gateway** | Routes requests to backend services |
| **Auth Service** | Authentication and authorization |
| **Chat Service** | Conversations and chat functionality |
| **Agent Service** | Agent orchestration and AI workflows |
| **Billing Service** | Billing-related functionality |
| **MongoDB** | Application data persistence |
| **Redis** | Sessions and short-term AI memory |
| **Qdrant** | Vector storage and semantic retrieval |

Each service can be developed, tested, containerized, and deployed independently.

---

# 🛠️ Tech Stack

| Category | Technology |
|---|---|
| Frontend | React.js |
| State Management | Redux Toolkit |
| Backend | Node.js |
| API Framework | Express.js |
| Database | MongoDB |
| AI Orchestration | LangChain |
| Agent Workflows | LangGraph |
| Vector Database | Qdrant |
| Memory / Cache | Redis |
| Authentication | Firebase Authentication |
| Authorization | JWT |
| Containerization | Docker |
| Deployment | AWS-ready |

---

# 📂 Project Structure

```text
cortex-ai/
│
├── frontend/
│   ├── src/
│   ├── components/
│   ├── pages/
│   ├── store/
│   └── services/
│
├── backend/
│   │
│   ├── api-gateway/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── ...
│   │
│   ├── auth-service/
│   │   ├── controllers/
│   │   ├── routes/
│   │   └── ...
│   │
│   ├── chat-service/
│   │   ├── controllers/
│   │   ├── routes/
│   │   └── ...
│   │
│   ├── agent-service/
│   │   ├── agents/
│   │   ├── workflows/
│   │   ├── langgraph/
│   │   └── ...
│   │
│   ├── billing-service/
│   │   └── ...
│   │
│   └── docker-compose.yml
│
└── README.md
```

---

# 🚀 Getting Started

## Prerequisites

Make sure you have the following installed:

- Node.js
- npm
- MongoDB
- Redis
- Qdrant
- Docker
- Git

You will also need the required credentials for:

- Firebase Authentication
- Your selected LLM provider
- Any external search or scraping service used by the Search Agent

---

## 1. Clone the Repository

```bash
git clone https://github.com/your-username/cortex-ai.git

cd cortex-ai
```

---

## 2. Install Dependencies

Install dependencies for the frontend:

```bash
cd frontend
npm install
```

Install dependencies for the backend services according to their individual directories.

```bash
cd ../backend
```

---

## 3. Configure Environment Variables

Create the required `.env` files for the frontend, API Gateway, and individual services.

Example:

```env
# MongoDB
MONGODB_URI=

# Redis
REDIS_URL=

# Qdrant
QDRANT_URL=
QDRANT_API_KEY=

# Firebase
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# JWT
JWT_SECRET=

# AI Provider
AI_API_KEY=

# Search Provider
SEARCH_API_KEY=
```

Do not commit environment files or API credentials to the repository.

---

# 🐳 Run with Docker

For multi-service local development, Docker Compose can be used to start the backend infrastructure.

```bash
cd backend

docker compose up --build
```

To stop the services:

```bash
docker compose down
```

---

# 💻 Run the Frontend

From the frontend directory:

```bash
npm run dev
```

The frontend will be available at:

```text
http://localhost:3000
```

---

# ⚙️ Run Backend Services

Each backend service can be started independently.

Example:

```bash
cd backend/auth-service
npm run dev
```

```bash
cd backend/chat-service
npm run dev
```

```bash
cd backend/agent-service
npm run dev
```

The API Gateway handles communication between the frontend and backend services.

---

# 🔄 Request Flow

A typical user request follows this flow:

```text
User
 │
 ▼
React Frontend
 │
 ▼
API Gateway
 │
 ▼
Authentication
 │
 ▼
Agent Router
 │
 ├───────────────┬───────────────┐
 ▼               ▼               ▼
Chat Agent    Search Agent    Coding Agent
 │               │               │
 │               ▼               │
 │            Qdrant              │
 │               │               │
 └───────────────┴───────────────┘
                 │
                 ▼
              LLM
                 │
                 ▼
          Generated Response
                 │
                 ▼
          Streaming UI
```

---

# 🎯 Use Cases

Cortex AI can be used as a foundation for:

- AI-powered conversational assistants
- Multi-agent AI applications
- Web research assistants
- RAG-based knowledge assistants
- Developer coding assistants
- Document-based AI applications
- Enterprise AI workspaces
- Multi-user AI platforms

---

# 📈 Scalability

The microservices architecture allows individual components to scale independently.

For example:

```text
High Chat Traffic
      │
      ▼
Scale Chat Service
      │
      └── Other services remain unchanged


High Search Traffic
      │
      ▼
Scale Search / Agent Service
      │
      └── Qdrant handles vector retrieval
```

Docker-based services can be deployed independently and scaled according to workload.

---

# 🔒 Security Considerations

Cortex AI uses multiple layers of application security.

- Firebase Authentication
- JWT authorization
- Protected API routes
- Service-level authentication
- Environment-based secrets
- Isolated service responsibilities
- Secure session management

Never commit API keys, JWT secrets, Firebase credentials, or database credentials to the repository.

---

# 📊 Project Highlights

| Capability | Implementation |
|---|---|
| Multi-Agent AI | LangGraph + LangChain |
| Conversational AI | Chat Agent |
| Web Research | Search Agent |
| Coding Assistance | Coding Agent |
| RAG | Qdrant |
| AI Memory | Redis |
| Authentication | Firebase |
| Authorization | JWT |
| Backend Architecture | Microservices |
| API Routing | API Gateway |
| Database | MongoDB |
| Containerization | Docker |
| Cloud Readiness | AWS |

---

# 🧭 Project Vision

Cortex AI is designed around the idea of a unified AI workspace where users can interact with multiple specialized agents through a single interface.

Rather than building separate applications for chat, research, coding, and knowledge retrieval, Cortex AI brings these capabilities together through an orchestrated multi-agent architecture.

The platform provides a foundation for building scalable AI applications where specialized agents can collaborate, retrieve external knowledge, maintain context, and produce task-specific results.

---

# 📸 Screenshots

Add your project screenshots below:

```html
<p align="center">
  <img src="YOUR_SCREENSHOT_URL_1" alt="Cortex AI Chat" width="800" />
</p>

<p align="center">
  <img src="YOUR_SCREENSHOT_URL_2" alt="Cortex AI Search" width="800" />
</p>

<p align="center">
  <img src="YOUR_SCREENSHOT_URL_3" alt="Cortex AI Coding" width="800" />
</p>
```

---

# 📜 License

This project is intended for educational and development purposes.

Please review the repository license before using the project or its source code in production.
