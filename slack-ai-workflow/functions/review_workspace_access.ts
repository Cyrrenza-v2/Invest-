import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";

export const ReviewWorkspaceAccessDefinition = DefineFunction({
  callback_id: "review_workspace_access_csv",
  title: "Review Workspace Access CSV",
  description: "Review a Slack member export for MFA, SSO, owner-role, billing, and expiry follow-ups without exposing member PII in the report.",
  source_file: "functions/review_workspace_access.ts",
  input_parameters: {
    properties: {
      csv: {
        type: Schema.types.string,
        title: "Slack members CSV",
        description: "Paste a Slack workspace member CSV export. Do not include unrelated personal data.",
      },
    },
    required: ["csv"],
  },
  output_parameters: {
    properties: {
      report: {
        type: Schema.types.string,
        title: "Access review report",
        description: "Aggregate access findings and recommended follow-ups. Member names and emails are intentionally omitted.",
      },
    },
    required: ["report"],
  },
});

const MAX_CSV_LENGTH = 100_000;
const MAX_ROWS = 1_000;
const MAX_FINDINGS = 30;

type CsvRow = Record<string, string>;

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"' && cell.length === 0) {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function truthy(value: string | undefined): boolean {
  return ["1", "true", "yes", "active", "enabled"].includes((value ?? "").trim().toLowerCase());
}

function buildReport(csv: string): string {
  if (!csv.trim()) throw new Error("Paste the Slack members CSV first.");
  if (csv.length > MAX_CSV_LENGTH) throw new Error("CSV is too large. Maximum supported size is 100 KB.");

  const parsed = parseCsv(csv);
  if (parsed.length < 2) throw new Error("CSV must contain a header row and at least one member row.");
  if (parsed.length - 1 > MAX_ROWS) throw new Error(`CSV exceeds the ${MAX_ROWS}-member review limit.`);

  const headers = parsed[0].map((header) => header.trim().toLowerCase());
  const required = ["status", "has-2fa", "has-sso"];
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`Missing required CSV column(s): ${missing.join(", ")}.`);

  const records: CsvRow[] = parsed.slice(1).map((values) => {
    const record: CsvRow = {};
    headers.forEach((header, index) => { record[header] = (values[index] ?? "").trim(); });
    return record;
  });

  let missingMfa = 0;
  let missingSso = 0;
  let privilegedOwners = 0;
  let inactiveBilling = 0;
  let missingExpiry = 0;
  let expired = 0;
  const findings: string[] = [];
  const now = Date.now();

  records.forEach((record, index) => {
    const rowNumber = index + 2;
    const reasons: string[] = [];
    if (!truthy(record["has-2fa"])) { missingMfa += 1; reasons.push("MFA not indicated"); }
    if (!truthy(record["has-sso"])) { missingSso += 1; reasons.push("SSO not indicated"); }
    if (/owner/i.test(record.status)) { privilegedOwners += 1; reasons.push("owner-level role: verify necessity and recovery controls"); }
    if (headers.includes("billing-active") && !truthy(record["billing-active"])) {
      inactiveBilling += 1;
      reasons.push("billing-active is false/blank (confirm this field is relevant to the workspace plan)");
    }
    if (headers.includes("expiration-timestamp")) {
      const expiry = record["expiration-timestamp"];
      if (!expiry) {
        missingExpiry += 1;
      } else {
        const numeric = Number(expiry);
        const parsedDate = Number.isFinite(numeric)
          ? new Date(numeric > 10_000_000_000 ? numeric : numeric * 1000)
          : new Date(expiry);
        if (!Number.isNaN(parsedDate.getTime()) && parsedDate.getTime() < now) {
          expired += 1;
          reasons.push("access expiration appears to be in the past");
        }
      }
    }
    if (reasons.length && findings.length < MAX_FINDINGS) {
      findings.push(`- CSV row ${rowNumber}: ${reasons.join("; ")}.`);
    }
  });

  const lines = [
    "Slack workspace access review",
    "",
    `Members reviewed: ${records.length}`,
    `MFA not indicated: ${missingMfa}`,
    `SSO not indicated: ${missingSso}`,
    `Owner-level roles requiring verification: ${privilegedOwners}`,
    ...(headers.includes("billing-active") ? [`Billing inactive or unspecified: ${inactiveBilling}`] : []),
    ...(headers.includes("expiration-timestamp") ? [
      `Expired access timestamps detected: ${expired}`,
      `No expiration timestamp supplied: ${missingExpiry}`,
    ] : []),
    "",
    "Follow-up findings (row numbers only; no member names, emails, or IDs):",
    ...(findings.length ? findings : ["- No flagged findings in the supported fields."]),
    ...(records.length > MAX_FINDINGS ? ["", "Additional findings were omitted from this summary to keep the report concise."] : []),
    "",
    "Interpretation: this is a CSV-based review, not live verification of Slack settings. A blank/false field can mean unavailable export data, not necessarily a confirmed misconfiguration. Verify findings in Slack admin settings before changing access.",
    "Recommended next steps: require MFA for privileged accounts, confirm SSO policy, review owner access, and validate expiry/billing fields against your workspace policy.",
  ];
  return lines.join("\n");
}

export default SlackFunction(ReviewWorkspaceAccessDefinition, async ({ inputs, logger }) => {
  try {
    return { outputs: { report: buildReport(inputs.csv ?? "") } };
  } catch (error) {
    logger.warn(`Workspace access CSV review rejected: ${String(error)}`);
    return { error: error instanceof Error ? error.message : "Could not review this CSV. Check its format and try again." };
  }
});
