# Uploads go to S3-compatible object storage via presigned URLs

Verification documents, CVs, Health Record attachments, and avatar, product,
course, and magazine images need file storage, and the API on Render has no
durable disk. Clients upload directly to S3-compatible object storage
(Cloudflare R2 or similar) with presigned URLs; the API stores only object
keys, never bytes. There are two buckets: a public one for images, and a
private one for verification documents, CVs, and anything attached to a Health
Record or Consultation Request, served only through short-lived signed URLs
embedded in the owning resource's response. Keeping the storage S3-compatible
keeps the provider swappable.
