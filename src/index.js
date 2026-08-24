/**
 * Calixto AI — backend inicial
 *
 * Este Worker pertenece EXCLUSIVAMENTE a la nueva aplicación de Calixto.
 * El Worker del portfolio no se modifica ni se reutiliza directamente aquí.
 */

export default {
  async fetch(request) {
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
          version: "0.1.0",
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

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Backend de Calixto AI preparado para integrar el modelo de IA.",
      }),
      {
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          ...corsHeaders,
        },
      }
    );
  },
};
