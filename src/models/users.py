import logging
from src.connect import get_connection
from werkzeug.security import generate_password_hash

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class Users:
    @staticmethod
    def create_tables():
        """Crea la tabla users si no existe."""
        try:
            connection = get_connection()
            cursor = connection.cursor()
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                sex VARCHAR(10) CHECK (sex IN ('M', 'F', 'Otro')),
                birth_date DATE NOT NULL,
                phone VARCHAR(15),
                institution VARCHAR(100),
                password TEXT NOT NULL,
                role_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
            );
            """)
            connection.commit()
            logging.info("Tabla 'users' creada o ya existe.")
        except Exception as e:
            logging.error(f"Error al crear la tabla 'users': {e}")
        finally:
            cursor.close()
            connection.close()

    @staticmethod
    def create_user(name, last_name, email, sex, birth_date, phone, institution, password, role_id):
        try:
            hashed_password = generate_password_hash(password)
            with get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("""
                        INSERT INTO users (name, last_name, email, sex, birth_date, phone, institution, password, role_id) 
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
                    """, (name, last_name, email, sex, birth_date, phone, institution, hashed_password, role_id))
                    user_id = cursor.fetchone()[0]
                    logging.info(f"Usuario creado con ID {user_id}")
                    return user_id
        except Exception as e:
            logging.error(f"Error al crear usuario: {e}")
            return None
    
    @staticmethod
    def get_users():
        try:
            with get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("SELECT * FROM users")
                    return cursor.fetchall()
        except Exception as e:
            logging.error(f"Error al obtener usuarios: {e}")
            return []

    @staticmethod
    def update_user(user_id, **kwargs):
        if not kwargs:
            logging.warning("No se proporcionaron datos para actualizar el usuario.")
            return False
        try:
            with get_connection() as conn:
                with conn.cursor() as cursor:
                    set_clause = ", ".join(f"{key} = %s" for key in kwargs)
                    values = list(kwargs.values()) + [user_id]
                    cursor.execute(f"UPDATE users SET {set_clause} WHERE id = %s", values)
                    logging.info(f"Usuario {user_id} actualizado correctamente.")
                    return True
        except Exception as e:
            logging.error(f"Error al actualizar usuario {user_id}: {e}")
            return False
    
    @staticmethod
    def delete_user(user_id):
        try:
            with get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
                    logging.info(f"Usuario {user_id} eliminado correctamente.")
                    return True
        except Exception as e:
            logging.error(f"Error al eliminar usuario {user_id}: {e}")
            return False
