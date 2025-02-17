function isUrlAnImage(url: string) {
  return url.match(/\.(jpeg|jpg|gif|png|webp)$/) != null;
}

function convertDTOToFormData(dto: Object): FormData {
  const formData = new FormData();
  Object.entries(dto).forEach(([key, value]) => {
    formData.append(key, value?.toString() ?? "");
  });
  return formData;
}

export { isUrlAnImage, convertDTOToFormData };
