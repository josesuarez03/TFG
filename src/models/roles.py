import logging
from src.connect import get_connection

class Roles:
    @staticmethod
    def create_tables():
        try:
            connection = get_connection()
            cursor = connection.cursor()
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS roles (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) UNIQUE NOT NULL CHECK (name IN ('user', 'doctor', 'admin'))
            );
            """)
            connection.commit()
            logging.info("Tabla 'roles' creada o ya existe.")
        except Exception as e:
            logging.error(f"Error al crear la tabla 'roles': {e}")
        finally:
            cursor.close()
            connection.close()

    @staticmethod
    def create_role(name):
        try:
            with get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("INSERT INTO roles (name) VALUES (%s) RETURNING id", (name,))
                    role_id = cursor.fetchone()[0]
                    logging.info(f"Rol creado con ID {role_id}")
                    return role_id
        except Exception as e:
            logging.error(f"Error al crear rol: {e}")
            return None

    @staticmethod
    def get_roles():
        try:
            with get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("SELECT * FROM roles")
                    return cursor.fetchall()
        except Exception as e:
            logging.error(f"Error al obtener roles: {e}")
            return []

    @staticmethod
    def delete_role(role_id):
        try:
            with get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("DELETE FROM roles WHERE id = %s", (role_id,))
                    logging.info(f"Rol {role_id} eliminado correctamente.")
                    return True
        except Exception as e:
            logging.error(f"Error al eliminar rol {role_id}: {e}")
            return False
