"use client";
import { useEffect, useRef, useState } from "react";
import socket from "@/socket/socket";
function HomePage() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const iceServers = {
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302",
      },
    ],
  };
  // Tạo PeerConnection
  const createPeerConnection = () => {
    const pc = new RTCPeerConnection(iceServers);

    // Lắng nghe sự kiện ICE candidate
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("candidate", event.candidate, 1);
      }
    };

    // Khi nhận được luồng media từ peer khác
    pc.ontrack = (event: RTCTrackEvent) => {
      console.log("new stream: " + event.streams[0]);
      setRemoteStream(event.streams[0]);
      if (remoteVideoRef.current)
        remoteVideoRef.current.srcObject = event.streams[0];
      console.log(remoteVideoRef.current);
    };

    return pc;
  };
  const startCall = async () => {
    console.log("start call");
    socket.emit("join-room", 1);
  };
  useEffect(() => {
    const handleOffer = async (offer: any) => {
      console.log("Offer:", offer);
      await peerConnection.current?.setRemoteDescription(
        new RTCSessionDescription(offer)
      );
      const answer = await peerConnection.current?.createAnswer();
      await peerConnection.current?.setLocalDescription(answer);
      socket.emit("answer", answer, 1);
    };
    const handleConnected = async (userId: any) => {
      console.log("Connected to user", userId);
      const offer = await peerConnection.current?.createOffer();
      await peerConnection.current?.setLocalDescription(offer);
      socket.emit("offer", offer, 1);
    };
    // Xử lý khi nhận được answer từ peer
    const handleAnswer = async (answer: any) => {
      console.log("Answer:", answer);
      if (peerConnection.current?.signalingState === "stable") {
        console.error(
          "RTCPeerConnection is in stable state. Cannot set local description."
        );
        return;
      }
      await peerConnection.current?.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
    };

    // Xử lý khi nhận được candidate ICE từ peer
    const handleCandidate = async (candidate: any) => {
      console.log("Candidate:", candidate);
      await peerConnection.current?.addIceCandidate(
        new RTCIceCandidate(candidate)
      );
    };

    // Khi người dùng muốn bắt đầu cuộc gọi video

    // Truy cập camera và microphone
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        console.log("current stream" + stream);
        setStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          console.log(localVideoRef.current);
        }
        peerConnection.current = createPeerConnection();

        // Thêm track (audio và video) vào PeerConnection
        stream.getTracks().forEach((track) => {
          if (peerConnection.current)
            peerConnection.current.addTrack(track, stream);
        });
        if (!socket.hasListeners("user-connected")) {
          socket.on("user-connected", handleConnected);
        }
        // Lắng nghe tín hiệu từ server signaling
        if (!socket.hasListeners("offer")) {
          socket.on("offer", handleOffer);
        }
        if (!socket.hasListeners("answer")) {
          socket.on("answer", handleAnswer);
        }

        if (!socket.hasListeners("candidate")) {
          socket.on("candidate", handleCandidate);
        }
      })
      .catch((error) => console.error("Error accessing media devices.", error));

    return () => {
      socket.off("user-connected", handleConnected);
      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("candidate", handleCandidate);
    };
  }, []);
  return (
    <div className="bg-slate-500 h-[1000px]">
      <h1>Home Page</h1>
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
      />
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
      />
      <button onClick={startCall}>Start Call</button>
    </div>
  );
}

export default HomePage;
