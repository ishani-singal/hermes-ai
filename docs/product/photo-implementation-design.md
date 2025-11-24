# Photo Input Capability — Implementation Design

Version: 0.2 (Phase 1 & 2 Complete - Nov 22, 2025)
Audience: Engineering (frontend, backend, AI/orchestration)
Scope: Photos in chat and work orders; video deferred but considered (photo + audio)

**Implementation Status:** ✅ Phase 1 & 2 Complete  
**See Also:** [File Upload Architecture](./file-upload-architecture.md) | [Implementation Summary](../tasks/file-upload-implementation-summary.md)

---

## Quick Status Update (Nov 22, 2025)

### ✅ What's Been Implemented:
1. **Two Endpoint Decision**: Separate `/api/photos` and `/api/documents` (see architecture doc for rationale)
2. **Photos API**: Full GET/POST with equipment & work order linking
3. **FileUploadForm Component**: Unified, auto-detecting upload component
4. **Work Order Integration**: 
   - Create flow: WO creation → optional file upload
   - Detail view: View/add attachments section
5. **Database Schema**: Unified `files` table with link tables (already existed)

### 🔧 Still TODO (Phase 3+):
- OCR & Vision AI processing pipeline
- Photo description generation
- RAG indexing for photos
- Equipment form refactor to use new component
- Mobile camera integration

---

## Original Summary (Context)

- Photo (image) input: Yes, planned. File picker + drag/drop; mobile Camera API; uploads to Supabase Storage; JPEG/PNG (<=10MB). Analysis via a vision-capable model to generate descriptions.
- Video input: Not explicitly implemented in the current app. A separate VideoToList service exists, but the main app’s video parser is a placeholder. Future plan is to treat video as photos + audio.

---

## Goals

- Enable technicians to capture or upload photos in chat or as work order attachments.
- Automatically analyze photos (OCR + scene analysis) to produce a concise, editable description.
- Persist description and structured metadata; index for retrieval and agent memory.
- Link photos to equipment and work orders; support corrections and re-indexing.
- Prepare for video by designing overlaps (frame analysis, shared metadata, indexing).

---

## User Experience (End-to-End)

1) Photo in Chat (Troubleshooting)
- User attaches/takes a photo in chat. Immediately shows a thumbnail and an “Analyzing…” state.
- When analysis completes, bot replies with: (a) short description of what’s visible; (b) detected serials/labels; (c) suggested next actions (e.g., attach to equipment, create WO).
- The description is editable inline. Editing updates the saved description and triggers re-indexing.
- The agent “remembers” the photo: subsequent queries can recall this photo, and similar future photos will surface the associated history.

2) Photo as a Work Order Attachment
- In a work order, user selects Add Attachment → Photo (upload or camera on mobile).
- Attachment persists to Storage and appears in the WO timeline/gallery with its description and detected tags.
- User can mark attachment type (evidence, before, after, diagnostic) and reorder attachments.
- The description is editable and corrections update the index.

---

## Success Criteria (MVP)

- Upload → Storage → Background analysis pipeline runs automatically.
- OCR-only works reliably (baseline); optional scene analysis can be enabled per company.
- Descriptions and structured metadata saved per photo; editable in UI; re-index on change.
- Equipment linking available (manual + auto-suggest via OCR and similarity).
- Photos searchable via natural language (semantic text search).

---

## System Components & Responsibilities

- Frontend (App Router)
  - Chat: file input + camera capture (mobile), thumbnail previews, progress UI, edit description UI.
  - Work Orders: attachment upload, galleries, edit description, assign attachment type, reordering.
  - Optional: “Find similar photos” action in photo detail view.

- API Layer
  - Upload endpoints (multipart) or signed-URL flow; returns attachment record with IDs.
  - Status endpoints for analysis jobs.
  - Endpoints to edit description, link/unlink equipment, set attachment type/order, re-run analysis.

- Storage & DB
  - Supabase Storage bucket for photos; signed URLs for access.
  - Database records for attachments/photos, with fields for description, analysis metadata, equipment link, hashes.

