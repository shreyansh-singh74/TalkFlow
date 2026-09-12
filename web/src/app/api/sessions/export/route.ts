import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { loadSessionSamples } from "@/lib/session-samples";
import { phoneRows, summarize, turnRows } from "@/lib/progress";

/**
 * Export everything that was measured about a learner's practice.
 *
 * Deliberately not a database dump: this is the same data the reports show, in
 * a form someone can open in a spreadsheet. The Pro plan advertises "export
 * session data", and a promise in a pricing table is the kind of thing that
 * should be true.
 *
 * `null` is written as an empty cell rather than 0, so an unmeasured metric
 * cannot be read as a measurement once it leaves the app.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = (searchParams.get("format") || "json").toLowerCase();

    const samples = await loadSessionSamples(session.user.id);
    const summary = summarize(samples);
    const turns = turnRows(samples);
    const phones = phoneRows(summary.phones);

    if (format === "csv") {
      const csv = toCsv(turns, phones);
      const stamp = new Date().toISOString().slice(0, 10);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="talkflow-${stamp}.csv"`,
        },
      });
    }

    return NextResponse.json(
      {
        exportedAt: new Date().toISOString(),
        // The summary is the same object the progress page renders, so an
        // export can never disagree with what the learner was shown.
        summary,
        phones,
        turns,
      },
      {
        headers: {
          "Content-Disposition": 'attachment; filename="talkflow.json"',
        },
      }
    );
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Failed to export" }, { status: 500 });
  }
}

function escapeCell(value: string | number): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(
  turns: Array<Record<string, string | number>>,
  phones: Array<Record<string, string | number>>
): string {
  const section = (rows: Array<Record<string, string | number>>) => {
    if (rows.length === 0) return "";
    const headers = Object.keys(rows[0]);
    const body = rows.map((row) =>
      headers.map((h) => escapeCell(row[h] ?? "")).join(",")
    );
    return [headers.join(","), ...body].join("\n");
  };

  return [
    "# Per-turn results",
    section(turns),
    "",
    "# Per-phone evidence",
    section(phones),
    "",
  ].join("\n");
}
