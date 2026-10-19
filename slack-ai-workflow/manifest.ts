import { Manifest } from "deno-slack-sdk/mod.ts";
import { AnswerQuestionDefinition } from "./functions/answer_question.ts";
import { AnalyzeBuildFailureDefinition } from "./functions/analyze_build_failure.ts";

export default Manifest({
  name: "invest-broker-ai-workflow",
  description: "AI question answering and GitHub CI failure analysis for Invest-broker.",
  functions: [AnswerQuestionDefinition, AnalyzeBuildFailureDefinition],
  botScopes: [],
});
