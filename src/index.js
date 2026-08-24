/**
 * Calixto AI — backend
 *
 * Este Worker pertenece EXCLUSIVAMENTE a la aplicación de Calixto.
 * El Worker del portfolio es independiente y no se modifica desde aquí.
 */

const SYSTEM_PROMPT = `
Eres Calixto, un asistente personal de inteligencia artificial.

Tu personalidad es cercana, natural, inteligente, útil y clara.
Hablas siempre desde tu propia perspectiva usando "yo", "me" y "mi".
Puedes utilizar humor ligero y emojis ocasionalmente cuando encajen.

No finjas ser una persona real.
No inventes información cuando no la conozcas.
Si una respuesta depende de información que no tienes, dilo claramente.

Esta es la versión de Calixto destinada a una aplicación independiente.
No actúas como el asistente del portfolio de Gabriela y no debes asumir que
conoces información privada del usuario que no haya sido proporcionada en
la conversación o mediante una futura función de memoria autorizada.

Responde siempre en español, salvo que el usuario solicite explícitamente otro idioma.
`;

const MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (request.method === "GET") {
      return new Response(
        JSON.stringify({
          ok: true,
          name: "Calixto AI",
          version: "0.2.0",
          message: "Calixto AI está funcionando.",
        }),
        {
          headers: {
            "Content-Type": "application/json; charset=UTF-8",
            ...corsHeaders,
          },
        }
      );
    }

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Método no permitido." }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json; charset=UTF-8",
            ...corsHeaders,
          },
        }
      );
    }

    try {
      const body = await request.json();
      const message = body?.message;

      if (!message || typeof message !== "string") {
        return new Response(
          JSON.stringify({ error: "Falta el mensaje." }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json; charset=UTF-8",
              ...corsHeaders,
            },
          }
        );
      }

      const response = await env.AI.run(MODEL, {
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: message.trim(),
          },
        ],
        max_tokens: 512,
        temperature: 0.6,
      });

      const text = response?.response || "No he podido generar una respuesta.";

      return new Response(
        JSON.stringify({
          ok: true,
          reply: text,
          model: MODEL,
        }),
        {
          headers: {
            "Content-Type": "application/json; charset=UTF-8",
            ...corsHeaders,
          },
        }
      );
    } catch (error) {
      console.error("Error interno:", error);

      return new Response(
        JSON.stringify({
          ok: false,
          error: "Ha ocurrido un error al hablar con Calixto.",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json; charset=UTF-8",
            ...corsHeaders,
          },
        }
      );
    }
  },
};
