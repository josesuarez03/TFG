import psycopg2
import logging
from src.connect import get_connection

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class Patients:
    @staticmethod
    def create_tables():
        """Crea la tabla patients si no existe."""
        try:
            with get_connection() as connection:
                with connection.cursor() as cursor:
                    cursor.execute("""
                    CREATE TABLE IF NOT EXISTS patients (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_id INTEGER NOT NULL,
                        triage_level VARCHAR(20) CHECK (triage_level IN ('Leve', 'Moderado', 'Severo')),
                        pain_scale INTEGER CHECK (pain_scale BETWEEN 0 AND 10),
                        medical_context TEXT,
                        symptoms TEXT,
                        allergies TEXT,
                        pre_existing_conditions TEXT,
                        current_medications TEXT,
                        occupation VARCHAR(100),
                        conversation_history JSONB,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                    );
                    """)
                    connection.commit()
                    logging.info("Tabla 'patients' creada o ya existe.")
        except Exception as e:
            logging.error(f"Error al crear la tabla 'patients': {e}")

    @staticmethod
    def create_patient(user_id, triage_level, pain_scale, medical_context, symptoms, allergies, pre_existing_conditions, current_medications, occupation, conversation_history):
        """Inserta un nuevo paciente en la base de datos."""
        try:
            with get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("""
                        INSERT INTO patients (user_id, triage_level, pain_scale, medical_context, symptoms, allergies, 
                        pre_existing_conditions, current_medications, occupation, conversation_history) 
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
                    """, (user_id, triage_level, pain_scale, medical_context, symptoms, allergies, 
                          pre_existing_conditions, current_medications, occupation, conversation_history))
                    patient_id = cursor.fetchone()[0]
                    logging.info(f"Paciente creado con ID {patient_id}")
                    return patient_id
        except Exception as e:
            logging.error(f"Error al crear paciente: {e}")
            return None

    @staticmethod
    def get_patients():
        """Obtiene todos los pacientes de la base de datos."""
        try:
            with get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("SELECT * FROM patients")
                    patients = cursor.fetchall()
                    logging.info(f"Se obtuvieron {len(patients)} pacientes.")
                    return patients
        except Exception as e:
            logging.error(f"Error al obtener pacientes: {e}")
            return []

    @staticmethod
    def update_patient(patient_id, **kwargs):
        """Actualiza los datos de un paciente en la base de datos."""
        if not kwargs:
            logging.warning("No se proporcionaron datos para actualizar el paciente.")
            return False
        
        try:
            with get_connection() as conn:
                with conn.cursor() as cursor:
                    set_clause = ", ".join(f"{key} = %s" for key in kwargs)
                    values = list(kwargs.values()) + [patient_id]
                    cursor.execute(f"UPDATE patients SET {set_clause} WHERE id = %s", values)
                    logging.info(f"Paciente con ID {patient_id} actualizado correctamente.")
                    return True
        except Exception as e:
            logging.error(f"Error al actualizar paciente {patient_id}: {e}")
            return False

    @staticmethod
    def delete_patient(patient_id):
        """Elimina un paciente de la base de datos."""
        try:
            with get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute("DELETE FROM patients WHERE id = %s", (patient_id,))
                    logging.info(f"Paciente con ID {patient_id} eliminado correctamente.")
        except Exception as e:
            logging.error(f"Error al eliminar paciente {patient_id}: {e}")
