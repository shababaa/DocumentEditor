import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import * as path from "node:path";
import * as vscode from "vscode";

interface GeneratedDocument {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface GenerateResponse {
  ok: true;
  doc: GeneratedDocument;
}

const REQUEST_TIMEOUT_MS = 65_000;

function withTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function postJson(url: URL, body: unknown): Promise<GenerateResponse> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const transport = url.protocol === "https:" ? httpsRequest : httpRequest;
    const request = transport(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => {
        const rawBody = Buffer.concat(chunks).toString("utf8");
        let parsedBody: unknown;

        try {
          parsedBody = rawBody ? JSON.parse(rawBody) : {};
        } catch {
          reject(new Error("The DocuEdit backend returned an invalid response."));
          return;
        }

        const statusCode = response.statusCode ?? 500;
        if (statusCode < 200 || statusCode >= 300) {
          const error = parsedBody as { error?: unknown };
          const message = statusCode === 401
            ? "Authentication is required. VS Code extension authentication is not implemented yet; use the web app generation flow or call the API with an authenticated session."
            : typeof error.error === "string"
            ? error.error
            : `Backend request failed with status ${statusCode}.`;
          reject(new Error(message));
          return;
        }

        const result = parsedBody as Partial<GenerateResponse>;
        if (result.ok !== true || typeof result.doc?.id !== "string") {
          reject(new Error("The DocuEdit backend response did not include a document id."));
          return;
        }

        resolve(result as GenerateResponse);
      });
    });

    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error("The DocuEdit backend request timed out."));
    });
    request.on("error", (error) => reject(error));
    request.write(payload);
    request.end();
  });
}

async function generateDocumentationFromCurrentFile(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage(
      "DocuEdit: Open a file before generating documentation.",
    );
    return;
  }

  const document = editor.document;
  const filename = path.basename(document.fileName);
  const language = document.languageId;
  const code = editor.selection.isEmpty
    ? document.getText()
    : document.getText(editor.selection);

  if (code.trim().length === 0) {
    void vscode.window.showWarningMessage(
      "DocuEdit: The current file or selection is empty.",
    );
    return;
  }

  const configuration = vscode.workspace.getConfiguration("docuedit");
  const backendBaseUrl = configuration.get<string>(
    "backendApiBaseUrl",
    "http://localhost:5001",
  ).trim();
  const webAppBaseUrl = configuration.get<string>(
    "webAppBaseUrl",
    "http://localhost:5173",
  ).trim();

  try {
    const endpoint = new URL(
      "documents/generate-from-code",
      withTrailingSlash(backendBaseUrl),
    );
    const response = await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `DocuEdit: Generating documentation for ${filename}…`,
      cancellable: false,
    }, () => postJson(endpoint, { filename, language, code }));

    const editorUrl = new URL(
      `doc/${encodeURIComponent(response.doc.id)}`,
      withTrailingSlash(webAppBaseUrl),
    );
    const opened = await vscode.env.openExternal(vscode.Uri.parse(editorUrl.toString()));
    if (!opened) {
      throw new Error(`Document created, but the browser could not open ${editorUrl}.`);
    }

    void vscode.window.showInformationMessage(
      `DocuEdit: Created ${response.doc.title}.`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(
      `DocuEdit: Could not generate documentation. ${message}`,
    );
  }
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "docuedit.generateDocumentationFromCurrentFile",
      generateDocumentationFromCurrentFile,
    ),
  );
}

export function deactivate(): void {}
