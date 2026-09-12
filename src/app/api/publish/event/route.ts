import type { NextRequest } from "next/server";
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
    return Response.json(await publishEvent(await jsonBody(request)));
  } catch (error) {
    return errorResponse(error);
  }
}
