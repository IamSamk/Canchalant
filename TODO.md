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
- [ ] **Commit:** `feat(storage): implement Cloudinary media storage with secure HTTPS URL generation`

## Phase 2: Heuristic Pre-Filter & Blur Detection
- [x] Implement `backend/app/services/filter.py`:
  - [x] Laplacian variance blur detection (configurable threshold, default 80.0)
  - [x] Face/gaze detection via OpenCV Haar cascades
  - [x] Candidness heuristic scoring (looking-away vs staring-at-camera)
- [ ] **Commit:** `feat(filter): implement OpenCV Laplacian blur and candid heuristic checks`

## Phase 3: Hugging Face Serverless Gemma Vision Integration
- [ ] Implement `backend/app/services/vlm.py`:
  - [ ] Asynchronous Hugging Face Serverless Inference API client for `google/paligemma-3b-pt-224`
  - [ ] Bearer authentication via `HF_TOKEN`
  - [ ] Strict JSON prompt for classification, confidence, caption, mood_tags
  - [ ] Robust fallback and error handling
- [ ] **Commit:** `feat(vision): integrate Hugging Face serverless PaliGemma inference client`

## Phase 4: Local Vector Embeddings (CLIP)
- [x] Implement `backend/app/services/embedder.py`:
  - [x] Load `clip-ViT-B-32` via sentence-transformers (CUDA auto-detection)
  - [x] `embed_image(image_bytes) -> List[float]` method
  - [x] `embed_text(query) -> List[float]` method
  - [x] L2 unit vector normalization (512 dimensions)
- [ ] **Commit:** `feat(embeddings): implement local CUDA-accelerated CLIP vectorizer`

## Phase 5: MongoDB Atlas & Vector Search Integration
- [ ] Implement `backend/app/services/db.py`:
  - [ ] Motor async connection targeting database `canchalant` and collection `moments`
  - [ ] Atlas `$vectorSearch` aggregation pipeline on 512-dim CLIP vectors
  - [ ] Secure Cloudinary HTTPS URL persistence
  - [ ] Gallery pagination, mood tag filtering, and deletion
- [ ] **Commit:** `feat(db): configure Motor client and Atlas vectorSearch aggregation pipeline`

## Phase 6: FastAPI API Gateway
- [ ] Implement `backend/app/api/endpoints.py`:
  - [ ] `POST /api/frame/analyze` — prefilter -> HF PaliGemma -> CLIP -> Cloudinary -> MongoDB
  - [ ] `GET /api/gallery` — paginated gallery with Cloudinary images
  - [ ] `POST /api/gallery/search` — natural language vector search
  - [ ] `DELETE /api/gallery/{id}` — remove DB record and Cloudinary asset
  - [ ] `GET /api/health` — health check for all subsystems
- [ ] Update `backend/app/main.py`
- [ ] **Commit:** `feat(api): expose REST endpoints for camera analysis, gallery, and semantic search`

## Phase 7: Interactive Modern Frontend (Vite + React)
- [ ] Update `frontend/src/api.js` to use `import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"`
- [ ] Update Camera HUD and Gallery components to render Cloudinary secure URLs
- [ ] Verify reactive Camera HUD, Controls Drawer, and Searchable Memories Gallery
- [ ] **Commit:** `feat(ui): build reactive camera HUD, control drawer, and vector gallery`

## Phase 8: Verification & Challenge Polish
- [ ] End-to-end integration testing (curl + browser)
- [ ] Update `README.md` and `DEV_SUBMISSION.md`
- [ ] Final verification of all user criteria
