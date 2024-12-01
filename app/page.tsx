"use client";
import { useEffect, useRef, useState } from "react";
import firebaseConfig from "./firebase";
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  onSnapshot,
  getFirestore,
  updateDoc,
} from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};
function HomePage() {
  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }
  const firestore = getFirestore();
  const pc = useRef(new RTCPeerConnection(servers));
  const roomRef = useRef<HTMLInputElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  // Tạo PeerConnection
  const initPC = () => {
    pc.current = new RTCPeerConnection(servers);
  };
  const init = async () => {
    const lcStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    const rtStream = new MediaStream();

    lcStream.getTracks().forEach((track) => {
      pc.current.addTrack(track, lcStream);
    });
    pc.current.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        rtStream.addTrack(track);
      });
    };

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = lcStream;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = rtStream;
    }

    // setLocalStream(true);
    // setRemoteStream(true);

    // callButton.disabled = false;
    // answerButton.disabled = false;
    // webcamButton.disabled = true;
  };
  const endCall = async () => {
    if (roomRef.current) {
      const callId = roomRef.current.value;
      const callDoc = doc(collection(firestore, "calls"), callId);
      await updateDoc(callDoc, { callEnded: true });
      if (pc) {
        pc.current.close();
      }
      if (roomRef.current) {
        roomRef.current.value = "";
      }
      initPC();
      init();
    }
  };
  const handleCreateRoom = async () => {
    // Reference Firestore collections for signaling
    const callDoc = doc(collection(firestore, "calls"));
    const offerCandidates = collection(callDoc, "offerCandidates");
    const answerCandidates = collection(callDoc, "answerCandidates");

    if (roomRef.current) {
      roomRef.current.value = callDoc.id;
    }
    // Get candidates for caller, save to db

    pc.current.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(offerCandidates, event.candidate.toJSON());
      }
    };
    // Create offer
    const offerDescription = await pc.current.createOffer();
    await pc.current.setLocalDescription(offerDescription);

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };

    await setDoc(callDoc, { offer });

    // Listen for remote answer
    onSnapshot(callDoc, (snapshot) => {
      const data = snapshot.data();
      if (!pc.current.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        pc.current.setRemoteDescription(answerDescription);
      }
    });
    // When answered, add candidate to peer connection
    onSnapshot(answerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const candidate = new RTCIceCandidate(change.doc.data());
          pc.current.addIceCandidate(candidate);
        }
      });
    });
    onSnapshot(callDoc, (snapshot) => {
      const data = snapshot.data();
      if (data?.callEnded) {
        console.log("Call has been ended by the other party.");
        if (pc) {
          pc.current.close();
        }
        if (roomRef.current) {
          roomRef.current.value = "";
        }
        initPC();
        init();
        // Thêm logic để xử lý giao diện khi kết thúc cuộc gọi
      }
    });
    // hangupButton.disabled = false;
  };
  const handleCall = async () => {
    if (roomRef.current) {
      const callId = roomRef.current.value;
      const callDoc = doc(collection(firestore, "calls"), callId);
      const answerCandidates = collection(callDoc, "answerCandidates");
      const offerCandidates = collection(callDoc, "offerCandidates");
      pc.current.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(answerCandidates, event.candidate.toJSON());
        }
      };

      const callSnapshot = await getDoc(callDoc);
      const callData = callSnapshot.data();
      if (callData) {
        const offerDescription = callData.offer;
        await pc.current.setRemoteDescription(
          new RTCSessionDescription(offerDescription)
        );
      }

      const answerDescription = await pc.current.createAnswer();
      await pc.current.setLocalDescription(answerDescription);

      const answer = {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
      };

      await updateDoc(callDoc, { answer });

      onSnapshot(offerCandidates, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            pc.current
              .addIceCandidate(new RTCIceCandidate(data))
              .catch((error) => {
                console.error("Error adding ICE candidate:", error);
              });
          }
        });
      });
      onSnapshot(callDoc, (snapshot) => {
        const data = snapshot.data();
        if (data?.callEnded) {
          console.log("Call has been ended by the other party.");
          if (pc) {
            pc.current.close();
          }
          if (roomRef.current) {
            roomRef.current.value = "";
          }
          initPC();
          init();
          // Thêm logic để xử lý giao diện khi kết thúc cuộc gọi
        }
      });
    }
  };
  useEffect(() => {
    init();
  }, []);
  return (
    <div className="bg-slate-500 h-[800px] py-[100px] flex flex-col  items-center">
      <p className="text-white text-[36px]  font-[600] mb-[20px] ">
        Chat Video App
      </p>
      <div className="flex gap-10 ">
        {
          <div className="w-[376px] h-[282px] rounded-lg relative">
            <video
              className="absolute z-10 top-0 right-0 left-0 bottom-0 rounded-lg"
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
            />
            (
            <div className="absolute z-0 top-0 right-0 left-0 bottom-0 bg-black flex justify-center items-center text-white rounded-lg">
              waiting for connection...
            </div>
            )
          </div>
        }

        {
          <div className="w-[376px] h-[282px] rounded-lg relative">
            <video
              className="absolute z-10 top-0 right-0 left-0 bottom-0 rounded-lg"
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted
            />
            (
            <div className="absolute z-0  top-0 right-0 left-0 bottom-0 bg-black flex justify-center items-center text-white rounded-lg">
              waiting for connection...
            </div>
            )
          </div>
        }
      </div>
      <div className="mt-[20px]">
        <label className="mr-[4px] text-white text-[22px] font-[600] ">
          idRoom:
        </label>
        <input
          className="rounded-sm px-[4px] text-purple-800 w-[100px] text-end"
          ref={roomRef}
          type="text"
        />
      </div>

      <div className="flex gap-4">
        <button
          className="p-2 bg-purple-600 font-[600] text-[30px] hover:opacity-80 text-white rounded-lg mt-[20px]"
          onClick={handleCreateRoom}
        >
          Create Room
        </button>
        <button
          className="p-2 bg-purple-600 font-[600] text-[30px] hover:opacity-80 text-white rounded-lg mt-[20px]"
          onClick={handleCall}
        >
          Start Call
        </button>
        <button
          className="p-2 bg-purple-600 font-[600] text-[30px] hover:opacity-80 text-white rounded-lg mt-[20px]"
          onClick={endCall}
        >
          Stop Calling
        </button>
      </div>
    </div>
  );
}

export default HomePage;
