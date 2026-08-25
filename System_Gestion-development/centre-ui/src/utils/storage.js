import { supabase } from '../supabaseClient'

export const AVATARS_BUCKET = 'avatars'

const fileExtension = (file) => {
  const ext = (file?.name?.split('.').pop() || 'jpg').toLowerCase()
  return /^[a-z0-9]{1,10}$/.test(ext) ? ext : 'jpg'
}

export const buildObjectPath = (entity, id, file) =>
  `${entity}/${id}-${Date.now()}.${fileExtension(file)}`

export const publicUrlFor = (bucket, path) => {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data?.publicUrl || null
}

export async function uploadImage({ entity, id, file, bucket = AVATARS_BUCKET }) {
  if (!file) return null
  const path = buildObjectPath(entity, id, file)
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    cacheControl: '3600',
    contentType: file.type || 'image/jpeg',
  })
  if (error) throw new Error(error.message)
  return publicUrlFor(bucket, path)
}
