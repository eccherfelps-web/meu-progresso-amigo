import { defineMcp } from "@lovable.dev/mcp-js";
import getProfileInfo from "./tools/get-profile";
import calculateMacros from "./tools/calculate-macros";
import estimateOneRepMax from "./tools/one-rep-max";

export default defineMcp({
  name: "healthy-life-tracker-mcp",
  title: "Healthy Life Tracker",
  version: "0.1.0",
  instructions:
    "Ferramentas do Healthy Life Tracker: calcule metas calóricas e macros (fórmula Mifflin-St Jeor com hard limit de 50g de gordura), estime 1RM (Epley) e consulte instruções de perfil. Os dados do usuário ficam no dispositivo — este servidor expõe apenas cálculos.",
  tools: [getProfileInfo, calculateMacros, estimateOneRepMax],
});
