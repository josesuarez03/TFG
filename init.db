-- Crear el rol (usuario) con una contraseña segura
CREATE ROLE myuser WITH LOGIN PASSWORD 'secure_password';

-- No dar privilegios de superusuario
ALTER ROLE myuser NOSUPERUSER;

-- Crear la base de datos con el propietario especificado
CREATE DATABASE mydatabase OWNER myuser;

-- Establecer el rol "myuser" como el rol predeterminado para la base de datos
\c mydatabase
ALTER DATABASE mydatabase SET ROLE myuser;

-- Revocar privilegios globales (en todos los esquemas y tablas) del rol "public"
REVOKE ALL ON DATABASE mydatabase FROM public;

-- Conceder permisos específicos al rol "myuser" para la base de datos
GRANT CONNECT ON DATABASE mydatabase TO myuser;
GRANT USAGE ON SCHEMA public TO myuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO myuser;

-- Conceder privilegios adicionales para permitir la creación de objetos dentro de la base de datos
GRANT CREATE ON DATABASE mydatabase TO myuser;

-- Habilitar la auditoría para este usuario (registrar todas las acciones en esta base de datos)
-- (Esto requiere pg_audit o configuraciones adicionales si es necesario)

-- Finalmente, confirmar que las configuraciones se han aplicado correctamente
SELECT current_user;
SELECT * FROM pg_roles;

