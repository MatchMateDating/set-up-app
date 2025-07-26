from app import create_app
from flask import send_from_directory
import os

app = create_app()

@app.route('/static/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(os.path.join(app.root_path, 'static', 'uploads'), filename)

if __name__ == '__main__':
    app.run(debug=True)
