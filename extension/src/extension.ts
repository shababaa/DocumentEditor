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

interface LoginResponse {
  ok: true;
  user: { id: string; email: string };
}

interface RequestResult<T> {
  body: T;
  setCookies: string[];
}

interface SourceContext {
  filename: string;
  language: string;
  code: string;
  fileCount: number;
  label: string;
}

interface SourceFile {
  uri: vscode.Uri;
  relativePath: string;
  language: string;
  content: string;
}

type ContextKind = "current" | "files" | "folders" | "workspace";

interface ContextQuickPick extends vscode.QuickPickItem {
  sourceKind: ContextKind;
}

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

const SESSION_SECRET_KEY = "docuedit.sessionCookie";
const REQUEST_TIMEOUT_MS = 65_000;
const MAX_DISCOVERED_FILES = 2_000;
const MAX_CONTEXT_FILES = 120;
const MAX_CONTEXT_BYTES = 420_000;
const MAX_SINGLE_FILE_BYTES = 120_000;
const DEFAULT_EXCLUDE = "**/{node_modules,.git,dist,build,out,coverage,.next,.nuxt,.venv,venv,target,vendor}/**";
const BINARY_EXTENSIONS = new Set([
  ".7z", ".a", ".avi", ".bin", ".bmp", ".class", ".db", ".dll", ".dylib",
  ".eot", ".exe", ".gif", ".gz", ".ico", ".jar", ".jpeg", ".jpg", ".lockb",
  ".mov", ".mp3", ".mp4", ".o", ".otf", ".pdf", ".png", ".pyc", ".so",
  ".sqlite", ".tar", ".tiff", ".ttf", ".wav", ".webm", ".webp", ".woff",
  ".woff2", ".zip",
]);

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ".c": "c", ".cc": "cpp", ".cpp": "cpp", ".cs": "csharp", ".css": "css",
  ".go": "go", ".html": "html", ".java": "java", ".js": "javascript",
  ".jsx": "javascriptreact", ".json": "json", ".kt": "kotlin", ".md": "markdown",
  ".php": "php", ".py": "python", ".rb": "ruby", ".rs": "rust", ".scss": "scss",
  ".sh": "shellscript", ".sql": "sql", ".swift": "swift", ".toml": "toml",
  ".ts": "typescript", ".tsx": "typescriptreact", ".vue": "vue", ".xml": "xml",
  ".yaml": "yaml", ".yml": "yaml",
};

function withTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function getConfiguration(): { backendBaseUrl: string; webAppBaseUrl: string } {
  const configuration = vscode.workspace.getConfiguration("docuedit");
  return {
    backendBaseUrl: configuration.get<string>("backendApiBaseUrl", "http://localhost:5001").trim(),
    webAppBaseUrl: configuration.get<string>("webAppBaseUrl", "http://localhost:5173").trim(),
  };
}

function apiUrl(route: string): URL {
  return new URL(route, withTrailingSlash(getConfiguration().backendBaseUrl));
}

function requestJson<T>(
  url: URL,
  options: { method?: string; body?: unknown; cookie?: string } = {},
): Promise<RequestResult<T>> {
  return new Promise((resolve, reject) => {
    const payload = options.body === undefined ? undefined : JSON.stringify(options.body);
    const transport = url.protocol === "https:" ? httpsRequest : httpRequest;
    const headers: Record<string, string | number> = { Accept: "application/json" };
    if (payload !== undefined) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(payload);
    }
    if (options.cookie) headers.Cookie = options.cookie;

    const request = transport(url, {
      method: options.method ?? "GET",
      headers,
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

        const status = response.statusCode ?? 500;
        if (status < 200 || status >= 300) {
          const error = parsedBody as { error?: unknown };
          reject(new ApiError(
            typeof error.error === "string" ? error.error : `Backend request failed with status ${status}.`,
            status,
          ));
          return;
        }

        resolve({
          body: parsedBody as T,
          setCookies: response.headers["set-cookie"] ?? [],
        });
      });
    });

    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error("The DocuEdit backend request timed out."));
    });
    request.on("error", reject);
    if (payload !== undefined) request.write(payload);
    request.end();
  });
}

function ensureSafeCredentialTransport(url: URL): void {
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (url.protocol !== "https:" && !localHosts.has(url.hostname)) {
    throw new Error("DocuEdit sign-in requires HTTPS unless the backend is running on localhost.");
  }
}

