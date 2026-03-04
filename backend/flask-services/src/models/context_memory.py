import json
import logging
from datetime import datetime
import uuid
from bson import Binary, ObjectId
from bson.binary import UuidRepresentation
from data.connect import mongo_db
import faiss
import numpy as np
import os

# Configurar logger
logger = logging.getLogger(__name__)

class ContextManagerMemory:

    def __init__(self, embedding_dim=768, index_dir="faiss_indices"):
        self.collection = mongo_db['context_memory']
        logger.info("ContextManagerMemory inicializado correctamente")
        self.embedding_dim = embedding_dim
        self.index_dir = index_dir

        if not os.path.exists(self.index_dir):
            os.makedirs(self.index_dir)

    def _uuid_to_binary(self, uuid_obj):
        """Convierte un UUID a Binary para MongoDB"""
        if isinstance(uuid_obj, str):
            uuid_obj = uuid.UUID(uuid_obj)
        return Binary.from_uuid(uuid_obj, UuidRepresentation.STANDARD)

    def _binary_to_uuid(self, binary_obj):
        """Convierte un Binary de MongoDB a UUID string"""
        if isinstance(binary_obj, Binary):
            return str(binary_obj.as_uuid())
        return str(binary_obj)
    
    def _get_index_path(self, user_id):
        """Genera la ruta del índice FAISS para un usuario específico"""
        return os.path.join(self.index_dir, f"faiss_index_{user_id}.index")
    
    def _load_faiss_index(self, user_id):
        """Carga el índice FAISS desde el disco"""
        index_path = self._get_index_path(user_id)
        if os.path.exists(index_path):
            try:
                return faiss.read_index(index_path)
            except Exception as e:
                logger.error(f"Error al cargar índice FAISS: {e}")
        return faiss.IndexIDMap(faiss.IndexFlatL2(self.embedding_dim))

    def _save_faiss_index(self, user_id, index):
        """Guarda el índice FAISS en el disco"""
        index_path = self._get_index_path(user_id)
        faiss.write_index(index, index_path)
        logger.info(f"Índice FAISS guardado en {index_path}")

    def _objectid_to_int(self, obj_id):
        """Convierte un ObjectId a entero grande para usarlo como ID en FAISS"""
        return int(obj_id.binary.hex(), 16)

    def _int_to_objectid(self, int_id):
        """Convierte un entero grande de vuelta a ObjectId"""
        hex_str = hex(int_id)[2:].zfill(24)
        return ObjectId(hex_str)
    
    def add_context(self, user_id, text, embedding, conversation_id=None, source_turn_id=None, metadata=None):
        """Guarda el contexto en MongoDB y lo indexa en FAISS"""
        # Comprobar si ya existe el mismo texto
        if self.collection.find_one({"user_id": user_id, "text": text}):
            logger.info("Texto duplicado detectado, omitiendo inserción.")
            return

        # Guardar en MongoDB
        doc = {
            "user_id": user_id,
            "conversation_id": conversation_id,
            "source_turn_id": source_turn_id,
            "text": text,
            "embedding": embedding,
            "timestamp": datetime.utcnow(),
            **(metadata or {})
        }
        inserted = self.collection.insert_one(doc)
        doc_id = inserted.inserted_id

        # Guardar en FAISS con ID
        index = self._load_faiss_index(user_id)
        id_np = np.array([self._objectid_to_int(doc_id)], dtype='int64')
        vector_np = np.array([embedding], dtype='float32')
        index.add_with_ids(vector_np, id_np)
        self._save_faiss_index(user_id, index)

    def search_context(self, user_id, query_embedding, top_k=5, conversation_id=None):
        """Busca los contextos más relevantes en FAISS y recupera los textos desde MongoDB"""
        index = self._load_faiss_index(user_id)
        if index.ntotal == 0:
            logger.info("El índice FAISS está vacío.")
            return []

        query_np = np.array([query_embedding], dtype='float32')
        distances, ids = index.search(query_np, top_k)

        results = []
        for int_id in ids[0]:
            if int_id < 0:
                continue
            obj_id = self._int_to_objectid(int_id)
            query = {"_id": obj_id, "user_id": user_id}
            if conversation_id is not None:
                query["conversation_id"] = conversation_id
            doc = self.collection.find_one(query)
            if doc:
                results.append(doc)

        return results

    def create_mongo_index(self):
        """Crea índices en MongoDB para acelerar las consultas por usuario y orden cronológico"""
        self.collection.create_index([("user_id", 1), ("timestamp", -1)])
        self.collection.create_index([("user_id", 1), ("conversation_id", 1), ("timestamp", -1)])
        self.collection.create_index([("user_id", 1), ("conversation_id", 1), ("source_turn_id", 1)])
        logger.info("Índice de MongoDB creado")

    def delete_context(self, user_id, doc_id):
        """Elimina un contexto tanto de MongoDB como del índice FAISS"""
        obj_id = ObjectId(doc_id)
        result = self.collection.delete_one({"_id": obj_id, "user_id": user_id})
        if result.deleted_count == 1:
            index = self._load_faiss_index(user_id)
            int_id = np.array([self._objectid_to_int(obj_id)], dtype='int64')
            try:
                index.remove_ids(int_id)
                self._save_faiss_index(user_id, index)
                logger.info(f"Contexto con ID {doc_id} eliminado.")
            except Exception as e:
                logger.error(f"Error al eliminar del índice FAISS: {e}")

    def update_context(self, user_id, doc_id, new_embedding=None, new_metadata=None):
        """Actualiza el contexto en MongoDB. Opcionalmente puede actualizar el embedding"""
        obj_id = ObjectId(doc_id)
        update_fields = {}
        if new_metadata:
            update_fields.update(new_metadata)
        if new_embedding:
            update_fields["embedding"] = new_embedding
        if update_fields:
            self.collection.update_one({"_id": obj_id, "user_id": user_id}, {"$set": update_fields})
            logger.info(f"Contexto {doc_id} actualizado en MongoDB (embedding y/o metadata actualizados).")
            # Re-indexar si el embedding ha cambiado
            if new_embedding:
                index = self._load_faiss_index(user_id)
                int_id = np.array([self._objectid_to_int(obj_id)], dtype='int64')
                try:
                    index.remove_ids(int_id)
                except Exception:
                    pass  # Puede que no esté aún indexado
                vector_np = np.array([new_embedding], dtype='float32')
                index.add_with_ids(vector_np, int_id)
                self._save_faiss_index(user_id, index)

