import { getDatabase } from '@netlify/database';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const json = (body, status=200) => new Response(JSON.stringify(body), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const hashPassword = (password, salt) => scryptSync(password, salt, 32).toString('hex');
const safeEq = (a,b) => { try { const A=Buffer.from(a,'hex'), B=Buffer.from(b,'hex'); return A.length===B.length && timingSafeEqual(A,B); } catch { return false; } };
const adminOK = (p) => !!process.env.ADMIN_BOARD_PASSWORD && p === process.env.ADMIN_BOARD_PASSWORD;
const clean = (v,max=5000) => String(v ?? '').trim().slice(0,max);

export default async (req) => {
  const db = getDatabase();
  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'list';
  try {
    if (req.method === 'GET' && action === 'list') {
      const rows = await db.sql`SELECT id, subject, region, status, created_at FROM inquiries ORDER BY id DESC LIMIT 100`;
      return json(rows);
    }
    if (req.method !== 'POST') return json({error:'Method not allowed'},405);
    const body = await req.json();
    if (action === 'create') {
      const subject=clean(body.subject,120), nameCompany=clean(body.nameCompany,120), contact=clean(body.contact,80), region=clean(body.region,80), message=clean(body.message,10000), password=String(body.password||'');
      if (!subject || !nameCompany || !contact || !message || password.length < 4) return json({error:'필수 항목과 4자리 이상의 비밀번호를 확인해주세요.'},400);
      let attachmentName=null, attachmentType=null, attachmentBase64=null;
      if (body.attachment?.data) {
        attachmentName=clean(body.attachment.name,180); attachmentType=clean(body.attachment.type,100); attachmentBase64=String(body.attachment.data);
        if (attachmentBase64.length > 4_200_000) return json({error:'첨부파일은 3MB 이하만 가능합니다.'},400);
      }
      const salt=randomBytes(16).toString('hex'), passHash=hashPassword(password,salt);
      const [row] = await db.sql`INSERT INTO inquiries (subject,name_company,contact,region,message,password_salt,password_hash,attachment_name,attachment_type,attachment_base64) VALUES (${subject},${nameCompany},${contact},${region},${message},${salt},${passHash},${attachmentName},${attachmentType},${attachmentBase64}) RETURNING id`;
      return json({ok:true,id:row.id},201);
    }
    const id=Number(body.id); if (!Number.isInteger(id)||id<1) return json({error:'잘못된 글 번호입니다.'},400);
    const rows=await db.sql`SELECT * FROM inquiries WHERE id=${id}`; const row=rows[0]; if(!row) return json({error:'문의글을 찾을 수 없습니다.'},404);
    const password=String(body.password||''); const allowed=adminOK(password)||safeEq(hashPassword(password,row.password_salt),row.password_hash);
    if(!allowed) return json({error:'비밀번호가 맞지 않습니다.'},403);
    if(action==='view') {
      return json({id:row.id,subject:row.subject,nameCompany:row.name_company,contact:row.contact,region:row.region,message:row.message,status:row.status,adminReply:row.admin_reply,createdAt:row.created_at,answeredAt:row.answered_at,attachment:row.attachment_base64?{name:row.attachment_name,type:row.attachment_type,data:row.attachment_base64}:null,isAdmin:adminOK(password)});
    }
    if(action==='reply') {
      if(!adminOK(password)) return json({error:'관리자 비밀번호가 필요합니다.'},403);
      const reply=clean(body.reply,10000); if(!reply) return json({error:'답변 내용을 입력해주세요.'},400);
      await db.sql`UPDATE inquiries SET admin_reply=${reply}, status='ANSWERED', answered_at=NOW() WHERE id=${id}`;
      return json({ok:true});
    }
    return json({error:'Unknown action'},400);
  } catch (e) { console.error(e); return json({error:'서버 처리 중 오류가 발생했습니다.'},500); }
};

export const config = { path: '/api/board' };
