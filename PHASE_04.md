# VELORA AI — PHASE 04 PRODUCTION HARDENING & MULTI-MODEL AI ROUTER

## 1. Executive Summary & Architecture Consolidation

### Architecture Before vs After
- **Before Phase 04**:
  - Chat was locked exclusively to Google Gemini without quota management.
  - When Gemini returned `429 RESOURCE_EXHAUSTED` (Quota Exceeded), the application broke and dumped raw provider error JSON to the user interface.
  - Competing backend scaffolds (incomplete FastAPI files vs active Node/Express server) caused ambiguity.
  - No authentication, session management, or ownership checks existed.
- **After Phase 04**:
  - **Single Authoritative Full-Stack Architecture**: Node.js/Express with TypeScript on port 3000 hosting Vite middleware in development and serving production SPA assets.
  - **Multi-Model AI Chat Router**: Prioritized candidate dispatch with automatic, seamless fallback across 4 provider tiers:
    1. Primary: Google Gemini (`gemini-3.8-flash`, `gemini-3.1-pro-preview`)
    2. Fallback Cloud: OpenAI (`gpt-4o-mini`, `gpt-4o`, custom models)
    3. Fallback Local: Local Ollama (dynamically discovers installed models via `/api/tags`)
    4. Fallback Gateway: Custom OpenAI-compatible self-hosted gateways (vLLM, LMStudio, LocalAI)
  - **Quota Detection & Cooldown Cache**: 429 and RESOURCE_EXHAUSTED errors trigger temporary cooldown periods. During cooldown, calls immediately bypass rate-limited providers to prevent wasteful roundtrips.
  - **Production Authentication**: Secure scrypt password hashing, session tokens, and resource ownership enforcement across projects, assets, generations, and conversations.
  - **Normalized Error Contracts**: Zero raw JSON blobs or stack traces in the UI. All failures map to actionable, human-friendly cards with retry and settings shortcuts.

---

## 2. Multi-Provider Router & Fallback Rules

### Routing Sequence
```
Chat Request (e.g. "hi")
      ↓
Candidate Resolution (Requested Model -> Preferred Cloud -> Local Ollama -> Compatible Gateway)
      ↓
Provider Health Check (Is configured? Is in 429 cooldown?)
      ↓
Try Provider 1 (e.g. Gemini)
      ├── Success → Stream token-by-token response & persist
      └── 429 Rate Limit / 5xx Error
             ↓
          Mark Provider 1 RATE_LIMITED (Cooldown timer: 60s)
             ↓
          Switch to Provider 2 (e.g. OpenAI or Local Ollama)
             ↓
          Emit provider_switched event to UI
             ↓
          Deliver real response!
```

### Fallback Invariants
- **Non-Fallback Conditions**: Errors caused by user abort (Stop button) or content safety rejections do NOT fallback to avoid repeating violations.
- **Bounded Retries**: Maximum attempts across providers is strictly bounded (2–3 attempts max) to prevent infinite loops.
- **Exhaustion State**: If all providers are rate-limited or unconfigured, returns `NO_PROVIDER_AVAILABLE` / `PROVIDER_RATE_LIMITED` with friendly guidance.

---

## 3. Provider Configuration Guide

### A. Google Gemini
- **Environment**: `GEMINI_API_KEY`
- **Capabilities**: High-speed text (`gemini-3.8-flash`), reasoning (`gemini-3.1-pro-preview`), image synthesis (`gemini-3.1-flash-image`), video (`veo-3.1-lite-generate-preview`), and live Google Search Grounding.
- *Notice: Cloud AI providers require active API quota.*

### B. OpenAI
- **Environment**: `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL` (e.g. `gpt-4o-mini`, `gpt-4o`)
- **Integration**: Official OpenAI Chat Completions API with streaming. Activated automatically as cloud fallback when Gemini is busy.

### C. Local Ollama
- **Environment**: `OLLAMA_ENABLED=true`, `OLLAMA_BASE_URL=http://localhost:11434`, `OLLAMA_CHAT_MODEL`
- **Discovery**: Automatically queries `GET /api/tags` to discover locally installed models (e.g. `llama3`, `codellama`, `stable-code`).
- *Notice: Local Ollama inference depends on the user's local hardware and installed models.*

### D. OpenAI-Compatible Gateways
- **Environment**: `OPENAI_COMPATIBLE_ENABLED`, `OPENAI_COMPATIBLE_BASE_URL`, `OPENAI_COMPATIBLE_API_KEY`, `OPENAI_COMPATIBLE_MODEL`
- **Integration**: Supports vLLM, LMStudio, TextGenWebUI, and self-hosted inference servers.

### E. Open-Source Image Providers (FLUX & Stable Diffusion)
- **FLUX.1**: `FLUX_ENABLED`, `FLUX_API_URL`, `FLUX_MODEL`, `FLUX_API_KEY` (Supports Hugging Face Inference API, Fal.ai, Replicate, or ComfyUI).
- **Stable Diffusion XL & 3.5**: `SD_ENABLED`, `SD_API_URL`, `SD_MODEL`, `SD_API_KEY`.
- *Notice: Open-source model weights do not automatically mean free hosted cloud inference.*

---

## 4. Authentication, Database & Security

- **Password Hashing**: `crypto.scryptSync` with unique 16-byte random salts. Plaintext passwords are never stored.
- **Session Tokens**: Cryptographically secure 32-byte hex tokens with 30-day expiration, stored in the `sessions` collection.
- **Resource Ownership**: Every project, media asset, generation record, and conversation validates `user_id`.
- **Idempotency**: Generation submissions accept `Idempotency-Key` headers to prevent accidental duplicate charges or runs.

---

## 5. Automated Verification & Test Results

A dedicated automated test suite (`tests/run-tests.ts`) was executed:
- **Authentication**: Password hashing, verification, user creation, session generation, and logout passed.
- **Router Fallback**: Simulated Gemini 429 quota exhaustion correctly marked Gemini in cooldown, switched providers, and returned normalized error contracts when all candidates were exhausted.
- **Error Normalization**: Verified that 429 errors normalize to `PROVIDER_RATE_LIMITED` with actionable `actionText`.
- **Model Registry**: Verified all 8 model definitions, capabilities, and provider metadata.
- **Result**: **24 passed, 0 failed**.
