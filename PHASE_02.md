# VELORA AI — Phase 02: Real AI Generation Engine & Backend Architecture

## 1. Executive Summary

Phase 02 transforms the VELORA AI creative suite from a high-fidelity frontend foundation into a production-grade full-stack creative SaaS. This document details the completed backend architecture, database schemas, real AI provider integration, asynchronous job processing, and streaming protocols.

---

## 2. System Architecture

```
┌───────────────────────────────────────────────────────────┐
│                    VELORA AI Web Client                   │
│           (React 19 + TypeScript + Zustand 5)             │
└──────────────────────────┬─▲──────────────────────────────┘
                           │ │
             REST (JSON)   │ │ Server-Sent Events (SSE)
                           ▼ │
┌───────────────────────────────────────────────────────────┐
│              Production API Server (Port 3000)            │
│                 Express.js + Vite Middleware              │
├──────────────────────────┬────────────────────────────────┤
│      API Endpoints       │     Asynchronous Job Queue     │
│   /health                │  - In-memory event dispatcher  │
│   /api/v1/assets/upload  │  - Non-blocking execution      │
│   /api/v1/generations    │  - Real-time status pipeline   │
│   /api/v1/projects       │  - Cancellation & retry guards │
│   /api/v1/library        │                                │
│   /api/v1/history        │                                │
└─────────────┬────────────┴───────────────┬────────────────┘
              │                            │
              ▼                            ▼
┌───────────────────────────┐ ┌─────────────────────────────┐
│  Persistent Storage Layer │ │    Google Gen AI SDK        │
│  - JSON/SQLite Local DB   │ │  - gemini-3.1-flash-image   │
│  - Local media storage    │ │  - veo-3.1-lite-preview     │
│  - Assets & metadata      │ │  - gemini-3.8-flash (assist)│
└───────────────────────────┘ └─────────────────────────────┘
```

---

## 3. Database Schema

The database persistence layer is implemented in `src/server/db.ts` (with corresponding SQLAlchemy models in `backend/app/models/`):

### Tables & Records

1. **`users`**
   - `id`: UUID (Primary Key)
   - `email`: User email address
   - `display_name`: Formatted user name
   - `avatar_url`: User avatar image link
   - `tier`: Subscription tier (`FREE`, `PRO`, `ENTERPRISE`)
   - `created_at`: ISO timestamp

2. **`projects`**
   - `id`: UUID (Primary Key)
   - `user_id`: Foreign Key (`users.id`)
   - `name`: Project display title
   - `description`: Optional project synopsis
   - `cover_asset_id`: Thumbnail media reference
   - `created_at`: ISO timestamp
   - `updated_at`: ISO timestamp

3. **`generations`**
   - `id`: UUID (Primary Key)
   - `user_id`: Foreign Key (`users.id`)
   - `project_id`: Foreign Key (`projects.id`, optional)
   - `type`: `TEXT_TO_IMAGE` | `IMAGE_TO_IMAGE` | `TEXT_TO_VIDEO` | `IMAGE_TO_VIDEO`
   - `prompt`: Input prompt text
   - `enhanced_prompt`: AI-augmented prompt (optional)
   - `negative_prompt`: Exclusion tokens (optional)
   - `input_asset_id`: Source asset reference for img2img / img2vid
   - `output_asset_id`: Generated media asset reference
   - `provider`: AI Provider key (`google_gemini_image`, `google_veo_video`)
   - `model`: Model identifier (`gemini-3.1-flash-image`, `veo-3.1-lite-generate-preview`, etc.)
   - `status`: `QUEUED` | `PROCESSING` | `FINALIZING` | `COMPLETED` | `CANCELLED` | `FAILED`
   - `settings`: Generation parameters (aspect ratio, duration, motion, camera, etc.)
   - `error_code`: Machine-readable error code if failed
   - `error_message`: User-facing failure reason
   - `created_at`: ISO timestamp
   - `started_at`: ISO timestamp
   - `completed_at`: ISO timestamp

4. **`assets`**
   - `id`: UUID (Primary Key)
   - `user_id`: Foreign Key (`users.id`)
   - `project_id`: Foreign Key (`projects.id`, optional)
   - `type`: `IMAGE` | `VIDEO`
   - `source`: `UPLOAD` | `GENERATED`
   - `storage_key`: Unique disk/cloud object storage path
   - `thumbnail_key`: Thumbnail object path
   - `mime_type`: Content type (`image/png`, `video/mp4`, etc.)
   - `size_bytes`: File size in bytes
   - `width`, `height`, `duration_seconds`: Media dimensions & duration
   - `metadata`: Original upload filename, parameters, etc.
   - `created_at`: ISO timestamp

5. **`usage_records`**
   - `id`: UUID (Primary Key)
   - `user_id`: Foreign Key (`users.id`)
   - `generation_id`: Foreign Key (`generations.id`)
   - `provider`: Provider identifier
   - `model`: Model identifier
   - `units`: Resource consumption units
   - `created_at`: ISO timestamp

---

## 4. API Endpoints & Contracts

All endpoints respond with standard JSON format and `X-Request-ID` correlation headers.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server and provider health status check |
| `POST` | `/api/v1/assets/upload` | Multipart file upload for image input |
| `POST` | `/api/v1/generations` | Initiate async image or video generation |
| `GET` | `/api/v1/generations/:id` | Poll generation status and output metadata |
| `GET` | `/api/v1/generations/:id/events` | SSE streaming endpoint for live job status updates |
| `POST` | `/api/v1/generations/:id/cancel` | Cancel an in-flight generation |
| `POST` | `/api/v1/generations/:id/retry` | Re-queue a failed or cancelled generation |
| `GET` | `/api/v1/projects` | List user projects |
| `POST` | `/api/v1/projects` | Create a new project |
| `PATCH` | `/api/v1/projects/:id` | Update project metadata |
| `DELETE` | `/api/v1/projects/:id` | Delete a project |
| `GET` | `/api/v1/library` | Query generated and uploaded assets with filters |
| `GET` | `/api/v1/history` | Query generation pipeline audit log |

---

## 5. Real AI Model Providers & Execution Flow

VELORA AI connects directly to Google Gemini and Google Veo via `@google/genai`:

- **Text to Image**: `gemini-3.1-flash-image` produces 1K resolution images in 1:1, 16:9, 9:16, 4:3, or 3:4 aspect ratios.
- **Image to Image**: `gemini-3.1-flash-lite-image` accepts base64-encoded source images with editing directives.
- **Video Generation**: `veo-3.1-lite-generate-preview` handles cinematic video synthesis up to 720p with polling operations.
- **Prompt Enhancement**: `gemini-3.8-flash` enriches brief user inputs into atmospheric, production-grade visual descriptions.

---

## 6. Real-Time Status Streaming (SSE)

Clients connect to `/api/v1/generations/:id/events` via `EventSource`. The server pushes events whenever stage transitions occur:

```json
event: generation.status
data: {
  "generation_id": "gen_8e21...",
  "status": "PROCESSING",
  "timestamp": "2026-09-27T15:48:32.100Z",
  "output_asset_id": null,
  "output_url": null,
  "error": null
}
```

Upon reaching `COMPLETED`, `FAILED`, or `CANCELLED`, the event stream transmits the final payload and closes gracefully.
