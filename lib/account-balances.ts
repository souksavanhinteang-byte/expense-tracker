type AccountBalanceSource = {
  id: string;
  name: string;
  currency: string;
  initial_balance: unknown;
  is_active: boolean;
};

type TransactionBalanceSource = {
  type: string;
  amount: unknown;
  account_id: string | null;
  destination_account_id: string | null;
  currency: string;
};

export type AccountBalance = {
  id: string;
  name: string;
  currency: string;
  is_active: boolean;
  balance: number;
};

export type CurrencyBalanceTotal = {
  currency: string;
  total: number;
};

function parseWholeAmount(value: unknown, label: string) {
  const amount = typeof value === "number" ? value : Number(value);

  if (!Number.isSafeInteger(amount)) {
    throw new Error(`${label} ບໍ່ແມ່ນຈຳນວນເງິນເຕັມທີ່ຖືກຕ້ອງ`);
  }

  return amount;
}

function addAmount(balance: number, amount: number, label: string) {
  const nextBalance = balance + amount;

  if (!Number.isSafeInteger(nextBalance)) {
    throw new Error(`${label} ເກີນຂອບເຂດຈຳນວນເງິນທີ່ຮອງຮັບ`);
  }

  return nextBalance;
}

function getAccount(
  accountsById: Map<string, AccountBalance>,
  accountId: string | null,
  label: string,
) {
  if (!accountId) {
    throw new Error(`${label} ບໍ່ມີບັນຊີ`);
  }

  const account = accountsById.get(accountId);

  if (!account) {
    throw new Error(`${label} ອ້າງອີງບັນຊີທີ່ບໍ່ພົບ`);
  }

  return account;
}

function validateTransactionCurrency(
  transaction: TransactionBalanceSource,
  account: AccountBalance,
) {
  if (transaction.currency !== account.currency) {
    throw new Error("ສະກຸນເງິນຂອງລາຍການບໍ່ກົງກັບບັນຊີ");
  }
}

export function calculateAccountBalances(
  accounts: AccountBalanceSource[],
  transactions: TransactionBalanceSource[],
) {
  const accountBalances = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    currency: account.currency,
    is_active: account.is_active,
    balance: parseWholeAmount(account.initial_balance, `ຍອດເລີ່ມຕົ້ນຂອງ ${account.name}`),
  }));
  const accountsById = new Map(accountBalances.map((account) => [account.id, account]));

  for (const transaction of transactions) {
    const amount = parseWholeAmount(transaction.amount, "ຈຳນວນເງິນຂອງລາຍການ");

    if (amount <= 0) {
      throw new Error("ຈຳນວນເງິນຂອງລາຍການຕ້ອງເປັນເລກເຕັມບວກ");
    }

    if (transaction.type === "income" || transaction.type === "expense") {
      const account = getAccount(accountsById, transaction.account_id, "ລາຍການ");
      validateTransactionCurrency(transaction, account);
      account.balance = addAmount(
        account.balance,
        transaction.type === "income" ? amount : -amount,
        `ຍອດຂອງ ${account.name}`,
      );
      continue;
    }

    if (transaction.type === "transfer") {
      const sourceAccount = getAccount(accountsById, transaction.account_id, "ລາຍການໂອນເງິນ");
      const destinationAccount = getAccount(
        accountsById,
        transaction.destination_account_id,
        "ລາຍການໂອນເງິນ",
      );

      validateTransactionCurrency(transaction, sourceAccount);
      validateTransactionCurrency(transaction, destinationAccount);
      sourceAccount.balance = addAmount(
        sourceAccount.balance,
        -amount,
        `ຍອດຂອງ ${sourceAccount.name}`,
      );
      destinationAccount.balance = addAmount(
        destinationAccount.balance,
        amount,
        `ຍອດຂອງ ${destinationAccount.name}`,
      );
      continue;
    }

    throw new Error("ພົບປະເພດລາຍການທີ່ບໍ່ຮອງຮັບ");
  }

  const totalsByCurrency = new Map<string, number>();

  for (const account of accountBalances) {
    totalsByCurrency.set(
      account.currency,
      addAmount(
        totalsByCurrency.get(account.currency) ?? 0,
        account.balance,
        `ຍອດລວມ ${account.currency}`,
      ),
    );
  }

  return {
    accounts: accountBalances,
    totalsByCurrency: Array.from(totalsByCurrency, ([currency, total]) => ({
      currency,
      total,
    })),
  } satisfies {
    accounts: AccountBalance[];
    totalsByCurrency: CurrencyBalanceTotal[];
  };
}
