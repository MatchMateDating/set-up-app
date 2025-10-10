Go to backend
cd backend

For macOS: follow the instructions here https://realpython.com/python-virtual-environments-a-primer/ to create a venv virtual environment

Activate:
macOs: source {name of virtual environemnt}/bin/activate
Windows: .\{name of virtual environemnt}\Scripts\activate

Download requirements:
pip install -r requirements.txt

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
flask analyze-conversation <user_id_1> <user_id_2>

