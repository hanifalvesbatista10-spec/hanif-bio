import { useSearchParams } from "react-router-dom";
import MyDataForm from "../../components/member/MyDataForm";
import SecurityCard from "../../components/member/SecurityCard";

const TABS = [
  { id: "dados", label: "Meus dados" },
  { id: "seguranca", label: "Segurança" },
];

// Configurações da conta do aluno, em abas: Meus dados e Segurança (?aba=dados | seguranca).
export default function StudentProfilePage() {
  const [params, setParams] = useSearchParams();
  const active = TABS.some((tab) => tab.id === params.get("aba")) ? params.get("aba") : "dados";

  const select = (id) => setParams({ aba: id }, { replace: true });

  const onKey = (event) => {
    const index = TABS.findIndex((tab) => tab.id === active);
    let nextIndex = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % TABS.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + TABS.length) % TABS.length;
    if (nextIndex === null) return;
    event.preventDefault();
    select(TABS[nextIndex].id);
    document.getElementById(`mb-tab-${TABS[nextIndex].id}`)?.focus();
  };

  return (
    <div className="mb-page is-narrow">
      <div className="mb-page-head">
        <h1>Configurações</h1>
        <p>Seus dados pessoais e o acesso à sua conta.</p>
      </div>

      <div className="mb-tabs" role="tablist" aria-label="Configurações" onKeyDown={onKey}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`mb-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            aria-controls={`mb-panel-${tab.id}`}
            tabIndex={active === tab.id ? 0 : -1}
            className={`mb-tabs-btn${active === tab.id ? " is-active" : ""}`}
            onClick={() => select(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div id={`mb-panel-${active}`} role="tabpanel" aria-labelledby={`mb-tab-${active}`}>
        {active === "dados" ? <MyDataForm /> : <SecurityCard />}
      </div>
    </div>
  );
}
