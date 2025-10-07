import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useWebRTC } from "@/hooks/use-webrtc";

interface Props{
    onLeave: ()=> void;
    meetingName: string;
}

export const CallActive = ({onLeave, meetingName}: Props) => {
    const {
        attachLocalStream,
        isCameraOn,
        isMicOn,
        toggleCamera,
        toggleMic,
        error,
        requestMedia,
        localStream,
    } = useWebRTC({ video: true, audio: true });

    return (
        <div className="flex flex-col justify-between p-4 h-full text-white">
            <div className="bg-[#101213] rounded-full flex items-center gap-4">
                <Link href="/" className="flex items-center justify-center p-1 bg-white/10 rounded-full w-fit">
                    <Image src="/logo.svg" width={22} height={22} alt="Logo" />
                </Link>
                <h4 className="text-base">
                    {meetingName}
                </h4>
            </div>
            
            <div className="flex-1 flex items-center justify-center bg-gray-800 rounded-lg">
                {localStream ? (
                    <video
                        ref={attachLocalStream}
                        className="w-full h-full object-cover rounded-lg"
                        muted
                        playsInline
                        autoPlay
                    />
                ) : (
                    <div className="text-center p-6">
                        <p className="text-gray-300 mb-3">Camera/Mic not allowed yet.</p>
                        <Button variant="outline" size="sm" onClick={() => requestMedia()}>
                            Allow Camera & Mic
                        </Button>
                    </div>
                )}
            </div>
            
            <div className="bg-[#101213] rounded-full px-4 py-2">
                <div className="flex items-center justify-center gap-4">
                    <Button variant="outline" size="sm" onClick={toggleMic}>
                        {isMicOn ? "Mute" : "Unmute"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={toggleCamera}>
                        {isCameraOn ? "Camera Off" : "Camera On"}
                    </Button>
                    <Button variant="destructive" size="sm" onClick={onLeave}>
                        Leave Call
                    </Button>
                </div>
                {error && (
                    <p className="text-center text-red-500 text-xs mt-1">{error}</p>
                )}
            </div>
        </div>
    )
}