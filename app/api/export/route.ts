import { NextRequest } from "next/server";
import { calculateAccountBalances, parseWholeAmount } from "@/lib/account-balances";
import { createCsv } from "@/lib/csv-export";
import { createClient } from "@/lib/supabase/server";

type ExportKind = "transactions" | "accounts" | "categories";

function isExportKind(value: string | null): value is ExportKind {
  return value === "transactions" || value === "accounts" || value === "categories";
}

function getExportDate() {
  return new Date().toISOString().slice(0, 10);
}

function csvResponse(filename: string, csv: string) {
  return new Response(csv, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

function parsePositiveTransactionAmount(value: unknown) {
  const amount = parseWholeAmount(value, "ຈຳນວນເງິນຂອງລາຍການ");

  if (amount <= 0) {
    throw new Error("ຈຳນວນເງິນຂອງລາຍການຕ້ອງເປັນເລກເຕັມບວກ");
  }

  return amount;
}

export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind");

  if (!isExportKind(kind)) {
    return new Response("Invalid export type", { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const exportDate = getExportDate();

  if (kind === "transactions") {
    const { data: transactions, error } = await supabase
      .from("transactions")
      .select(`
        transaction_date,
        type,
        description,
        amount,
        currency,
        note,
        created_at,
        categories ( name ),
        source_account:accounts!transactions_account_id_fkey ( name ),
        destination_account:accounts!transactions_destination_account_id_fkey ( name )
      `)
      .eq("user_id", user.id)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const rows = (transactions ?? []).map((transaction) => {
      const category = Array.isArray(transaction.categories)
        ? transaction.categories[0]
        : transaction.categories;
      const sourceAccount = Array.isArray(transaction.source_account)
        ? transaction.source_account[0]
        : transaction.source_account;
      const destinationAccount = Array.isArray(transaction.destination_account)
        ? transaction.destination_account[0]
        : transaction.destination_account;

      return {
        ...transaction,
        amount: parsePositiveTransactionAmount(transaction.amount),
        categoryName: category?.name ?? "",
        sourceAccountName: sourceAccount?.name ?? "",
        destinationAccountName: destinationAccount?.name ?? "",
      };
    });

    return csvResponse(
      `expense-tracker-transactions-${exportDate}.csv`,
      createCsv(
        [
          { header: "transaction_date", value: (row) => row.transaction_date },
          { header: "type", value: (row) => row.type },
          { header: "description", value: (row) => row.description },
          { header: "amount", value: (row) => row.amount },
          { header: "currency", value: (row) => row.currency },
          { header: "category_name", value: (row) => row.categoryName },
          { header: "source_account_name", value: (row) => row.sourceAccountName },
          { header: "destination_account_name", value: (row) => row.destinationAccountName },
          { header: "note", value: (row) => row.note },
          { header: "created_at", value: (row) => row.created_at },
        ],
        rows,
      ),
    );
  }

  if (kind === "accounts") {
    const [accountsResult, transactionsResult] = await Promise.all([
      supabase
        .from("accounts")
        .select("id, name, account_type, currency, initial_balance, is_active, created_at")
        .eq("user_id", user.id)
        .order("name"),
      supabase
        .from("transactions")
        .select("type, amount, account_id, destination_account_id, currency")
        .eq("user_id", user.id),
    ]);

    if (accountsResult.error) {
      throw new Error(accountsResult.error.message);
    }

    if (transactionsResult.error) {
      throw new Error(transactionsResult.error.message);
    }

    const { accounts } = calculateAccountBalances(
      accountsResult.data ?? [],
      transactionsResult.data ?? [],
    );
    const accountDetailsById = new Map((accountsResult.data ?? []).map((account) => [account.id, account]));
    const rows = accounts.map((account) => {
      const detail = accountDetailsById.get(account.id);

      if (!detail) {
        throw new Error("ບໍ່ພົບຂໍ້ມູນບັນຊີ");
      }

      return {
        ...account,
        accountType: detail.account_type ?? "",
        initialBalance: parseWholeAmount(detail.initial_balance, `ຍອດເລີ່ມຕົ້ນຂອງ ${detail.name}`),
        createdAt: detail.created_at,
      };
    });

    return csvResponse(
      `expense-tracker-accounts-${exportDate}.csv`,
      createCsv(
        [
          { header: "name", value: (row) => row.name },
          { header: "account_type", value: (row) => row.accountType },
          { header: "currency", value: (row) => row.currency },
          { header: "initial_balance", value: (row) => row.initialBalance },
          { header: "current_balance", value: (row) => row.balance },
          { header: "is_active", value: (row) => row.is_active },
          { header: "created_at", value: (row) => row.createdAt },
        ],
        rows,
      ),
    );
  }

  const { data: categories, error } = await supabase
    .from("categories")
    .select("name, type, is_active, created_at")
    .eq("user_id", user.id)
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return csvResponse(
    `expense-tracker-categories-${exportDate}.csv`,
    createCsv(
      [
        { header: "name", value: (row) => row.name },
        { header: "type", value: (row) => row.type },
        { header: "is_active", value: (row) => row.is_active },
        { header: "created_at", value: (row) => row.created_at },
      ],
      categories ?? [],
    ),
  );
}
