"use client";

export function DeleteGoalButton() {
  return <button type="submit" onClick={(event) => { if (!window.confirm("ຢືນຢັນການລຶບເປົ້າໝາຍ? ປະຫວັດການອອມທັງໝົດຈະຖືກລຶບນຳ.")) event.preventDefault(); }} className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700">ລຶບ (ລຶບປະຫວັດ)</button>;
}
