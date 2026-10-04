# 📸 Canchalant — The Intelligent Ambient Candid Photo Assistant & Semantic Memory Gallery

*Built with love for Hacktoberfest: Best Use of Gemma & Best Use of MongoDB Atlas.*

---

## 💡 The Inspiration: Built for a Friend & His Partner

We take thousands of photos on our phones, but almost all of them are staged. We stop what we're doing, turn to the lens, smile on cue, and freeze. The most genuine moments—the spontaneous laughter over morning coffee, a glance exchanged while cooking, the quiet contentment of reading together on the sofa—are rarely captured because picking up a camera breaks the magic of the moment.

I built **Canchalant** (a portmanteau of **Candid** and **Nonchalant**) as a private, ambient memory assistant for a close friend and his partner. 

Placed on a shelf or desk, Canchalant sits quietly in the background. Its ambient vision pipeline watches the scene without being intrusive:
1. It continuously samples camera frames.
2. It applies OpenCV heuristic filters to reject motion blur and camera-staring staged poses.
3. It sends candidate interactions to **Google's open-weight Gemma Vision (PaliGemma)** via Hugging Face Serverless Inference for nuanced candid classification and heartfelt captioning.
4. It computes local **CLIP vector embeddings** (`clip-ViT-B-32`) on CUDA.
5. It uploads the captured moment directly to **Cloudinary** for secure, optimized media delivery under the `canchalant_snaps` vault.
6. It indexes the moment, caption, and dense vectors in **MongoDB Atlas** for natural language semantic vector search.

Weeks later, instead of scrolling through endless folders, they can type:
> *"sitting together laughing over coffee"* or *"quiet moments on the couch"*
and MongoDB Atlas Vector Search immediately surfaces the exact moment.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 REACT FRONTEND (Vite + Tailwind)            │
│  - Live Camera HUD with Laplacian Blur & Motion Metrics     │
│  - Mode Toggles: Passive Ambient / Manual Shutter / Burst   │
│  - Sensitivity Sliders: Blur, Confidence, Frame Interval   │
│  - Searchable Memory Gallery with Lightbox & Mood Badges    │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / WebSocket / JSON
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    FASTAPI BACKEND GATEWAY                  │
│                                                             │
│   ┌────────────────────────┐    ┌────────────────────────┐  │
│   │ OpenCV Pre-Filter      │    │ Hugging Face Gemma     │  │
│   │ - Laplacian Variance   ├───▶│ Vision (PaliGemma 3B)  │  │
│   │ - Haar Gaze Heuristics │    │ - Structured JSON      │  │
│   └────────────────────────┘    └───────────┬────────────┘  │
│                                             │               │
│                                             ▼               │
│   ┌────────────────────────┐    ┌────────────────────────┐  │
│   │ Cloudinary Storage     │    │ Local CLIP Vectorizer  │  │
│   │ - canchalant_snaps     │    │ - clip-ViT-B-32 (CUDA) │  │
│   │ - Secure HTTPS URLs    │    │ - 512-dim unit vector  │  │
│   └───────────┬────────────┘    └───────────┬────────────┘  │
│               │                             │               │
│               └──────────────┬──────────────┘               │
│                              ▼                              │
│   ┌──────────────────────────────────────────────────────┐  │
│   │                 MONGODB ATLAS                        │  │
│   │ - Database: canchalant | Collection: moments         │  │
│   │ - $vectorSearch Aggregation Pipeline                 │  │
│   │ - Cosine Similarity Metric                           │  │
│   └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🌟 Key Features

### 1. 🎥 Ambient Camera HUD with Real-Time Feedback
- **Passive Ambient Mode:** Runs hands-free, evaluating frames every few seconds. Only snaps when an authentic, unposed moment occurs.
- **Manual Capture + Auto-Tag:** One-tap shutter that immediately invokes PaliGemma for emotional tagging and captioning.
- **Burst Candid Hunt:** Aggressive 500ms sampling window for high-energy moments (cooking together, playing games).
- **Interactive HUD Overlays:** Shows blur score, face count, candid score, target acquisition ring, and camera flash effect.

