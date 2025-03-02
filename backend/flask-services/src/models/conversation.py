import json
import logging
from datetime import datetime
import uuid
from data.connect import  mongo_db, redis_client

# Configurar logger
logger = logging.getLogger(__name__)

class ConversationalDatasetManager:
    
    def __init__(self):
        try:
            self.collection = mongo_db['conversations']
            logger.info("ConversationalDatasetManager inicializado correctamente")
        except Exception as e:
            logger.error(f"Error al inicializar ConversationalDatasetManager: {str(e)}")
            raise

    def add_conversation(self, user_id, medical_context, messages, symptoms, symptoms_pattern, pain_scale, triaje_level):
        try:
            conversation_id = str(uuid.uuid4())
            conversation = {
                "user_id": user_id,
                "_id": uuid.UUID(conversation_id),
                "symptoms": symptoms,
                "symptoms_pattern": symptoms_pattern,
                "pain_scale": pain_scale,
                "triaje_level": triaje_level,
                "medical_context": medical_context,
                "messages": messages,
                "timestamp": datetime.now(),
                "active": True
            }
            self.collection.insert_one(conversation)
            logger.info(f"Conversación {conversation_id} agregada a MongoDB para el usuario {user_id}")
            
            # También guardar en Redis con expiración de 24 horas
            try:
                RedisCacheManager.guardar_conversacion(user_id, conversation_id, medical_context, messages, 
                                                     symptoms, symptoms_pattern, pain_scale, triaje_level)
                logger.info(f"Conversación {conversation_id} agregada a Redis para el usuario {user_id}")
            except Exception as redis_error:
                logger.warning(f"Error al guardar en Redis, continuando solo con MongoDB: {str(redis_error)}")
            
            return conversation_id
        except Exception as e:
            logger.error(f"Error al agregar conversación: {str(e)}")
            raise

    def get_conversations(self, user_id):
        try:
            conversations = self.collection.find({"user_id": user_id})
            result = list(conversations)
            logger.info(f"Recuperadas {len(result)} conversaciones de MongoDB para el usuario {user_id}")
            return result
        except Exception as e:
            logger.error(f"Error al obtener conversaciones para el usuario {user_id}: {str(e)}")
            raise

    def get_conversation(self, user_id, conversation_id):
        try:
            # Primero intentar obtener de Redis
            try:
                cached_conversation = RedisCacheManager.obtener_conversacion(user_id, conversation_id)
                if cached_conversation:
                    logger.info(f"Conversación {conversation_id} recuperada de Redis para el usuario {user_id}")
                    return cached_conversation
            except Exception as redis_error:
                logger.warning(f"Error al obtener de Redis, continuando con MongoDB: {str(redis_error)}")
                
            # Si no está en cache, buscar en MongoDB
            conversation = self.collection.find_one({"user_id": user_id, "_id": uuid.UUID(conversation_id)})
            if conversation:
                logger.info(f"Conversación {conversation_id} recuperada de MongoDB para el usuario {user_id}")
            else:
                logger.info(f"Conversación {conversation_id} no encontrada para el usuario {user_id}")
            return conversation
        except Exception as e:
            logger.error(f"Error al obtener conversación {conversation_id} para el usuario {user_id}: {str(e)}")
            raise

    def update_conversation(self, user_id, conversation_id, messages=None, symptoms=None, 
                           symptoms_pattern=None, pain_scale=None, triaje_level=None):
        try:
            update_data = {"timestamp": datetime.now()}
            
            if messages:
                update_data["messages"] = messages
            if symptoms:
                update_data["symptoms"] = symptoms
            if symptoms_pattern:
                update_data["symptoms_pattern"] = symptoms_pattern
            if pain_scale:
                update_data["pain_scale"] = pain_scale
            if triaje_level:
                update_data["triaje_level"] = triaje_level
                
            result = self.collection.update_one(
                {"user_id": user_id, "_id": uuid.UUID(conversation_id)},
                {"$set": update_data}
            )
            
            logger.info(f"Conversación {conversation_id} actualizada en MongoDB para el usuario {user_id}, campos modificados: {result.modified_count}")
            
            # Actualizar también en Redis si existe
            try:
                cached_conversation = RedisCacheManager.obtener_conversacion(user_id, conversation_id)
                if cached_conversation:
                    for key, value in update_data.items():
                        cached_conversation[key] = value
                    RedisCacheManager.actualizar_conversacion(user_id, conversation_id, cached_conversation)
                    logger.info(f"Conversación {conversation_id} actualizada en Redis para el usuario {user_id}")
            except Exception as redis_error:
                logger.warning(f"Error al actualizar en Redis: {str(redis_error)}")
                
            return result.modified_count
        except Exception as e:
            logger.error(f"Error al actualizar conversación {conversation_id} para el usuario {user_id}: {str(e)}")
            raise

    def mark_conversation_inactive(self, user_id, conversation_id):
        try:
            result = self.collection.update_one(
                {"user_id": user_id, "_id": uuid.UUID(conversation_id)},
                {"$set": {"active": False}}
            )
            
            logger.info(f"Conversación {conversation_id} marcada como inactiva en MongoDB para el usuario {user_id}")
            
            # Eliminar de Redis
            try:
                RedisCacheManager.eliminar_conversacion(user_id, conversation_id)
                logger.info(f"Conversación {conversation_id} eliminada de Redis para el usuario {user_id}")
            except Exception as redis_error:
                logger.warning(f"Error al eliminar de Redis: {str(redis_error)}")
            
            return result.modified_count
        except Exception as e:
            logger.error(f"Error al marcar conversación {conversation_id} como inactiva para el usuario {user_id}: {str(e)}")
            raise

    def delete_conversation(self, user_id, conversation_id):
        try:
            # Eliminar de Redis primero
            try:
                RedisCacheManager.eliminar_conversacion(user_id, conversation_id)
                logger.info(f"Conversación {conversation_id} eliminada de Redis para el usuario {user_id}")
            except Exception as redis_error:
                logger.warning(f"Error al eliminar de Redis: {str(redis_error)}")
            
            # Luego eliminar de MongoDB
            result = self.collection.delete_one({"user_id": user_id, "_id": uuid.UUID(conversation_id)})
            logger.info(f"Conversación {conversation_id} eliminada de MongoDB para el usuario {user_id}, elementos eliminados: {result.deleted_count}")
            return result.deleted_count
        except Exception as e:
            logger.error(f"Error al eliminar conversación {conversation_id} para el usuario {user_id}: {str(e)}")
            raise

    def delete_all_conversations(self, user_id):
        try:
            # Eliminar todas las conversaciones de Redis para este usuario
            try:
                RedisCacheManager.eliminar_todas_conversaciones(user_id)
                logger.info(f"Todas las conversaciones eliminadas de Redis para el usuario {user_id}")
            except Exception as redis_error:
                logger.warning(f"Error al eliminar todas las conversaciones de Redis: {str(redis_error)}")
            
            # Luego eliminar de MongoDB
            result = self.collection.delete_many({"user_id": user_id})
            logger.info(f"Todas las conversaciones eliminadas de MongoDB para el usuario {user_id}, elementos eliminados: {result.deleted_count}")
            return result.deleted_count
        except Exception as e:
            logger.error(f"Error al eliminar todas las conversaciones para el usuario {user_id}: {str(e)}")
            raise
    
    def sync_from_redis_to_mongo(self, user_id, conversation_id=None):
        """Sincroniza datos de Redis a MongoDB"""
        try:
            if conversation_id:
                # Sincronizar una conversación específica
                try:
                    cached_data = RedisCacheManager.obtener_conversacion(user_id, conversation_id)
                    if cached_data:
                        # Asegurarse de que _id sea un UUID y no una string
                        if isinstance(cached_data["_id"], str):
                            cached_data["_id"] = uuid.UUID(cached_data["_id"])
                            
                        result = self.collection.replace_one(
                            {"user_id": user_id, "_id": cached_data["_id"]},
                            cached_data,
                            upsert=True
                        )
                        logger.info(f"Conversación {conversation_id} sincronizada de Redis a MongoDB para el usuario {user_id}")
                except Exception as redis_error:
                    logger.warning(f"Error al sincronizar de Redis a MongoDB: {str(redis_error)}")
            else:
                # Sincronizar todas las conversaciones del usuario
                try:
                    all_cached = RedisCacheManager.obtener_todas_conversaciones(user_id)
                    for cached_data in all_cached:
                        # Asegurarse de que _id sea un UUID y no una string
                        if isinstance(cached_data["_id"], str):
                            cached_data["_id"] = uuid.UUID(cached_data["_id"])
                            
                        self.collection.replace_one(
                            {"user_id": cached_data["user_id"], "_id": cached_data["_id"]},
                            cached_data,
                            upsert=True
                        )
                    logger.info(f"{len(all_cached)} conversaciones sincronizadas de Redis a MongoDB para el usuario {user_id}")
                except Exception as redis_error:
                    logger.warning(f"Error al sincronizar todas las conversaciones de Redis a MongoDB: {str(redis_error)}")
        except Exception as e:
            logger.error(f"Error al sincronizar datos de Redis a MongoDB para el usuario {user_id}: {str(e)}")
            raise

