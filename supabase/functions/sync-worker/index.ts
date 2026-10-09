import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

const requiredEnv = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const supabaseUrl = requiredEnv("SUPABASE_URL");
const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
const accountId = requiredEnv("R2_ACCOUNT_ID");
const bucket = requiredEnv("R2_BUCKET");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const r2 = new AwsClient({
  accessKeyId: requiredEnv("R2_KEY_ID"),
  secretAccessKey: requiredEnv("R2_SECRET"),
  service: "s3",
  region: "auto",
});

const r2Base = `https://${accountId}.r2.cloudflarestorage.com/${encodeURIComponent(bucket)}`;
const encodePath = (value: string) => value.split("/").map(encodeURIComponent).join("/");
const MULTIPART_THRESHOLD = 64 * 1024 * 1024;
const MULTIPART_CHUNK_SIZE = 32 * 1024 * 1024;

function sourceUrl(bucketId: string, name: string): string {
  return `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucketId)}/${encodePath(name)}`;
}

function destinationUrl(bucketId: string, name: string): string {
  return `${r2Base}/${encodePath(bucketId)}/${encodePath(name)}`;
}

function withQuery(url: string, values: Record<string, string>): string {
  const parsed = new URL(url);
  for (const [key, value] of Object.entries(values)) parsed.searchParams.set(key, value);
  return parsed.toString();
}

function signedHeaders(extra: Record<string, string> = {}): Headers {
  return new Headers({ "x-amz-content-sha256": "UNSIGNED-PAYLOAD", ...extra });
}

async function uploadSmallObject(
  url: string,
  body: Uint8Array,
  contentType: string,
  srcVersion: string,
): Promise<void> {
  const response = await r2.fetch(url, {
    method: "PUT",
    headers: signedHeaders({
      "Content-Length": String(body.byteLength),
      "Content-Type": contentType,
      "x-amz-meta-src-version": srcVersion,
    }),
    body,
  });
  if (!response.ok) throw new Error(`R2 PUT returned ${response.status}`);
}

