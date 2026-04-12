const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

const uploadFile = async (buffer, originalName) => {
  const fileName = `${Date.now()}-${originalName.replace(/\s/g, "_")}`;

  const { error } = await supabase.storage
    .from("submissions")
    .upload(fileName, buffer, { upsert: false });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from("submissions").getPublicUrl(fileName);

  return { url: data.publicUrl };
};

const deleteFile = async () => {};

module.exports = { uploadFile, deleteFile };
