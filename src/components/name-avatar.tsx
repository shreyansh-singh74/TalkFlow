import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

interface NameAvatarProps{
    name: string;
    size?: number;
}

export function NameAvatar({
    name,
    size = 70
}:NameAvatarProps){
    const url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
    name || "?"
  )}`;

  return(
    <Avatar className="rounded-full " style={{ width: size, height: size }}>
        <AvatarImage src={url} alt="name" />
        <AvatarFallback>{name[0]?.toUpperCase() ?? "?"}</AvatarFallback>
    </Avatar>
  )
}