function takeBytes(chunks: Uint8Array[], size: number): Uint8Array {
  const result = new Uint8Array(size);
  let written = 0;
  while (written < size) {
    const first = chunks[0];
    const amount = Math.min(first.byteLength, size - written);
    result.set(first.subarray(0, amount), written);
    written += amount;
    if (amount === first.byteLength) chunks.shift();
    else chunks[0] = first.subarray(amount);
  }
  return result;
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

async function uploadMultipartObject(
  url: string,
  body: ReadableStream<Uint8Array>,
  contentType: string,
  srcVersion: string,
  expectedLength: number,
): Promise<void> {
  const initiated = await r2.fetch(withQuery(url, { uploads: "" }), {
    method: "POST",
    headers: signedHeaders({
      "Content-Type": contentType,
      "x-amz-meta-src-version": srcVersion,
    }),
  });
  if (!initiated.ok) throw new Error(`R2 multipart initiate returned ${initiated.status}`);
  const initiateXml = await initiated.text();
  const uploadId = initiateXml.match(/<UploadId>([^<]+)<\/UploadId>/)?.[1];
  if (!uploadId) throw new Error("R2 multipart response did not include an upload ID");

  const completedParts: Array<{ partNumber: number; etag: string }> = [];
  const pendingChunks: Uint8Array[] = [];
  let pendingBytes = 0;
  let uploadedBytes = 0;
  const reader = body.getReader();

  const putPart = async (part: Uint8Array, partNumber: number) => {
    const response = await r2.fetch(withQuery(url, {
      partNumber: String(partNumber),
      uploadId,
    }), {
      method: "PUT",
      headers: signedHeaders({ "Content-Length": String(part.byteLength) }),
      body: part,
    });
    if (!response.ok) throw new Error(`R2 multipart part ${partNumber} returned ${response.status}`);
    const etag = response.headers.get("etag");
    if (!etag) throw new Error(`R2 multipart part ${partNumber} returned no ETag`);
    completedParts.push({ partNumber, etag });
    uploadedBytes += part.byteLength;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value?.byteLength) {
        pendingChunks.push(value);
        pendingBytes += value.byteLength;
      }
      while (pendingBytes >= MULTIPART_CHUNK_SIZE) {
        const part = takeBytes(pendingChunks, MULTIPART_CHUNK_SIZE);
        pendingBytes -= part.byteLength;
        await putPart(part, completedParts.length + 1);
      }
    }
    if (pendingBytes > 0) {
      const finalPart = takeBytes(pendingChunks, pendingBytes);
      pendingBytes = 0;
      await putPart(finalPart, completedParts.length + 1);
    }
    if (uploadedBytes !== expectedLength) {
      throw new Error(`Storage body length mismatch: expected ${expectedLength}, received ${uploadedBytes}`);
    }

    const partsXml = completedParts.map(({ partNumber, etag }) =>
      `<Part><PartNumber>${partNumber}</PartNumber><ETag>${escapeXml(etag)}</ETag></Part>`
    ).join("");
    const completionBody = new TextEncoder().encode(`<CompleteMultipartUpload>${partsXml}</CompleteMultipartUpload>`);
    const completed = await r2.fetch(withQuery(url, { uploadId }), {
      method: "POST",
      headers: signedHeaders({
        "Content-Length": String(completionBody.byteLength),
        "Content-Type": "application/xml",
      }),
      body: completionBody,
    });
    const completionXml = await completed.text();
    if (!completed.ok || /<Error>/.test(completionXml)) {
      throw new Error(`R2 multipart completion returned ${completed.status}`);
    }
  } catch (error) {
    try {
      await r2.fetch(withQuery(url, { uploadId }), {
        method: "DELETE",
        headers: signedHeaders(),
      });
    } catch {
      // The original upload error is the useful one; incomplete parts can be lifecycle-cleaned in R2.
    }
    throw error;
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
  }

  const { data: rows, error: claimError } = await supabase.rpc("claim_backup_batch", {
    batch_size: 20,
  });
  if (claimError) {
    console.error("Unable to claim backup batch", claimError.message);
    return Response.json({ error: "Unable to claim backup batch" }, { status: 500 });
  }

  let copied = 0;
  let failed = 0;
  let superseded = 0;

  for (const row of rows ?? []) {
    try {
      const source = await fetch(sourceUrl(row.bucket_id, row.name), {
        headers: { Authorization: `Bearer ${serviceRoleKey}` },
      });
      if (!source.ok) throw new Error(`Storage GET returned ${source.status}`);
      if (!source.body) throw new Error("Storage GET returned an empty body");

      const contentLength = source.headers.get("content-length");
      if (!contentLength) throw new Error("Storage response did not include content-length");

      const expectedLength = Number(contentLength);
      if (!Number.isSafeInteger(expectedLength) || expectedLength < 0) {
        throw new Error("Storage response included an invalid content-length");
      }
      const target = destinationUrl(row.bucket_id, row.name);
      const contentType = source.headers.get("content-type") ?? "application/octet-stream";
      if (expectedLength <= MULTIPART_THRESHOLD) {
        await uploadSmallObject(target, new Uint8Array(await source.arrayBuffer()), contentType, row.src_version);
      } else {
        await uploadMultipartObject(target, source.body, contentType, row.src_version, expectedLength);
      }

      const { data: completed, error: completeError } = await supabase
        .from("backup_ledger")
        .update({ status: "done", synced_at: new Date().toISOString(), last_error: null })
        .eq("bucket_id", row.bucket_id)
        .eq("name", row.name)
        .eq("src_version", row.src_version)
        .eq("status", "in_progress")
        .select("bucket_id")
        .maybeSingle();
      if (completeError) throw new Error(`Unable to mark backup complete: ${completeError.message}`);
      if (!completed) {
        superseded++;
        continue;
      }
      copied++;
    } catch (error) {
      const message = String(error).slice(0, 500);
      const { error: failError } = await supabase
        .from("backup_ledger")
        .update({ status: "failed", last_error: message })
        .eq("bucket_id", row.bucket_id)
        .eq("name", row.name)
        .eq("src_version", row.src_version)
        .eq("status", "in_progress");
      if (failError) {
        console.error("Unable to record backup failure", failError.message);
      }
      failed++;
    }
  }

  return Response.json({ claimed: rows?.length ?? 0, copied, failed, superseded });
});
