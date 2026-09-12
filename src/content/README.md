# Gallery storage and publishing

The `/misc` gallery keeps production metadata in `misc/index.json` and published image copies in Cloudflare R2. The bundled `misc.json` is the fallback when R2 metadata is unavailable. Original photos stay in Photos, iCloud, or another private backup and never enter this repository.

The production image address is:

```text
https://photos.rkolaric.com/misc/<date>-<event>/<number>-<name>.jpg
```

Example:

```text
https://photos.rkolaric.com/misc/2026-09-07-dolomites/01-lake.jpg
```

Local `/misc/...` paths remain supported for the sample gallery. New real events should use the R2 address.

## One-time Cloudflare setup

### 1. Add the domain to Cloudflare if needed

The R2 custom domain must belong to a Cloudflare zone in the same account as the bucket.

If `rkolaric.com` is already active in Cloudflare, continue to step 2. Otherwise:

1. Open the Cloudflare dashboard and choose **Add a domain**.
2. Enter `rkolaric.com` and select the Free plan.
3. Compare every imported DNS record with the records shown in the Vercel project's **Settings → Domains** page. Preserve any mail records as well.
4. Change the domain's nameservers at the registrar only after the records match.
5. Wait until Cloudflare reports the zone as **Active**, then confirm `https://rkolaric.com` still loads before touching R2.

Do not guess or replace the Vercel DNS records. Use the values Vercel currently shows for this project.

### 2. Create the R2 bucket

1. In Cloudflare, open **Storage & databases → R2 → Overview**.
2. Complete the R2 checkout/activation screen. A payment method may be requested even when usage stays inside the free allowance.
3. Choose **Create bucket**.
4. Name it `rkolaric-photos`.
5. Use the default **Standard** storage class and create the bucket.

Only resized, publishable copies belong in this bucket. Do not upload camera originals, RAW files, private albums, or unreviewed exports.

### 3. Connect the public photo domain

1. Open `rkolaric-photos` and select **Settings**.
2. Under **Custom Domains**, choose **Add**.
3. Enter `photos.rkolaric.com` and approve the DNS record Cloudflare proposes.
4. Wait for the domain status to become **Active**.
5. Leave the bucket writable only through authenticated R2 tools. The custom domain supplies public read access.
6. Disable the `r2.dev` development URL after the custom domain works.

Test the domain after uploading the first image by opening its full URL in a private browser window.

### 4. Create publishing credentials

The private `/misc/publish` page needs restricted R2 credentials.

1. Return to **R2 → Overview**.
2. Under **Account Details**, choose **Manage** next to **API Tokens**.
3. Create a user or account API token.
4. Grant **Object Read & Write**.
5. Apply it only to the `rkolaric-photos` bucket.
6. Copy the **Access Key ID**, **Secret Access Key**, account ID, and S3 endpoint immediately. Cloudflare shows the secret only once.

Store them locally in `.env.local` at the repository root and add the same values to the Vercel project:

```dotenv
R2_ACCOUNT_ID=replace-me
R2_ACCESS_KEY_ID=replace-me
R2_SECRET_ACCESS_KEY=replace-me
R2_BUCKET=rkolaric-photos
R2_ENDPOINT=https://replace-me.r2.cloudflarestorage.com
R2_PUBLIC_URL=https://photos.rkolaric.com
PUBLISH_PASSWORD=replace-with-a-random-password-of-at-least-16-characters
SESSION_SECRET=replace-with-at-least-32-random-characters
```

`.env.local` is ignored by Git. None of these names may use the `NEXT_PUBLIC_` prefix.

Never paste real credentials into `misc.json`, source code, a commit, an issue, or a chat message.

### 5. Allow browser uploads

Add this CORS policy to the R2 bucket, replacing or extending the origins when the site uses another hostname:

```json
[
  {
    "AllowedOrigins": ["https://rkolaric.com", "http://localhost:3000"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## Publish the first event

### 1. Prepare public copies

For each public copy:

- Correct its rotation before export.
- Keep the long edge around 2400 pixels.
- Export JPEG at roughly 80–85% quality, or WebP at similar visual quality.
- Remove location and other EXIF metadata.
- Inspect the exported copy before upload.

Keep the originals in the photo library or backup. R2 is the delivery copy, not the master archive.

### 2. Upload and publish

1. Open `/misc/publish` and enter the publishing password.
2. Enter the event title and date.
3. Choose up to 50 prepared JPEG, WebP, or PNG images, each no larger than 15 MB.
4. Add a description and alt text for every image.
5. Review the generated immutable event path.
6. Choose **Upload and publish**.
7. Open `/misc` and check:

- Event order, title, and date.
- Every main photo and thumbnail.
- Portrait and landscape framing.
- Every description.
- The compact grid and both pinch directions.

The first successful publish creates `misc/index.json` from the bundled fallback and prepends the new event. If metadata publishing fails after upload, the page reports the possibly orphaned R2 object keys; do not publish the same path again until those objects are removed or the title is changed.

## Rules that prevent future problems

- Treat every R2 custom-domain URL as public.
- Keep originals and private metadata outside both Git and the public bucket.
- Never overwrite a published file. The publisher rejects existing event paths and object keys.
- Keep event paths immutable after publication.
- Keep a separate backup of originals and periodically copy `misc/index.json`; R2 is the live source of both captions and photographs.

## Troubleshooting

**The custom URL returns 404:** confirm the object key includes the complete `misc/<event>/...` path and matches capitalization exactly.

**The custom URL returns 403:** confirm the custom domain is Active and public access through that domain is enabled.

**Next.js reports an unconfigured image host:** restart the development server after changing `next.config.mjs`. Only `https://photos.rkolaric.com/misc/**` is allowed.

**The gallery check rejects a URL:** use either a local `/misc/...` sample path or the exact `https://photos.rkolaric.com/misc/...` production prefix.

**Publishing reports orphaned keys:** inspect those exact keys in R2. Remove them before retrying the same event path, or change the event title to generate a new path.

**Direct upload fails in the browser:** confirm the bucket CORS policy includes the exact site origin and permits `PUT` with the `Content-Type` header.

## Existing gallery behavior

Collections appear in the order written in R2 metadata, with the newest published event first. Each event has one title and any number of photos with individual descriptions. Portrait, landscape, and square images are supported.

Days remain in a continuous scroll. Pinching inward on a Mac trackpad or choosing **All photos** opens the compact grid; pinching open over a tile or clicking it returns to that photo's event.

## Official references

- [Cloudflare R2 public buckets and custom domains](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [Cloudflare R2 S3 credentials](https://developers.cloudflare.com/r2/get-started/s3/)
- [Cloudflare R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [Cloudflare R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Next.js remote image configuration](https://nextjs.org/docs/app/api-reference/components/image#remotepatterns)
