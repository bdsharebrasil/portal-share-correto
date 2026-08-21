import {
  Camera,
  CameraOff,
  Cast,
  Check,
  Copy,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  ScreenShare,
  Users,
  Volume2,
} from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import {
  atualizarStatusReuniao,
  sairDaReuniaoTreinamento,
  type TrainingMeeting,
} from "./trainingService";
import { Whiteboard, type WhiteboardStroke } from "./Whiteboard";

const DEFAULT_STUN_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function getRtcConfiguration(): RTCConfiguration {
  const turnUrls = String(import.meta.env.VITE_TURN_URLS ?? "").split(",").map((url) => url.trim()).filter(Boolean);
  const username = String(import.meta.env.VITE_TURN_USERNAME ?? "").trim();
  const credential = String(import.meta.env.VITE_TURN_CREDENTIAL ?? "").trim();
  const turnServers: RTCIceServer[] = turnUrls.length && username && credential
    ? [{ urls: turnUrls, username, credential }]
    : [];
  return { iceServers: [...DEFAULT_STUN_SERVERS, ...turnServers], iceCandidatePoolSize: 10 };
}

const RTC_CONFIGURATION = getRtcConfiguration();

function getVideoProfile(participantCount: number) {
  if (participantCount >= 10) return { maxBitrate: 180_000, scaleResolutionDownBy: 2.5, maxFramerate: 15 };
  if (participantCount >= 7) return { maxBitrate: 300_000, scaleResolutionDownBy: 2, maxFramerate: 18 };
  return { maxBitrate: 500_000, scaleResolutionDownBy: 1.5, maxFramerate: 24 };
}

type PresencePayload = {
  userId: string;
  nome: string;
  isHost: boolean;
  cameraOn: boolean;
  microphoneOn: boolean;
};

type MeetingParticipant = PresencePayload & {
  stream: MediaStream | null;
};

