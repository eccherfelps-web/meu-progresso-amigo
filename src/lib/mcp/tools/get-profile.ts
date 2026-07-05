import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

// Retorna orientação para leitura do perfil (armazenado no navegador do usuário).
export default defineTool({
  name: "get_profile_info",
  title: "Informações do perfil",
  description:
    "Retorna instruções sobre onde encontrar o perfil do usuário no Healthy Life Tracker. Os dados ficam no dispositivo (IndexedDB/localStorage) — o cliente MCP não os acessa diretamente.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [
      {
        type: "text",
        text: "Os dados do perfil (peso, altura, idade, metas de macros) são armazenados localmente no dispositivo do usuário. Abra a aba 'Perfil' no app para visualizar e editar.",
      },
    ],
  }),
});
