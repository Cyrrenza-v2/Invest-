import { Manifest } from "deno-slack-sdk/mod.ts";
import { AnswerQuestionDefinition } from "./functions/answer_question.ts";
import { AnalyzeBuildFailureDefinition } from "./functions/analyze_build_failure.ts";

export default Manifest({
  name: "invest-broker-ai-workflow",
  description: "AI question answering and GitHub CI failure analysis for Invest-broker.",
  icon: "https://a.slack-edge.com/80588/img/avatars-teams/ava_0001-34.png",
  functions: [AnswerQuestionDefinition, AnalyzeBuildFailureDefinition],
  botScopes: [],
});
