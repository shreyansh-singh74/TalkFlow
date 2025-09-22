import {createAvatar} from "@dicebear/core"
import {botttsNeutral,initials} from "@dicebear/collection"

interface Props{
    seed: string;
    variant: "bottlsNeutral" | "initials";
}

export const GeneratedAvatarUri = ({ seed, variant }: Props) => {
    let avatar;
    if(variant === "bottlsNeutral"){
        avatar = createAvatar(botttsNeutral,{seed});   
    }
    else{
        avatar = createAvatar(initials,{seed,fontWeight:700,fontSize:42});
    }
    return avatar.toDataUri();
};
