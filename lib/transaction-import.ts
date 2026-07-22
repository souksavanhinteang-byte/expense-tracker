import { createHash } from "crypto";
import { parse } from "csv-parse/sync";
import { parseWholeAmount } from "@/lib/account-balances";

const REQUIRED_COLUMNS = [
  "transaction_date",
  "type",
  "description",
  "amount",
  "currency",
  "category",
  "source_account",
  "destination_account",
  "note",
] as const;

type ImportAccount = { id: string; name: string; currency: string };
type ImportCategory = { id: string; name: string; type: string };

export type ValidatedImportRow = {
  rowNumber: number;
  transactionDate: string;
  type: "income" | "expense" | "transfer";
  description: string;
  amount: number;
  currency: string;
  categoryId: string | null;
  accountId: string;
  destinationAccountId: string | null;
  note: string | null;
  fingerprint: string;
};

export type ImportPreviewRow = {
  rowNumber: number;
  values: Record<string, string>;
  errors: string[];
};

export type ImportPreview = {
  fileName: string;
  fileHash: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ImportPreviewRow[];
};

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase();
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function addToNameMap<T extends { name: string }>(map: Map<string, T[]>, item: T) {
  const key = normalizeName(item.name);
  map.set(key, [...(map.get(key) ?? []), item]);
}

function findUniqueByName<T extends { name: string }>(
  map: Map<string, T[]>,
  name: string,
  label: string,
) {
  const matches = map.get(normalizeName(name)) ?? [];

  if (matches.length === 0) {
    throw new Error(`ບໍ່ພົບ${label}`);
  }

  if (matches.length > 1) {
    throw new Error(`${label}ຊື່ຊ້ຳກັນ`);
  }

  return matches[0];
}

function findUniqueCategoryByNameAndType(
  categoriesByName: Map<string, ImportCategory[]>,
  name: string,
  type: "income" | "expense",
) {
  const matches = (categoriesByName.get(normalizeName(name)) ?? []).filter(
    (category) => category.type === type,
  );

  if (matches.length === 0) {
    throw new Error("ບໍ່ພົບໝວດໝູ່ທີ່ກົງກັບປະເພດລາຍການ");
  }

  if (matches.length > 1) {
    throw new Error("ໝວດໝູ່ຊື່ຊ້ຳກັນ");
  }

  return matches[0];
}

function getRowFingerprint(userId: string, row: ValidatedImportRow) {
  return createHash("sha256")
    .update(JSON.stringify([
      userId,
      row.transactionDate,
      row.type,
      row.amount,
      row.currency,
      row.description,
      row.accountId,
      row.destinationAccountId,
      row.rowNumber,
    ]))
    .digest("hex");
}

