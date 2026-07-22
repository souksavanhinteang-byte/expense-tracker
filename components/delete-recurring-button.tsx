"use client";

export function DeleteRecurringButton() {
  return <button onClick={(event) => { if (!window.confirm("ຢືນຢັນການລຶບລາຍການປະຈຳ?")) event.preventDefault(); }} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50">ລຶບ</button>;
}
