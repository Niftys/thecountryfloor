import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Countryfloor",
    short_name: "Countryfloor",
    description: "ACDA country dance judging for tablets",
    start_url: "/",
    display: "standalone",
    background_color: "#121417",
    theme_color: "#0d47a1",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
