import { redirect } from "next/navigation";

/**
 * The old home URL. All app routes moved out from under `/dashboard`
 * (`/sessions`, `/coaches`, `/progress`, `/settings`, `/home`), so this
 * page only forwards to the new home and keeps old bookmarks working.
 */
export default function Page() {
  redirect("/home");
}
