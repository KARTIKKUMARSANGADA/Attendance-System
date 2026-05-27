# PMS Attendance Dashboard

A modern, multi-user attendance dashboard for the Brainerhub PMS API.

## Architecture
- **Frontend**: Vanilla HTML/JS/CSS (Optimized for Vercel deployment)
- **Backend**: Flask Proxy Server (Optimized for Render deployment)

## Local Development

### 1. Backend Setup
```bash
# Navigate to the project root
cd pms

# Install dependencies
pip install -r backend/requirements.txt

# Run the backend proxy
python backend/main.py
```
*The proxy runs on `http://localhost:8002`.*

### 2. Frontend Setup
Simply open `index.html` in your browser. 
To authenticate, you can:
1. Paste your `access_token` into the UI.
2. Or, use the provided Bookmarklet on the official PMS site.

## Deployment

### Deploy Backend (Render)
1. Push this repository to GitHub.
2. Go to [Render](https://render.com) and create a **Web Service**.
3. Use the following settings:
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `gunicorn backend.main:app`
4. Once deployed, copy the Render URL.

### Deploy Frontend (Vercel)
1. In `index.html`, update the `PROD_API_BASE` variable to your Render URL.
2. Go to [Vercel](https://vercel.com) and create a new project.
3. Import your GitHub repository.
4. Vercel will automatically deploy the static files.

## Future Plans (Phase 2)
- Integrate Supabase for persistent token storage and formal user authentication.
