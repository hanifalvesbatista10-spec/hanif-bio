import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase";

export default function UsersPage(){
 const [rows,setRows]=useState([]); const [message,setMessage]=useState("");
 const load=async()=>{const {data,error}=await supabase.from("profiles").select("id,full_name,email,phone,role,account_status,created_at,last_access").order("created_at",{ascending:false}); if(error)setMessage(error.message);else setRows(data||[])};
 useEffect(()=>{load()},[]);
 const update=async(id,patch)=>{const {error}=await supabase.from("profiles").update(patch).eq("id",id); if(error)setMessage(error.message);else{setMessage("Usuário atualizado.");load()}};
 return <section className="admin-section"><div className="admin-section-head"><div><span>ACESSO</span><h2>Usuários</h2></div></div>{message&&<div className="admin-alert">{message}</div>}<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Nome</th><th>E-mail</th><th>Função</th><th>Status</th><th>Cadastro</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><strong>{r.full_name||"Sem nome"}</strong><small>{r.phone||""}</small></td><td>{r.email}</td><td><select value={r.role} onChange={e=>update(r.id,{role:e.target.value})}><option value="student">Aluno</option><option value="user">Usuário</option><option value="admin">Administrador</option></select></td><td><select value={r.account_status} onChange={e=>update(r.id,{account_status:e.target.value})}><option value="active">Ativo</option><option value="blocked">Bloqueado</option><option value="inactive">Inativo</option></select></td><td>{new Date(r.created_at).toLocaleDateString("pt-BR")}</td></tr>)}</tbody></table></div></section>
}
