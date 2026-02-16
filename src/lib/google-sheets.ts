import { sheets_v4, auth } from "@googleapis/sheets";

function getSheetsClient(): sheets_v4.Sheets {
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const apiKey = process.env.GOOGLE_API_KEY;

  // API key auth (simple key string like "AIzaSy...")
  if (apiKey || (key && !key.trimStart().startsWith("{"))) {
    return new sheets_v4.Sheets({ auth: apiKey || key });
  }

  // Service account auth (JSON credentials)
  if (key) {
    const credentials = JSON.parse(key);
    const authClient = new auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    return new sheets_v4.Sheets({ auth: authClient });
  }

  throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_API_KEY must be set");
}

export async function appendRows(rows: string[][]) {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error("GOOGLE_SHEET_ID is not set");
  if (rows.length === 0) return;

  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "Sheet1!A:D",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: rows,
    },
  });
}

export async function readAllRows(): Promise<string[][]> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error("GOOGLE_SHEET_ID is not set");

  const sheets = getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "Sheet1!A:D",
  });

  return (res.data.values as string[][] | undefined) || [];
}
