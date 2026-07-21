# Expense Tracker Project Instructions

## Project purpose

This project is a personal income and expense tracking web application.

The application must allow users to:

- Sign in and sign out
- Add income and expense transactions
- View all transactions
- Edit transactions
- Delete transactions with confirmation
- View monthly income, expenses, and remaining balance
- Manage accounts and categories
- Import historical Excel data
- Export data for backup

## Technology stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase PostgreSQL
- Supabase Row Level Security
- Server Components and Server Actions

## User interface

- The main UI language is Lao.
- Keep Lao wording simple and easy to understand.
- Default currency is LAK.
- Amounts should be shown with thousands separators.
- Use responsive layouts that work on desktop and mobile.
- Keep the design clean and easy to use.

## Existing routes

- `/`
- `/auth/login`
- `/dashboard`
- `/transactions`
- `/transactions/new`
- `/transactions/[id]/edit`

## Database tables

- `profiles`
- `accounts`
- `categories`
- `transactions`
- `import_batches`

## Database rules

- Every user-owned row must use `user_id`.
- Users must only access their own data.
- Row Level Security must remain enabled.
- Do not bypass RLS from browser code.
- Do not expose secret keys or the Supabase service-role key.
- Only the Supabase publishable key may be used in public environment variables.
- Preserve existing database constraints unless a change is clearly necessary.
- Transfers must not be counted as income or expense.
- Monetary values are stored as whole numbers.

## Code rules

- Inspect the relevant files before editing.
- Do not replace working features without explaining why.
- Make the smallest safe change needed.
- Preserve existing routes and working behavior.
- Avoid duplicated code when a reusable component is appropriate.
- Validate form data on the server.
- Check the authenticated user before database writes.
- Include `user_id` checks when updating or deleting rows.
- Handle Supabase errors clearly.
- Use descriptive TypeScript names.
- Do not use `any` unless absolutely necessary.

## Required checks after changes

Run:

```bash
npm run lint
npx tsc --noEmit