### 2. 🧠 Google Gemma Vision (PaliGemma 3B)
Using the open-weight `google/paligemma-3b-pt-224` model, Canchalant classifies moments into:
- `SPECIFIC_CANDID`: Deep connection, laughter, authentic conversation caught in the moment.
- `GENERAL_CANDID`: Ambient, walking, reading, unposed background activity.
- `POSED`: Stiff, looking directly into the camera, performed smiles (automatically rejected in passive mode).
- `JUNK`: Empty, accidental, or severely blurred shots.

Every approved capture receives a heartfelt 1–2 sentence caption and 3–5 mood tags (e.g. `["warmth", "laughter", "coffee-date"]`).

### 3. ☁️ Cloudinary Media Storage (`canchalant_snaps`)
Captured memories are instantly uploaded to Cloudinary, ensuring:
- Automatic format optimization and responsive delivery.
- Secure HTTPS URLs stored directly with the metadata.
- Clean deletion cascading between the database and Cloudinary assets.

### 4. ⚡ MongoDB Atlas Vector Search
Every moment is vectorized with local CUDA-accelerated `clip-ViT-B-32` into a 512-dimensional dense embedding.
Using MongoDB Atlas's `$vectorSearch` pipeline:
```python
pipeline = [
    {
        "$vectorSearch": {
            "index": "vector_index",
            "path": "embedding",
            "queryVector": query_vector,
            "numCandidates": 50,
            "limit": 20
        }
    },
    {
        "$project": {
            "_id": 0,
            "embedding": 0,
            "score": {"$meta": "vectorSearchScore"}
        }
    }
]
```
Users can search naturally using everyday language like *"reading together on the couch"* or *"laughing in the kitchen"*, and find the exact memories with relevance scores.

---

## 🛠️ Tech Stack & Open Source Ecosystem

| Domain | Technology | Role |
|---|---|---|
| **Vision Model** | Google PaliGemma 3B (`google/paligemma-3b-pt-224`) | Candid interaction classification & captioning |
| **Database** | MongoDB Atlas | Document storage & Vector Search |
| **Media Cloud** | Cloudinary | Asset storage under `canchalant_snaps` |
| **Embeddings** | `sentence-transformers` (`clip-ViT-B-32`) | 512-dim multimodal vectors |
| **Heuristics** | OpenCV (Laplacian variance + Haar cascades) | Motion blur & gaze pre-filtering |
| **Backend** | FastAPI + Motor (Async ASGI) | High-throughput async gateway |
| **Frontend** | React 19 + Vite + Tailwind CSS + Lucide | HUD stream, controls drawer & memory gallery |

---

## 🔒 Why Open Innovation & Local Vision Matter

- **Zero Cloud API Subscription Fees:** Runs on open weights (Google Gemma + CLIP).
- **Media Privacy by Design:** Pre-filtering and embeddings run locally before cloud syndication.
- **Low Latency:** OpenCV discards 90% of unsuitable frames in <5ms, saving bandwidth and compute.

---

## 🚀 Getting Started

### 1. Clone & Configure
```bash
git clone https://github.com/IamSamk/Canchalant.git
cd Canchalant
cp .env.example .env
```

### 2. Configure `.env`
Fill in your credentials:
```env
MONGODB_URI="mongodb+srv://<username>:<password>@cluster0.kdhnwwg.mongodb.net/?appName=Cluster0"
MONGODB_DB_NAME="canchalant"
MONGODB_COLLECTION="moments"
MONGODB_VECTOR_INDEX_NAME="vector_index"

HF_TOKEN="hf_your_token_here"
HF_VISION_MODEL="google/paligemma-3b-pt-224"

CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_API_SECRET="your_api_secret"
CLOUDINARY_FOLDER="canchalant_snaps"
```

### 3. Create MongoDB Atlas Vector Search Index
In MongoDB Atlas, create a Vector Search Index on `canchalant.moments`:
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

### 4. Run Backend & Frontend
```bash
# Terminal 1: Backend
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`, grant camera permissions, and let Canchalant preserve your candid memories.
