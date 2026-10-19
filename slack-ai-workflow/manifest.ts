import { Manifest } from "deno-slack-sdk/mod.ts";
import { AnswerQuestionDefinition } from "./functions/answer_question.ts";
import { AnalyzeBuildFailureDefinition } from "./functions/analyze_build_failure.ts";
import { ReviewWorkspaceAccessDefinition } from "./functions/review_workspace_access.ts";

export default Manifest({
  name: "invest-broker-ai-workflow",
  description: "AI question answering, GitHub CI failure analysis, and Slack workspace access review for Invest-broker.",
  functions: [AnswerQuestionDefinition, AnalyzeBuildFailureDefinition, ReviewWorkspaceAccessDefinition],
  botScopes: [],
});
