Go to backend
cd backend

make virtual env called .venv
python venv -m .venv

activate:
source .venv\bin\activate
.\.venv\Scripts\activate

create database
flask db init
flask db migrate
flask db upgrade

run:
flask run


