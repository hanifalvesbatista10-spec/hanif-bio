import MyCertificates from "../../components/member/MyCertificates";

export default function StudentCertificatesPage() {
  return (
    <div className="mb-page">
      <div className="mb-page-head">
        <h1>Certificados</h1>
        <p>Baixe o PDF ou envie o código para quem precisa conferir que o certificado é verdadeiro.</p>
      </div>
      <MyCertificates />
    </div>
  );
}
