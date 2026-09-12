import { NextResponse } from "next/server";
import {
  createSession,
  errorResponse,
  jsonBody,
  SESSION_AGE,
  SESSION_COOKIE,
  validPassword,
} from "@/lib/publish";

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const password = typeof body === "object" && body !== null && "password" in body
      ? body.password
      : undefined;
    if (!validPassword(password)) return Response.json({ error: "Incorrect password." }, { status: 401 });
    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: SESSION_COOKIE,
      value: createSession(),
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_AGE,
    });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
