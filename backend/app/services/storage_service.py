"""
Cloud storage service for handling image uploads to S3 or Cloudflare R2.
Supports both S3-compatible storage providers.
"""
import boto3
import os
from botocore.exceptions import ClientError
from flask import current_app
from werkzeug.utils import secure_filename
from uuid import uuid4


def get_storage_client():
    """
    Get the appropriate storage client (S3 or R2).
    Returns boto3 client configured for the chosen storage provider.
    """
    config = current_app.config
    
    if config.get('USE_CLOUDFLARE_R2'):
        # Cloudflare R2 uses S3-compatible API
        return boto3.client(
            's3',
            endpoint_url=config.get('R2_ENDPOINT_URL'),
            aws_access_key_id=config.get('R2_ACCESS_KEY_ID'),
            aws_secret_access_key=config.get('R2_SECRET_ACCESS_KEY'),
            region_name='auto'  # R2 doesn't use regions
        )
    elif config.get('USE_S3'):
        # Standard AWS S3
        return boto3.client(
            's3',
            aws_access_key_id=config.get('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=config.get('AWS_SECRET_ACCESS_KEY'),
            region_name=config.get('S3_REGION', 'us-east-1')
        )
    else:
        return None


def get_bucket_name():
    """Get the bucket name for the configured storage provider."""
    config = current_app.config
    if config.get('USE_CLOUDFLARE_R2'):
        return config.get('R2_BUCKET_NAME')
    elif config.get('USE_S3'):
        return config.get('S3_BUCKET_NAME')
    return None


def upload_image_to_cloud(image_file, user_id):
    """
    Upload an image file to cloud storage (S3 or R2).
    
    Args:
        image_file: FileStorage object from Flask request
        user_id: ID of the user uploading the image
        
    Returns:
        tuple: (image_url, unique_filename) or (None, None) on error
    """
    if not current_app.config.get('USE_CLOUD_STORAGE'):
        return None, None
    
    try:
        # Generate unique filename with environment prefix
        ext = os.path.splitext(secure_filename(image_file.filename))[1]
        
        # Add environment prefix to separate dev/prod images
        env_prefix = current_app.config.get('STORAGE_ENV_PREFIX', '')
        if env_prefix:
            unique_filename = f"{env_prefix}/users/{user_id}/{uuid4().hex}{ext}"
        else:
            unique_filename = f"users/{user_id}/{uuid4().hex}{ext}"
        
        # Get storage client and bucket
        s3_client = get_storage_client()
        bucket_name = get_bucket_name()
        
        if not s3_client or not bucket_name:
            return None, None
        
        # Upload file
        # Note: R2 doesn't support ACL, so we skip it for R2
        upload_args = {
            'ContentType': image_file.content_type or 'image/jpeg'
        }
        if not current_app.config.get('USE_CLOUDFLARE_R2'):
            # Only set ACL for S3 (R2 doesn't support it)
            upload_args['ACL'] = 'public-read'
        
        s3_client.upload_fileobj(
            image_file,
            bucket_name,
            unique_filename,
            ExtraArgs=upload_args
        )
        
        # Generate URL
        cdn_base_url = current_app.config.get('CDN_BASE_URL')
        
        if cdn_base_url:
            # Use CDN URL if configured (custom domain: cdn.matchmatedating.com/images)
            image_url = f"{cdn_base_url.rstrip('/')}/{unique_filename}"
        elif current_app.config.get('USE_CLOUDFLARE_R2'):
            # R2: Generate presigned URL as fallback (if CDN not configured)
            image_url = s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': bucket_name, 'Key': unique_filename},
                ExpiresIn=31536000  # 1 year expiration
            )
        else:
            # S3 public URL format
            region = current_app.config.get('S3_REGION', 'us-east-1')
            bucket_name = current_app.config.get('S3_BUCKET_NAME')
            image_url = f"https://{bucket_name}.s3.{region}.amazonaws.com/{unique_filename}"
        
        return image_url, unique_filename
        
    except ClientError as e:
        current_app.logger.error(f"Error uploading image to cloud storage: {str(e)}")
        return None, None
    except Exception as e:
        current_app.logger.error(f"Unexpected error uploading image: {str(e)}")
        return None, None


def delete_image_from_cloud(image_key):
    """
    Delete an image from cloud storage.
    
    Args:
        image_key: The key/path of the image in storage
        
    Returns:
        bool: True if successful, False otherwise
    """
    if not current_app.config.get('USE_CLOUD_STORAGE'):
        return False
    
    try:
        s3_client = get_storage_client()
        bucket_name = get_bucket_name()
        
        if not s3_client or not bucket_name:
            return False
        
        s3_client.delete_object(Bucket=bucket_name, Key=image_key)
        return True
        
    except ClientError as e:
        current_app.logger.error(f"Error deleting image from cloud storage: {str(e)}")
        return False
    except Exception as e:
        current_app.logger.error(f"Unexpected error deleting image: {str(e)}")
        return False


def extract_key_from_url(image_url):
    """
    Extract the storage key from an image URL.
    Handles both CDN URLs and direct bucket URLs.
    
    Args:
        image_url: Full URL of the image
        
    Returns:
        str: Storage key or None if extraction fails
    """
    if not image_url:
        return None
    
    # Try to extract from CDN URL
    cdn_base_url = current_app.config.get('CDN_BASE_URL')
    if cdn_base_url and image_url.startswith(cdn_base_url):
        return image_url.replace(cdn_base_url.rstrip('/') + '/', '')
    
    # Try to extract from R2 URL
    if 'r2.cloudflarestorage.com' in image_url:
        parts = image_url.split('r2.cloudflarestorage.com/')
        if len(parts) > 1:
            return '/'.join(parts[1].split('/')[1:])  # Remove bucket name
    
    # Try to extract from S3 URL
    if '.s3.' in image_url or '.s3.amazonaws.com' in image_url:
        # Format: https://bucket.s3.region.amazonaws.com/key
        # or: https://bucket.s3.amazonaws.com/key
        parts = image_url.split('.amazonaws.com/')
        if len(parts) > 1:
            return parts[1]
        parts = image_url.split('.s3.')
        if len(parts) > 1:
            return '/'.join(parts[1].split('/')[1:])  # Remove region
    
    # If URL format is unknown, try to extract the last part
    return image_url.split('/')[-1] if '/' in image_url else image_url
