const cloudinary = require("cloudinary").v2;
const path = require("path");
const fs = require("fs");
const os = require("os");

// Fayl nomini xavfsiz qilish — kirill va maxsus belgilarni olib tashlash
const sanitizeFilename = (filename) => {
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);
  const safe =
    name
      .replace(/[а-яёА-ЯЁ]/g, "") // kirill harflarni olib tashlash
      .replace(/[^\w\-\.]/g, "_") // maxsus belgilarni _ ga
      .replace(/_+/g, "_") // ko'p _ ni bittaga
      .replace(/^_|_$/g, "") || // bosh va ohir _ olib tashlash
    "file"; // bo'sh bo'lsa "file"
  return safe + ext.toLowerCase();
};

const isCloudinaryConfigured = () =>
  !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const uploadFile = async (buffer, originalName) => {
  const safeName = sanitizeFilename(originalName);

  if (isCloudinaryConfigured()) {
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      const publicId = `edutest/${timestamp}-${safeName.replace(/\.[^.]+$/, "")}`;

      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: "raw",
          public_id: publicId,
          use_filename: false,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      stream.end(buffer);
    });
  }

  // Local storage fallback
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const filename = `${Date.now()}-${safeName}`;
  const filepath = path.join(uploadsDir, filename);
  fs.writeFileSync(filepath, buffer);

  return {
    url: `/uploads/${filename}`,
    publicId: filename,
  };
};

module.exports = { uploadFile };
