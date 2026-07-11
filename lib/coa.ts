import { getDb } from "./db";

export type AccountType =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "INCOME"
  | "EXPENSE";

export interface CoaRow {
  code: string;
  name: string;
  type: AccountType;
  vatRole?: "output" | "input"; // marks the two VAT control accounts
  isCategory?: boolean; // expense account offered for receipt categorisation
}

// A minimal but standard UK small-business chart of accounts.
export const UK_COA_TEMPLATE: CoaRow[] = [
  // Assets
  { code: "1200", name: "Bank Current Account", type: "ASSET" },
  { code: "1100", name: "Accounts Receivable", type: "ASSET" },
  { code: "1210", name: "VAT on Purchases (input)", type: "ASSET", vatRole: "input" },
  // Liabilities
  { code: "2100", name: "Accounts Payable", type: "LIABILITY" },
  { code: "2200", name: "VAT on Sales (output)", type: "LIABILITY", vatRole: "output" },
  // Equity
  { code: "3000", name: "Owner's Equity", type: "EQUITY" },
  // Income
  { code: "4000", name: "Sales", type: "INCOME" },
  { code: "4900", name: "Other Income", type: "INCOME" },
  // Expenses (these are the receipt categorisation options)
  { code: "5000", name: "Cost of Goods Sold", type: "EXPENSE", isCategory: true },
  { code: "6000", name: "Office Supplies", type: "EXPENSE", isCategory: true },
  { code: "6100", name: "Rent", type: "EXPENSE", isCategory: true },
  { code: "6200", name: "Motor & Travel", type: "EXPENSE", isCategory: true },
  { code: "6300", name: "Professional Fees", type: "EXPENSE", isCategory: true },
  { code: "6400", name: "Utilities", type: "EXPENSE", isCategory: true },
  { code: "6500", name: "Advertising & Marketing", type: "EXPENSE", isCategory: true },
  { code: "7000", name: "Bank Charges", type: "EXPENSE", isCategory: true },
];

// Idempotently seed the chart of accounts for a client.
export function seedChartOfAccounts(firmId: number, clientId: number): void {
  const db = getDb();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO accounts (firm_id, client_id, code, name, type, vat_role, is_category)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const tx = db.transaction((rows: CoaRow[]) => {
    for (const r of rows) {
      insert.run(
        firmId,
        clientId,
        r.code,
        r.name,
        r.type,
        r.vatRole ?? null,
        r.isCategory ? 1 : 0,
      );
    }
  });
  tx(UK_COA_TEMPLATE);
}
