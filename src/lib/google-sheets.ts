import { sheets_v4, auth } from "@googleapis/sheets";

function getAuthClient() {
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!key) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not set");

  const credentials = JSON.parse(key);

  return new auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export async function appendRows(rows: string[][]) {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error("GOOGLE_SHEET_ID is not set");
  if (rows.length === 0) return;

  const authClient = getAuthClient();
  const sheets = new sheets_v4.Sheets({ auth: authClient });

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "Sheet1!A:D",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: rows,
    },
  });
}
