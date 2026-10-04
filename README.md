# 🎯 Canchalant

> **Candid + Nonchalant** — An intelligent, private ambient photo assistant and semantic memory gallery.

Built as a gift for a friend and his partner. Canchalant uses an active camera stream (laptop webcam or phone browser) that continuously samples frames, runs real-time heuristic filters, classifies authentic unposed candid interactions via **Google Gemma Vision (PaliGemma)**, uploads captures to **Cloudinary** (`canchalant_snaps`), and indexes dense **CLIP vector embeddings** in **MongoDB Atlas Vector Search** for natural language retrieval.

**Say "sitting together laughing over coffee" and find exactly that moment.**

---

## 🏆 Target Hacktoberfest Categories
- **Best Use of Gemma ($200)** — PaliGemma 3B open-weight vision model for candid classification, heartfelt captioning, and mood tagging.
- **Best Use of MongoDB Atlas ($100)** — Atlas Vector Search (`$vectorSearch`) over 512-dim multimodal CLIP embeddings.

---

## ✨ Features

- **🎥 Ambient Camera HUD** — Real-time HTML5 `getUserMedia` video canvas with animated target indicators, Laplacian blur metrics, and capture flash.
- **🧠 Google Gemma Vision Integration** — Serverless open-weight PaliGemma (`google/paligemma-3b-pt-224`) outputs structured JSON with classification (`SPECIFIC_CANDID`, `GENERAL_CANDID`, `POSED`, `JUNK`), confidence, caption, and mood tags.
- **☁️ Cloudinary Media Storage** — Instant auto-upload to the `canchalant_snaps` folder, delivering secure HTTPS URLs with zero local storage constraints.
- **🔍 MongoDB Atlas Vector Search** — Local CUDA-accelerated CLIP (`clip-ViT-B-32`) vectors queried via Atlas `$vectorSearch` for natural language semantic memory recall.
- **🎛️ Granular Control Drawer** — Toggles between `Passive Ambient` (hands-free auto-snap), `Manual Capture + Auto-Tag`, and `Burst Candid Hunt`, plus sensitivity sliders for blur and confidence.
- **💾 Responsive Memories Gallery** — Masonry grid with mood chips, lightbox inspection, date timestamps, instant search, and deletion cascading.

---

## 🏗️ Architecture

```
┌────────────────────────────────────────┐
│     React Frontend (Vite + Tailwind)   │
│  - Real-time Camera HUD                │
│  - Mode & Sensitivity Control Drawer   │
│  - Semantic Vector Memory Gallery      │
└───────────────────┬────────────────────┘
                    │ HTTP REST API
                    ▼
┌────────────────────────────────────────┐
│         FastAPI Backend Gateway        │
│                                        │
│  1. OpenCV Laplacian & Gaze Pre-Filter │
│  2. Hugging Face Gemma Vision Model    │
│  3. Local CUDA CLIP Embedder (512-dim) │
│  4. Cloudinary Storage (canchalant)    │
│  5. MongoDB Atlas Vector Search        │
└────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### 1. Prerequisites
- Python 3.11+ / 3.12 / 3.13
- Node.js 18+ & npm
- MongoDB Atlas cluster with a Vector Search index
- Hugging Face account token
- Cloudinary account

### 2. Environment Configuration
Copy `.env.example` to `.env` and fill in your values:
```env
# MongoDB Atlas
MONGODB_URI="mongodb+srv://<username>:<password>@cluster0.kdhnwwg.mongodb.net/?appName=Cluster0"
MONGODB_DB_NAME="canchalant"
MONGODB_COLLECTION="moments"
MONGODB_VECTOR_INDEX_NAME="vector_index"

# Hugging Face Serverless Vision API
HF_TOKEN="hf_your_token_here"
HF_VISION_MODEL="google/paligemma-3b-pt-224"

# Cloudinary Media Storage
CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_API_SECRET="your_api_secret"
CLOUDINARY_FOLDER="canchalant_snaps"

# Server Settings
PORT=8000
HOST="0.0.0.0"
DEVICE="cuda"
```

### 3. MongoDB Atlas Vector Index
Create a Vector Search index on the `canchalant.moments` collection in Atlas:
```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 512,
      "similarity": "cosine"
    }
  ]
}
```
Set the index name to `vector_index`.

### 4. Running the Application

**Backend:**
```bash
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 📄 License
MIT — See [LICENSE](./LICENSE)
