import Link from "next/link";

type AccountFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  defaultName?: string;
  defaultCurrency?: string;
};

export function AccountForm({
  action,
  defaultName = "",
  defaultCurrency = "LAK",
}: AccountFormProps) {
  return (
    <form action={action} className="space-y-6 rounded-2xl bg-white p-8 shadow-sm">
      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="name">
          ຊື່ບັນຊີ
        </label>
        <input
          id="name"
          name="name"
          type="text"
          defaultValue={defaultName}
          required
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 [color-scheme:light]"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="currency">
          ສະກຸນເງິນ
        </label>
        <input
          id="currency"
          name="currency"
          type="text"
          defaultValue={defaultCurrency}
          required
          maxLength={3}
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 [color-scheme:light]"
        />
      </div>

      <div className="flex gap-3">
        <Link
          href="/accounts"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-center font-semibold hover:bg-slate-100"
        >
          ຍົກເລີກ
        </Link>
        <button
          type="submit"
          className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700"
        >
          ບັນທຶກ
        </button>
      </div>
    </form>
  );
}
