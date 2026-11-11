// Réduit l'image avant envoi : réponse plus rapide et coût d'API minimal.
function draw(src, w, h, maxSide = 512) {
  const k = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * k);
  canvas.height = Math.round(h * k);
  canvas.getContext("2d").drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.7);
}

export function videoToDataUrl(video) {
  return draw(video, video.videoWidth, video.videoHeight);
}

export async function fileToDataUrl(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  return draw(bmp, bmp.width, bmp.height);
}
