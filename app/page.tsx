"use client";
import { useEffect, useRef, useState } from "react";
import socket from "@/socket/socket";
function HomePage() {
  const [stream, setStream] = useState(false);
  const [remoteStream, setRemoteStream] = useState(false);
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState("");
  const roomRef = useRef<HTMLInputElement>(null);
  const [remoteStreamSource, setRemoteStreamSource] =
    useState<MediaStream | null>(null);
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
        socket.emit("candidate", event.candidate, roomRef.current?.value);
      }
    };

    // Khi nhận được luồng media từ peer khác
    pc.ontrack = (event: RTCTrackEvent) => {
      console.log("new stream: " + event.streams[0]);
      setRemoteStream(true);
      setRemoteStreamSource(event.streams[0]);
      console.log(remoteVideoRef.current);
    };

    return pc;
  };
  const switchVideoPartner = async () => {
    // Tạo một RTCPeerConnection mới
    const pc = new RTCPeerConnection(iceServers);

    // Đăng ký các sự kiện cho peerConnection mới
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", event.candidate);
      }
    };

    pc.ontrack = (event: RTCTrackEvent) => {
      console.log("new stream: " + event.streams[0]);
      setRemoteStream(true);
      setRemoteStreamSource(event.streams[0]);
      console.log(remoteVideoRef.current);
    };

    // Lấy stream từ camera và microphone của người dùng
    const localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    // Thêm các track của localStream vào peerConnection
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    return pc;
  };

  useEffect(() => {
    console.log("remoteVideoRef.current" + remoteVideoRef.current);
    if (remoteVideoRef.current)
      remoteVideoRef.current.srcObject = remoteStreamSource;
    console.log("remoteStreamSource:" + remoteStreamSource);
    console.log(remoteVideoRef.current);
  }, [remoteStream]);
  const startCall = async () => {
    if (roomRef.current?.value) {
      setRoom(roomRef.current?.value);
      socket.emit("join-room", roomRef.current?.value);
    }
    setConnected(true);
    console.log("start call");
  };

  const stopCall = async () => {
    console.log("click stop ");
    socket.emit("disconnectRoom", roomRef.current?.value);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    setConnected(false);
    setRemoteStream(false);
    if (peerConnection.current) {
      peerConnection.current.close(); // Đóng tất cả kết nối ICE, ngừng truyền dữ liệu
      peerConnection.current = null; // Giải phóng đối tượng cũ
    }
    peerConnection.current = createPeerConnection();
    const localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    // Thêm các track của localStream vào peerConnection
    localStream.getTracks().forEach((track) => {
      if (peerConnection.current) {
        peerConnection.current.addTrack(track, localStream);
      }
    });
  };
  useEffect(() => {
    const handleOffer = async (offer: any) => {
      console.log("Offer:", offer);
      await peerConnection.current?.setRemoteDescription(
        new RTCSessionDescription(offer)
      );
      const answer = await peerConnection.current?.createAnswer();
      await peerConnection.current?.setLocalDescription(answer);
      socket.emit("answer", answer, roomRef.current?.value);
    };
    const handleConnected = async (userId: any) => {
      console.log("Connected to user", userId);
      const offer = await peerConnection.current?.createOffer();
      await peerConnection.current?.setLocalDescription(offer);
      console.log(room);
      socket.emit("offer", offer, roomRef.current?.value);
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

    const handleDisconnect = async (socketId: any) => {
      console.log("stop call" + socketId);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      setRemoteStream(false);
      setConnected(false);
      if (peerConnection.current) {
        peerConnection.current.close(); // Đóng tất cả kết nối ICE, ngừng truyền dữ liệu
        peerConnection.current = null; // Giải phóng đối tượng cũ
      }
      peerConnection.current = createPeerConnection();
      const localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      // Thêm các track của localStream vào peerConnection
      localStream.getTracks().forEach((track) => {
        if (peerConnection.current) {
          peerConnection.current.addTrack(track, localStream);
        }
      });
    };
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        console.log("current stream" + stream);
        setStream(true);
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
        if (!socket.hasListeners("disconnectRoom")) {
          socket.on("disconnectRoom", handleDisconnect);
        }
      })
      .catch((error) => console.error("Error accessing media devices.", error));

    return () => {
      socket.off("user-connected", handleConnected);
      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("candidate", handleCandidate);
      socket.off("disconnectRoom", handleDisconnect);
    };
  }, []);
  return (
    <div className="bg-slate-500 h-[800px] py-[100px] flex flex-col  items-center">
      <p className="text-white text-[36px]  font-[600] mb-[20px] ">
        Chat Video App
      </p>
      <div className="flex gap-10 ">
        {stream && (
          <video
            className="w-[376px] h-[282px] rounded-lg"
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
          />
        )}
        {!stream && (
          <div className="w-[376px] h-[282px] bg-black flex justify-center items-center text-white rounded-lg">
            waiting for connection...
          </div>
        )}
        {remoteStream && (
          <video
            className="w-[376px] h-[282px] rounded-lg"
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted
          />
        )}
        {!remoteStream && (
          <div className="w-[376px] h-[282px] bg-black flex justify-center items-center text-white rounded-lg">
            waiting for connection...
          </div>
        )}
      </div>
      <div className="mt-[20px]">
        <label className="mr-[4px] text-white text-[22px] font-[600] ">
          Room:
        </label>
        <input
          className="rounded-sm px-[4px] text-purple-800 w-[40px] text-end"
          disabled={connected}
          ref={roomRef}
          type="text"
        />
      </div>
      {connected && (
        <button
          className="p-2 bg-purple-600 font-[600] text-[30px] hover:opacity-80 text-white rounded-lg mt-[20px]"
          onClick={stopCall}
        >
          Stop Calling
        </button>
      )}
      {!connected && (
        <button
          className="p-2 bg-purple-600 font-[600] text-[30px] hover:opacity-80 text-white rounded-lg mt-[20px]"
          onClick={startCall}
        >
          Start Call
        </button>
      )}
    </div>
  );
}

export default HomePage;
