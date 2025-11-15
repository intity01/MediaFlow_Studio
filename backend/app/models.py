from pydantic import BaseModel, HttpUrl

class DownloadRequest(BaseModel):
	url: HttpUrl
	quality: str = "320"

class VideoInfo(BaseModel):
	title: str
	duration: int
	thumbnail: str
	channel: str
