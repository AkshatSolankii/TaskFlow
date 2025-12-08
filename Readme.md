Follow the steps below to run this project on your local system:
Open your terminal or command prompt and run:
git clone https://github.com/AkshatSolankii/TaskFlow.git 
cd TaskFlow


Install Project Dependencies
pip install -r requirements.txt

Initialize the Database
Run the following inside Python shell:
python
>>> from app import app
>>> from models import db
>>> with app.app_context():
...     db.create_all()
...     exit()
This creates a file named taskflow.db in your project folder.

Start the development server with:
python app.py

You should see an output similar to:
Running on http://127.0.0.1:5000


