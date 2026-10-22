import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { memberIcons as icons } from "../../components/member/MemberIcons";
import { supabase } from "../../services/supabase";
import { getMeetingUrl } from "../../services/meeting";
import { markMeetingAttendance, presenceWindow } from "../../services/attendance";
import "../../styles/member-area.css";

export default function MeetingRoomPage() {
  const { meetingId } = useParams();
  const [meeting, setMeeting] = useState(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [marked, setMarked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [presenceError, setPresenceError] = useState("");

  const markPresence = async () => {
    setBusy(true);
    setPresenceError("");
    const result = await markMeetingAttendance(meetingId);
    if (result.error) setPresenceError(result.error);
    else setMarked(true);
    setBusy(false);
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from("live_meetings").select("id,title,product_id,starts_at,duration_minutes,ended_at,meet_url").eq("id", meetingId).maybeSingle(),
      supabase.from("meeting_attendance").select("meeting_id").eq("meeting_id", meetingId).maybeSingle(),
    ]).then(async ([meetingResult, attendance]) => {
      if (!active) return;
      if (attendance?.data) setMarked(true);
      if (meetingResult.data) setMeeting(meetingResult.data);
      // encontro com link do Meet: não existe sala dentro do site, só o botão para abrir o Meet
      const room = meetingResult.data?.meet_url ? { external: true } : await getMeetingUrl(meetingId).catch((err) => ({ error: err.message }));
      if (!active) return;
      if (room.error) setError(room.error);
      else if (!room.external) setUrl(room.url);
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

      {meeting && (marked || presenceWindow(meeting) === "open") && (
        <div className="mb-alert mb-presence-bar" role="status">
          {marked ? (
            <span className="mb-presence-ok">✓ Presença registrada neste encontro</span>
          ) : (
            <>
              <span>Estando no encontro, marque a sua presença (vale para o certificado).</span>
              <button type="button" className="mb-btn" onClick={markPresence} disabled={busy}>{busy ? "Marcando..." : "Marcar minha presença"}</button>
            </>
          )}
          {presenceError && <span className="mb-pdf-error" role="alert">{presenceError}</span>}
        </div>
      )}

      {meeting?.meet_url && (
        <div className="mb-alert" role="status">
          <strong>Este encontro acontece no Google Meet.</strong>
          <p style={{ margin: "6px 0 10px" }}>O Meet abre em uma nova aba. Depois de entrar, volte aqui para marcar a sua presença.</p>
          <a className="mb-btn" href={meeting.meet_url} target="_blank" rel="noopener noreferrer">Abrir o Meet</a>
        </div>
      )}

      {loading && !meeting?.meet_url && <div className="mb-alert" role="status">Abrindo a sala...</div>}
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
