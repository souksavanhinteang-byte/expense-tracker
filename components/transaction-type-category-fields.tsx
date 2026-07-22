"use client";

import { useState } from "react";

type Category = {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
};

type TransactionTypeCategoryFieldsProps = {
  categories: Category[];
  defaultType: "income" | "expense";
  defaultCategoryId?: string | null;
};

const controlClassName =
  "w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 [color-scheme:light]";

export function TransactionTypeCategoryFields({
  categories,
  defaultType,
  defaultCategoryId = "",
}: TransactionTypeCategoryFieldsProps) {
  const [type, setType] = useState(defaultType);
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? "");
  const availableCategories = categories.filter(
    (category) =>
      category.type === type &&
      (category.is_active || category.id === defaultCategoryId),
  );

  return (
    <>
      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="type">
          ປະເພດ
        </label>
        <select
          id="type"
          name="type"
          value={type}
          onChange={(event) => {
            const nextType = event.target.value === "income" ? "income" : "expense";
            setType(nextType);
            setCategoryId("");
          }}
          required
          className={controlClassName}
        >
          <option value="expense">ລາຍຈ່າຍ</option>
          <option value="income">ລາຍຮັບ</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="category_id">
          ໝວດໝູ່
        </label>
        <select
          id="category_id"
          name="category_id"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          required
          className={controlClassName}
        >
          <option value="" disabled>
            ເລືອກໝວດໝູ່
          </option>
          {availableCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
