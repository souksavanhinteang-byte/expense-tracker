import { createCsv } from "@/lib/csv-export";

const sampleRows = [
  {
    transaction_date: "2026-07-01",
    type: "income",
    description: "ເງິນເດືອນ",
    amount: 5000000,
    currency: "LAK",
    category: "ເງິນເດືອນ",
    source_account: "Cash",
    destination_account: "",
    note: "",
  },
  {
    transaction_date: "2026-07-02",
    type: "expense",
    description: "ຄ່າອາຫານ",
    amount: 50000,
    currency: "LAK",
    category: "ອາຫານ",
    source_account: "Cash",
    destination_account: "",
    note: "ຕົວຢ່າງ",
  },
  {
    transaction_date: "2026-07-03",
    type: "transfer",
    description: "ໂອນເງິນເຂົ້າທະນາຄານ",
    amount: 100000,
    currency: "LAK",
    category: "",
    source_account: "Cash",
    destination_account: "Bank",
    note: "",
  },
];

export async function GET() {
  const csv = createCsv(
    [
      { header: "transaction_date", value: (row) => row.transaction_date },
      { header: "type", value: (row) => row.type },
      { header: "description", value: (row) => row.description },
      { header: "amount", value: (row) => row.amount },
      { header: "currency", value: (row) => row.currency },
      { header: "category", value: (row) => row.category },
      { header: "source_account", value: (row) => row.source_account },
      { header: "destination_account", value: (row) => row.destination_account },
      { header: "note", value: (row) => row.note },
    ],
    sampleRows,
  );

  return new Response(csv, {
    headers: {
      "Content-Disposition": "attachment; filename=expense-tracker-import-template.csv",
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
