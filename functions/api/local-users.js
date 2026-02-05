import { jsonResponse } from "../_utils/json.js";

export const onRequest = ({ request }) => {
  if (request.method === "GET") {
    return jsonResponse([]);
  }
  if (request.method === "POST") {
    return jsonResponse({ success: true, message: "Persistence not available in serverless mode. Data stored in browser only." });
  }
  return jsonResponse({ error: "Method not allowed" }, { status: 405 });
};
