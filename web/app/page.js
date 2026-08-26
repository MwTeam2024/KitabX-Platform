import { redirect } from "next/navigation";

export default function RootPage() {
  // In production this checks the session (NestJS-issued cookie/token) and
  // sends returning, verified users straight to /home instead of /welcome.
  redirect("/welcome");
}
