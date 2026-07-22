"use client";

import { useState } from "react";
import { confirmImport, previewImport } from "@/app/import/actions";
import type { ImportPreview } from "@/lib/transaction-import";

export function TransactionImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [importValidOnly, setImportValidOnly] = useState(false);

  async function handlePreview() {
    if (!file) {
      setError("ກະລຸນາເລືອກໄຟລ໌ CSV");
      return;
    }

    setIsPending(true);
    setError("");
    setPreview(null);

    try {
      const formData = new FormData();
      formData.set("file", file);
      setPreview(await previewImport(formData));
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "ກວດສອບໄຟລ໌ບໍ່ສຳເລັດ");
    } finally {
      setIsPending(false);
    }
  }

  async function handleImport() {
    if (!file) return;

    setIsPending(true);
    setError("");

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("import_valid_only", String(importValidOnly));
      await confirmImport(formData);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "ນຳເຂົ້າຂໍ້ມູນບໍ່ສຳເລັດ");
      setIsPending(false);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-8 shadow-sm">
      <label className="block text-sm font-medium" htmlFor="csv-file">ເລືອກໄຟລ໌ CSV</label>
      <input
        id="csv-file"
        type="file"
        accept=".csv,text/csv"
        className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
        onChange={(event) => {
          setFile(event.target.files?.[0] ?? null);
          setPreview(null);
          setError("");
          setImportValidOnly(false);
        }}
      />

      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={isPending}
          onClick={handlePreview}
          className="rounded-lg bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          ກວດສອບຂໍ້ມູນ
        </button>
        <a href="/api/import-template" className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-center font-semibold hover:bg-slate-100">
          ດາວໂຫຼດໄຟລ໌ຕົວຢ່າງ
        </a>
      </div>

      {preview && (
        <div className="mt-8">
          <h2 className="text-xl font-bold">ຕົວຢ່າງຂໍ້ມູນ</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <p className="rounded-lg bg-slate-50 p-3">ຈຳນວນແຖວທັງໝົດ: {preview.totalRows}</p>
            <p className="rounded-lg bg-emerald-50 p-3 text-emerald-700">ແຖວທີ່ຖືກຕ້ອງ: {preview.validRows}</p>
            <p className="rounded-lg bg-red-50 p-3 text-red-700">ແຖວທີ່ຜິດ: {preview.invalidRows}</p>
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[850px] text-sm">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="px-3 py-3">ແຖວ</th>
                  <th className="px-3 py-3">ວັນທີ</th>
                  <th className="px-3 py-3">ປະເພດ</th>
                  <th className="px-3 py-3">ລາຍລະອຽດ</th>
                  <th className="px-3 py-3">ສະຖານະ</th>
                  <th className="px-3 py-3">ເຫດຜົນທີ່ຜິດ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {preview.rows.slice(0, 20).map((row) => (
                  <tr key={row.rowNumber}>
                    <td className="px-3 py-3">{row.rowNumber}</td>
                    <td className="px-3 py-3">{row.values.transaction_date}</td>
                    <td className="px-3 py-3">{row.values.type}</td>
                    <td className="px-3 py-3">{row.values.description}</td>
                    <td className={`px-3 py-3 font-medium ${row.errors.length ? "text-red-600" : "text-emerald-600"}`}>
                      {row.errors.length ? "ຜິດ" : "ຖືກຕ້ອງ"}
                    </td>
                    <td className="px-3 py-3 text-red-600">{row.errors.join("; ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.invalidRows > 0 && (
            <label className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <input
                type="checkbox"
                checked={importValidOnly}
                onChange={(event) => setImportValidOnly(event.target.checked)}
                className="mt-1"
              />
              <span>ນຳເຂົ້າສະເພາະແຖວທີ່ຖືກຕ້ອງ ແລະ ຂ້າມແຖວທີ່ຜິດ</span>
            </label>
          )}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled={isPending || preview.validRows === 0 || (preview.invalidRows > 0 && !importValidOnly)}
              onClick={handleImport}
              className="rounded-lg bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              ຢືນຢັນການນຳເຂົ້າ
            </button>
            <button type="button" onClick={() => setPreview(null)} className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold hover:bg-slate-100">
              ຍົກເລີກ
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
