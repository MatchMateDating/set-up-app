Go to backend
cd backend

For macOS: follow the instructions here https://realpython.com/python-virtual-environments-a-primer/ to create a venv virtual environment

Activate:
macOs: source {name of virtual environemnt}/bin/activate
Windows: .\{name of virtual environemnt}\Scripts\activate

Download requirements:
pip install -r requirements.txt

Create database: (add python -m in front of each command in macOS)
flask db init
flask db migrate
flask db upgrade

run:
flask run
macOS: python -m flask run


