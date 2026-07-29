/**
 * Offline export engine — generates PDF and DOCX reports client-side with
 * no external network calls.
 */
import jsPDF from "jspdf";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
} from "docx";
import { formatPKR, formatDate } from "./utils";
import type { Database } from "./schema";
import { summarize } from "./finance";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportFinancePdf(db: Database): Promise<void> {
  const s = summarize(db);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(13, 13, 13);
  doc.rect(0, 0, pageW, 80, "F");
  doc.setTextColor(255, 107, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(db.settings.gymName.toUpperCase(), 40, 40);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text("Financial Summary Report", 40, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageW - 40, 60, { align: "right" });

  let y = 120;
  const line = (text: string, bold = false, size = 10, color?: [number, number, number]) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    if (color) doc.setTextColor(color[0], color[1], color[2]);
    else doc.setTextColor(20, 20, 20);
    doc.text(text, 40, y);
    y += size + 6;
  };

  line("Key Metrics", true, 14, [255, 107, 0]);
  y += 4;
  line(`Total Revenue:        ${formatPKR(s.totalRevenue)}`);
  line(`Total Expenses:       ${formatPKR(s.totalExpenses)}`);
  line(`Net Profit / Loss:    ${formatPKR(s.netProfit)}`, true, 10, s.netProfit >= 0 ? [0, 120, 40] : [200, 30, 30]);
  line(`This Month Revenue:   ${formatPKR(s.revenueThisMonth)}`);
  line(`This Month Expenses:  ${formatPKR(s.expensesThisMonth)}`);
  line(`This Month P/L:       ${formatPKR(s.profitThisMonth)}`);
  y += 12;

  line("Monthly Breakdown", true, 14, [255, 107, 0]);
  y += 4;
  // table header
  doc.setFillColor(245, 245, 245);
  doc.rect(40, y - 4, pageW - 80, 18, "F");
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Month", 50, y + 8);
  doc.text("Income", 200, y + 8);
  doc.text("Expenses", 320, y + 8);
  doc.text("Profit", 440, y + 8);
  y += 24;
  doc.setFont("helvetica", "normal");
  for (const m of s.monthly) {
    doc.text(m.label, 50, y);
    doc.text(formatPKR(m.income), 200, y);
    doc.text(formatPKR(m.expenses), 320, y);
    doc.setTextColor(m.profit >= 0 ? 0 : 200, m.profit >= 0 ? 120 : 30, m.profit >= 0 ? 40 : 30);
    doc.text(formatPKR(m.profit), 440, y);
    doc.setTextColor(20, 20, 20);
    y += 16;
    if (y > 760) {
      doc.addPage();
      y = 60;
    }
  }

  y += 20;
  line("Operational Snapshot", true, 14, [255, 107, 0]);
  y += 4;
  line(`Active Members: ${s.activeMembersCount}`);
  line(`Today Attendance: ${s.todayAttendance}`);
  line(`Pending Renewals (this week): ${s.pendingRenewals}`);
  line(`Low Stock Items: ${s.lowStockCount}`);

  triggerDownload(doc.output("blob"), `financial-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function exportFinanceDocx(db: Database): Promise<void> {
  const s = summarize(db);
  const rows: TableRow[] = [
    new TableRow({
      children: ["Month", "Income", "Expenses", "Profit"].map(
        (h) =>
          new TableCell({
            children: [new Paragraph({ text: h, heading: HeadingLevel.HEADING_3 })],
            shading: { fill: "171717" },
          })
      ),
    }),
  ];
  for (const m of s.monthly) {
    rows.push(
      new TableRow({
        children: [m.label, formatPKR(m.income), formatPKR(m.expenses), formatPKR(m.profit)].map(
          (v) => new TableCell({ children: [new Paragraph(v)] })
        ),
      })
    );
  }

  const doc = new Document({
    styles: {
      default: { document: { run: { color: "FFFFFF", font: "Calibri" } } },
    },
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: db.settings.gymName,
                bold: true,
                color: "FF6B00",
                size: 48,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "Financial Summary Report", size: 28 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `Generated: ${new Date().toLocaleString()}`, size: 20, color: "A0A0A0" })],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [new TextRun({ text: "Key Metrics", bold: true, color: "FF6B00", size: 28 })],
          }),
          new Paragraph({ text: `Total Revenue: ${formatPKR(s.totalRevenue)}` }),
          new Paragraph({ text: `Total Expenses: ${formatPKR(s.totalExpenses)}` }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Net Profit/Loss: ${formatPKR(s.netProfit)}`,
                bold: true,
                color: s.netProfit >= 0 ? "33CC33" : "E03C3C",
              }),
            ],
          }),
          new Paragraph({ text: `This Month Revenue: ${formatPKR(s.revenueThisMonth)}` }),
          new Paragraph({ text: `This Month Expenses: ${formatPKR(s.expensesThisMonth)}` }),
          new Paragraph({ text: `This Month P/L: ${formatPKR(s.profitThisMonth)}` }),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [new TextRun({ text: "Monthly Breakdown", bold: true, color: "FF6B00", size: 28 })],
          }),
          new Table({
            rows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [new TextRun({ text: "Operational Snapshot", bold: true, color: "FF6B00", size: 28 })],
          }),
          new Paragraph({ text: `Active Members: ${s.activeMembersCount}` }),
          new Paragraph({ text: `Today's Check-ins: ${s.todayAttendance}` }),
          new Paragraph({ text: `Pending Renewals: ${s.pendingRenewals}` }),
          new Paragraph({ text: `Low-stock Items: ${s.lowStockCount}` }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, `financial-report-${new Date().toISOString().slice(0, 10)}.docx`);
}

export function exportMemberListCsv(db: Database): void {
  const header = ["UID", "Name", "Phone", "Status", "Plan", "Start", "End", "Tokens"];
  const rows = db.members.map((m) => {
    const plan = m.subscriptionId ? db.plans.find((p) => p.id === m.subscriptionId)?.name || "" : "";
    return [
      m.uid,
      m.fullName,
      m.phone,
      m.status,
      plan,
      formatDate(m.subscriptionStart),
      formatDate(m.subscriptionEnd),
      String(m.loyaltyTokens),
    ];
  });
  const csv = [header, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8" }), `members-${new Date().toISOString().slice(0, 10)}.csv`);
}
