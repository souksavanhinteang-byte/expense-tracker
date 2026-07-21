"use client";

type DeleteTransactionButtonProps = {
  transactionId: string;
  deleteAction: (formData: FormData) => void | Promise<void>;
};

export function DeleteTransactionButton({
  transactionId,
  deleteAction,
}: DeleteTransactionButtonProps) {
  return (
    <form
      action={deleteAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          "ເຈົ້າຕ້ອງການລຶບລາຍການນີ້ແທ້ບໍ?",
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input
        type="hidden"
        name="transaction_id"
        value={transactionId}
      />

      <button
        type="submit"
        className="inline-flex rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
      >
        ລຶບ
      </button>
    </form>
  );
}