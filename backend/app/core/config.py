from pathlib import Path
from pydantic import BaseModel

class Settings(BaseModel):
    PROJECT_NAME: str = "ImageSleuth"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    # Base paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent.parent
    STORAGE_DIR: Path = BASE_DIR / "storage"
    EVIDENCE_DIR: Path = STORAGE_DIR / "evidence"
    DERIVED_DIR: Path = STORAGE_DIR / "derived"
    REPORTS_DIR: Path = STORAGE_DIR / "reports"
    
    # Database
    DATABASE_URL: str = f"sqlite:///{STORAGE_DIR / 'imagesleuth.db'}"
    
    # Security & limits
    MAX_UPLOAD_SIZE_BYTES: int = 20 * 1024 * 1024  # 20 MB
    ALLOWED_IMAGE_TYPES: list[str] = ["image/jpeg", "image/png", "image/webp"]
    ALLOWED_EXTENSIONS: list[str] = [".jpg", ".jpeg", ".png", ".webp"]
    
    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

settings = Settings()

# Ensure directories exist
settings.EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
settings.DERIVED_DIR.mkdir(parents=True, exist_ok=True)
settings.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
