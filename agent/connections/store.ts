import { defineOpenAPIConnection } from "eve/connections";

export default defineOpenAPIConnection({
  spec: "https://vercel-agentic-swag-store-api.vercel.app/api/openapi.json",
  description: "Swag Store storefront and back-office API.",
});
