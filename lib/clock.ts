import { io } from "next/cache";

/** Request time. `io()` keeps this out of the prerendered shell. */
export async function currentInstant(): Promise<Date> {
  await io();
  return new Date();
}
