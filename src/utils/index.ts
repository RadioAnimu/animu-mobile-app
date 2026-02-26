function isUrlAnImage(url: string) {
  return url.match(/\.(jpeg|jpg|gif|png|webp)$/) != null;
}

function convertDTOToFormData(dto: Object): FormData {
  const formData = new FormData();

  Object.entries(dto).forEach(([key, value]) => {
    if (value === null || value === undefined) return; // skip empties instead of sending ""

    if (value instanceof File || value instanceof Blob) {
      formData.append(key, value);
    } else if (typeof value === "boolean") {
      formData.append(key, value ? "true" : "false");
    } else if (typeof value === "object") {
      // Avoid silent "[object Object]" — serialize or skip
      formData.append(key, JSON.stringify(value));
    } else {
      formData.append(key, String(value));
    }
  });

  return formData;
}

function logFormData(label: string, formData: FormData): void {
  console.log(`[FormData] ${label}:`);
  formData.forEach((value, key) => {
    console.log(`  ${key}:`, value);
  });
}

export { isUrlAnImage, convertDTOToFormData, logFormData };
