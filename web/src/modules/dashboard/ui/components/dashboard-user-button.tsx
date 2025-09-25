import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDownIcon,
  CreditCardIcon,
  LogOutIcon,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function DashboardUserButton() {
  const router = useRouter();
  
  const { data, isPending } = authClient.useSession();

  const onLogout = () => {
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/sign-in");
        },
      },
    });
  };

  if (isPending || !data?.user) {
    return null;
  }

  const user = data.user;

  // Get user initials for fallback
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Check if user has a profile image from OAuth providers (Google/GitHub)
  const hasProfileImage = user.image && user.image.trim() !== "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-lg border border-border/10 p-3 w-full flex items-center gap-3 bg-white/5 hover:bg-white/10">
        <Avatar className="h-8 w-8">
          {hasProfileImage ? (
            <AvatarImage
              src={user.image || undefined}
              alt={user.name || "User Avatar"}
              className="object-cover"
              onError={(e) => {
                console.log("Image failed to load:", user.image);
                // Hide broken images and show fallback
                e.currentTarget.style.display = "none";
              }}
              onLoad={() => {
                console.log("Image loaded successfully:", user.image);
              }}
            />
          ) : null}
          <AvatarFallback className="bg-primary/10 text-primary font-medium">
            {user.name ? getInitials(user.name) : <User className="h-4 w-4" />}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col items-start">
          <p className="text-sm font-medium truncate max-w-32">
            {user.name || "User"}
          </p>
          <p className="text-xs text-muted-foreground truncate max-w-32">
            {user.email}
          </p>
        </div>
        <ChevronDownIcon className="size-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-72">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-1">
            <span className="font-medium truncate">{data.user.name}</span>
            <span className="text-sm font-normal text-muted-foreground truncate">
              {data.user.email}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer flex items-center justify-between">
          Billing
          <CreditCardIcon className="size-4" />
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer flex items-center justify-between"
          onClick={onLogout}
        >
          Logout
          <LogOutIcon className="size-4" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
