from flask import Flask
from flask_cors import CORS
from routes.routes import bp
from config import Config

app = Flask(__name__)
CORS(app)
app.config.from_object(Config)

app.register_blueprint(bp)

if __name__ == '__main__':
    app.run(debug=True)