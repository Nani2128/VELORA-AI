# VELORA AI — PHASE 07 DOCUMENTATION
## Real Media Provider Expansion + Fal.ai FLUX.1 [schnell] + Intelligent Fallback & Production UI

---

### 1. Architecture Overview

VELORA AI Phase 07 establishes a production-grade, multi-provider media synthesis mesh with intelligent failover, real queueing, server-side asset persistence, and live Server-Sent Events (SSE).

```
                      ┌─────────────────────────────────────────┐
                      │          VELORA Studio Client           │
                      │  (Image, Video, Live Chat, Voice Studio) │
                      └────────────────────┬────────────────────┘
                                           │ POST /api/v1/generations
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │        Capability & Quota Router        │
                      │   (Task Classifier + Health Filter)     │
                      └────────────────────┬────────────────────┘
                                           │
         ┌───────────────────┬─────────────┴───────┬────────────────────┐
         │                   │                     │                    │
         ▼                   ▼                     ▼                    ▼
   Google Cloud           Fal.ai                xAI Grok          OpenAI / HF / Local
  (Gemini / Veo)    (FLUX.1 Schnell)       (Grok Imagine)       (DALL-E 3, SDXL)
         │                   │                     │                    │
         └─────────┬─────────┴─────────────┬───────┴────────────────────┘
                   ▼                       ▼
            429 / Quota Error      Successful Render
                   │                       │
                   ▼                       ▼
           Automatic Failover      Download & Save Asset
       (Continue without reset)    (VELORA Storage + DB)
                   │                       │
                   ▼                       ▼
             SSE Stream               SSE Stream
     (generation.provider_switched)   (generation.completed)
```

---

### 2. Fal.ai & FLUX.1 [schnell] Integration

- **Provider File**: `src/server/imageProviders/falFlux.ts`
- **SDK**: Official `@fal-ai/client`
- **Model ID**: `fal-ai/flux/schnell`
- **Display Name**: `FLUX.1 Schnell`
- **Queue Pipeline**:
  1. Server initiates generation using `fal.subscribe('fal-ai/flux/schnell', ...)`, which dispatches to Fal's asynchronous queue.
  2. The server monitors queue status.
  3. The resulting image URL is downloaded server-side via `fetch(imageUrl)`.
  4. Media is written to permanent VELORA object storage (`uploads/` or S3).
  5. An `AssetRecord` is created in PostgreSQL / persistent DB.
  6. The client receives permanent asset URLs via SSE (`generation.completed`).
- **Resolution & Aspect Ratio Presets**:
  - `square` / `square_hd` (1024×1024)
  - `landscape_16_9` (1024×576)
  - `portrait_16_9` (576×1024)
  - `landscape_4_3` (1024×768)
  - `portrait_4_3` (768×1024)
  - Custom `width` and `height` dimensions (clamped between 256 and 2048)

---

### 3. Capability Router & Task Classification

The router (`src/server/router/capabilityRouter.ts`) maps user directives into strict `TaskType` values:
- `TEXT_TO_IMAGE`
- `IMAGE_TO_IMAGE`
- `TEXT_TO_VIDEO`
- `IMAGE_TO_VIDEO`
- `TEXT_TO_MUSIC`
- `CHAT`
- `RESEARCH`
- `CODING`
- `REASONING`

Every model in `KNOWN_MODELS` declares:
- Modalities (`text`, `image`, `video`, `audio`)
- Supported input/output types
- Live credentials health check (`isConfigured`)
- Live quota cooldown states (`quotaManager.isAvailable`)

---

### 4. Quota Management & Failover Logic

- **Detection**: Centralized error parser (`classifyProviderError`) catches HTTP 429, `RESOURCE_EXHAUSTED`, `daily_limit`, and `too_many_requests`.
- **Normalization**: Errors are normalized into `PROVIDER_QUOTA_EXHAUSTED` or `PROVIDER_RATE_LIMITED` with dynamic cooldown tracking (`retryAfterSeconds`).
- **Automatic Fallback Chain**:
  - `TEXT_TO_IMAGE`: Google Gemini Image ➔ Fal.ai FLUX.1 Schnell ➔ xAI Grok Imagine ➔ Hugging Face FLUX ➔ Stability AI SDXL.
  - Failovers trigger `generation.provider_switching` SSE events.
  - The user's request continues automatically without needing to re-enter prompts.
- **Quota UI Experience**:
  - When a model's quota is reached, a human-friendly card presents:
    - Clear explanation of the cooldown
    - Highlighted compatible alternative (e.g. `FLUX.1 Schnell`)
    - 1-click continuation button (`[ Continue with FLUX.1 Schnell ]`)
    - Option to choose another model

---

### 5. UI/UX Refinement & Anti-Slop Discipline

- **White-First Aesthetic**: Modern, clean design with high contrast, sharp typography, and subtle border math.
- **Theme Toggle**: Real-time switching between crisp White Mode and Cinematic Obsidian Dark Mode.
- **Indeterminate Progress Bar**: No fake percentage increments. Real stages displayed:
  - `Preparing request`
  - `Model selected`
  - `Queued in pipeline`
  - `Generating latents`
  - `Downloading & Finalizing`
- **Video Buffering State**: Poster previews and spinner overlays to prevent black screens.
- **Model Selector**: Shows provider tags, availability indicators (`● Available`), speed badges (`Fast 4-Step`), and cooldown timers.

---

### 6. Environment Variables (`.env.example`)

```bash
# Primary Cloud AI Provider
GEMINI_API_KEY=""

# Fal.ai High-Speed FLUX.1 Schnell Queue
FAL_KEY=""

# OpenAI Provider
OPENAI_API_KEY=""

# Groq LPU Provider
GROQ_API_KEY=""

# DeepSeek AI Provider
DEEPSEEK_API_KEY=""

# xAI Grok Provider
XAI_API_KEY=""

# Hugging Face Inference
HF_TOKEN=""

# Ollama Local Offline
OLLAMA_ENABLED="true"
OLLAMA_BASE_URL="http://localhost:11434"

# Database & Cache
DATABASE_URL="postgresql://user:password@localhost:5432/velora"
REDIS_URL="redis://localhost:6379/0"
```

---

### 7. Render Deployment (`render.yaml`)

- **Web Service**: Node.js runtime, `npm install && npm run build`, `startCommand: npm start`, health check on `/health` and `/api/v1/health`.
- **Worker Service**: Background generation worker (`npx tsx src/server/worker.ts`).
- **PostgreSQL**: Managed PostgreSQL database (`velora-postgres`).
- **Redis**: Managed Redis cache (`velora-redis`).

---

### 8. Verification & Test Suite

The test suite (`tests/run-tests.ts`) executes **43 automated unit and integration tests**:
- Group 1: Authentication & Password Security (scrypt, salt, sessions)
- Group 2: Multi-Provider Router & Cooldown States
- Group 3: Normalized Error Contracts & UI Friendly Messages
- Group 4: Unified Model Registry & Capabilities Plane
- Group 5: Fal.ai FLUX.1 Schnell Integration & Queue Contract
- Group 6: Intent Classification & Capability Routing
- Group 7: Quota Normalization & Failover Chains
- Group 8: Optional Live API test via `RUN_REAL_PROVIDER_TESTS=true`

All 43 tests pass cleanly with zero linting or TypeScript compilation errors.
