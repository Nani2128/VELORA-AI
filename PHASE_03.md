# VELORA AI — PHASE 03 ARCHITECTURE & SYSTEM DOCUMENTATION

## 1. System Architecture & Consolidation

### Runtime Architecture Audit
- **Active Production Runtime**: Full-stack Node.js + Express + TypeScript on port 3000 (`tsx server.ts`) hosting Vite middleware in development mode and serving built SPA assets in production.
- **Backend Parity**: Both TypeScript (`src/server/*`) and Python (`backend/app/*`) contain provider abstractions, model registries, chat schemas, and streaming endpoints. The active live runtime server powering the applet preview is `server.ts`.
- **Persistence Layer**: Structured relational-style JSON database in `data/velora.db.json` with atomicity, managing `users`, `projects`, `assets`, `generations`, `generation_jobs`, `provider_models`, `usage_records`, `conversations`, and `messages`.

---

## 2. Open-Source AI Image Provider System

VELORA AI Phase 03 introduces first-class support for open-source / self-hosted image synthesis engines alongside Google Cloud GenAI:

### Supported Model Families
1. **Google Gemini & Veo (Cloud)**:
   - `gemini-3.1-flash-image`: 1K/2K high-fidelity native synthesis.
   - `gemini-3.1-flash-lite-image`: Low-latency rapid prototyping.
   - `gemini-3-pro-image`: Studio-tier 4K resolution output.
   - `veo-3.1-lite-generate-preview`: Temporal consistency video synthesis.
2. **Black Forest Labs FLUX.1 (Open-Source / Self-Hosted)**:
   - `flux-1-schnell`: 12B parameter 4-step rectified flow transformer.
   - `flux-1-dev`: Open-weight guidance-distilled model.
   - *Environment variables*: `FLUX_ENABLED`, `FLUX_API_URL`, `FLUX_MODEL`, `FLUX_API_KEY`.
   - *Endpoint Support*: Hugging Face Inference API, Fal.ai, Replicate, or self-hosted ComfyUI/Diffusers HTTP servers.
3. **Stability AI (Open-Source / Self-Hosted)**:
   - `sdxl-1.0`: Benchmark open-weights latent diffusion model.
   - `sd-3.5-medium`: Multimodal Diffusion Transformer (MMDiT).
   - *Environment variables*: `SD_ENABLED`, `SD_API_URL`, `SD_MODEL`, `SD_API_KEY`.
   - *Endpoint Support*: Automatic1111 WebUI API, ComfyUI, Hugging Face, or remote endpoints.

---

## 3. Unified Model Registry & Health APIs

- **`GET /api/v1/models`**: Returns complete unified model list with capabilities (`supports_text_to_image`, `supports_image_to_image`, `supports_aspect_ratio`, `supports_negative_prompt`, `supports_steps`, `supports_guidance`) and configuration status (`available`, `configured`, `unconfigured`).
- **`GET /api/v1/models/:model_id`**: Returns specific model capabilities and status.
- **`GET /api/v1/providers/health`**: Real-time health check verifying credentials and endpoint reachability for Google Gemini, FLUX, and Stable Diffusion.
- **Studio Model Selector**: Dropdown selector in `Create Studio` and `Image Synthesizer` enabling instant switching across models with visual tags (`Google Cloud`, `FLUX Open-Source`, `Stability AI`) and configuration guidance.

---

## 4. ChatGPT-Style Multi-Turn Chat System

Dedicated creative assistant at `/app/chat`:
- **Conversation Endpoints**:
  - `POST /api/v1/chat/conversations`: Create conversation session.
  - `GET /api/v1/chat/conversations`: List historical conversations with last message snippets and counts.
  - `GET /api/v1/chat/conversations/:id`: Retrieve full conversation with message history.
  - `PATCH /api/v1/chat/conversations/:id`: Inline rename conversation.
  - `DELETE /api/v1/chat/conversations/:id`: Remove conversation.
  - `POST /api/v1/chat/conversations/:id/messages?stream=true`: Real-time SSE streaming.
- **Interactive UI Features**:
  - Token-by-token live streaming with cursor animation.
  - Rich Markdown parsing (`marked`) supporting code blocks, bold, headers, tables, and lists.
  - Stop generation button (AbortController).
  - Copy response button with feedback toast.
  - Regenerate response capability.
  - Automatic conversation title generation from initial user intent.

---

## 5. Real Web Search Grounding

- **Toggleable Grounding**: One-click "Web Search" toggle in chat header and input bar.
- **Real-Time Retrieval**: Uses Gemini Search Grounding (`tools: [{ googleSearch: {} }]`).
- **Citations & Sources**:
  - Extracts `groundingMetadata.groundingChunks` and search queries.
  - Displays source chips with domain favicon/pill, source title, and clickable external links.

---

## 6. White-First UI & Instant Theme Switching

- **White-First Default**: Default theme is clean, luminous, elevated light mode (`theme: 'light'`).
- **Dark Mode Support**: Deep obsidian canvas (`theme: 'dark'`) preserved from Phase 01/02.
- **Instant Toggle**:
  - Sun / Moon button in Topbar with smooth icon rotation.
  - Full theme selector cards in `/app/settings`.
  - Persisted in `localStorage` under `velora_theme` and synchronized via `document.documentElement` class and `data-theme`.
- **Anti-AI Slop Design**: Zero-pill discipline, crisp slate/zinc borders, refined typography, and high contrast.
