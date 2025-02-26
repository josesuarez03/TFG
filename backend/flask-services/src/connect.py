from config import Config
import pymongo
import redis

MONGO_URI = f"mongodb://{Config.MONGO_USER}:{Config.MONGO_PASS}@{Config.MONGO_HOST}:{Config.MONGO_PORT}/{Config.MONGO_DB}?authSource=admin"
mongo_client = pymongo.MongoClient(MONGO_URI)
mongo_db = mongo_client[Config.MONGO_DB]

redis_client = redis.Redis(host=Config.REDIS_HOST, port=Config.REDIS_PORT, db=0)

# Verificar conexiones
try:
    mongo_client.server_info()  # Prueba la conexión a MongoDB
    print("✅ Conexión exitosa a MongoDB")
except Exception as e:
    print(f"❌ Error conectando a MongoDB: {e}")

try:
    redis_client.ping()  # Prueba la conexión a Redis
    print("✅ Conexión exitosa a Redis")
except Exception as e:
    print(f"❌ Error conectando a Redis: {e}")