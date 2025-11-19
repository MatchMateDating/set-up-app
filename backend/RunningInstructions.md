Go to backend
cd backend

For macOS: follow the instructions here https://realpython.com/python-virtual-environments-a-primer/ to create a venv virtual environment

Activate:
macOs: source {name of virtual environemnt}/bin/activate
Windows: .\{name of virtual environemnt}\Scripts\activate

Download requirements:
pip install -r requirements.txt

in the backend folder run:
macOs:
export FLASK_APP=app:create_app
export FLASK_ENV=development

Windows:
set FLASK_APP=app:create_app
set FLASK_ENV=development


Create database: (add python -m in front of each command in macOS)
delete the instance and migrations folders
flask db init
flask db migrate
flask db upgrade

run:
flask run
macOS: python -m flask run 

To run the ai_embeddings model before we integrate it within the app:
run:
make sure you're in the backend folder
flask analyze-conversation <user_id_1> <user_id_2>