function validateRow(
  values: Record<string, string>,
  rowNumber: number,
  userId: string,
  accountsByName: Map<string, ImportAccount[]>,
  categoriesByName: Map<string, ImportCategory[]>,
) {
  const transactionDate = (values.transaction_date ?? "").trim();
  const type = (values.type ?? "").trim().toLowerCase();
  const description = (values.description ?? "").trim();
  const currency = (values.currency ?? "").trim().toUpperCase();
  const sourceAccountName = (values.source_account ?? "").trim();
  const destinationAccountName = (values.destination_account ?? "").trim();
  const categoryName = (values.category ?? "").trim();
  const note = (values.note ?? "").trim();
  const errors: string[] = [];

  if (!isValidDate(transactionDate)) errors.push("ວັນທີບໍ່ຖືກຕ້ອງ");
  if (type !== "income" && type !== "expense" && type !== "transfer") errors.push("ປະເພດບໍ່ຖືກຕ້ອງ");
  if (!description) errors.push("ກະລຸນາປ້ອນລາຍລະອຽດ");
  if (!/^[A-Z]{3}$/.test(currency)) errors.push("ສະກຸນເງິນບໍ່ຖືກຕ້ອງ");
  if (!sourceAccountName) errors.push("ກະລຸນາເລືອກບັນຊີຕົ້ນທາງ");

  let amount: number | null = null;
  try {
    amount = parseWholeAmount((values.amount ?? "").trim(), "ຈຳນວນເງິນ");
    if (amount <= 0) errors.push("ຈຳນວນເງິນຕ້ອງເປັນເລກເຕັມບວກ");
  } catch {
    errors.push("ຈຳນວນເງິນບໍ່ຖືກຕ້ອງ");
  }

  let sourceAccount: ImportAccount | null = null;
  if (sourceAccountName) {
    try {
      sourceAccount = findUniqueByName(accountsByName, sourceAccountName, "ບັນຊີຕົ້ນທາງ");
      if (sourceAccount.currency !== currency) errors.push("ສະກຸນເງິນບໍ່ກົງກັບບັນຊີຕົ້ນທາງ");
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "ບັນຊີຕົ້ນທາງບໍ່ຖືກຕ້ອງ");
    }
  }

  let destinationAccount: ImportAccount | null = null;
  let category: ImportCategory | null = null;

  if (type === "income" || type === "expense") {
    if (destinationAccountName) errors.push("ລາຍຮັບ ຫຼື ລາຍຈ່າຍ ຫ້າມມີບັນຊີປາຍທາງ");
    if (!categoryName) {
      errors.push("ກະລຸນາປ້ອນໝວດໝູ່");
    } else {
      try {
        category = findUniqueCategoryByNameAndType(categoriesByName, categoryName, type);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "ໝວດໝູ່ບໍ່ຖືກຕ້ອງ");
      }
    }
  }

  if (type === "transfer") {
    if (categoryName) errors.push("ລາຍການໂອນເງິນຫ້າມມີໝວດໝູ່");
    if (!destinationAccountName) {
      errors.push("ກະລຸນາເລືອກບັນຊີປາຍທາງ");
    } else {
      try {
        destinationAccount = findUniqueByName(accountsByName, destinationAccountName, "ບັນຊີປາຍທາງ");
        if (destinationAccount.currency !== currency) errors.push("ສະກຸນເງິນບໍ່ກົງກັບບັນຊີປາຍທາງ");
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "ບັນຊີປາຍທາງບໍ່ຖືກຕ້ອງ");
      }
    }

    if (sourceAccount && destinationAccount) {
      if (sourceAccount.id === destinationAccount.id) errors.push("ບັນຊີຕົ້ນທາງ ແລະ ປາຍທາງຕ້ອງຕ່າງກັນ");
      if (sourceAccount.currency !== destinationAccount.currency) errors.push("ບັນຊີທັງສອງຕ້ອງໃຊ້ສະກຸນເງິນດຽວກັນ");
    }
  }

  if (errors.length || !amount || !sourceAccount || (type !== "income" && type !== "expense" && type !== "transfer")) {
    return { errors, row: null };
  }

  const row: ValidatedImportRow = {
    rowNumber,
    transactionDate,
    type,
    description,
    amount,
    currency,
    categoryId: category?.id ?? null,
    accountId: sourceAccount.id,
    destinationAccountId: destinationAccount?.id ?? null,
    note: note || null,
    fingerprint: "",
  };
  row.fingerprint = getRowFingerprint(userId, row);

  return { errors, row };
}

export function getFileHash(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function parseAndValidateImport(
  buffer: Buffer,
  fileName: string,
  userId: string,
  accounts: ImportAccount[],
  categories: ImportCategory[],
) {
  const text = buffer.toString("utf8");

  if (!text.trim()) {
    throw new Error("ໄຟລ໌ວ່າງເປົ່າ");
  }

  let records: Record<string, string>[];
  try {
    records = parse(text, {
      bom: true,
      columns: true,
      relax_column_count: false,
      skip_empty_lines: true,
      trim: false,
    }) as Record<string, string>[];
  } catch {
    throw new Error("ໄຟລ໌ CSV ບໍ່ຖືກຕ້ອງ ຫຼື ມີແຖວບໍ່ຄົບ");
  }

  if (records.length === 0) {
    throw new Error("ບໍ່ພົບແຖວຂໍ້ມູນໃນໄຟລ໌");
  }

  if (records.length > 5000) {
    throw new Error("ໄຟລ໌ມີຫຼາຍກວ່າ 5,000 ແຖວ");
  }

  const headers = Object.keys(records[0] ?? {});
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));

  if (missingColumns.length) {
    throw new Error(`ບໍ່ພົບຫົວຕາຕະລາງ: ${missingColumns.join(", ")}`);
  }

  const accountsByName = new Map<string, ImportAccount[]>();
  const categoriesByName = new Map<string, ImportCategory[]>();
  accounts.forEach((account) => addToNameMap(accountsByName, account));
  categories.forEach((category) => addToNameMap(categoriesByName, category));

  const validatedRows: ValidatedImportRow[] = [];
  const previewRows: ImportPreviewRow[] = records.map((values, index) => {
    const rowNumber = index + 2;
    const result = validateRow(values, rowNumber, userId, accountsByName, categoriesByName);

    if (result.row) validatedRows.push(result.row);

    return { rowNumber, values, errors: result.errors };
  });

  return {
    fileHash: getFileHash(buffer),
    fileName,
    preview: {
      fileName,
      fileHash: getFileHash(buffer),
      totalRows: records.length,
      validRows: validatedRows.length,
      invalidRows: records.length - validatedRows.length,
      rows: previewRows,
    } satisfies ImportPreview,
    validatedRows,
  };
}
