export function downloadText(contents: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  try { link.click(); }
  finally {
    link.remove();
    // Give the browser time to begin the download before releasing the Blob.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
export function downloadDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
