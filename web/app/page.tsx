import { redirect } from "next/navigation";

export const metadata = {
  title: "AI Video Studio",
  description: "Create videos with the AI video studio.",
};

export default function Home() {
  redirect("/veo-studio");
}