class RedisCacheManager:
    # Constantes
    EXPIRATION_TIME = 60 * 60 * 24  # 24 horas en segundos
    
    @staticmethod
    def _get_key(user_id, conversation_id=None):
        """Genera la clave para Redis"""
        try:
            if conversation_id:
                return f"conversation:{user_id}:{conversation_id}"
            return f"user:{user_id}"
        except Exception as e:
            logger.error(f"Error al generar clave Redis: {str(e)}")
            raise
    
    @staticmethod
    def guardar_conversacion(user_id, conversation_id, medical_context, messages, symptoms, 
                           symptoms_pattern, pain_scale, triaje_level):
        """Guarda una conversación en Redis con expiración de 24 horas"""
        try:
            data = {
                "user_id": user_id,
                "_id": conversation_id,
                "symptoms": symptoms,
                "symptoms_pattern": symptoms_pattern,
                "pain_scale": pain_scale,
                "triaje_level": triaje_level,
                "medical_context": medical_context,
                "messages": messages,
                "timestamp": datetime.now().isoformat(),
                "active": True
            }
            
            # Guardar la conversación con expiración
            key = RedisCacheManager._get_key(user_id, conversation_id)
            redis_client.set(key, json.dumps(data), ex=RedisCacheManager.EXPIRATION_TIME)
            logger.debug(f"Datos guardados en Redis con clave: {key}")
            
            # Añadir a la lista de conversaciones del usuario
            user_key = RedisCacheManager._get_key(user_id)
            redis_client.sadd(user_key, conversation_id)
            redis_client.expire(user_key, RedisCacheManager.EXPIRATION_TIME)
            logger.debug(f"Conversación {conversation_id} añadida al conjunto de usuario: {user_key}")
            
            return data
        except Exception as e:
            logger.error(f"Error al guardar conversación en Redis para usuario {user_id}, conversación {conversation_id}: {str(e)}")
            raise

    @staticmethod
    def obtener_conversacion(user_id, conversation_id):
        """Obtiene una conversación específica de Redis"""
        try:
            key = RedisCacheManager._get_key(user_id, conversation_id)
            data = redis_client.get(key)
            
            # Renovar el tiempo de expiración cuando se accede
            if data:
                redis_client.expire(key, RedisCacheManager.EXPIRATION_TIME)
                logger.debug(f"Tiempo de expiración renovado para clave: {key}")
                return json.loads(data)
            logger.debug(f"No se encontró datos en Redis para clave: {key}")
            return None
        except json.JSONDecodeError as je:
            logger.error(f"Error al decodificar JSON desde Redis para usuario {user_id}, conversación {conversation_id}: {str(je)}")
            return None
        except Exception as e:
            logger.error(f"Error al obtener conversación de Redis para usuario {user_id}, conversación {conversation_id}: {str(e)}")
            raise
    
    @staticmethod
    def actualizar_conversacion(user_id, conversation_id, data):
        """Actualiza una conversación en Redis"""
        try:
            key = RedisCacheManager._get_key(user_id, conversation_id)
            redis_client.set(key, json.dumps(data), ex=RedisCacheManager.EXPIRATION_TIME)
            logger.debug(f"Conversación actualizada en Redis con clave: {key}")
            return True
        except Exception as e:
            logger.error(f"Error al actualizar conversación en Redis para usuario {user_id}, conversación {conversation_id}: {str(e)}")
            raise
    
    @staticmethod
    def eliminar_conversacion(user_id, conversation_id):
        """Elimina una conversación específica de Redis"""
        try:
            # Eliminar la conversación
            key = RedisCacheManager._get_key(user_id, conversation_id)
            redis_client.delete(key)
            logger.debug(f"Eliminada conversación de Redis con clave: {key}")
            
            # Eliminar de la lista de conversaciones del usuario
            user_key = RedisCacheManager._get_key(user_id)
            redis_client.srem(user_key, conversation_id)
            logger.debug(f"Conversación {conversation_id} eliminada del conjunto de usuario: {user_key}")
            
            return True
        except Exception as e:
            logger.error(f"Error al eliminar conversación de Redis para usuario {user_id}, conversación {conversation_id}: {str(e)}")
            raise
    
    @staticmethod
    def eliminar_todas_conversaciones(user_id):
        """Elimina todas las conversaciones de un usuario en Redis"""
        try:
            # Obtener todas las IDs de conversación para este usuario
            user_key = RedisCacheManager._get_key(user_id)
            conversation_ids = redis_client.smembers(user_key)
            
            # Eliminar cada conversación
            for conv_id in conversation_ids:
                try:
                    key = RedisCacheManager._get_key(user_id, conv_id.decode('utf-8'))
                    redis_client.delete(key)
                    logger.debug(f"Eliminada conversación de Redis con clave: {key}")
                except Exception as inner_e:
                    logger.warning(f"Error al eliminar conversación individual {conv_id}: {str(inner_e)}")
            
            # Eliminar la lista de conversaciones
            redis_client.delete(user_key)
            logger.debug(f"Eliminado conjunto de usuario: {user_key}")
            
            return True
        except Exception as e:
            logger.error(f"Error al eliminar todas las conversaciones de Redis para usuario {user_id}: {str(e)}")
            raise
    
    @staticmethod
    def obtener_todas_conversaciones(user_id):
        """Obtiene todas las conversaciones de un usuario en Redis"""
        try:
            # Obtener todas las IDs de conversación para este usuario
            user_key = RedisCacheManager._get_key(user_id)
            conversation_ids = redis_client.smembers(user_key)
            
            conversations = []
            for conv_id in conversation_ids:
                try:
                    conv_id = conv_id.decode('utf-8')
                    data = RedisCacheManager.obtener_conversacion(user_id, conv_id)
                    if data:
                        conversations.append(data)
                except Exception as inner_e:
                    logger.warning(f"Error al obtener conversación individual {conv_id}: {str(inner_e)}")
            
            logger.debug(f"Recuperadas {len(conversations)} conversaciones de Redis para usuario {user_id}")
            return conversations
        except Exception as e:
            logger.error(f"Error al obtener todas las conversaciones de Redis para usuario {user_id}: {str(e)}")
            raise
    
    @staticmethod
    def verificar_expiracion(user_id, conversation_id):
        """Verifica el tiempo restante de expiración para una conversación"""
        try:
            key = RedisCacheManager._get_key(user_id, conversation_id)
            ttl = redis_client.ttl(key)
            if ttl > 0:
                logger.info(f"Tiempo restante para expiración de conversación {conversation_id}: {ttl} segundos")
                return ttl
            else:
                logger.info(f"La conversación {conversation_id} no existe o no tiene tiempo de expiración configurado")
                return None
        except Exception as e:
            logger.error(f"Error al verificar expiración para usuario {user_id}, conversación {conversation_id}: {str(e)}")
            raise
    
    @staticmethod
    def extender_expiracion(user_id, conversation_id, horas=24):
        """Extiende el tiempo de expiración de una conversación"""
        try:
            key = RedisCacheManager._get_key(user_id, conversation_id)
            segundos = int(horas * 60 * 60)
            result = redis_client.expire(key, segundos)
            
            if result:
                logger.info(f"Expiración extendida a {horas} horas para conversación {conversation_id}")
                
                # También extender el conjunto de usuario
                user_key = RedisCacheManager._get_key(user_id)
                redis_client.expire(user_key, segundos)
                
                return True
            else:
                logger.warning(f"No se pudo extender expiración para conversación {conversation_id}, posiblemente no existe")
                return False
        except Exception as e:
            logger.error(f"Error al extender expiración para usuario {user_id}, conversación {conversation_id}: {str(e)}")
            raise