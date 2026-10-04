# 🚀 Canchalant — Production Deployment Guide

This guide covers deploying **Canchalant** across two modern cloud platforms:
- **Backend (FastAPI + CLIP + OpenCV)** $\rightarrow$ [Render](https://render.com) (Python Web Service)
- **Frontend (React + Vite + Tailwind CSS)** $\rightarrow$ [Vercel](https://vercel.com) (Edge CDN Static SPA)

---

## 🏗️ Architecture Overview

```
                      ┌──────────────────────────────────────┐
                      │           User Browser / Mobile       │
                      └──────────────────┬───────────────────┘
                                         │
                    HTTPS Requests       │ WebRTC / Camera Stream
                                         ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │                       Frontend: Vercel Edge CDN                         │
   │  - Framework: Vite + React                                             │
   │  - Config: vercel.json                                                 │
   │  - Env: VITE_API_BASE_URL=https://canchalant-api.onrender.com          │
   └─────────────────────────────────────┬──────────────────────────────────┘
                                         │ REST API / WebSocket
                                         ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │                       Backend: Render Web Service                       │
   │  - Framework: FastAPI + Uvicorn                                        │
   │  - Config: render.yaml                                                 │
   │  - Embeddings: Local CLIP (ViT-B-32 on CPU)                            │
   │  - Vision Inference: Hugging Face Serverless (Gemma / PaliGemma)       │
   └───────────────┬────────────────────────────────────────┬───────────────┘
                   │                                        │
                   ▼                                        ▼
    ┌─────────────────────────────┐         ┌─────────────────────────────┐
    │     MongoDB Atlas M0        │         │       Cloudinary CDN        │
    │  - Database: canchalant     │         │  - Folder: canchalant_snaps │
    │  - Collection: moments      │         │  - Secure HTTPS image URLs  │
    │  - 512-dim $vectorSearch    │         │                             │
    └─────────────────────────────┘         └─────────────────────────────┘
```

---

## 📦 Part 1: Deploying Backend to Render

### Option A: 1-Click Blueprint (Recommended)

1. Push your repository to GitHub.
2. Log into [Render Dashboard](https://dashboard.render.com).
3. Click **New +** $\rightarrow$ **Blueprint**.
4. Connect your GitHub repository (`IamSamk/Canchalant`).
5. Render will automatically detect the [render.yaml](file:///d:/Projects/Canchalant/render.yaml) file.
6. Under **Environment Variables**, fill in the secret variables:
   - `MONGODB_URI`: Your MongoDB Atlas connection string.
   - `HF_TOKEN`: Your Hugging Face user access token.
   - `CLOUDINARY_API_KEY`: Your Cloudinary API key.
   - `CLOUDINARY_API_SECRET`: Your Cloudinary API secret.
7. Click **Apply**. Render will build and deploy the service.

---

### Option B: Manual Web Service Setup

If you prefer configuring the Web Service manually:

1. In Render, click **New +** $\rightarrow$ **Web Service**.
2. Connect your GitHub repository.
3. Configure the service settings:
   - **Name**: `canchalant-api`
   - **Language**: `Python 3`
   - **Region**: `Oregon (US West)` or closest to your users
   - **Branch**: `main`
   - **Root Directory**: *(leave blank for repo root)*
   - **Build Command**:
     ```bash
     pip install --upgrade pip && pip install torch --index-url https://download.pytorch.org/whl/cpu && pip install -r backend/requirements.txt
     ```
   - **Start Command**:
     ```bash
     uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT
     ```
   - **Plan**: `Free`

4. Add the following **Environment Variables** under the **Environment** tab:

| Variable | Value / Description |
| :--- | :--- |
| `PYTHON_VERSION` | `3.11.9` |
| `DEVICE` | `cpu` *(forces lightweight CPU mode on Render free tier)* |
| `MONGODB_URI` | `mongodb+srv://<user>:<password>@cluster0.kdhnwwg.mongodb.net/?appName=Cluster0` |
| `MONGODB_DB_NAME` | `canchalant` |
| `MONGODB_COLLECTION` | `moments` |
| `MONGODB_VECTOR_INDEX_NAME` | `vector_index` |
| `HF_TOKEN` | `your_huggingface_token_here` |
| `HF_VISION_MODEL` | `google/paligemma-3b-pt-224` |
| `CLOUDINARY_CLOUD_NAME` | `your_cloudinary_cloud_name` |
| `CLOUDINARY_API_KEY` | `your_cloudinary_api_key` |
| `CLOUDINARY_API_SECRET` | `your_cloudinary_api_secret` |
| `CLOUDINARY_FOLDER` | `canchalant_snaps` |

5. Click **Create Web Service**.
6. Once deployed, note your service URL (e.g. `https://canchalant-api.onrender.com`).
7. Test the health endpoint in your browser:
   ```
   https://canchalant-api.onrender.com/api/health
   ```
   Expected response:
   ```json
   {
     "status": "ok",
     "mongodb": "connected",
     "huggingface": "connected (user: IamSamkk)",
     "cloudinary": "connected",
     "embedder": "healthy",
     "device": "cpu"
   }
   ```

---

## ⚡ Part 2: Deploying Frontend to Vercel

1. Log into [Vercel](https://vercel.com).
2. Click **Add New...** $\rightarrow$ **Project**.
3. Import your GitHub repository (`IamSamk/Canchalant`).
4. Configure the project:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend` *(or leave as `./` — root [vercel.json](file:///d:/Projects/Canchalant/vercel.json) supports both)*
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Under **Environment Variables**, add:
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: `https://canchalant-api.onrender.com` *(your live Render backend URL from Part 1)*
6. Click **Deploy**.
7. Vercel will build the frontend and assign an HTTPS production domain (e.g. `https://canchalant.vercel.app`).

---

## 🌐 Part 3: MongoDB Atlas IP Access

Render services use dynamic egress IP addresses. To ensure Render can always connect to MongoDB Atlas:

1. Log into [MongoDB Atlas](https://cloud.mongodb.com).
2. Navigate to **Security** $\rightarrow$ **Network Access**.
3. Confirm that `0.0.0.0/0` (Allow Access from Anywhere) is present and active.
4. If not present:
   - Click **Add IP Address**
   - Click **Allow Access from Anywhere** (`0.0.0.0/0`)
   - Click **Confirm**

---

## 🔍 Part 4: Post-Deployment Smoke Test

Once both frontend and backend are live:

1. **Open Vercel App**: Visit your Vercel URL in your browser or phone.
2. **Check System Telemetry**:
   - The top navbar should display green badges: `Atlas Online`, `Cloudinary Active`, `CPU Active`.
3. **Capture a Candid Moment**:
   - Allow camera permissions in the **Studio** tab.
   - Click the camera shutter button or upload a photo using the desktop upload icon.
   - Observe the real-time telemetry HUD evaluate blur score and candid confidence.
4. **Inspect the Vault**:
   - Switch to the **Vault** tab.
   - Verify that your newly captured moment appears with its Cloudinary secure HTTPS image.
   - Click on the photo card to open the Cinema Lightbox.
5. **Test Natural Language Semantic Search**:
   - In the search bar, type `smiling candid interaction` or `quiet ambient moment`.
   - Verify that Atlas `$vectorSearch` re-ranks memories based on 512-dimension cosine similarity.

---

## 📁 File Reference

- Root Vercel config: [vercel.json](file:///d:/Projects/Canchalant/vercel.json)
- Frontend Vercel config: [frontend/vercel.json](file:///d:/Projects/Canchalant/frontend/vercel.json)
- Render Blueprint: [render.yaml](file:///d:/Projects/Canchalant/render.yaml)
- Frontend env template: [frontend/.env.example](file:///d:/Projects/Canchalant/frontend/.env.example)
- Backend env template: [backend/.env.example](file:///d:/Projects/Canchalant/backend/.env.example)
- Project root env template: [.env.example](file:///d:/Projects/Canchalant/.env.example)
