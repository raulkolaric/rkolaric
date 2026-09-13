import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import {
  errorResponse,
  jsonBody,
  publishEvent,
  requireSession,
  SESSION_COOKIE,
} from "@/lib/publish";

export async function POST(request: NextRequest) {
  try {
    requireSession(request.cookies.get(SESSION_COOKIE)?.value);
    const result = await publishEvent(await jsonBody(request));
    revalidatePath("/misc");
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