- Mastra Image Service (Server-only)
  - Ingest event-driven jobs with `file_url`, `company_id`, possibly `equipment_id`/`work_order_id`.
  - OCR (Vertex Vision OCR or Vision API) and optional scene analysis (Gemini/Vertex multimodal).
  - Produce normalized description and structured metadata; persist; trigger embedding and Pinecone upserts.

- RAG & Memory
  - Generate embeddings for text descriptions; store in Pinecone with rich metadata.
  - Search flows include image-derived content to augment AI responses and history recall.

---

## Storage & Database (MVP Shape)

- Storage path: `photos/{company_id}/{photo_id}/{filename}`.
- **Database Schema (Hybrid Link Table Approach)**:
  - **`media` table**: Stores the asset itself.
    - `id`, `company_id`, `uploaded_by`
    - `bucket_id` (enum: 'photos', 'videos', 'documents')
    - `storage_path`, `file_url`, `file_name`, `file_type`, `file_size`
    - `description` (AI generated/user edited), `analysis_metadata` (JSONB)
    - `processing_status` (uploaded, analyzing, ready, failed)
  - **`work_order_media` table**: Links media to work orders.
    - `work_order_id` (FK), `media_id` (FK)
    - `link_type` (evidence, before, after)
    - `display_order`
  - **`equipment_media` table**: Links media to equipment.
    - `equipment_id` (FK), `media_id` (FK)
    - `link_type` (profile_pic, reference, manual)
    - `display_order`

This design supports:
- **Transactional linking**: Photo → Work Order (via `work_order_media`)
- **Catalog linking**: Photo → Equipment (via `equipment_media`)
- **Many-to-Many**: One manual → Multiple Equipment (via multiple rows in `equipment_media`)
- **Standalone**: Photo in chat (exists in `media` table, no links yet)
- **Future-proofing**: Easy to add `conversation_media` or `user_media` tables later without altering the core `media` table.

---

## Background Analysis Pipeline

Trigger: on photo upload record creation.

Steps (MVP):
- Fetch file via signed URL.
- OCR (Vertex Vision OCR or Google Vision API): extract raw text; normalize whitespace.
- Scene analysis (optional per company): Gemini/Vertex multimodal to summarize the scene.
- Structured extraction (prompt-constrained): serial numbers, part labels, damage indicators, measurements (when present). Use JSON-style output via function-calling/structured prompting.
- Description synthesis: produce a single concise, technician-friendly description (<= 280 chars) plus a longer summary (<= 800 chars) for details.
- Persist results: write `photo_description` and `analysis_metadata`.
- Embeddings: compute text embeddings for `photo_description` and key metadata; upsert to Pinecone with metadata linking back to company/equipment/WO/photo.

Re-run
- Allow re-run analysis; keep `analysis_metadata.model_version` and overwrite description only if user hasn’t edited. If edited, re-run updates metadata but preserves `photo_description` unless user opts to replace.

---

## Structured Metadata (Normalized Output)

- `ocr_text`: raw extracted text.
- `scene_summary`: short free-text summary of visible elements.
- `extracted_serials`: list of { value, confidence, validated }.
- `detected_objects`: list of { label, confidence } (bounding boxes optional later).
- `damage_indicators`: list of { type (rust|leak|crack|wear), severity (low|medium|high) }.
- `measurements`: list of { type (gauge|temperature), value, unit }.
- `keywords`: array of strings for fast filtering.
- `processing_timestamp`, `model_version`.

Descriptions
- `photo_description_short`: concise, technician-facing.
- `photo_description_long`: expanded explanation and context.

Note: All fields optional; only include when detected. Keep schema stable to enable downstream analytics.

---

## Equipment Linking (Priority Focus)

Modes
- Manual: user selects equipment in UI while uploading or after the fact.
- OCR-based: match `extracted_serials` to `equipment.serial_number` (company-scoped). If unique match, auto-suggest link; else show candidates.
- Visual similarity (Phase 2): image embeddings to find nearest neighbor among photos already linked to equipment; offer suggestion with confidence.

