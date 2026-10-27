export function WhatsappGlyph({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2a9.9 9.9 0 0 0-8.43 15.1L2 22l5.05-1.32A9.9 9.9 0 1 0 12.04 2Zm0 1.8a8.1 8.1 0 1 1-4.2 15.03l-.3-.18-2.99.78.8-2.92-.2-.31A8.1 8.1 0 0 1 12.04 3.8Zm-3.2 4.2c-.17 0-.45.06-.69.32-.24.26-.9.88-.9 2.15 0 1.26.92 2.48 1.05 2.65.13.17 1.78 2.83 4.4 3.85 2.17.85 2.62.68 3.09.64.47-.04 1.52-.62 1.73-1.22.21-.6.21-1.11.15-1.22-.06-.11-.23-.17-.49-.3-.26-.13-1.52-.75-1.75-.83-.24-.09-.4-.13-.58.13-.17.26-.67.83-.82 1-.15.17-.3.2-.56.07-.26-.13-1.1-.4-2.1-1.3-.77-.69-1.3-1.55-1.45-1.8-.15-.26-.02-.4.11-.53.12-.12.26-.3.39-.45.13-.15.17-.26.26-.43.09-.17.04-.32-.02-.45-.06-.13-.58-1.4-.8-1.92-.2-.5-.42-.43-.58-.44h-.5Z" />
    </svg>
  );
}

// Cartão "Grupo do curso" no topo das aulas: o link só chega para quem tem acesso ativo ao curso (regra do banco, SQL 60).
export default function GroupInvite({ url }) {
  if (!url) return null;
  return (
    <div className="mb-group">
      <span className="mb-group-icon"><WhatsappGlyph size={24} /></span>
      <div className="mb-group-text">
        <strong>Grupo do curso no WhatsApp</strong>
        <small>Avisos, links dos encontros e conversa com a turma.</small>
      </div>
      <a className="mb-btn is-small mb-group-btn" href={url} target="_blank" rel="noopener noreferrer">Entrar no grupo</a>
    </div>
  );
}
