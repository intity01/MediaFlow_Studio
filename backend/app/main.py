from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .models import DownloadRequest, VideoInfo

app = FastAPI(title="MediaFlow API")

# CORS configuration
app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)

@app.get("/")
async def root():
	return {"message": "MediaFlow API", "status": "running"}

@app.get("/health")
async def health():
	return {"status": "healthy"}

@app.post("/api/info")
async def get_info(request: DownloadRequest):
	# Placeholder - we'll add yt-dlp integration next
	return {
		"title": "Example",
		"duration": 300,
		"channel": "Example Channel"
	}

if __name__ == "__main__":
	import uvicorn
	uvicorn.run(app, host="0.0.0.0", port=8000)
