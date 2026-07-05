# GradeSmart AI 🎓

**Auto-grade short answers for Online prep courses.**


## Quick Stats

TO Be added

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React (Vite) + Tailwind CSS | 
| Backend | FastAPI + Python 3.11 | 
| Database | SQLite (auto-created, max 1000 rows) | 
| Embeddings | sentence-transformers/all-MiniLM-L6-v2 | 
| OCR | Tesseract (grayscale + contrast enhancement) | 
| LLM | Together AI / Hackathon Credits | 
| Hosting | Hugging Face Spaces (CPU free tier) | 

## Features

| Feature | Description |
|---------|-------------|
| **Text Submission** | Type or paste short-answer responses |
| **Image Upload** | Upload handwritten answer sheets (JPG/PNG, max 10MB) |
| **OCR Processing** | Auto-extracts text with grayscale + contrast preprocessing |
| **Semantic Grading** | sentence-transformers cosine similarity, score 0–100 |
| **LLM Feedback** | AI-generated <80 word feedback: mistake → hint → action |
| **Teacher Dashboard** | Paginated table, inline edit for score & feedback |
| **Bulk Upload** | JSON array batch grading (up to 500 at once) |
| **CSV Export** | Download `grading_results.csv` for Google Classroom / Moodle |
| **Demo Mode** | One-click seed with 5 sample submissions |
| **Time-Saved Counter** | Real-time estimate of hours saved |
| **Rate Limiting** | 100 req/min per user to prevent abuse |
| **Input Sanitization** | HTML tags stripped, max lengths enforced |

## Project Structure

```
assessment-automation/
├── backend/
│   ├── app/
│   │   ├── main.py              # 14 endpoints, validation, rate limiting
│   │   ├── grading.py           # Semantic similarity with LRU cache
│   │   ├── feedback.py          # LLM feedback with 10s timeout + fallback
│   │   ├── ocr.py               # Tesseract OCR (grayscale, contrast 2x)
│   │   ├── models.py            # SQLAlchemy + stats + backup + auto-cleanup
│   │   └── prompts/
│   │       └── feedback_system.txt
│   ├── tests/
│   │   └── test_grading.py      # 13 unit tests
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Stats cards, demo mode, toast system
│   │   ├── api.js               # All API calls
│   │   ├── components/
│   │   │   ├── SubmissionForm.jsx   # Text + image + bulk + spinner + char counter
│   │   │   ├── GradeEditor.jsx      # Paginated table + color-coded scores + clear all
│   │   │   ├── ExportCSV.jsx         # One-click CSV download
│   │   │   └── Toast.jsx            # Animated notification toasts
│   │   └── index.css            # Tailwind + slide-in animation
│   ├── package.json
│   ├── vite.config.js
│   ├── nginx.conf
│   └── Dockerfile
├── eval/
│   ├── eval_harness.py          # Auto vs. human score comparison
│   └── sample_data.json         # 10 GATE CS Q&A pairs
├── docker-compose.yml           # Multi-service Docker
├── Dockerfile                   # Single-container HF Spaces deploy
├── .env                         # Environment template
├── .gitignore
└── README.md
```

## Installation & Setup

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/)
- (Optional) Python 3.11 for local backend
- (Optional) Node.js 20 for local frontend
- Tesseract OCR (for local non-Docker use)

### Quick Start (Docker — Recommended)

```bash
# 1. Clone the project
cd assessment-automation

# 2. Set up environment
cp .env .env.local
# Edit .env.local and add your LLM_API_KEY

# 3. Launch
docker-compose --env-file .env.local up --build
```

**Access the app:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:7860

### Manual Setup (No Docker)

**Backend:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate    # Windows
# source venv/bin/activate  # macOS/Linux

pip install -r requirements.txt

# Install Tesseract OCR:
#   Ubuntu: sudo apt install tesseract-ocr tesseract-ocr-eng
#   macOS:  brew install tesseract
#   Windows: https://github.com/UB-Mannheim/tesseract/wiki

uvicorn app.main:app --reload --port 7860
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## API Documentation

All endpoints are prefixed with `/api`. Rate limit: **100 requests/minute**.

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/health` | Health check + version | — |
| `GET` | `/api/version` | App version | — |
| `GET` | `/api/stats` | Dashboard stats (total, avg score, time saved) | 30/min |
| `POST` | `/api/submit` | Grade a text answer | 30/min |
| `POST` | `/api/submit-image` | Upload image → OCR → grade | 20/min |
| `POST` | `/api/bulk-upload` | Batch-grade JSON array (max 500) | 10/min |
| `POST` | `/api/grade` | Get similarity score only | — |
| `POST` | `/api/feedback` | Generate LLM feedback | — |
| `GET` | `/api/submissions` | Paginated list (?page=1&per_page=100) | 60/min |
| `PUT` | `/api/submissions/:id` | Update score / feedback | — |
| `GET` | `/api/export` | Download grading_results.csv | — |
| `POST` | `/api/demo-seed` | Create 5 sample submissions | 5/min |
| `GET` | `/api/backup` | Export all data as JSON | 10/min |
| `DELETE` | `/api/clear-all` | Delete all submissions | 3/min |

## Testing

```bash
cd backend
pytest tests/ -v
```

Expected output — 13 tests covering:
- Exact match grading (≥90 score)
- Close match grading (50–100)
- Wrong answer grading (0–40)
- Empty input handling (returns 0)
- Semantic similarity
- Partial knowledge scoring
- Feedback word count (<80 words)
- Fallback feedback quality
- Score-dependent tone checking

### Evaluation Harness

```bash
cd eval
pip install -r ../backend/requirements.txt
python eval_harness.py
```

Compares auto-grading against human scores using 10 GATE Computer Science Q&A pairs. Reports Mean Absolute Error (MAE) and Root Mean Squared Error (RMSE).


## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| OCR returns empty text | Low-contrast image | Use darker ink, better lighting |
| Grading score too low | Vague student answer | Add more detail to reference answer |
| LLM feedback not generating | Missing API key | Set `LLM_API_KEY` in .env or HF secrets |
| Submission limit reached | 1000 max | Export data, then Clear All |
| Rate limit error | Too many requests | Wait 1 minute, reduce frequency |
| Docker build fails | Missing dependencies | Ensure Docker Desktop is running |
| Hugging Face build timeout | Large model download | Use `sentence-transformers` cache in Dockerfile |

## Security Features

- Rate limiting: 100 requests/minute per IP
- Input sanitization: HTML tags stripped from all text
- File validation: Only JPG/PNG accepted, max 10MB
- CORS: Configurable allowed origins
- Environment-based secrets: No hardcoded API keys
- Temp file cleanup: Uploaded images deleted after processing
