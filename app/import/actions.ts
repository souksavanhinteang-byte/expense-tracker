"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseAndValidateImport, type ImportPreview } from "@/lib/transaction-import";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

async function getValidatedImport(file: File) {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    throw new Error("ກະລຸນາເລືອກໄຟລ໌ CSV ເທົ່ານັ້ນ");
  }

  if (file.size === 0) {
    throw new Error("ໄຟລ໌ວ່າງເປົ່າ");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("ໄຟລ໌ໃຫຍ່ກວ່າ 5 MB");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const [accountsResult, categoriesResult] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, currency")
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("categories")
      .select("id, name, type")
      .eq("user_id", user.id)
      .eq("is_active", true),
  ]);

  if (accountsResult.error) throw new Error(accountsResult.error.message);
  if (categoriesResult.error) throw new Error(categoriesResult.error.message);

  const buffer = Buffer.from(await file.arrayBuffer());
  return {
    supabase,
    user,
    parsed: parseAndValidateImport(
      buffer,
      file.name,
      user.id,
      accountsResult.data ?? [],
      categoriesResult.data ?? [],
    ),
  };
}

export async function previewImport(formData: FormData): Promise<ImportPreview> {
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new Error("ກະລຸນາເລືອກໄຟລ໌ CSV");
  }

  const { parsed } = await getValidatedImport(file);
  return parsed.preview;
}

export async function confirmImport(formData: FormData) {
  const file = formData.get("file");
  const importValidOnly = formData.get("import_valid_only") === "true";

  if (!(file instanceof File)) {
    throw new Error("ກະລຸນາເລືອກໄຟລ໌ CSV ອີກຄັ້ງ");
  }

  const { supabase, user, parsed } = await getValidatedImport(file);

  if (parsed.preview.invalidRows > 0 && !importValidOnly) {
    throw new Error("ກະລຸນາເລືອກນຳເຂົ້າສະເພາະແຖວທີ່ຖືກຕ້ອງ ຫຼື ແກ້ໄຂໄຟລ໌");
  }

  const { data: existingBatch, error: existingBatchError } = await supabase
    .from("import_batches")
    .select("id")
    .eq("user_id", user.id)
    .eq("file_hash", parsed.fileHash)
    .maybeSingle();

  if (existingBatchError) throw new Error(existingBatchError.message);
  if (existingBatch) throw new Error("ໄຟລ໌ນີ້ຖືກນຳເຂົ້າແລ້ວ");

  const skippedRows = parsed.preview.invalidRows;
  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({
      user_id: user.id,
      file_name: parsed.fileName,
      file_hash: parsed.fileHash,
      status: "processing",
      total_rows: parsed.preview.totalRows,
      imported_rows: 0,
      skipped_rows: skippedRows,
      failed_rows: 0,
    })
    .select("id")
    .single();

  if (batchError?.code === "23505") {
    throw new Error("ໄຟລ໌ນີ້ຖືກນຳເຂົ້າແລ້ວ");
  }

  if (batchError || !batch) throw new Error(batchError?.message ?? "ບໍ່ສາມາດສ້າງຊຸດນຳເຂົ້າ");

  let importedRows = 0;
  const rows = parsed.validatedRows.map((row) => ({
    user_id: user.id,
    transaction_date: row.transactionDate,
    type: row.type,
    amount: row.amount,
    description: row.description,
    category_id: row.categoryId,
    account_id: row.accountId,
    destination_account_id: row.destinationAccountId,
    currency: row.currency,
    note: row.note,
    import_batch_id: batch.id,
    source_row_number: row.rowNumber,
    import_fingerprint: row.fingerprint,
  }));

  try {
    for (let start = 0; start < rows.length; start += 250) {
      const chunk = rows.slice(start, start + 250);
      const { error } = await supabase.from("transactions").insert(chunk);

      if (error) throw new Error(error.message);
      importedRows += chunk.length;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "ການນຳເຂົ້າລົ້ມເຫຼວ";
    await supabase
      .from("import_batches")
      .update({
        status: "failed",
        imported_rows: importedRows,
        skipped_rows: skippedRows,
        failed_rows: rows.length - importedRows,
        error_message: message,
      })
      .eq("id", batch.id)
      .eq("user_id", user.id);
    throw new Error("ການນຳເຂົ້າບາງສ່ວນລົ້ມເຫຼວ; ກວດເບິ່ງປະຫວັດການນຳເຂົ້າ");
  }

  const { error: completeError } = await supabase
    .from("import_batches")
    .update({
      status: "completed",
      imported_rows: importedRows,
      skipped_rows: skippedRows,
      failed_rows: 0,
      completed_at: new Date().toISOString(),
    })
    .eq("id", batch.id)
    .eq("user_id", user.id);

  if (completeError) {
    throw new Error(completeError.message);
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  redirect(`/import?success=${batch.id}`);
}
