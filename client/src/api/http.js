export async function apiFetch (path, options = {}) {
  const API = import.meta.env.VITE_API_BASE
  let res;

  try {
    console.log("fetching:", `${API}${path}`);
    res = await fetch(`${API}${path}`, {
      credentials: "include",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    })
    
  } catch(err) {
    console.error("apiFetch network/client error:", err);
    throw new Error("Network error: failed to reach server")
  }
  
  const contentType = res.headers.get("content-type") || ""
  const isJson = contentType.includes("application/json")

  const body = isJson 
    ? await res.json().catch(() => null) 
    : await res.text().catch(() => "")

  if (!res.ok) {
    const message = 
      (body && body.error) ||
      (typeof body === "string" && body) ||
      `Request failed with status ${res.status}`
    throw new Error(message)
  }

  return body
  
}