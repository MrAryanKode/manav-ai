from fastapi import FastAPI

app = FastAPI(
    title="MANAV AI",
    description="MANAV Assistant Backend",
    version="0.1.0",
)


@app.get("/")
async def root():
    return {
        "name": "MANAV",
        "status": "online",
        "message": "MANAV backend is running",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}