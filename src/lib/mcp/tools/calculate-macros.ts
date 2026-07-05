import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

// Calcula meta calórica e macros usando a mesma fórmula do app (Mifflin-St Jeor).
export default defineTool({
  name: "calculate_macros",
  title: "Calcular macros",
  description:
    "Calcula gasto energético (TDEE), meta calórica e distribuição de macros (proteína, carboidrato, gordura) a partir de peso, altura, idade, sexo, nível de atividade e objetivo.",
  inputSchema: {
    weightKg: z.number().positive().describe("Peso em kg"),
    heightCm: z.number().positive().describe("Altura em cm"),
    age: z.number().int().positive().describe("Idade em anos"),
    sex: z.enum(["male", "female"]).describe("Sexo biológico"),
    activityLevel: z
      .enum(["sedentary", "light", "moderate", "active", "very_active"])
      .describe("Nível de atividade física"),
    goal: z
      .enum(["cut", "maintain", "bulk"])
      .describe("Objetivo: cutting (déficit), manutenção ou bulk (superávit)"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ weightKg, heightCm, age, sex, activityLevel, goal }) => {
    const bmr =
      sex === "male"
        ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
        : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
    const activityFactor = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9,
    }[activityLevel];
    const tdee = bmr * activityFactor;
    const goalDelta = { cut: -500, maintain: 0, bulk: 300 }[goal];
    const targetKcal = Math.round(tdee + goalDelta);

    const proteinG = Math.round(weightKg * 2);
    const fatG = Math.min(50, Math.round((targetKcal * 0.25) / 9));
    const carbsG = Math.max(
      0,
      Math.round((targetKcal - proteinG * 4 - fatG * 9) / 4),
    );

    return {
      content: [
        {
          type: "text",
          text: `Meta: ${targetKcal} kcal | Proteína: ${proteinG}g | Carbo: ${carbsG}g | Gordura: ${fatG}g (limite duro 50g)`,
        },
      ],
      structuredContent: {
        bmr: Math.round(bmr),
        tdee: Math.round(tdee),
        targetKcal,
        proteinG,
        carbsG,
        fatG,
      },
    };
  },
});
