from config.config import Config
import pymongo
from pymongo import MongoClient
from bson.codec_options import CodecOptions
from bson.binary import UuidRepresentation
import redis

# Configurar el cliente MongoDB con UUID representation
MONGO_URI = f"mongodb://{Config.MONGO_USER}:{Config.MONGO_PASS}@{Config.MONGO_HOST}:{Config.MONGO_PORT}/{Config.MONGO_DB}?authSource=admin"

# Crear cliente con configuración de UUID
mongo_client = MongoClient(MONGO_URI, uuidRepresentation='standard')

# Configurar la base de datos con opciones de codec
codec_options = CodecOptions(uuid_representation=UuidRepresentation.STANDARD)
mongo_db = mongo_client[Config.MONGO_DB].with_options(codec_options=codec_options)

redis_client = redis.Redis(host=Config.REDIS_HOST, port=Config.REDIS_PORT, db=Config.REDIS_DB)

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