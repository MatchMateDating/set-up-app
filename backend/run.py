from app import create_app
from flask import send_from_directory, redirect
import os

app = create_app()

# Local file serving route (for backward compatibility when not using cloud storage)
# In production with cloud storage, images are served via CDN URLs
@app.route('/static/uploads/<path:filename>')
def uploaded_file(filename):
    # If using cloud storage, redirect to CDN or return 404
    # Otherwise, serve from local filesystem
    if app.config.get('USE_CLOUD_STORAGE', False):
        # If cloud storage is configured, local files shouldn't be accessed
        # Images should be accessed via their cloud URLs stored in the database
        return {'error': 'Image not found. Use cloud storage URL.'}, 404
    else:
        # Fallback to local filesystem serving
        return send_from_directory(os.path.join(app.root_path, 'static', 'uploads'), filename)

# This allows the app to be run with Gunicorn in production
# Usage: gunicorn -w 4 -b 0.0.0.0:5000 run:app
# Or: gunicorn --bind 0.0.0.0:$PORT run:app (for platforms like Railway/Render)

if __name__ == '__main__':
    # Development server
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
