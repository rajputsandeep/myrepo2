export function normalizeIntegrationsInput(raw: any): any[] {
  if (!raw) return [];

  if (Array.isArray(raw)) return raw;

  if (typeof raw === "object") {
    const out: any[] = [];
    for (const k of Object.keys(raw)) {
      const v = raw[k];
      if (Array.isArray(v)) {
        for (const el of v) {
          const item = el && typeof el === "object" ? { ...el } : { value: el };
          if (!item.type) item.type = String(k).toUpperCase();
          out.push(item);
        }
      } else {
        const item = v && typeof v === "object" ? { ...v } : { value: v };
        if (!item.type) item.type = String(k).toUpperCase();
        out.push(item);
      }
    }
    return out;
  }

  return [];
}