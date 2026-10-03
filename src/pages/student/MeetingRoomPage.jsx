import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { memberIcons as icons } from "../../components/member/MemberIcons";
import { supabase } from "../../services/supabase";
import { getMeetingUrl } from "../../services/meeting";
import "../../styles/member-area.css";

export default function MeetingRoomPage() {
  const { meetingId } = useParams();
  const [meeting, setMeeting] = useState(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from("live_meetings").select("id,title,product_id").eq("id", meetingId).maybeSingle(),
      getMeetingUrl(meetingId).catch((err) => ({ error: err.message })),
    ]).then(([meetingResult, room]) => {
      if (!active) return;
      if (meetingResult.data) setMeeting(meetingResult.data);
      if (room.error) setError(room.error);
      else setUrl(room.url);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [meetingId]);

  return (
    <div className="mb-page is-wide">
      <div className="mb-crumb">
        <Link to={meeting ? `/minha-area/curso/${meeting.product_id}` : "/minha-area"}>{icons.arrowLeft} Voltar ao curso</Link>
      </div>
      <div className="mb-page-head is-tight">
        <h1>{meeting?.title || "Encontro ao vivo"}</h1>
      </div>

      {loading && <div className="mb-alert" role="status">Abrindo a sala...</div>}
      {error && <div className="mb-alert" role="alert">{error}</div>}
      {url && (
        <iframe
          title={meeting?.title || "Encontro ao vivo"}
          src={url}
          allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
          style={{ width: "100%", height: "78vh", minHeight: 480, border: 0, borderRadius: 16, background: "#0b1220" }}
        />
      )}
    </div>
  );
}
