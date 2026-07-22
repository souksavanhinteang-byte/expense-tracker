import Link from "next/link";

type CategoryFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  defaultName?: string;
  defaultType?: "income" | "expense";
};

export function CategoryForm({
  action,
  defaultName = "",
  defaultType = "expense",
}: CategoryFormProps) {
  const controlClassName =
    "w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 [color-scheme:light]";

  return (
    <form action={action} className="space-y-6 rounded-2xl bg-white p-8 shadow-sm">
      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="name">
          ຊື່ໝວດໝູ່
        </label>
        <input
          id="name"
          name="name"
          type="text"
          defaultValue={defaultName}
          required
          className={controlClassName}
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="type">
          ປະເພດ
        </label>
        <select id="type" name="type" defaultValue={defaultType} className={controlClassName}>
          <option value="income">ລາຍຮັບ</option>
          <option value="expense">ລາຍຈ່າຍ</option>
        </select>
      </div>

      <div className="flex gap-3">
        <Link
          href="/categories"
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