async function signIn(secrets: vscode.SecretStorage): Promise<string | undefined> {
  const email = await vscode.window.showInputBox({
    title: "Sign in to DocuEdit",
    prompt: "Email address",
    placeHolder: "you@company.dev",
    ignoreFocusOut: true,
  });
  if (!email) return undefined;

  const password = await vscode.window.showInputBox({
    title: "Sign in to DocuEdit",
    prompt: "Password",
    password: true,
    ignoreFocusOut: true,
  });
  if (!password) return undefined;

  const endpoint = apiUrl("auth/login");
  ensureSafeCredentialTransport(endpoint);
  const response = await requestJson<LoginResponse>(endpoint, {
    method: "POST",
    body: { email, password },
  });
  const cookie = response.setCookies[0]?.split(";", 1)[0];
  if (!cookie) throw new Error("The backend signed in but did not return a session cookie.");

  await secrets.store(SESSION_SECRET_KEY, cookie);
  void vscode.window.showInformationMessage(`DocuEdit: Signed in as ${response.body.user.email}.`);
  return cookie;
}

async function signOut(secrets: vscode.SecretStorage): Promise<void> {
  const cookie = await secrets.get(SESSION_SECRET_KEY);
  try {
    if (cookie) await requestJson(apiUrl("auth/logout"), { method: "POST", cookie });
  } finally {
    await secrets.delete(SESSION_SECRET_KEY);
  }
  void vscode.window.showInformationMessage("DocuEdit: Signed out.");
}

function isSensitiveFile(uri: vscode.Uri): boolean {
  const name = path.basename(uri.fsPath).toLowerCase();
  const extension = path.extname(name);
  return name === ".env"
    || name.startsWith(".env.")
    || [".npmrc", ".pypirc", "credentials.json", "credentials.yaml", "credentials.yml", "secrets.json", "secrets.yaml", "secrets.yml"].includes(name)
    || [".pem", ".key", ".p12", ".pfx"].includes(extension);
}

function isBinary(bytes: Uint8Array, uri: vscode.Uri): boolean {
  if (BINARY_EXTENSIONS.has(path.extname(uri.fsPath).toLowerCase())) return true;
  const sampleSize = Math.min(bytes.length, 8_000);
  for (let index = 0; index < sampleSize; index += 1) {
    if (bytes[index] === 0) return true;
  }
  return false;
}

function relativePath(uri: vscode.Uri): string {
  const workspacePath = vscode.workspace.asRelativePath(uri, false);
  return workspacePath === uri.fsPath ? path.basename(uri.fsPath) : workspacePath;
}

function inferLanguage(uri: vscode.Uri): string {
  return LANGUAGE_BY_EXTENSION[path.extname(uri.fsPath).toLowerCase()] ?? "text";
}

async function readSourceFiles(uris: vscode.Uri[]): Promise<SourceFile[]> {
  const uniqueUris = [...new Map(uris.map((uri) => [uri.toString(), uri])).values()];
  const selected = uniqueUris.slice(0, MAX_CONTEXT_FILES);
  const sources: SourceFile[] = [];
  let totalBytes = 0;
  let skipped = uniqueUris.length - selected.length;

  for (const uri of selected) {
    if (isSensitiveFile(uri)) {
      skipped += 1;
      continue;
    }

    try {
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.type !== vscode.FileType.File || stat.size > MAX_SINGLE_FILE_BYTES) {
        skipped += 1;
        continue;
      }
      if (totalBytes + stat.size > MAX_CONTEXT_BYTES) {
        skipped += 1;
        continue;
      }

      const openDocument = vscode.workspace.textDocuments.find(
        (document) => document.uri.toString() === uri.toString(),
      );
      const bytes = openDocument
        ? Buffer.from(openDocument.getText(), "utf8")
        : await vscode.workspace.fs.readFile(uri);
      if (isBinary(bytes, uri)) {
        skipped += 1;
        continue;
      }

      totalBytes += bytes.byteLength;
      sources.push({
        uri,
        relativePath: relativePath(uri).replace(/[\r\n]/g, " "),
        language: openDocument?.languageId ?? inferLanguage(uri),
        content: openDocument?.getText() ?? Buffer.from(bytes).toString("utf8"),
      });
    } catch {
      skipped += 1;
    }
  }

  if (skipped > 0) {
    void vscode.window.showWarningMessage(
      `DocuEdit: Skipped ${skipped} file${skipped === 1 ? "" : "s"} because of context limits, binary content, or secret-file rules.`,
    );
  }
  return sources;
}