type SignalPayload = {
  kind: "offer" | "answer" | "candidate";
  senderId: string;
  targetId: string;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

type MeetingRoomProps = {
  meeting: TrainingMeeting;
  userId: string;
  userName: string;
  isHost: boolean;
  onLeave: () => void;
};

function VideoTile({
  stream,
  label,
  muted,
  isHost,
  cameraOn,
}: {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
  isHost?: boolean;
  cameraOn: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="group relative aspect-video overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0c1424] shadow-xl shadow-slate-950/20">
      {stream && cameraOn ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center bg-[radial-gradient(circle_at_50%_25%,rgba(245,200,75,0.18),transparent_35%),#0c1424]">
          <span className="flex size-16 items-center justify-center rounded-full bg-amber-300/15 text-2xl font-semibold text-amber-200">
            {label.trim().slice(0, 1).toUpperCase() || "?"}
          </span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent px-3 pb-3 pt-8">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-white">
          <span className="truncate">{label}</span>
          {isHost && (
            <Badge className="border-amber-300/30 bg-amber-300/15 text-[10px] text-amber-200">
              host
            </Badge>
          )}
        </div>
        <span className="text-slate-300">
          {cameraOn ? (
            <Camera className="size-4" />
          ) : (
            <CameraOff className="size-4" />
          )}
        </span>
      </div>
    </div>
  );
}

function formatMeetingStatus(status: TrainingMeeting["status"]) {
  if (status === "em_andamento") return "Ao vivo";
  if (status === "encerrada") return "Encerrada";
  return "Agendada";
}

export function MeetingRoom({
  meeting,
  userId,
  userName,
  isHost,
  onLeave,
}: MeetingRoomProps) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const peersRef = useRef(new Map<string, RTCPeerConnection>());
  const remoteStreamsRef = useRef(new Map<string, MediaStream>());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const presenceRef = useRef<PresencePayload>({
    userId,
    nome: userName,
    isHost,
    cameraOn: true,
    microphoneOn: true,
  });
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<MeetingParticipant[]>([]);
  const [cameraOn, setCameraOn] = useState(true);
  const [microphoneOn, setMicrophoneOn] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [strokes, setStrokes] = useState<WhiteboardStroke[]>([]);
  const [isCopied, setIsCopied] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);

  useEffect(() => {
    presenceRef.current = {
      ...presenceRef.current,
      userId,
      nome: userName,
      isHost,
      cameraOn,
      microphoneOn,
    };
  }, [cameraOn, isHost, microphoneOn, userId, userName]);

  const localPresence = useCallback(
    (): PresencePayload => presenceRef.current,
    [],
  );

  const sendBroadcast = useCallback(
    async (event: string, payload: Record<string, unknown>) => {
      const channel = channelRef.current;
      if (!channel) return;
      await channel.send({ type: "broadcast", event, payload });
    },
    [],
  );

  const refreshParticipants = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;
    const presence = channel.presenceState() as Record<
      string,
      PresencePayload[]
    >;
    const next = Object.values(presence)
      .flat()
      .filter((item) => item?.userId)
      .map((item) => ({
        ...item,
        stream:
          item.userId === userId
            ? localStreamRef.current
            : (remoteStreamsRef.current.get(item.userId) ?? null),
      }));
    setParticipants(next);
    setParticipantCount(Math.max(1, next.length));
  }, [userId]);

  useEffect(() => {
    const profile = getVideoProfile(participantCount);
    [...peersRef.current.values()].forEach((connection) => {
      const sender = connection.getSenders().find((item) => item.track?.kind === "video");
      if (!sender) return;
      const parameters = sender.getParameters();
      parameters.encodings = parameters.encodings?.length ? parameters.encodings : [{}];
      parameters.encodings[0] = { ...parameters.encodings[0], maxBitrate: profile.maxBitrate, maxFramerate: profile.maxFramerate, scaleResolutionDownBy: profile.scaleResolutionDownBy };
      void sender.setParameters(parameters).catch(() => undefined);
    });
  }, [participantCount]);

  const getCurrentVideoTrack = useCallback(() => {
    return (
      screenStreamRef.current?.getVideoTracks()[0] ??
      localStreamRef.current?.getVideoTracks()[0] ??
      null
    );
  }, []);

  const createPeerConnection = useCallback(
    (remoteId: string) => {
      const existing = peersRef.current.get(remoteId);
      if (existing) return existing;

      const connection = new RTCPeerConnection(RTC_CONFIGURATION);
      const remoteStream =
        remoteStreamsRef.current.get(remoteId) ?? new MediaStream();
      remoteStreamsRef.current.set(remoteId, remoteStream);

      const local = localStreamRef.current;
      if (local) {
        local.getTracks().forEach((track) => connection.addTrack(track, local));
      }
      const currentVideo = getCurrentVideoTrack();
      const existingVideoSender = connection
        .getSenders()
        .find((sender) => sender.track?.kind === "video");
      if (
        currentVideo &&
        existingVideoSender &&
        existingVideoSender.track !== currentVideo
      ) {
        void existingVideoSender.replaceTrack(currentVideo);
      }

      const applyVideoProfile = async () => {
        const sender = connection.getSenders().find((item) => item.track?.kind === "video");
        if (!sender) return;
        const profile = getVideoProfile(participantCount);
        const parameters = sender.getParameters();
        parameters.encodings = parameters.encodings?.length ? parameters.encodings : [{}];
        parameters.encodings[0] = { ...parameters.encodings[0], maxBitrate: profile.maxBitrate, maxFramerate: profile.maxFramerate, scaleResolutionDownBy: profile.scaleResolutionDownBy };
        await sender.setParameters(parameters);
      };
      void applyVideoProfile().catch(() => undefined);
      connection.onicecandidate = (event) => {
        if (!event.candidate) return;
        void sendBroadcast("webrtc-signal", {
          kind: "candidate",
          senderId: userId,
          targetId: remoteId,
          candidate: event.candidate.toJSON(),
        });
      };
      connection.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach((track) => {
          const alreadyPresent = remoteStream
            .getTracks()
            .some((current) => current.id === track.id);
          if (!alreadyPresent) remoteStream.addTrack(track);
        });
        refreshParticipants();
      };
      connection.onconnectionstatechange = () => {
        if (["failed", "closed"].includes(connection.connectionState)) {
          connection.close();
          peersRef.current.delete(remoteId);
          remoteStreamsRef.current.delete(remoteId);
          refreshParticipants();
        }
      };

      peersRef.current.set(remoteId, connection);
      return connection;
    },
    [getCurrentVideoTrack, participantCount, refreshParticipants, sendBroadcast, userId],
  );

  const replaceVideoTrackForPeers = useCallback(
    async (track: MediaStreamTrack | null) => {
      await Promise.all(
        [...peersRef.current.values()].map(async (connection) => {
          const sender = connection
            .getSenders()
            .find((item) => item.track?.kind === "video");
          if (sender) await sender.replaceTrack(track);
        }),
      );
    },
    [],
  );

  const createOfferIfNeeded = useCallback(
    async (remoteId: string) => {
      if (userId > remoteId || peersRef.current.has(remoteId)) return;
      const connection = createPeerConnection(remoteId);
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      await sendBroadcast("webrtc-signal", {
        kind: "offer",
        senderId: userId,
        targetId: remoteId,
        description: offer,
      });
    },
    [createPeerConnection, sendBroadcast, userId],
  );

  const applySignal = useCallback(
    async (signal: SignalPayload) => {
      if (signal.targetId !== userId) return;
      const connection = createPeerConnection(signal.senderId);
      if (signal.kind === "offer" && signal.description) {
        await connection.setRemoteDescription(signal.description);
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
        await sendBroadcast("webrtc-signal", {
          kind: "answer",
          senderId: userId,
          targetId: signal.senderId,
          description: answer,
        });
        return;
      }
      if (signal.kind === "answer" && signal.description) {
        await connection.setRemoteDescription(signal.description);
        return;
      }
      if (signal.kind === "candidate" && signal.candidate) {
        try {
          await connection.addIceCandidate(signal.candidate);
        } catch {
          // ICE candidates can arrive before the remote description on slow clients.
        }
      }
    },
    [createPeerConnection, sendBroadcast, userId],
  );

  useEffect(() => {
    let cancelled = false;
    const streamPromise = navigator.mediaDevices?.getUserMedia({
      video: { width: { ideal: 640, max: 1280 }, height: { ideal: 360, max: 720 }, frameRate: { ideal: 20, max: 24 } },
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    if (!streamPromise) {
      setConnectionError(
        "Seu navegador não oferece acesso à câmera e ao microfone.",
      );
      return;
    }

    void streamPromise
      .then(async (stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
        await Promise.all(
          [...peersRef.current.values()].map(async (connection) => {
            stream
              .getTracks()
              .forEach((track) => connection.addTrack(track, stream));
          }),
        );
      })
      .catch(() => {
        setConnectionError(
          "Não foi possível acessar a câmera. Você ainda pode participar sem vídeo.",
        );
        setCameraOn(false);
        setMicrophoneOn(false);
      });

    return () => {
      cancelled = true;
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    const channel = supabase.channel(`treinamento-sala-${meeting.id}`, {
      config: {
        private: true,
        broadcast: { self: false, ack: true },
        presence: { key: userId },
      },
    });
    channelRef.current = channel;
    const peersForCleanup = peersRef.current;
    const remoteStreamsForCleanup = remoteStreamsRef.current;

    channel.on("presence", { event: "sync" }, () => {
      refreshParticipants();
      const presence = channel.presenceState() as Record<
        string,
        PresencePayload[]
      >;
      Object.values(presence)
        .flat()
        .filter((item) => item.userId && item.userId !== userId)
        .forEach((item) => void createOfferIfNeeded(item.userId));
    });
    channel.on("presence", { event: "join" }, ({ newPresences }) => {
      const joined = newPresences as unknown as PresencePayload[];
      refreshParticipants();
      joined
        .filter((item) => item.userId !== userId)
        .forEach((item) => void createOfferIfNeeded(item.userId));
    });
    channel.on("presence", { event: "leave" }, ({ leftPresences }) => {
      const left = leftPresences as unknown as PresencePayload[];
      left.forEach((item) => {
        peersRef.current.get(item.userId)?.close();
        peersRef.current.delete(item.userId);
        remoteStreamsRef.current.delete(item.userId);
      });
      refreshParticipants();
    });
    channel.on("broadcast", { event: "webrtc-signal" }, ({ payload }) => {
      void applySignal(payload as SignalPayload).catch(() =>
        setConnectionError("A conexão de vídeo encontrou um problema."),
      );
    });
    channel.on("broadcast", { event: "whiteboard-stroke" }, ({ payload }) => {
      const stroke = payload as WhiteboardStroke;
      if (!stroke?.id || !Array.isArray(stroke.points)) return;
      setStrokes((current) => [
        ...current.filter((item) => item.id !== stroke.id),
        stroke,
      ]);
    });
    channel.on("broadcast", { event: "whiteboard-clear" }, () =>
      setStrokes([]),
    );
    channel.on("broadcast", { event: "meeting-ended" }, () => {
      toast.info("O host encerrou a reunião.");
      onLeave();
    });

    channel.subscribe(async (status) => {
      if (status !== "SUBSCRIBED" || disposed) return;
      setIsConnected(true);
      await channel.track(presenceRef.current);
      refreshParticipants();
    });

    return () => {
      disposed = true;
      void channel.untrack();
      void supabase.removeChannel(channel);
      channelRef.current = null;
      peersForCleanup.forEach((connection) => connection.close());
      peersForCleanup.clear();
      remoteStreamsForCleanup.clear();
    };
  }, [
    applySignal,
    createOfferIfNeeded,
    meeting.id,
    onLeave,
    refreshParticipants,
    userId,
  ]);

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !isConnected) return;
    void channel.track(localPresence());
    refreshParticipants();
  }, [cameraOn, isConnected, localPresence, microphoneOn, refreshParticipants]);

  useEffect(() => {
    if (!isHost) return;
      void atualizarStatusReuniao(meeting.id, "em_andamento").catch(() => undefined);
  }, [isHost, meeting.id]);

  const currentParticipants = useMemo(() => {
    const local: MeetingParticipant = {
      ...localPresence(),
      stream: screenStream ?? localStream,
    };
    return [
      local,
      ...participants.filter((participant) => participant.userId !== userId),
    ];
  }, [localPresence, localStream, participants, screenStream, userId]);

  async function toggleCamera() {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) {
      toast.error("A câmera não está disponível neste dispositivo.");
      return;
    }
    track.enabled = !track.enabled;
    setCameraOn(track.enabled);
  }

  async function toggleMicrophone() {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) {
      toast.error("O microfone não está disponível neste dispositivo.");
      return;
    }
    track.enabled = !track.enabled;
    setMicrophoneOn(track.enabled);
  }

  async function toggleScreenShare() {
    if (!isHost) return;
    if (screenStreamRef.current) {
      await stopScreenShare();
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      toast.error("Seu navegador não oferece compartilhamento de tela.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      if (!track) return;
      screenStreamRef.current = stream;
      setScreenStream(stream);
      await replaceVideoTrackForPeers(track);
      await sendBroadcast("meeting-state", {
        screenSharing: true,
        sharedBy: userId,
      });
      track.onended = () => void stopScreenShare();
      toast.success("A tela está sendo compartilhada com a sala.");
    } catch {
      toast.info("O compartilhamento de tela foi cancelado.");
    }
  }

  async function stopScreenShare() {
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    setScreenStream(null);
    await replaceVideoTrackForPeers(
      localStreamRef.current?.getVideoTracks()[0] ?? null,
    );
    await sendBroadcast("meeting-state", {
      screenSharing: false,
      sharedBy: null,
    });
  }

  function handleStroke(stroke: WhiteboardStroke) {
    setStrokes((current) => [
      ...current.filter((item) => item.id !== stroke.id),
      stroke,
    ]);
    void sendBroadcast(
      "whiteboard-stroke",
      stroke as unknown as Record<string, unknown>,
    );
  }

  function handleClearBoard() {
    setStrokes([]);
    void sendBroadcast("whiteboard-clear", {});
  }

  async function leaveRoom() {
    if (isHost) {
      await atualizarStatusReuniao(meeting.id, "encerrada").catch(() => undefined);
      await sendBroadcast("meeting-ended", {});
    }
    await sairDaReuniaoTreinamento(meeting.id).catch(() => undefined);
    onLeave();
  }

  async function copyMeetingLink() {
    await navigator.clipboard.writeText(
      `${window.location.origin}/admin/centro-treinamento/sala-reuniao/${meeting.id}`,
    );
    setIsCopied(true);
    window.setTimeout(() => setIsCopied(false), 1800);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              {meeting.titulo}
            </h1>
            <Badge className="border-emerald-300/25 bg-emerald-300/10 text-emerald-200">
              {formatMeetingStatus(meeting.status)}
            </Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            {meeting.descricao || "Sala aberta para treinamento da equipe."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white"
          onClick={copyMeetingLink}
        >
          {isCopied ? (
            <Check className="size-4 text-emerald-300" />
          ) : (
            <Copy className="size-4" />
          )}
          {isCopied ? "Link copiado" : "Copiar convite"}
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {currentParticipants.map((participant) => (
              <VideoTile
                key={participant.userId}
                stream={participant.stream}
                label={participant.nome}
                muted={participant.userId === userId}
                isHost={participant.isHost}
                cameraOn={participant.cameraOn}
              />
            ))}
            {currentParticipants.length === 0 && (
              <Card className="border-slate-700 bg-slate-900/60">
                <CardContent className="py-12 text-center text-sm text-slate-400">
                  Aguardando participantes…
                </CardContent>
              </Card>
            )}
          </div>

          {isHost && screenStream && (
            <div className="overflow-hidden rounded-2xl border border-amber-300/30 bg-amber-300/[0.04]">
              <div className="flex items-center gap-2 border-b border-amber-300/20 px-4 py-3 text-sm font-medium text-amber-100">
                <MonitorUp className="size-4" /> Pré-visualização da tela
                compartilhada
              </div>
              <video
                ref={(node) => {
                  if (node) node.srcObject = screenStream;
                }}
                autoPlay
                playsInline
                muted
                className="aspect-video w-full bg-black object-contain"
              />
            </div>
          )}

          <Whiteboard
            strokes={strokes}
            canEdit={isHost}
            onStroke={handleStroke}
            onClear={handleClearBoard}
          />
        </section>

        <aside className="space-y-4">
          <Card className="border-slate-700/80 bg-slate-900/75 text-slate-100">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Users className="size-4 text-amber-300" /> Participantes
                </div>
                <span className="text-xs text-slate-400">
                  {currentParticipants.length} online
                </span>
              </div>
              <Separator className="bg-slate-700" />
              <div className="space-y-3">
                {currentParticipants.map((participant) => (
                  <div
                    key={participant.userId}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-amber-200">
                        {participant.nome.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {participant.nome}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {participant.isHost
                            ? "Administração da sala"
                            : "Participante"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-slate-400">
                      {participant.microphoneOn ? (
                        <Volume2 className="size-3.5" />
                      ) : (
                        <MicOff className="size-3.5 text-rose-300" />
                      )}
                      {participant.cameraOn ? (
                        <Camera className="size-3.5" />
                      ) : (
                        <CameraOff className="size-3.5 text-rose-300" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-700/80 bg-slate-900/75 text-slate-100">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Cast className="size-4 text-amber-300" /> Recursos da sala
              </div>
              <p className="text-xs leading-5 text-slate-400">
                A câmera pode ser desativada individualmente. O host controla o
                compartilhamento de tela e os desenhos na lousa.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge className="border-slate-700 bg-slate-800 text-slate-300">
                  {isConnected ? "Realtime conectado" : "Conectando…"}
                </Badge>
                {isHost && (
                  <Badge className="border-amber-300/20 bg-amber-300/10 text-amber-200">
                    Você é o host
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      {connectionError && (
        <p className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          {connectionError}
        </p>
      )}

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-slate-700/80 bg-slate-950/95 p-3 shadow-2xl shadow-slate-950/40 backdrop-blur">
        <Button
          type="button"
          variant="outline"
          className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
          onClick={() => void toggleMicrophone()}
        >
          {microphoneOn ? (
            <Mic className="size-4" />
          ) : (
            <MicOff className="size-4 text-rose-300" />
          )}
          {microphoneOn ? "Microfone" : "Microfone desligado"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
          onClick={() => void toggleCamera()}
        >
          {cameraOn ? (
            <Camera className="size-4" />
          ) : (
            <CameraOff className="size-4 text-rose-300" />
          )}
          {cameraOn ? "Câmera" : "Câmera desligada"}
        </Button>
        {isHost && (
          <Button
            type="button"
            variant="outline"
            className={`border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 ${screenStream ? "border-amber-300/50 text-amber-100" : ""}`}
            onClick={() => void toggleScreenShare()}
          >
            <ScreenShare className="size-4" />
            {screenStream ? "Parar compartilhamento" : "Compartilhar tela"}
          </Button>
        )}
        <Button
          type="button"
          className="bg-rose-600 text-white hover:bg-rose-500"
          onClick={() => void leaveRoom()}
        >
          <PhoneOff className="size-4" />
          {isHost ? "Encerrar reunião" : "Sair da sala"}
        </Button>
      </div>
    </div>
  );
}
