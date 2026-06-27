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

<!-- Docker Setup Process -->
Step 1:-
Install Docker Desktop
Download from: https://www.docker.com/products/docker-desktop/
After installation:
Open Docker Desktop
Wait until Docker Engine is running

Step 2:- 
Verify Docker Installation
Open terminal or PowerShell and run:
```bash
docker --version
```
You should see output similar to:
```plaintext
Docker version 28.x.x
```

Step 3 — Build and Run the Application
Run the following command inside the project folder:
```bash
docker compose up --build
```
This command will:
- Build the Docker image
- Install project dependencies
- Start the Flask application container


Step 4 — Access the Application
Open browser and visit:
```plaintext
http://localhost:5000
```


Step 5 — Stop the Application
Press:
```plaintext
CTRL + C
```
inside the terminal.

Step 6 — Restart Application Later
To start the application again:
```bash
docker compose up
```