function combineSourceFiles(files: SourceFile[], label: string): SourceContext {
  if (files.length === 0) throw new Error("No readable source files were selected.");
  if (files.length === 1) {
    return {
      filename: path.basename(files[0].uri.fsPath),
      language: files[0].language,
      code: files[0].content,
      fileCount: 1,
      label,
    };
  }

  const workspaceName = vscode.workspace.name ?? "Selected codebase";
  const code = files.map((file) => [
    `===== FILE: ${file.relativePath} =====`,
    `Language: ${file.language}`,
    "",
    file.content,
    `===== END FILE: ${file.relativePath} =====`,
  ].join("\n")).join("\n\n");

  return {
    filename: `${workspaceName} codebase`.slice(0, 220),
    language: "multi-file",
    code,
    fileCount: files.length,
    label,
  };
}

async function currentEditorContext(): Promise<SourceContext | undefined> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage("DocuEdit: Open a file before generating documentation.");
    return undefined;
  }
  const code = editor.selection.isEmpty
    ? editor.document.getText()
    : editor.document.getText(editor.selection);
  if (!code.trim()) {
    void vscode.window.showWarningMessage("DocuEdit: The current file or selection is empty.");
    return undefined;
  }
  if (Buffer.byteLength(code, "utf8") > MAX_CONTEXT_BYTES) {
    void vscode.window.showWarningMessage(
      `DocuEdit: The current file or selection exceeds the ${Math.round(MAX_CONTEXT_BYTES / 1_000)} KB context limit. Select a smaller section.`,
    );
    return undefined;
  }
  return {
    filename: path.basename(editor.document.fileName),
    language: editor.document.languageId,
    code,
    fileCount: 1,
    label: editor.selection.isEmpty ? "current file" : "selected code",
  };
}

async function discoverWorkspaceFiles(): Promise<vscode.Uri[]> {
  return vscode.workspace.findFiles("**/*", DEFAULT_EXCLUDE, MAX_DISCOVERED_FILES);
}

async function selectWorkspaceFiles(): Promise<vscode.Uri[] | undefined> {
  const discovered = (await discoverWorkspaceFiles()).filter((uri) => !isSensitiveFile(uri));
  const picked = await vscode.window.showQuickPick(
    discovered.map((uri) => ({
      label: relativePath(uri),
      description: inferLanguage(uri),
      uri,
    })),
    {
      title: "Add files to DocuEdit context",
      placeHolder: "Select the files the documentation should understand",
      canPickMany: true,
      matchOnDescription: true,
      ignoreFocusOut: true,
    },
  );
  return picked?.map((item) => item.uri);
}

async function selectFolders(): Promise<vscode.Uri[] | undefined> {
  const folders = await vscode.window.showOpenDialog({
    title: "Select folders to document",
    defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri,
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: true,
    openLabel: "Add folders",
  });
  if (!folders?.length) return undefined;

  const discovered: vscode.Uri[] = [];
  for (const folder of folders) {
    const remaining = MAX_DISCOVERED_FILES - discovered.length;
    if (remaining <= 0) break;
    const files = await vscode.workspace.findFiles(
      new vscode.RelativePattern(folder, "**/*"),
      DEFAULT_EXCLUDE,
      remaining,
    );
    discovered.push(...files);
  }
  return discovered;
}

async function chooseContext(): Promise<SourceContext | undefined> {
  const choices: ContextQuickPick[] = [
    { label: "$(file-code) Current file or selection", description: "Use the active editor", sourceKind: "current" },
    { label: "$(files) Select files", description: "Choose multiple workspace files", sourceKind: "files" },
    { label: "$(folder) Select folders", description: "Include source files recursively", sourceKind: "folders" },
    { label: "$(root-folder) Entire workspace", description: "Use the open codebase within safe limits", sourceKind: "workspace" },
  ];
  const choice = await vscode.window.showQuickPick(choices, {
    title: "What should DocuEdit document?",
    placeHolder: "Choose source context",
    ignoreFocusOut: true,
  });
  if (!choice) return undefined;
  if (choice.sourceKind === "current") return currentEditorContext();

  const uris = choice.sourceKind === "files"
    ? await selectWorkspaceFiles()
    : choice.sourceKind === "folders"
    ? await selectFolders()
    : await discoverWorkspaceFiles();
  if (!uris?.length) return undefined;

  if (choice.sourceKind === "workspace") {
    const proceed = await vscode.window.showWarningMessage(
      `DocuEdit will read up to ${MAX_CONTEXT_FILES} source files (${Math.round(MAX_CONTEXT_BYTES / 1_000)} KB) from this workspace. Secret and binary files are skipped.`,
      { modal: true },
      "Continue",
    );
    if (proceed !== "Continue") return undefined;
  }

  const files = await readSourceFiles(uris);
  return combineSourceFiles(files, choice.sourceKind === "workspace" ? "workspace" : `selected ${choice.sourceKind}`);
}

