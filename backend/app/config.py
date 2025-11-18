import os

class Config:
    # For running the DB on Amazon RDS for PostgreSQL
    # DB_USERNAME = os.getenv('DB_USERNAME', 'your_username')
    # DB_PASSWORD = os.getenv('DB_PASSWORD', 'your_password')
    # DB_HOST = os.getenv('DB_HOST', 'your-db-endpoint')
    # DB_PORT = os.getenv('DB_PORT', '5432')
    # DB_NAME = os.getenv('DB_NAME', 'postgres')

    # SQLALCHEMY_DATABASE_URI = f'postgresql://{DB_USERNAME}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}'

    # For running the DB locally
    SQLALCHEMY_DATABASE_URI = 'sqlite:///../instance/users.db'

    # For either
    # Use default values if SECRET_KEY is not set or is empty
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key'
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'super-secret-key'