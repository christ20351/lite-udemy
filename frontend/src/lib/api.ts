export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type ApiOptions = Omit<RequestInit, "body"> & { body?: unknown };

export async function api(path: string, options: ApiOptions = {}) {
  const isFormData =
    typeof options.body === "object" &&
    options.body !== null &&
    options.body instanceof FormData;

  // Un fetch sans limite peut rester suspendu indéfiniment (réseau,
  // serveur tué en plein vol…) et bloquer toute l'interface.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${API_URL}/api${path}`, {
      credentials: "include",
      signal: controller.signal,
      ...options,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(options.headers || {}),
      },
      body:
        options.body === undefined
          ? undefined
          : isFormData
            ? (options.body as FormData)
            : JSON.stringify(options.body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        (data as { error?: string }).error || `Erreur ${res.status}`
      );
    }
    return data;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("Le serveur ne répond pas — réessayez dans un instant");
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}