UX
- After analysis, if high-confidence match found: “Looks like Equipment: {name} (SN: …). Link?”
- If no match: leave unlinked; allow search-and-link action.

Persistence
- Save `equipment_id` on attachment (when linked) and store a `link_type` in metadata (manual|ocr|visual) for auditability.

---

## Indexing & Retrieval

- Text embeddings for `photo_description_short` (and optionally `scene_summary`) using the project’s standard embeddings model.
- Pinecone metadata fields: `company_id`, `resource_type: 'photo'`, `resource_id: photo_id`, `work_order_id?`, `equipment_id?`, timestamps, `keywords`.
- Query flows (RAG):
  - Text queries: search photo descriptions alongside documents.
  - Context construction: prefer recent items; if query mentions equipment, filter by `equipment_id`.
- Similarity (Phase 2): add image embedding vectors (separate namespace or field) for image-to-image matching.

---

## Editing, Corrections, and Re-Indexing

- Editing description in UI updates DB and triggers embedding re-generation.
- Keep original auto-description in `analysis_metadata.original_description` and track `user_edited: true/false`.
- Only overwrite `photo_description` on re-run if `user_edited` is false, or if user explicitly chooses “Replace with new auto-description”.

---

## Prompts (Guidance, Not Code)

OCR Normalization Prompt (post-OCR clean-up)
- “Normalize this equipment OCR text. Remove duplicates, fix casing for model names, and extract candidate serial numbers (label with confidence). Keep output brief and machine-readable JSON fields: ocr_text_clean, extracted_serials[].”

Scene Summary Prompt (vision-capable model)
- “You are a manufacturing maintenance assistant. Summarize what you see in 2–3 sentences. Call out parts, visible damage (rust/leak/wear), readable labels, and any safety concerns.”

Structured Extraction Prompt
- “From this photo context (text + scene), extract: serials[], detected_objects[], damage_indicators[], measurements[], keywords[]. Return JSON only. Use strict types and omit empty fields. If unsure, omit.”

Final Description Synthesis Prompt
- “Write a concise technician-facing description (<= 280 chars) of this photo for a work order attachment. Include the most critical detail first (e.g., damaged part) and reference serial only if clearly detected.”

---

## API & Operations (Descriptions)

- POST /api/photos/upload (or reuse existing documents/attachments upload with type=photo): accepts multipart or uses signed URL flow; returns record with `id`, `file_url`.
- POST /api/photos/:id/analyze: triggers background analysis (idempotent guard).
- PATCH /api/photos/:id: allows edits to `photo_description`, `attachment_type`, `display_order`, `equipment_id`.
- GET /api/photos/:id/status: returns `{ status, last_error?, updated_at }`.
- POST /api/photos/:id/link-equipment: accepts `equipment_id` and `link_type`.

Notes
- Use service-role keys server-side only. Client never sees OCR/Vision credentials.
- Respect RLS by company; all endpoints filter by `company_id`.

---

## Security & Privacy (MVP-Scope)

- Signed URLs with short TTL for viewing/downloading.
- Strip EXIF metadata on upload where feasible.
- Content policies: warn if PII risk is detected in OCR (optional).

---

## Video Overlap (For Future Extension)

- Treat video as: (a) frames → same photo pipeline, and (b) audio → STT → text summary.
- Reuse structured metadata schema and description synthesis for key frames.
- Support a compact “video summary photo-set” (N frames with descriptions) linked to the same `video_id`.

---

## Rollout Plan

Phase 1 (MVP)
- Upload, Storage, DB fields; OCR-only; description synthesis; manual equipment linking; Pinecone text indexing; edit + re-index.

Phase 2
- Scene analysis; serial validation; auto-suggest equipment via OCR; similarity via image embeddings; dedup via hashes; re-run analysis controls.

---

## Non-Goals (Now)

- Full image diffing/overlay, bounding boxes UX, offline-first queues, face blurring, advanced cost controls. These can follow once MVP proves value.
