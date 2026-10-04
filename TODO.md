# 🎯 Canchalant — Project Roadmap

> **Canchalant** (Candid + Nonchalant) — An intelligent, private ambient photo assistant
> and semantic memory gallery.

---

## Phase 0: Environment & Configuration
- [x] Create `TODO.md` with exhaustive roadmap
- [x] Create `.env.example` with Cloudinary, Hugging Face, and MongoDB Atlas config keys
- [x] Create `.gitignore` (ignore `.env`, `node_modules`, `captured_photos/`, `__pycache__`, etc.)
- [x] Create `LICENSE` (MIT)
- [x] Scaffold backend directory structure: `backend/app/{core,api,services,models}/`
- [x] Update Python dependencies in `backend/requirements.txt` (FastAPI, Motor, SentenceTransformers, Cloudinary, etc.)
- [x] Scaffold frontend with Vite + React + Tailwind CSS
- [x] **Commit:** `chore: scaffold project structure and base dependencies`

## Phase 1: Backend Core Configuration & Cloudinary Storage
- [x] Create `backend/app/core/config.py` — Pydantic Settings with Cloudinary, HF Token, and Atlas keys
- [x] Create `backend/app/models/schemas.py` — Pydantic models with Cloudinary URL support
- [x] Create `backend/app/services/storage.py` — Cloudinary media storage client uploading to `canchalant_snaps`
- [x] **Commit:** `feat(storage): implement Cloudinary media storage with secure HTTPS URL generation`

## Phase 2: Heuristic Pre-Filter & Blur Detection
- [x] Implement `backend/app/services/filter.py`:
  - [x] Laplacian variance blur detection (configurable threshold, default 80.0)
  - [x] Face/gaze detection via OpenCV Haar cascades
  - [x] Candidness heuristic scoring (looking-away vs staring-at-camera)
- [x] **Commit:** `feat(filter): implement OpenCV Laplacian blur and candid heuristic checks`

## Phase 3: Hugging Face Serverless Gemma Vision Integration
- [x] Implement `backend/app/services/vlm.py`:
  - [x] Asynchronous Hugging Face Serverless Inference API client for `google/paligemma-3b-pt-224`
  - [x] Bearer authentication via `HF_TOKEN`
  - [x] Strict JSON prompt for classification, confidence, caption, mood_tags
  - [x] Robust fallback and error handling
- [x] **Commit:** `feat(vision): integrate Hugging Face serverless PaliGemma inference client`

## Phase 4: Local Vector Embeddings (CLIP)
- [x] Implement `backend/app/services/embedder.py`:
  - [x] Load `clip-ViT-B-32` via sentence-transformers (CUDA auto-detection)
  - [x] `embed_image(image_bytes) -> List[float]` method
  - [x] `embed_text(query) -> List[float]` method
  - [x] L2 unit vector normalization (512 dimensions)
- [x] **Commit:** `feat(embeddings): implement local CUDA-accelerated CLIP vectorizer`

## Phase 5: MongoDB Atlas & Vector Search Integration
- [x] Implement `backend/app/services/db.py`:
  - [x] Motor async connection targeting database `canchalant` and collection `moments`
  - [x] Atlas `$vectorSearch` aggregation pipeline on 512-dim CLIP vectors
  - [x] Secure Cloudinary HTTPS URL persistence
  - [x] Gallery pagination, mood tag filtering, and deletion
- [x] **Commit:** `feat(db): configure Motor client and Atlas vectorSearch aggregation pipeline`

## Phase 6: FastAPI API Gateway
- [x] Implement `backend/app/api/endpoints.py`:
  - [x] `POST /api/frame/analyze` — prefilter -> HF PaliGemma -> CLIP -> Cloudinary -> MongoDB
  - [x] `GET /api/gallery` — paginated gallery with Cloudinary images
  - [x] `POST /api/gallery/search` — natural language vector search
  - [x] `DELETE /api/gallery/{id}` — remove DB record and Cloudinary asset
  - [x] `GET /api/health` — health check for all subsystems
- [x] Update `backend/app/main.py`
- [x] **Commit:** `feat(api): expose REST endpoints for camera analysis, gallery, and semantic search`

## Phase 7: Interactive Modern Frontend (Vite + React)
- [x] Update `frontend/src/api.js` to use `import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"`
- [x] Update Camera HUD and Gallery components to render Cloudinary secure URLs
- [x] Add photo upload capability for desktop/testing
- [x] Verify reactive Camera HUD, Controls Drawer, and Searchable Memories Gallery
- [x] **Commit:** `feat(ui): build reactive camera HUD, control drawer, and vector gallery`

## Phase 8: Verification & Challenge Polish
- [x] End-to-end integration testing (curl + python + API pipeline)
- [x] Write `README.md` and `DEV_SUBMISSION.md`
- [x] Final verification of all user criteria
- [x] **Commit:** `docs: complete architecture guide, setup steps, and DEV challenge post`
