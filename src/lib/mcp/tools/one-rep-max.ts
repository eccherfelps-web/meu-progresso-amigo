import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

// Estima 1RM pela fórmula de Epley — usada nas telas de treino.
export default defineTool({
  name: "estimate_one_rep_max",
  title: "Estimar 1RM",
  description:
    "Estima a repetição máxima (1RM) para um exercício usando a fórmula de Epley: 1RM = peso × (1 + reps/30).",
  inputSchema: {
    weightKg: z.number().positive().describe("Peso levantado em kg"),
    reps: z.number().int().positive().max(20).describe("Repetições completadas (1-20)"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ weightKg, reps }) => {
    const oneRM = Math.round(weightKg * (1 + reps / 30) * 10) / 10;
    return {
      content: [{ type: "text", text: `1RM estimado: ${oneRM} kg` }],
      structuredContent: { oneRM },
    };
  },
});
