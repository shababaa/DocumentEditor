const languages = {
  js: "JavaScript", jsx: "React", ts: "TypeScript", tsx: "React TS",
  py: "Python", rb: "Ruby", go: "Go", rs: "Rust", java: "Java",
  cs: "C#", cpp: "C++", c: "C", php: "PHP", swift: "Swift",
  kt: "Kotlin", sql: "SQL", css: "CSS", html: "HTML", json: "JSON",
  yml: "YAML", yaml: "YAML", sh: "Shell", md: "Markdown",
};

export function documentMeta(document) {
  const generated = document.title?.toLowerCase().startsWith("documentation:");
  const source = generated ? document.title.replace(/^documentation:\s*/i, "").trim() : null;
  const extension = source?.split(".").pop()?.toLowerCase();
  return {
    generated,
    source: source || "Web workspace",
    language: generated ? (languages[extension] || extension?.toUpperCase() || "Source") : "Markdown",
  };
}

export function formatRelativeTime(value) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const ranges = [[31536000, "year"], [2592000, "month"], [604800, "week"], [86400, "day"], [3600, "hour"], [60, "minute"]];
  for (const [amount, unit] of ranges) {
    if (Math.abs(seconds) >= amount) return formatter.format(Math.round(seconds / amount), unit);
  }
  return "Just now";
}

export function documentPreview(document) {
  const meta = documentMeta(document);
  if (meta.generated) return `A source-connected documentation draft for ${meta.source}, ready for review and collaborative editing.`;
  return "An editable Markdown document in your shared DocuEdit workspace.";
}