async function explorerContext(primary?: vscode.Uri, selected?: vscode.Uri[]): Promise<SourceContext | undefined> {
  const uris = selected?.length ? selected : primary ? [primary] : [];
  if (!uris.length) return chooseContext();

  const files: vscode.Uri[] = [];
  for (const uri of uris) {
    const stat = await vscode.workspace.fs.stat(uri);
    if (stat.type === vscode.FileType.Directory) {
      files.push(...await vscode.workspace.findFiles(
        new vscode.RelativePattern(uri, "**/*"),
        DEFAULT_EXCLUDE,
        MAX_DISCOVERED_FILES - files.length,
      ));
    } else if (stat.type === vscode.FileType.File) {
      files.push(uri);
    }
  }
  return combineSourceFiles(await readSourceFiles(files), "Explorer selection");
}

async function sessionCookie(secrets: vscode.SecretStorage): Promise<string | undefined> {
  const existing = await secrets.get(SESSION_SECRET_KEY);
  if (existing) return existing;
  const action = await vscode.window.showInformationMessage(
    "Sign in to DocuEdit before generating documentation.",
    "Sign in",
  );
  return action === "Sign in" ? signIn(secrets) : undefined;
}

async function createDocumentation(
  source: SourceContext | undefined,
  secrets: vscode.SecretStorage,
): Promise<void> {
  if (!source) return;
  let cookie = await sessionCookie(secrets);
  if (!cookie) return;

  const generate = () => requestJson<GenerateResponse>(apiUrl("documents/generate-from-code"), {
    method: "POST",
    cookie,
    body: { filename: source.filename, language: source.language, code: source.code },
  });

  try {
    let response: RequestResult<GenerateResponse>;
    try {
      response = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `DocuEdit: Generating from ${source.fileCount} file${source.fileCount === 1 ? "" : "s"}…`,
        cancellable: false,
      }, generate);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      await secrets.delete(SESSION_SECRET_KEY);
      void vscode.window.showWarningMessage("DocuEdit: Your session expired. Please sign in again.");
      cookie = await signIn(secrets);
      if (!cookie) return;
      response = await generate();
    }

    if (response.body.ok !== true || typeof response.body.doc?.id !== "string") {
      throw new Error("The DocuEdit backend response did not include a document id.");
    }
    const editorUrl = new URL(
      `doc/${encodeURIComponent(response.body.doc.id)}`,
      withTrailingSlash(getConfiguration().webAppBaseUrl),
    );
    const opened = await vscode.env.openExternal(vscode.Uri.parse(editorUrl.toString()));
    if (!opened) throw new Error(`Document created, but the browser could not open ${editorUrl}.`);

    void vscode.window.showInformationMessage(
      `DocuEdit: Created ${response.body.doc.title} from ${source.label}.`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(`DocuEdit: Could not generate documentation. ${message}`);
  }
}

async function runCommand(action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(`DocuEdit: ${message}`);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("docuedit.signIn", () =>
      runCommand(() => signIn(context.secrets))),
    vscode.commands.registerCommand("docuedit.signOut", () =>
      runCommand(() => signOut(context.secrets))),
    vscode.commands.registerCommand(
      "docuedit.generateDocumentationFromCurrentFile",
      () => runCommand(async () => createDocumentation(await currentEditorContext(), context.secrets)),
    ),
    vscode.commands.registerCommand(
      "docuedit.generateDocumentation",
      () => runCommand(async () => createDocumentation(await chooseContext(), context.secrets)),
    ),
    vscode.commands.registerCommand(
      "docuedit.generateDocumentationFromExplorer",
      (primary?: vscode.Uri, selected?: vscode.Uri[]) => runCommand(async () =>
        createDocumentation(await explorerContext(primary, selected), context.secrets)),
    ),
  );
}

export function deactivate(): void {}
