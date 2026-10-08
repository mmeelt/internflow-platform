const MAX_PROFILE_PHOTO_BYTES = 2 * 1024 * 1024;

export function readProfilePhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("Please choose an image file."));
  }
  if (file.size > MAX_PROFILE_PHOTO_BYTES) {
    return Promise.reject(new Error("Profile photo must be smaller than 2 MB."));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read this image."));
    reader.readAsDataURL(file);
  });
}
