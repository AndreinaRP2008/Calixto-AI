# Calixto AI

Nueva aplicación de Calixto: un asistente personal de IA independiente del asistente que existe en el portfolio de Gabriela.

## Estado actual

El proyecto ya cuenta con backend funcional en Cloudflare Worker + Workers AI + D1, incluyendo memoria persistente e historial de conversaciones.

También incluye una primera interfaz web en `frontend/` conectada al Worker mediante `POST`.

## Arquitectura prevista

- Frontend de la aplicación
- Cloudflare Worker / API
- Workers AI
- Memoria y contexto
- Historial de conversaciones
- Herramientas y APIs
- Autenticación y usuarios

## Importante

Este repositorio es independiente del repositorio `Portfolio`. No modifica ni reemplaza el Calixto utilizado allí.


## Interfaz web

La interfaz incluye chat responsive, indicador de pensamiento, estado de conexión, autoscroll, envío con Enter y configuración de la URL del Worker.

Para usarla, abre `frontend/index.html` o publícala como sitio estático. La primera vez te pedirá la URL pública de tu Worker `ai-calixto`; se guarda en el navegador.

La API espera un `POST` con `message`, y opcionalmente `user_id`, `conversation_id` e `history`. El frontend ya envía esos datos y conserva el `conversation_id` para mantener la conversación.
