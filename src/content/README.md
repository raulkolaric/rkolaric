# Gallery storage and publishing

The `/misc` gallery keeps public text in `misc.json` and published image copies in Cloudflare R2. Original photos stay in Photos, iCloud, or another private backup and never enter this repository.

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

### 4. Create credentials for the future upload command

Manual dashboard uploads do not need credentials, but create a restricted token now so uploads can be automated later.

1. Return to **R2 → Overview**.
2. Under **Account Details**, choose **Manage** next to **API Tokens**.
3. Create a user or account API token.
4. Grant **Object Read & Write**.
5. Apply it only to the `rkolaric-photos` bucket.
6. Copy the **Access Key ID**, **Secret Access Key**, account ID, and S3 endpoint immediately. Cloudflare shows the secret only once.

Store them locally in `.env.local` at the repository root:

```dotenv
R2_ACCOUNT_ID=replace-me
R2_ACCESS_KEY_ID=replace-me
R2_SECRET_ACCESS_KEY=replace-me
R2_BUCKET=rkolaric-photos
R2_ENDPOINT=https://replace-me.r2.cloudflarestorage.com
R2_PUBLIC_URL=https://photos.rkolaric.com
```

`.env.local` is ignored by Git. These credentials are only for uploading from the Mac; the deployed site reads public image URLs and does not need them in Vercel.

Never paste real credentials into `misc.json`, source code, a commit, an issue, or a chat message.

## Publish the first event

### 1. Prepare public copies

Create an event folder outside the repository. Use a sortable date and short lowercase slug:

```text
2026-09-07-dolomites/
  01-lake.jpg
  02-trail.jpg
  03-summit.jpg
```

For each public copy:

- Correct its rotation before export.
- Keep the long edge around 2400 pixels.
- Export JPEG at roughly 80–85% quality, or WebP at similar visual quality.
- Remove location and other EXIF metadata.
- Use numbered lowercase filenames without spaces.
- Inspect the exported copy before upload.

Keep the originals in the photo library or backup. R2 is the delivery copy, not the master archive.

### 2. Upload through the R2 dashboard

1. Open the `rkolaric-photos` bucket.
2. Create the path `misc/2026-09-07-dolomites/`.
3. Upload the prepared files into that path.
4. Open each expected public URL and confirm it loads:

```text
https://photos.rkolaric.com/misc/2026-09-07-dolomites/01-lake.jpg
```

Uploading first prevents a deployed gallery from pointing at missing images.

### 3. Add the event text

Add the newest event at the top of `misc.json`. One title belongs to the event; every photo has its own description and accessibility text.

```json
{
  "title": "A full day in the Dolomites",
  "date": "2026-09-07",
  "photos": [
    {
      "src": "https://photos.rkolaric.com/misc/2026-09-07-dolomites/01-lake.jpg",
      "description": "The first stop after leaving the road behind.",
      "alt": "Still blue lake surrounded by steep mountains"
    },
    {
      "src": "https://photos.rkolaric.com/misc/2026-09-07-dolomites/02-trail.jpg",
      "description": "The trail climbing above the tree line.",
      "alt": "Rocky mountain trail above a pine forest"
    }
  ]
}
```

`photographer` and `source` are optional. Use them when a photo needs attribution.

### 4. Validate and publish

Run:

```sh
node scripts/check-misc.mjs
npm run dev
```

Open `http://localhost:3000/misc` and check:

- Event order, title, and date.
- Every main photo and thumbnail.
- Portrait and landscape framing.
- Every description and credit.
- The compact grid and both pinch directions.

Commit `src/content/misc.json` after the preview is correct. The normal Vercel deployment publishes the update. Image files remain in R2 and do not enter Git history.

## Rules that prevent future problems

- Treat every R2 custom-domain URL as public.
- Keep originals and private metadata outside both Git and the public bucket.
- Never overwrite a published file. Upload a new filename such as `03-summit-v2.jpg`, update `misc.json`, then remove the old object later. This avoids stale CDN and browser caches.
- Upload objects before deploying their JSON references.
- Remove JSON references before deleting objects.
- Keep event paths immutable after publication.
- Keep a separate backup of originals; Git protects the captions, not the photographs.

## Troubleshooting

**The custom URL returns 404:** confirm the object key includes the complete `misc/<event>/...` path and matches capitalization exactly.

**The custom URL returns 403:** confirm the custom domain is Active and public access through that domain is enabled.

**Next.js reports an unconfigured image host:** restart the development server after changing `next.config.mjs`. Only `https://photos.rkolaric.com/misc/**` is allowed.

**The gallery check rejects a URL:** use either a local `/misc/...` sample path or the exact `https://photos.rkolaric.com/misc/...` production prefix.

**An updated photo still looks old:** publish it under a new filename and update the JSON rather than overwriting a cached object.

## Existing gallery behavior

Collections appear in the order written in `misc.json`, so keep the newest event first. Each event has one title and any number of photos with individual descriptions. Portrait, landscape, and square images are supported.

Days remain in a continuous scroll. Pinching inward on a Mac trackpad or choosing **All photos** opens the compact grid; pinching open over a tile or clicking it returns to that photo's event.

## Official references

- [Cloudflare R2 public buckets and custom domains](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [Cloudflare R2 S3 credentials](https://developers.cloudflare.com/r2/get-started/s3/)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Next.js remote image configuration](https://nextjs.org/docs/app/api-reference/components/image#remotepatterns)
