from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="AI食品致病性微生物污染事件应急与处置")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "AI食品致病性微生物污染事件应急与处置 API"}

@app.get("/api/health")
def health():
    return {"status": "ok"}
