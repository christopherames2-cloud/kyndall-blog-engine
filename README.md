# Kyndall Blog Engine - Web Service Version

This converts kyndall-blog-engine from a Job to a **Web Service** that runs 24/7 and can be triggered manually from Sanity Studio or via a cron service.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Sanity Studio                          │
│                   (in kyndall-site)                         │
│                                                             │
│    ┌──────────────────────┐                                │
│    │ 🚀 Generate Articles │  ← Click button                │
│    └──────────────────────┘                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              kyndall-site API Route                         │
│           /api/blog-engine/trigger                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           kyndall-blog-engine (Web Service)                 │
│               POST /generate                                │
│                                                             │
│    • Fetches trending topics                                │
│    • Generates articles with Claude                         │
│    • Saves drafts to Sanity                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Sanity CMS                               │
│             (5 new draft articles)                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Setup Instructions

### Step 1: Update kyndall-blog-engine

Replace `src/index.js` with the new web server version provided.

The key differences:
- Runs as an HTTP server on port 8080
- Has `/health`, `/status`, and `/generate` endpoints
- Uses `API_SECRET` for authentication

**Deploy to DigitalOcean as a WEB SERVICE (not Job)**

### Step 2: Add Environment Variables to kyndall-blog-engine

### Step 3: Add Files to kyndall-site

Copy these files to your kyndall-site repo:

| File | Destination |
|------|-------------|
| `sanity/components/TriggerBlogEngine.tsx` | `sanity/components/TriggerBlogEngine.tsx` |
| `sanity/structure.ts` | `sanity/structure.ts` |
| `app/api/blog-engine/trigger/route.ts` | `app/api/blog-engine/trigger/route.ts` |
| `app/api/blog-engine/status/route.ts` | `app/api/blog-engine/status/route.ts` |

### Step 4: Add Environment Variables to kyndall-site


### Step 5: Deploy Both Apps

1. Push kyndall-blog-engine → DigitalOcean redeploys
2. Push kyndall-site → DigitalOcean redeploys

---

## Usage

### Manual Trigger (from Sanity Studio)

1. Open Sanity Studio: `https://kyndallames.com/studio`
2. Click **🚀 Generate Articles** in sidebar
3. Click **Generate Articles Now**
4. Wait 2-5 minutes
5. Check **📰 Tips & Trends** for new drafts!

### Automatic Daily Generation (with cron-job.org)

1. Go to [cron-job.org](https://cron-job.org) (free)
2. Create account
3. Create new cron job:
   - **URL**: `https://kyndall-blog-engine-xxxxx.ondigitalocean.app/generate`
   - **Schedule**: `0 12 * * *` (12pm UTC = 4am PST)
   - **Method**: POST
   - **Headers**: 
     - `Authorization`: `Bearer your-secret-here`
     - `Content-Type`: `application/json`
4. Save

Now articles generate automatically every day at 4am PST! ☀️

---

## API Endpoints (kyndall-blog-engine)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | No | Health check (for DigitalOcean) |
| `/status` | GET | No | Current job status & last run |
| `/generate` | POST | Yes | Trigger article generation |

### Example: Trigger Manually


### Example: Check Status

```bash
curl https://kyndall-blog-engine-xxx.ondigitalocean.app/status
```

---

## Troubleshooting

### "Failed to connect to blog engine"
- Check BLOG_ENGINE_URL is correct
- Check blog engine is deployed and running
- Check BLOG_ENGINE_SECRET matches API_SECRET

### "Unauthorized"
- Check API_SECRET/BLOG_ENGINE_SECRET match
- Make sure Authorization header is correct

### "Job already running"
- Wait for current generation to complete (~2-5 min)
- Check /status to see progress

---
