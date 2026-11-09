export type DataSource = "mock" | "live";

export function dataMode(): DataSource {
  const mode = (process.env.DATA_MODE || "mock").trim().toLowerCase();
  return mode === "live" || mode === "hostaway" ? "live" : "mock";
}
