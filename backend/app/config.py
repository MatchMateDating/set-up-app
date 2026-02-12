import os

class Config:
    # Database Configuration
    # Supports both SQLite (local dev) and PostgreSQL (production)
    DB_USERNAME = os.getenv('DB_USERNAME')
    DB_PASSWORD = os.getenv('DB_PASSWORD')
    DB_HOST = os.getenv('DB_HOST')
    DB_PORT = os.getenv('DB_PORT', '5432')
    DB_NAME = os.getenv('DB_NAME', 'postgres')
    
    # Use PostgreSQL if credentials are provided, otherwise fall back to SQLite
    if DB_USERNAME and DB_PASSWORD and DB_HOST:
        SQLALCHEMY_DATABASE_URI = f'postgresql://{DB_USERNAME}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}'
    else:
        # For running the DB locally
        SQLALCHEMY_DATABASE_URI = 'sqlite:///../instance/users.db'

    # Application Secrets
    # Use default values if SECRET_KEY is not set or is empty
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key'
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'super-secret-key'
    
    # Environment
    FLASK_ENV = os.getenv('FLASK_ENV', 'development')
    
    # Cloud Storage Configuration (S3 or Cloudflare R2)
    # S3 Configuration
    AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
    S3_BUCKET_NAME = os.getenv('S3_BUCKET_NAME')
    S3_REGION = os.getenv('S3_REGION', 'us-east-1')
    
    # Cloudflare R2 Configuration (alternative to S3)
    R2_ACCOUNT_ID = os.getenv('R2_ACCOUNT_ID')
    R2_ACCESS_KEY_ID = os.getenv('R2_ACCESS_KEY_ID')
    R2_SECRET_ACCESS_KEY = os.getenv('R2_SECRET_ACCESS_KEY')
    R2_BUCKET_NAME = os.getenv('R2_BUCKET_NAME')
    R2_ENDPOINT_URL = os.getenv('R2_ENDPOINT_URL')
    
    # Determine which storage to use (R2 takes precedence if configured)
    USE_CLOUDFLARE_R2 = bool(R2_ACCOUNT_ID and R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY and R2_BUCKET_NAME)
    USE_S3 = bool(AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY and S3_BUCKET_NAME) and not USE_CLOUDFLARE_R2
    USE_CLOUD_STORAGE = USE_CLOUDFLARE_R2 or USE_S3
    
    # CDN Configuration (for public image URLs)
    CDN_BASE_URL = os.getenv('CDN_BASE_URL')  # e.g., https://your-cdn-domain.com
    # If CDN_BASE_URL is not set, will use presigned URLs or direct bucket URLs
    
    # Storage Environment Prefix (to separate dev/prod images in same bucket)
    # Set to 'dev' for development, 'prod' for production, or leave empty for no prefix
    # Example: 'dev' -> images stored in 'dev/users/{user_id}/...'
    #          'prod' -> images stored in 'prod/users/{user_id}/...'
    #          '' -> images stored in 'users/{user_id}/...' (backward compatible)
    STORAGE_ENV_PREFIX = os.getenv('STORAGE_ENV_PREFIX', '')
    
    # CORS Configuration
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', '*').split(',') if os.getenv('CORS_ORIGINS') else ['*']